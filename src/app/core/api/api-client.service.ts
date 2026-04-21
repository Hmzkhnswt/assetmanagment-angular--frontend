import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HttpService } from './http.service';
import { API_ENDPOINTS } from './constants';
import type { AccountType } from './api.types';
import type {
  AccountsResponse,
  BalanceAccountsResponse,
  BalanceSheetResponse,
  BalanceTransactionsResponse,
  CreateJournalInvoiceBody,
  CreateJournalInvoiceResponse,
  CreateReceiptBody,
  CreateReceiptResponse,
  EmployeesResponse,
  HealthResponse,
  JournalInvoiceDetailResponse,
  JournalInvoiceSummary,
  JournalListResponse,
  ProfitLossResponse,
  ReceiptDetailResponse,
  ReceiptListResponse,
  ReceiptSummary,
  ReceiptSummaryResponse,
  SummaryByTypeResponse,
  TrialBalanceResponse,
  UpdateJournalInvoiceBody,
  UpdateReceiptBody,
} from './api.types';
import { getApiErrorMessage } from './api-error.utils';

export { getApiErrorMessage };

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly httpService = inject(HttpService);
  private isValidPositiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
  }

  health(): Observable<HealthResponse> {
    return this.httpService.get<HealthResponse>(API_ENDPOINTS.HEALTH).pipe(map((response) => response.data));
  }

  getAssetAccounts(): Observable<AccountsResponse> {
    return this.getAccountsByType('asset');
  }

  getIncomeAccounts(): Observable<AccountsResponse> {
    return this.getAccountsByType('income');
  }

  getExpenseAccounts(): Observable<AccountsResponse> {
    return this.getAccountsByType('expense');
  }

  // Compatibility aliases
  getAssets(): Observable<AccountsResponse> {
    return this.getAssetAccounts();
  }

  getAccountsByType(type: AccountType): Observable<AccountsResponse> {
    return this.httpService.get<AccountsResponse>(API_ENDPOINTS.ACCOUNTS_BY_TYPE(type)).pipe(map((response) => response.data));
  }

  // Legacy support for GET /api/accounts?types=asset,expense
  getAccountsByTypes(types: AccountType[]): Observable<AccountsResponse> {
    const params = new HttpParams().set('types', types.join(','));
    return this.httpService.get<AccountsResponse>(API_ENDPOINTS.ACCOUNTS, params).pipe(map((response) => response.data));
  }

  getEmployees(): Observable<EmployeesResponse> {
    return this.httpService.get<EmployeesResponse>(API_ENDPOINTS.EMPLOYEES).pipe(map((response) => response.data));
  }

  createJournalInvoice(body: CreateJournalInvoiceBody): Observable<CreateJournalInvoiceResponse> {
    return this.httpService.post<CreateJournalInvoiceResponse>(API_ENDPOINTS.JOURNAL_INVOICES, body).pipe(map((response) => response.data));
  }

  listJournalInvoices(userId?: number | null): Observable<JournalListResponse> {
    let params = new HttpParams();
    if (userId != null && !Number.isNaN(userId)) {
      params = params.set('userId', String(userId));
    }
    return this.httpService.get<JournalListResponse>(API_ENDPOINTS.JOURNAL_INVOICES, params).pipe(map((response) => response.data));
  }

  getJournalInvoiceDetail(journalEntryId: string): Observable<JournalInvoiceDetailResponse> {
    return this.httpService.get<JournalInvoiceDetailResponse>(API_ENDPOINTS.JOURNAL_INVOICE_DETAIL(journalEntryId)).pipe(map((response) => response.data));
  }

  updateJournalInvoice(journalEntryId: string, body: UpdateJournalInvoiceBody): Observable<JournalInvoiceSummary> {
    return this.httpService.put<JournalInvoiceSummary>(API_ENDPOINTS.JOURNAL_INVOICE_DETAIL(journalEntryId), body).pipe(map((response) => response.data));
  }

  getBalancesTransactions(userId?: number): Observable<BalanceTransactionsResponse> {
    let params = new HttpParams();
    if (this.isValidPositiveInteger(userId)) {
      params = params.set('userId', String(userId));
    }
    return this.httpService.get<BalanceTransactionsResponse>(API_ENDPOINTS.BALANCES_TRANSACTIONS, params).pipe(map((response) => response.data));
  }

  getBalanceAccountTransactions(accountId: string): Observable<BalanceTransactionsResponse> {
    const params = new HttpParams().set('accountId', accountId);
    return this.httpService.get<BalanceTransactionsResponse>(API_ENDPOINTS.BALANCES_ACCOUNT_TRANSACTIONS, params).pipe(map((response) => response.data));
  }

  getBalancesAccounts(userId?: number): Observable<BalanceAccountsResponse> {
    let params = new HttpParams();
    if (this.isValidPositiveInteger(userId)) {
      params = params.set('userId', String(userId));
    }
    return this.httpService.get<BalanceAccountsResponse>(API_ENDPOINTS.BALANCES_ACCOUNTS, params).pipe(map((response) => response.data));
  }

  getBalancesSummaryByType(userId?: number): Observable<SummaryByTypeResponse> {
    let params = new HttpParams();
    if (this.isValidPositiveInteger(userId)) {
      params = params.set('userId', String(userId));
    }
    return this.httpService.get<SummaryByTypeResponse>(API_ENDPOINTS.BALANCES_SUMMARY_BY_TYPE, params).pipe(map((response) => response.data));
  }

  getOrganizationAccounts(): Observable<BalanceAccountsResponse> {
    return this.httpService.get<BalanceAccountsResponse>(API_ENDPOINTS.ORGANIZATION_ACCOUNTS).pipe(map((response) => response.data));
  }

  getOrganizationSummaryByType(): Observable<SummaryByTypeResponse> {
    return this.httpService.get<SummaryByTypeResponse>(API_ENDPOINTS.ORGANIZATION_SUMMARY_BY_TYPE).pipe(map((response) => response.data));
  }

  getTrialBalanceReport(): Observable<TrialBalanceResponse> {
    return this.httpService.get<TrialBalanceResponse>(API_ENDPOINTS.BALANCES_TRIAL_BALANCE).pipe(map((response) => response.data));
  }

  getProfitLossReport(): Observable<ProfitLossResponse> {
    return this.httpService.get<ProfitLossResponse>(API_ENDPOINTS.BALANCES_PROFIT_LOSS).pipe(map((response) => response.data));
  }

  getBalanceSheetReport(): Observable<BalanceSheetResponse> {
    return this.httpService.get<BalanceSheetResponse>(API_ENDPOINTS.BALANCES_BALANCE_SHEET).pipe(map((response) => response.data));
  }

  createReceipt(body: CreateReceiptBody): Observable<CreateReceiptResponse> {
    return this.httpService.post<CreateReceiptResponse>(API_ENDPOINTS.RECEIPTS, body).pipe(map((response) => response.data));
  }

  listReceipts(filters?: { status?: string; customerName?: string; from?: string; to?: string }): Observable<ReceiptListResponse> {
    let params = new HttpParams();
    if (filters?.status)       params = params.set('status', filters.status);
    if (filters?.customerName) params = params.set('customerName', filters.customerName);
    if (filters?.from)         params = params.set('from', filters.from);
    if (filters?.to)           params = params.set('to', filters.to);
    return this.httpService.get<ReceiptListResponse>(API_ENDPOINTS.RECEIPTS, params).pipe(map((response) => response.data));
  }

  getReceiptDetail(receiptId: string): Observable<ReceiptDetailResponse> {
    return this.httpService.get<ReceiptDetailResponse>(API_ENDPOINTS.RECEIPT_DETAIL(receiptId)).pipe(map((response) => response.data));
  }

  updateReceipt(receiptId: string, body: UpdateReceiptBody): Observable<ReceiptSummary> {
    return this.httpService.put<ReceiptSummary>(API_ENDPOINTS.RECEIPT_DETAIL(receiptId), body).pipe(map((response) => response.data));
  }

  getReceiptSummary(from?: string, to?: string): Observable<ReceiptSummaryResponse> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to)   params = params.set('to', to);
    return this.httpService.get<ReceiptSummaryResponse>(API_ENDPOINTS.RECEIPT_SUMMARY, params).pipe(map((response) => response.data));
  }
}
