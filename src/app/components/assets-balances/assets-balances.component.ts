import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
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

  private activeRequestVersion = 0;
  private pendingRequests = 0;

  filterForm: FormGroup;
  employees: EmployeeRow[] = [];
  isLoadingEmployees = false;

  isLoading = false;
  errorMessage = '';
  recentTransactions: BalanceTransactionRow[] = [];
  balances: BalanceAccountRow[] = [];
  summaryByType: Record<string, number> | null = null;

  constructor() {
    this.filterForm = this.fb.group({
      userId: [''],
    });
    void this.loadEmployeesThenMaybeData();
  }

  private async loadEmployeesThenMaybeData(): Promise<void> {
    await this.loadEmployees();
    const first = this.employees[0]?.userId;
    if (first != null && this.filterForm.get('userId')?.value === '') {
      this.filterForm.patchValue({ userId: String(first) });
    }
    await this.loadData();
  }

  async loadEmployees(): Promise<void> {
    this.isLoadingEmployees = true;
    this.errorMessage = '';
    try {
      const { employees } = await firstValueFrom(this.api.getEmployees());
      this.employees = employees ?? [];
    } catch (err) {
      this.errorMessage = getApiErrorMessage(err) || 'Failed to load employees.';
    } finally {
      this.isLoadingEmployees = false;
    }
  }

  async loadData(): Promise<void> {
    const uidRaw = this.filterForm.get('userId')?.value;
    const userId = uidRaw !== '' && uidRaw != null ? Number(uidRaw) : NaN;
    if (!Number.isFinite(userId)) {
      this.errorMessage = 'Select an employee (userId) to load balances.';
      this.recentTransactions = [];
      this.balances = [];
      this.summaryByType = null;
      return;
    }

    const requestVersion = ++this.activeRequestVersion;
    this.isLoading = true;
    this.errorMessage = '';
    this.pendingRequests = 3;

    void this.loadTransactions(userId, requestVersion);
    void this.loadBalances(userId, requestVersion);
    void this.loadSummary(userId, requestVersion);
  }

  displayTxDate(row: BalanceTransactionRow): string {
    return String(row.date ?? row.entryDate ?? '—');
  }

  displayTxAccount(row: BalanceTransactionRow): string {
    return String(row.accountName ?? row.account ?? row.accountId ?? '—');
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

  summaryEntries(): { key: string; value: number }[] {
    if (!this.summaryByType) return [];
    return Object.entries(this.summaryByType).map(([key, value]) => ({ key, value: Number(value) }));
  }

  private async loadTransactions(userId: number, requestVersion: number): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.api.getBalancesTransactions(userId).pipe(timeout(15000)),
      );
      if (requestVersion === this.activeRequestVersion) {
        this.recentTransactions = this.normalizeTransactions(response);
      }
    } catch (err) {
      if (requestVersion === this.activeRequestVersion) {
        this.errorMessage = getApiErrorMessage(err) || 'Failed to load transactions.';
      }
    } finally {
      this.finishRequest(requestVersion);
    }
  }

  private async loadBalances(userId: number, requestVersion: number): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.api.getBalancesAccounts(userId).pipe(timeout(15000)),
      );
      if (requestVersion === this.activeRequestVersion) {
        this.balances = this.normalizeAccounts(response);
      }
    } catch (err) {
      if (requestVersion === this.activeRequestVersion) {
        this.errorMessage = getApiErrorMessage(err) || 'Failed to load account balances.';
      }
    } finally {
      this.finishRequest(requestVersion);
    }
  }

  private async loadSummary(userId: number, requestVersion: number): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.api.getBalancesSummaryByType(userId).pipe(timeout(15000)),
      );
      if (requestVersion === this.activeRequestVersion) {
        this.summaryByType = this.normalizeSummary(response);
      }
    } catch (err) {
      if (requestVersion === this.activeRequestVersion) {
        this.errorMessage = getApiErrorMessage(err) || 'Failed to load summary by type.';
      }
    } finally {
      this.finishRequest(requestVersion);
    }
  }

  private finishRequest(requestVersion: number): void {
    if (requestVersion !== this.activeRequestVersion) return;
    this.pendingRequests = Math.max(0, this.pendingRequests - 1);
    if (this.pendingRequests === 0) {
      this.isLoading = false;
    }
  }

  private normalizeTransactions(value: unknown): BalanceTransactionRow[] {
    if (Array.isArray(value)) return value as BalanceTransactionRow[];
    if (!value || typeof value !== 'object') return [];
    const o = value as Record<string, unknown>;
    const candidates = ['transactions', 'rows', 'data', 'items'];
    for (const key of candidates) {
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
