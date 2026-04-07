import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {
  Subject,
  catchError,
  of,
  forkJoin,
  takeUntil,
} from 'rxjs';
import { Router } from '@angular/router';
import { ApiClient, getApiErrorMessage } from '../../core/api/api-client.service';
import type {
  AccountRow,
  CreateJournalInvoiceBody,
  EmployeeRow,
} from '../../core/api/api.types';

@Component({
  selector: 'app-invoice',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './invoice.component.html',
  styleUrls: ['./invoice.component.css'],
})
export class InvoiceComponent implements OnDestroy {
  private readonly api = inject(ApiClient);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  /** Emits when component is destroyed — used to cancel all subscriptions */
  private readonly destroy$ = new Subject<void>();

  invoiceForm: FormGroup;
  assetAccounts: AccountRow[] = [];
  expenseAccounts: AccountRow[] = [];
  employees: EmployeeRow[] = [];

  isLoadingAccounts = false;
  isLoadingEmployees = false;
  isSubmitting = false;

  /** Separate error channels so they don't overwrite each other */
  accountsError = '';
  employeesError = '';
  submitError = '';

  toastMessage = '';
  toastVisible = false;
  toastIsError = false;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.invoiceForm = this.fb.group({
      date: [this.getTodayDate(), Validators.required],
      payeeUserId: [''],
      manualFullName: [''],
      manualFirstName: [''],
      manualLastName: [''],
      entries: this.fb.array([]),
      description: ['', Validators.required],
    });

