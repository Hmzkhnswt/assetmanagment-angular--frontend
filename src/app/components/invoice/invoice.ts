import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
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
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ApiClient, getApiErrorMessage } from '../../core/api/api-client.service';
import type { AccountRow, CreateJournalInvoiceBody, EmployeeRow } from '../../core/api/api.types';

@Component({
  selector: 'app-invoice',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './invoice.component.html',
  styleUrls: ['./invoice.component.css'],
})
export class InvoiceComponent {
  private readonly api = inject(ApiClient);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  invoiceForm: FormGroup;
  assetAccounts: AccountRow[] = [];
  expenseAccounts: AccountRow[] = [];
  employees: EmployeeRow[] = [];

  isLoadingData = false;
  isSubmitting = false;

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
      entries: this.fb.array([]),
      description: ['', Validators.required],
    });

    this.addEntry();
    this.loadData();

    this.destroyRef.onDestroy(() => {
      if (this.toastTimer) clearTimeout(this.toastTimer);
    });
  }

  // ── Form helpers ────────────────────────────────────────────────────────────

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
    if (this.entries.length > 1) {
      this.entries.removeAt(index);
    }
  }

  // ── Data loading ────────────────────────────────────────────────────────────

  loadData(): void {
    this.isLoadingData = true;
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
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ accounts, employees }) => {
        this.assetAccounts = accounts.accounts.filter((a) => a.type === 'asset');
        this.expenseAccounts = accounts.accounts.filter((a) => a.type === 'expense');
        this.employees = employees.employees;
        this.isLoadingData = false;
        this.cdr.detectChanges();
      });
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  openPostedInvoicesPage(): void {
    const uidRaw = this.invoiceForm.get('payeeUserId')?.value;
    const queryParams = uidRaw !== '' && uidRaw != null ? { userId: String(uidRaw) } : {};
    void this.router.navigate(['/payments/posted-journal-invoices'], { queryParams });
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async onSubmit(): Promise<void> {
    this.submitError = '';
    this.dismissToast();

    if (this.entries.length === 0) {
      this.submitError = 'Add at least one entry before saving.';
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
      const res = await firstValueFrom(this.api.createJournalInvoice(body));
      const ref = res.invoice?.reference ?? res.invoice?.journalEntryId ?? '';
      this.showToast(`Journal saved${ref ? ` (${ref})` : ''}.`, false);
      this.entries.clear();
      this.addEntry();
      this.invoiceForm.patchValue({ description: '' });
    } catch (err) {
      this.submitError = getApiErrorMessage(err) || 'Failed to save journal invoice.';
    } finally {
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }

  // ── Builders & validators ───────────────────────────────────────────────────

  private buildJournalBody(date: string, description: string): CreateJournalInvoiceBody {
    const uidRaw = this.invoiceForm.get('payeeUserId')?.value;
    const hasUserId = uidRaw !== '' && uidRaw != null;

    const entries = this.entries.controls.map((c) => ({
      fromAccountId: String(c.get('fromAccountId')?.value ?? ''),
      reasonAccountId: String(c.get('reasonAccountId')?.value ?? ''),
      amount: Number(c.get('amount')?.value),
    }));

    const body: CreateJournalInvoiceBody = { date, description, entries };
    if (hasUserId) body.userId = Number(uidRaw);
    return body;
  }

  private accountsMustBeDifferentValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const from = control.get('fromAccountId')?.value;
      const reason = control.get('reasonAccountId')?.value;
      return from && reason && String(from) === String(reason) ? { sameAccount: true } : null;
    };
  }

  // ── Toast ───────────────────────────────────────────────────────────────────

  showToast(message: string, isError: boolean): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage = message;
    this.toastIsError = isError;
    this.toastVisible = true;
    this.toastTimer = setTimeout(() => {
      this.toastVisible = false;
      this.cdr.detectChanges();
    }, 4500);
  }

  dismissToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.toastVisible = false;
  }

  private getTodayDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
