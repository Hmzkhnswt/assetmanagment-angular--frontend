import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiClient, getApiErrorMessage } from '../../core/api/api-client.service';
import { getApiFieldErrors } from '../../core/api/api-error.utils';
import type { AccountRow, BalanceTransactionRow } from '../../core/api/api.types';

type EntryRow = {
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  runningBalance: number;
};

@Component({
  selector: 'app-journal-entries-report',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './journal-entries-report.html',
  styleUrls: ['./journal-entries-report.css'],
})
export class JournalEntriesReportComponent {
  private readonly api = inject(ApiClient);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly filterForm: FormGroup = this.fb.group({
    from: [this.getFirstDayOfMonth()],
    to: [this.getTodayDate()],
    accountId: [''],
  });

  isLoading = false;
  errorMessage = '';
  accountIdFieldError = '';
  accountOptions: AccountRow[] = [];
  rows: EntryRow[] = [];
  selectedAccount: AccountRow | null = null;

  constructor() {
    this.loadInitialData();
  }

  runReport(): void {
    this.errorMessage = '';
    this.accountIdFieldError = '';
    const selectedAccountId = this.getValidAccountId();
    if (!selectedAccountId) {
      this.errorMessage = 'Please select a valid account.';
      this.accountIdFieldError = 'Please select a valid account.';
      this.rows = [];
      return;
    }

    this.isLoading = true;

    this.api
      .getBalanceAccountTransactions(selectedAccountId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          this.applyFieldError(err);
          this.errorMessage = getApiErrorMessage(err) || 'Failed to load journal entries.';
          return of(null);
        }),
      )
      .subscribe((response) => {
        this.isLoading = false;
        if (!response) {
          this.rows = [];
          this.cdr.detectChanges();
          return;
        }

        this.selectedAccount = this.accountOptions.find((a) => a.id === selectedAccountId) ?? null;
        this.rows = this.buildStatementRows(this.normalizeTransactions(response));
        this.cdr.detectChanges();
      });
  }

  closingBalanceLabel(): string {
    if (this.rows.length === 0 || !this.selectedAccount) return '0.00';
    const last = this.rows[this.rows.length - 1];
    return `${Math.abs(last.runningBalance).toFixed(2)} ${last.runningBalance >= 0 ? 'Dr' : 'Cr'}`;
  }

  private loadInitialData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      assetAccounts: this.api.getAssetAccounts().pipe(
        catchError((err) => {
          this.errorMessage = getApiErrorMessage(err) || 'Failed to load accounts.';
          return of({ accounts: [] as AccountRow[] });
        }),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ assetAccounts }) => {
        this.accountOptions = assetAccounts.accounts ?? [];
        if (!this.filterForm.get('accountId')?.value && this.accountOptions.length > 0) {
          this.filterForm.patchValue({ accountId: this.accountOptions[0].id }, { emitEvent: false });
        }
        this.selectedAccount = null;
        this.rows = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      });
  }

  private buildStatementRows(transactions: BalanceTransactionRow[]): EntryRow[] {
    const from = String(this.filterForm.get('from')?.value ?? '');
    const to = String(this.filterForm.get('to')?.value ?? '');
    const accountType = String(this.selectedAccount?.type ?? '').toLowerCase();

    const filtered = transactions
      .filter((tx) => this.isInDateRange(this.resolveDate(tx), from, to))
      .sort((a, b) => this.resolveDate(a).localeCompare(this.resolveDate(b)));

    let running = 0;
    return filtered.map((tx) => {
      const debit = Number(tx.debit ?? 0);
      const credit = Number(tx.credit ?? 0);
      // Normal balance rule: assets/expenses are Dr-normal; others Cr-normal.
      running += accountType === 'asset' || accountType === 'expense' ? debit - credit : credit - debit;

      return {
        date: this.resolveDate(tx),
        description: String(tx.description ?? ''),
        reference: String(tx.reference ?? ''),
        debit,
        credit,
        runningBalance: running,
      };
    });
  }

  private normalizeTransactions(value: unknown): BalanceTransactionRow[] {
    if (Array.isArray(value)) return value as BalanceTransactionRow[];
    if (!value || typeof value !== 'object') return [];
    const o = value as Record<string, unknown>;
    for (const key of ['transactions', 'rows', 'data', 'items']) {
      const arr = o[key];
      if (Array.isArray(arr)) return arr as BalanceTransactionRow[];
    }
    return [];
  }

  private resolveDate(tx: BalanceTransactionRow): string {
    const raw = String(tx.date ?? tx.entryDate ?? '');
    const datePart = raw.split('T')[0];
    return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : this.getTodayDate();
  }

  private isInDateRange(date: string, from: string, to: string): boolean {
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }

  private getValidAccountId(): string | null {
    const accountId = String(this.filterForm.get('accountId')?.value ?? '').trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(accountId) ? accountId : null;
  }

  private applyFieldError(err: unknown): void {
    const firstFieldError = getApiFieldErrors(err)[0];
    if (!firstFieldError?.message) return;
    if (firstFieldError.path.toLowerCase().includes('account')) {
      this.accountIdFieldError = firstFieldError.message;
    }
  }

  private getTodayDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private getFirstDayOfMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }
}