    this.addEntry();
    this.initDataStreams();
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.dismissToast();
  }

  // ─── Form helpers ─────────────────────────────────────────────────────────

  get entries(): FormArray {
    return this.invoiceForm.get('entries') as FormArray;
  }

  get totalAmount(): number {
    return this.entries.controls.reduce((sum, c) => sum + Number(c.get('amount')?.value || 0), 0);
  }

  get isBalanced(): boolean {
    return this.totalAmount > 0;
  }

  addEntry(): void {
    this.entries.push(
      this.fb.group(
        {
          fromAccountId: ['', Validators.required],
          reasonAccountId: ['', Validators.required],
          amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
        },
        { validators: this.accountsMustBeDifferentValidator() },
      ),
    );
  }

  removeEntry(index: number): void {
    this.entries.removeAt(index);
  }

  // ─── Data streams (the core fix) ─────────────────────────────────────────

  /**
   * Accounts + Employees load in parallel, once, on init.
   */
  private initDataStreams(): void {
    // 1. Accounts & Employees — parallel, independent, fire-and-forget on init
    this.loadAccountsAndEmployees();

  }

  /** Loads accounts and employees in true parallel. */
  private loadAccountsAndEmployees(): void {
    this.isLoadingAccounts = true;
    this.isLoadingEmployees = true;
    this.accountsError = '';
    this.employeesError = '';

    forkJoin({
      accounts: this.api.getAccounts().pipe(
        catchError((err) => {
          this.accountsError = getApiErrorMessage(err) || 'Failed to load chart of accounts.';
          return of({ accounts: [] as AccountRow[] });
        }),
      ),
      employees: this.api.getEmployees().pipe(
        catchError((err) => {
          this.employeesError = getApiErrorMessage(err) || 'Failed to load employees.';
          return of({ employees: [] as EmployeeRow[] });
        }),
      ),
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe(({ accounts, employees }) => {
      this.assetAccounts = accounts.accounts.filter((a) => a.type === 'asset');
      this.expenseAccounts = accounts.accounts.filter((a) => a.type === 'expense');
      this.employees = employees.employees;
      this.isLoadingAccounts = false;
      this.isLoadingEmployees = false;
    })
  }

  /** Public entry for template — reloads chart of accounts and employees. */
  reloadAccounts(): void {
    this.loadAccountsAndEmployees();
  }

  openPostedInvoicesPage(): void {
    const uidRaw = this.invoiceForm.get('payeeUserId')?.value;
    const queryParams = uidRaw !== '' && uidRaw != null ? { userId: String(uidRaw) } : {};
    void this.router.navigate(['/payments/posted-journal-invoices'], { queryParams });
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async onSubmit(): Promise<void> {
    this.submitError = '';
    this.dismissToast();

    if (this.entries.length === 0) {
      this.submitError = 'Add at least one entry before saving.';
      return;
    }

    const payeeErr = this.validatePayee();
    if (payeeErr) {
      this.submitError = payeeErr;
      this.invoiceForm.markAllAsTouched();
      return;
    }

    if (this.invoiceForm.invalid) {
      this.submitError = 'Please fill all required fields (Date, From, Reason, Amount, Description).';
      this.invoiceForm.markAllAsTouched();
      return;
    }

    if (!this.isBalanced) {
      this.submitError = 'Total amount must be greater than zero.';
      return;
    }

    const date = String(this.invoiceForm.get('date')?.value ?? '');
    const description = String(this.invoiceForm.get('description')?.value ?? '').trim();
    const body = this.buildJournalBody(date, description);

    this.isSubmitting = true;
    try {
      const res = await import('rxjs').then(({ firstValueFrom }) =>
        firstValueFrom(this.api.createJournalInvoice(body)),
      );
      const ref = res.invoice?.reference ?? res.invoice?.journalEntryId ?? '';
      this.showToast(`Journal saved${ref ? ` (${ref})` : ''}.`, false);
      this.entries.clear();
      this.addEntry();
      this.invoiceForm.patchValue({ description: '' });
    } catch (err) {
      this.submitError = getApiErrorMessage(err) || 'Failed to save journal invoice.';
    } finally {
      this.isSubmitting = false;
    }
  }

  // ─── Validation & body builders ───────────────────────────────────────────

  private validatePayee(): string | null {
    return this.getPayeeValidationError(this.invoiceForm);
  }

  private getPayeeValidationError(formGroup: FormGroup): string | null {
    const uidRaw = formGroup.get('payeeUserId')?.value;
    const hasUserId = uidRaw !== '' && uidRaw != null;
    const fullName = String(formGroup.get('manualFullName')?.value ?? '').trim();
    const first = String(formGroup.get('manualFirstName')?.value ?? '').trim();
    const last = String(formGroup.get('manualLastName')?.value ?? '').trim();

    if (hasUserId) {
      return (fullName || first || last)
        ? 'Use either an employee from the list or manual name fields, not both.'
        : null;
    }
    if (fullName) return null;
    if (first && last) return null;
    if (first || last) return 'Enter both first and last name, or use full name, or pick an employee.';

    return null;
  }

  private buildJournalBody(date: string, description: string): CreateJournalInvoiceBody {
    const uidRaw = this.invoiceForm.get('payeeUserId')?.value;
    const hasUserId = uidRaw !== '' && uidRaw != null;
    const fullName = String(this.invoiceForm.get('manualFullName')?.value ?? '').trim();
    const firstName = String(this.invoiceForm.get('manualFirstName')?.value ?? '').trim();
    const lastName = String(this.invoiceForm.get('manualLastName')?.value ?? '').trim();

    const entries = this.entries.controls.map((c) => ({
      fromAccountId: String(c.get('fromAccountId')?.value ?? ''),
      reasonAccountId: String(c.get('reasonAccountId')?.value ?? ''),
      amount: Number(c.get('amount')?.value),
    }));

    const body: CreateJournalInvoiceBody = { date, description, entries };

    if (hasUserId) body.userId = Number(uidRaw);
    else if (fullName) body.fullName = fullName;
    else if (firstName && lastName) { body.firstName = firstName; body.lastName = lastName; }

    return body;
  }

  private accountsMustBeDifferentValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const from = control.get('fromAccountId')?.value;
      const reason = control.get('reasonAccountId')?.value;
      return from && reason && String(from) === String(reason) ? { sameAccount: true } : null;
    };
  }

  // ─── Toast ────────────────────────────────────────────────────────────────

  private showToast(message: string, isError: boolean): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage = message;
    this.toastIsError = isError;
    this.toastVisible = true;
    this.toastTimer = setTimeout(() => { this.toastVisible = false; }, 4500);
  }

  dismissToast(): void {
    if (this.toastTimer) { clearTimeout(this.toastTimer); this.toastTimer = null; }
    this.toastVisible = false;
  }

  private getTodayDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

