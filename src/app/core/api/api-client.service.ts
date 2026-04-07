import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
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

const JSON_HEADERS = new HttpHeaders({
  'Content-Type': 'application/json',
});

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
  private readonly http = inject(HttpClient);

  private url(path: string): string {
    const base = environment.apiUrl.replace(/\/$/, '');
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}/api${p}`;
  }

  health(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(this.url('/health'));
  }

  getAccounts(types = 'asset,expense'): Observable<AccountsResponse> {
    const params = new HttpParams().set('types', types);
    return this.http.get<AccountsResponse>(this.url('/accounts'), { params });
  }

  getEmployees(): Observable<EmployeesResponse> {
    return this.http.get<EmployeesResponse>(this.url('/employees'));
  }

  createJournalInvoice(body: CreateJournalInvoiceBody): Observable<CreateJournalInvoiceResponse> {
    return this.http.post<CreateJournalInvoiceResponse>(this.url('/invoices/journal'), body, {
      headers: JSON_HEADERS,
    });
  }

  listJournalInvoices(userId?: number | null): Observable<JournalListResponse> {
    let params = new HttpParams();
    if (userId != null && !Number.isNaN(userId)) {
      params = params.set('userId', String(userId));
    }
    return this.http.get<JournalListResponse>(this.url('/invoices/journal'), { params });
  }

  getJournalInvoiceDetail(journalEntryId: string): Observable<JournalInvoiceDetailResponse> {
    return this.http.get<JournalInvoiceDetailResponse>(this.url(`/invoices/journal/${encodeURIComponent(journalEntryId)}`));
  }

  updateJournalInvoice(journalEntryId: string, body: UpdateJournalInvoiceBody): Observable<JournalInvoiceSummary> {
    return this.http.put<JournalInvoiceSummary>(this.url(`/invoices/journal/${encodeURIComponent(journalEntryId)}`), body, {
      headers: JSON_HEADERS,
    });
  }

  getBalancesTransactions(userId: number): Observable<BalanceTransactionsResponse> {
    const params = new HttpParams().set('userId', String(userId));
    return this.http.get<BalanceTransactionsResponse>(this.url('/balances/transactions'), { params });
  }

  getBalancesAccounts(userId: number): Observable<BalanceAccountsResponse> {
    const params = new HttpParams().set('userId', String(userId));
    return this.http.get<BalanceAccountsResponse>(this.url('/balances/accounts'), { params });
  }

  getBalancesSummaryByType(userId: number): Observable<SummaryByTypeResponse> {
    const params = new HttpParams().set('userId', String(userId));
    return this.http.get<SummaryByTypeResponse>(this.url('/balances/summary-by-type'), { params });
  }

  getOrganizationAccounts(): Observable<BalanceAccountsResponse> {
    return this.http.get<BalanceAccountsResponse>(this.url('/balances/organization/accounts'));
  }

  getOrganizationSummaryByType(): Observable<SummaryByTypeResponse> {
    return this.http.get<SummaryByTypeResponse>(this.url('/balances/organization/summary-by-type'));
  }
}
