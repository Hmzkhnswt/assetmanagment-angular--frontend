import { HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpService } from './http.service';
import { API_ENDPOINTS } from './constants';
import type {
  AccountsResponse,
  BalanceAccountsResponse,
  BalanceTransactionsResponse,
  CreateJournalInvoiceBody,
  CreateJournalInvoiceResponse,
  EmployeesResponse,
  HealthResponse,
  JournalInvoiceDetailResponse,
  JournalInvoiceSummary,
  JournalListResponse,
  SummaryByTypeResponse,
  UpdateJournalInvoiceBody,
} from './api.types';

export function getApiErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error;
    if (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string') {
      return (body as { error: string }).error;
    }
    if (typeof err.error === 'string' && err.error.length > 0) {
      return err.error;
    }
    return err.message || `Request failed (${err.status})`;
  }
  if (err instanceof Error) return err.message;
  return 'Request failed';
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly httpService = inject(HttpService);

  health(): Observable<HealthResponse> {
    return this.httpService.get<HealthResponse>(API_ENDPOINTS.HEALTH);
  }

  getAccounts(types = 'asset,expense'): Observable<AccountsResponse> {
    const params = new HttpParams().set('types', types);
    return this.httpService.get<AccountsResponse>(API_ENDPOINTS.ACCOUNTS, params);
  }

  getEmployees(): Observable<EmployeesResponse> {
    return this.httpService.get<EmployeesResponse>(API_ENDPOINTS.EMPLOYEES);
  }

  createJournalInvoice(body: CreateJournalInvoiceBody): Observable<CreateJournalInvoiceResponse> {
    return this.httpService.post<CreateJournalInvoiceResponse>(API_ENDPOINTS.JOURNAL_INVOICES, body);
  }

  listJournalInvoices(userId?: number | null): Observable<JournalListResponse> {
    let params = new HttpParams();
    if (userId != null && !Number.isNaN(userId)) {
      params = params.set('userId', String(userId));
    }
    return this.httpService.get<JournalListResponse>(API_ENDPOINTS.JOURNAL_INVOICES, params);
  }

  getJournalInvoiceDetail(journalEntryId: string): Observable<JournalInvoiceDetailResponse> {
    return this.httpService.get<JournalInvoiceDetailResponse>(API_ENDPOINTS.JOURNAL_INVOICE_DETAIL(journalEntryId));
  }

  updateJournalInvoice(journalEntryId: string, body: UpdateJournalInvoiceBody): Observable<JournalInvoiceSummary> {
    return this.httpService.put<JournalInvoiceSummary>(API_ENDPOINTS.JOURNAL_INVOICE_DETAIL(journalEntryId), body);
  }

  getBalancesTransactions(userId: number): Observable<BalanceTransactionsResponse> {
    const params = new HttpParams().set('userId', String(userId));
    return this.httpService.get<BalanceTransactionsResponse>(API_ENDPOINTS.BALANCES_TRANSACTIONS, params);
  }

  getBalancesAccounts(userId: number): Observable<BalanceAccountsResponse> {
    const params = new HttpParams().set('userId', String(userId));
    return this.httpService.get<BalanceAccountsResponse>(API_ENDPOINTS.BALANCES_ACCOUNTS, params);
  }

  getBalancesSummaryByType(userId: number): Observable<SummaryByTypeResponse> {
    const params = new HttpParams().set('userId', String(userId));
    return this.httpService.get<SummaryByTypeResponse>(API_ENDPOINTS.BALANCES_SUMMARY_BY_TYPE, params);
  }

  getOrganizationAccounts(): Observable<BalanceAccountsResponse> {
    return this.httpService.get<BalanceAccountsResponse>(API_ENDPOINTS.ORGANIZATION_ACCOUNTS);
  }

  getOrganizationSummaryByType(): Observable<SummaryByTypeResponse> {
    return this.httpService.get<SummaryByTypeResponse>(API_ENDPOINTS.ORGANIZATION_SUMMARY_BY_TYPE);
  }
}
