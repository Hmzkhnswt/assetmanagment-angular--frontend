import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { catchError, forkJoin, of, Subject, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timeout } from 'rxjs/operators';
import { ApiClient, getApiErrorMessage } from '../../core/api/api-client.service';
import type {
  BalanceAccountRow,
  BalanceTransactionRow,
  EmployeeRow,
} from '../../core/api/api.types';

@Component({
  selector: 'app-assets-balances',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './assets-balances.component.html',
  styleUrls: ['./assets-balances.component.css'],
})
export class AssetsBalancesComponent {
  private readonly api = inject(ApiClient);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  /** Emits each time loadData() is called; switchMap cancels prior in-flight request. */
  private readonly loadData$ = new Subject<number>();

  filterForm: FormGroup;
  employees: EmployeeRow[] = [];

  isLoadingEmployees = false;
  isLoading = false;
  hasQueried = false;

  employeesError = '';
  errorMessage = '';

  recentTransactions: BalanceTransactionRow[] = [];
  balances: BalanceAccountRow[] = [];
  summaryByType: Record<string, number> | null = null;

  constructor() {
    this.filterForm = this.fb.group({ userId: [''] });

    // Wire up the data-load pipeline (switchMap auto-cancels stale requests)
    this.loadData$
      .pipe(
        tap(() => {
          this.isLoading = true;
          this.errorMessage = '';
          this.cdr.detectChanges();
        }),
        switchMap((userId) =>
          forkJoin({
            transactions: this.api.getBalancesTransactions(userId).pipe(
              timeout(15000),
              catchError((err) => {
                this.errorMessage = getApiErrorMessage(err) || 'Failed to load transactions.';
                return of(null);
              }),
            ),
            accounts: this.api.getBalancesAccounts(userId).pipe(
              timeout(15000),
              catchError((err) => {
                if (!this.errorMessage)
                  this.errorMessage = getApiErrorMessage(err) || 'Failed to load account balances.';
                return of(null);
              }),
            ),
            summary: this.api.getBalancesSummaryByType(userId).pipe(
              timeout(15000),
              catchError((err) => {
                if (!this.errorMessage)
                  this.errorMessage = getApiErrorMessage(err) || 'Failed to load balance summary.';
                return of(null);
              }),
            ),
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ transactions, accounts, summary }) => {
        this.recentTransactions = transactions ? this.normalizeTransactions(transactions) : [];
        this.balances = accounts ? this.normalizeAccounts(accounts) : [];
        this.summaryByType = summary ? this.normalizeSummary(summary) : null;
        this.isLoading = false;
        this.cdr.detectChanges();
      });

    // Load employees on init, then auto-select first & trigger data
    this.loadEmployees();
  }

  // ── Public API (template-facing) ────────────────────────────────────────────

  loadEmployees(): void {
    this.isLoadingEmployees = true;
    this.employeesError = '';

    this.api
      .getEmployees()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          this.employeesError = getApiErrorMessage(err) || 'Failed to load employees.';
          return of({ employees: [] as EmployeeRow[] });
        }),
      )
      .subscribe(({ employees }) => {
        this.employees = employees ?? [];
        this.isLoadingEmployees = false;

        const first = this.employees[0]?.userId;
        if (first != null && !this.filterForm.get('userId')?.value) {
          this.filterForm.patchValue({ userId: String(first) });
          this.triggerLoad();
        }
        this.cdr.detectChanges();
      });
  }

  loadData(): void {
    this.triggerLoad();
  }

  summaryEntries(): { key: string; value: number }[] {
    if (!this.summaryByType) return [];
    return Object.entries(this.summaryByType).map(([key, value]) => ({
      key,
      value: Number(value),
    }));
  }

  // ── Display helpers ─────────────────────────────────────────────────────────

  displayTxDate(row: BalanceTransactionRow): string {
    return String(row.date ?? row.entryDate ?? '—');
  }

  displayTxAccount(row: BalanceTransactionRow): string {
    return String(row.accountName ?? row.account ?? row.accountId ?? '—');
  }

  displayTxType(row: BalanceTransactionRow): string {
    return String(row.accountType ?? '—');
  }

  accountDisplayName(row: BalanceAccountRow): string {
    return String(row.accountName ?? row.account_name ?? '—');
  }

  accountTypeLabel(row: BalanceAccountRow): string {
    return String(row.accountType ?? row.account_type ?? '—');
  }

  accountBalance(row: BalanceAccountRow): number {
    return Number(row.balance ?? 0);
  }

  accountDebitTotal(row: BalanceAccountRow): number {
    return Number(row.totalDebit ?? row.total_debit ?? 0);
  }

  accountCreditTotal(row: BalanceAccountRow): number {
    return Number(row.totalCredit ?? row.total_credit ?? 0);
  }

  summaryIcon(key: string): string {
    const icons: Record<string, string> = {
      asset: 'fa-building',
      expense: 'fa-receipt',
      liability: 'fa-balance-scale',
      equity: 'fa-chart-pie',
      revenue: 'fa-arrow-trend-up',
      income: 'fa-coins',
    };
    return icons[key.toLowerCase()] ?? 'fa-circle-dollar-to-slot';
  }

  summaryColor(key: string): string {
    const colors: Record<string, string> = {
      asset: 'bg-primary',
      expense: 'bg-warning',
      liability: 'bg-danger',
      equity: 'bg-success',
      revenue: 'bg-info',
      income: 'bg-info',
    };
    return colors[key.toLowerCase()] ?? 'bg-secondary';
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private triggerLoad(): void {
    const uidRaw = this.filterForm.get('userId')?.value;
    const userId = uidRaw !== '' && uidRaw != null ? Number(uidRaw) : NaN;

    if (!Number.isFinite(userId)) {
      this.errorMessage = 'Please select an employee to load balances.';
      this.recentTransactions = [];
      this.balances = [];
      this.summaryByType = null;
      return;
    }

    this.hasQueried = true;
    this.loadData$.next(userId);
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

  private normalizeAccounts(value: unknown): BalanceAccountRow[] {
    if (Array.isArray(value)) return value as BalanceAccountRow[];
    if (!value || typeof value !== 'object') return [];
    const o = value as Record<string, unknown>;
    const arr = o['accounts'] ?? o['balances'] ?? o['rows'] ?? o['data'];
    if (Array.isArray(arr)) return arr as BalanceAccountRow[];
    return [];
  }

  private normalizeSummary(value: unknown): Record<string, number> | null {
    if (!value || typeof value !== 'object') return null;
    const o = value as Record<string, unknown>;
    const raw = (o['summary'] ?? o['byType'] ?? o['totals'] ?? o) as Record<string, unknown>;
    if (!raw || typeof raw !== 'object') return null;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    }
    return Object.keys(out).length ? out : null;
  }
}
