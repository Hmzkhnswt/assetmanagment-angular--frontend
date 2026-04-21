import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
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
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiClient, getApiErrorMessage } from '../../core/api/api-client.service';
import { applyApiValidationErrors, clearServerErrors } from '../../core/api/api-error.utils';
import type {
  AccountRow,
  EmployeeRow,
  InvoiceLineDetail,
  JournalEntryLineInput,
  JournalInvoiceDetailResponse,
  JournalListItem,
  UpdateJournalInvoiceBody,
} from '../../core/api/api.types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-posted-journal-invoices',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  templateUrl: './posted-journal-invoices.html',
  styleUrls: ['./posted-journal-invoices.css'],
})
export class PostedJournalInvoicesComponent implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  assetAccounts: AccountRow[] = [];
  expenseAccounts: AccountRow[] = [];
  employees: EmployeeRow[] = [];
  journalInvoices: JournalListItem[] = [];

  selectedInvoice: JournalListItem | null = null;
  isEditing = false;
  isLoadingSupport = false;
  isLoadingList = false;
  isLoadingDetail = false;
  isUpdating = false;

  accountsError = '';
  employeesError = '';
  listError = '';
  detailError = '';
  submitError = '';

  editForm: FormGroup = this.fb.group({
    date: [this.getTodayDate(), Validators.required],
    description: ['', Validators.required],
    entries: this.fb.array([]),
  });

  ngOnInit(): void {
    this.loadSupportData();
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const userId = params.get('userId');
        this.loadList(userId ? Number(userId) : undefined);
      });
  }

  get entries(): FormArray {
    return this.editForm.get('entries') as FormArray;
  }

  addEntry(prefill?: Partial<JournalEntryLineInput>): void {
    this.entries.push(
      this.fb.group(
        {
          fromAccountId: [prefill?.fromAccountId ?? '', [Validators.required, this.uuidValidator()]],
          reasonAccountId: [prefill?.reasonAccountId ?? '', [Validators.required, this.uuidValidator()]],
          amount: [prefill?.amount ?? null, [Validators.required, Validators.min(0.01)]],
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

  openEditor(invoice: JournalListItem): void {
    this.selectedInvoice = invoice;
    this.isEditing = true;
    this.loadInvoiceDetail(invoice.journalEntryId);
    setTimeout(() => {
      document.getElementById('posted-journal-invoice-editor')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  }

  closeEditor(): void {
    this.isEditing = false;
    this.selectedInvoice = null;
    this.detailError = '';
    this.submitError = '';
    clearServerErrors(this.editForm);
    this.entries.clear();
    this.editForm.reset({ date: this.getTodayDate(), description: '' });
  }

  async save(): Promise<void> {
    if (!this.selectedInvoice) return;
    this.submitError = '';

    if (this.entries.length === 0) {
      this.submitError = 'At least one entry is required.';
      return;
    }
    if (this.editForm.invalid) {
      this.submitError = 'Please fill all required fields and correct any errors.';
      this.editForm.markAllAsTouched();
      return;
    }

    const payload: UpdateJournalInvoiceBody = {
      date: String(this.editForm.get('date')?.value ?? '').trim() || undefined,
      description: String(this.editForm.get('description')?.value ?? '').trim(),
      entries: this.entries.controls.map((control) => ({
        fromAccountId: String(control.get('fromAccountId')?.value ?? ''),
        reasonAccountId: String(control.get('reasonAccountId')?.value ?? ''),
        amount: Number(control.get('amount')?.value),
      })),
    };

    if (!payload.description) {
      this.submitError = 'Description is required.';
      return;
    }

    this.isUpdating = true;
    try {
      await firstValueFrom(
        this.api.updateJournalInvoice(this.selectedInvoice.journalEntryId, payload),
      );
      this.closeEditor();
      // Re-read current userId filter from query params
      const userId = this.route.snapshot.queryParamMap.get('userId');
      this.loadList(userId ? Number(userId) : undefined);
    } catch (err) {
      applyApiValidationErrors(this.editForm, err, {
        sourceAccountId: 'entries.0.fromAccountId',
        expenseAccountId: 'entries.0.reasonAccountId',
      });
      this.submitError = getApiErrorMessage(err) || 'Failed to update invoice.';
    } finally {
      this.isUpdating = false;
      this.cdr.detectChanges();
    }
  }

  addInvoice(): void {
    void this.router.navigate(['/payments/invoices/new']);
  }

  // ── Private: data loading ───────────────────────────────────────────────────

  private loadSupportData(): void {
    this.isLoadingSupport = true;
    this.accountsError = '';
    this.employeesError = '';

    forkJoin({
      assetAccounts: this.api.getAssetAccounts().pipe(
        catchError((err) => {
          this.accountsError = getApiErrorMessage(err) || 'Failed to load asset accounts.';
          return of({ accounts: [] as AccountRow[] });
        }),
      ),
      expenseAccounts: this.api.getExpenseAccounts().pipe(
        catchError((err) => {
          if (!this.accountsError) {
            this.accountsError = getApiErrorMessage(err) || 'Failed to load expense accounts.';
          }
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
      .subscribe(({ assetAccounts, expenseAccounts, employees }) => {
        this.assetAccounts = assetAccounts.accounts;
        this.expenseAccounts = expenseAccounts.accounts;
        this.employees = employees.employees;
        this.isLoadingSupport = false;
        this.cdr.detectChanges();
      });
  }

  private loadList(userId?: number): void {
    this.listError = '';
    this.isLoadingList = true;

    this.api
      .listJournalInvoices(userId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          this.listError = getApiErrorMessage(err) || 'Failed to load posted invoices.';
          return of({ invoices: [] as JournalListItem[] });
        }),
      )
      .subscribe(({ invoices }) => {
        this.journalInvoices = invoices ?? [];
        this.isLoadingList = false;
        this.cdr.detectChanges();
      });
  }

  private loadInvoiceDetail(journalEntryId: string): void {
    this.detailError = '';
    this.submitError = '';
    this.isLoadingDetail = true;
    this.entries.clear();

    this.api
      .getJournalInvoiceDetail(journalEntryId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          this.detailError = getApiErrorMessage(err) || 'Failed to load invoice details.';
          return of(null);
        }),
      )
      .subscribe((res) => {
        this.isLoadingDetail = false;
        if (!res) {
          this.cdr.detectChanges();
          return;
        }
        try {
          this.patchDetail(res);
        } catch (err) {
          this.detailError = getApiErrorMessage(err) || 'Unexpected invoice detail shape.';
          this.entries.clear();
          this.addEntry();
        }
        this.cdr.detectChanges();
      });
  }

  // ── Private: form patching ──────────────────────────────────────────────────

  private patchDetail(res: JournalInvoiceDetailResponse | InvoiceLineDetail[]): void {
    const normalized = this.normalizeDetailResponse(res);
    const invoice = normalized.invoice ?? {};
    const dateRaw = (invoice.entryDate ?? invoice.date ?? this.getTodayDate()) as string;
    const description = String(invoice.description ?? this.selectedInvoice?.description ?? '').trim();

    this.editForm.patchValue({
      date: this.getDateInputValue(dateRaw),
      description,
    });

    const mappedEntries = this.extractEntries(normalized);
    if (mappedEntries.length === 0) {
      this.addEntry();
      return;
    }
    mappedEntries.forEach((entry) => this.addEntry(entry));
  }

  private normalizeDetailResponse(
    res: JournalInvoiceDetailResponse | InvoiceLineDetail[],
  ): JournalInvoiceDetailResponse {
    if (Array.isArray(res)) {
      return { invoice: {}, lines: res };
    }
    return {
      invoice: res.invoice ?? {},
      lines: Array.isArray(res.lines) ? res.lines : [],
      entries: Array.isArray(res.entries) ? res.entries : undefined,
    };
  }

  private extractEntries(res: JournalInvoiceDetailResponse): JournalEntryLineInput[] {
    if (Array.isArray(res.entries) && res.entries.length > 0) {
      return res.entries
        .map((e) => ({
          fromAccountId: String(e.fromAccountId ?? ''),
          reasonAccountId: String(e.reasonAccountId ?? ''),
          amount: Number(e.amount ?? 0),
        }))
        .filter((e) => !!e.fromAccountId && !!e.reasonAccountId && e.amount > 0);
    }

    const lines = Array.isArray(res.lines) ? res.lines : [];
    const credits = lines.filter((l) => Number(l.credit) > 0);
    const debits = lines.filter((l) => Number(l.debit) > 0);
    const entries: JournalEntryLineInput[] = [];
    const usedDebitIndexes = new Set<number>();

    for (const credit of credits) {
      const creditAmount = Number(credit.credit);
      const debitIdx = debits.findIndex(
        (debit, idx) => !usedDebitIndexes.has(idx) && Number(debit.debit) === creditAmount,
      );
      if (debitIdx < 0) continue;
      usedDebitIndexes.add(debitIdx);
      entries.push({
        fromAccountId: String(credit.accountId),
        reasonAccountId: String(debits[debitIdx].accountId),
        amount: creditAmount,
      });
    }
    return entries;
  }

  private accountsMustBeDifferentValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const from = control.get('fromAccountId')?.value;
      const reason = control.get('reasonAccountId')?.value;
      return from && reason && String(from) === String(reason) ? { sameAccount: true } : null;
    };
  }

  private uuidValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = String(control.value ?? '').trim();
      if (!value) return null;
      return UUID_REGEX.test(value) ? null : { uuid: true };
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private getDateInputValue(raw?: string): string {
    if (!raw) return this.getTodayDate();
    const datePart = raw.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return this.getTodayDate();
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }

  private getTodayDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
