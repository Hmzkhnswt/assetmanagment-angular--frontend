/** API error shape: { error: string } */
export interface ApiErrorBody {
  error: string;
}

export interface HealthResponse {
  ok: boolean;
}

export interface AccountRow {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
  created_at: string;
}

export interface AccountsResponse {
  accounts: AccountRow[];
}

export interface EmployeeRow {
  id: string;
  fullName: string;
  salary: number;
  userId: number;
  created_at: string;
}

export interface EmployeesResponse {
  employees: EmployeeRow[];
}

export interface JournalEntryLineInput {
  fromAccountId: string;
  reasonAccountId: string;
  amount: number;
}

export interface CreateJournalInvoiceBody {
  date: string;
  description: string;
  entries: JournalEntryLineInput[];
  userId?: number;
  fullName?: string;
  employeeName?: string;
  firstName?: string;
  lastName?: string;
}

export interface JournalInvoiceSummary {
  journalEntryId: string;
  reference: string;
  description: string;
  entryDate: string;
  userId: number | null;
  employeeName: string | null;
  totalDebit: number;
  totalCredit: number;
  lineCount: number;
}

export interface UpdateJournalInvoiceBody {
  date?: string;
  description: string;
  entries: JournalEntryLineInput[];
}

export interface CreateJournalInvoiceResponse {
  invoice: JournalInvoiceSummary;
}

export interface JournalListItem {
  journalEntryId: string;
  reference: string;
  description: string;
  entryDate: string;
  createdAt: string;
  userId: number | null;
  employeeName: string | null;
}

export interface JournalListResponse {
  invoices: JournalListItem[];
}

export interface InvoiceLineDetail {
  id: string;
  accountId: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
}

export interface JournalInvoiceDetailInvoice {
  journalEntryId?: string;
  reference?: string;
  description?: string;
  entryDate?: string;
  date?: string;
}

export interface JournalInvoiceDetailResponse {
  invoice: JournalInvoiceDetailInvoice;
  lines: InvoiceLineDetail[];
  entries?: JournalEntryLineInput[];
}

/** Line-level ledger activity (flexible field names from backend) */
export interface BalanceTransactionRow {
  id?: string;
  date?: string;
  entryDate?: string;
  reference?: string;
  description?: string;
  accountId?: string;
  accountName?: string;
  account?: string;
  accountType?: string;
  debit?: number;
  credit?: number;
}

export interface BalanceTransactionsResponse {
  transactions?: BalanceTransactionRow[];
  rows?: BalanceTransactionRow[];
}

export interface BalanceAccountRow {
  accountId?: string;
  account_id?: string;
  accountName?: string;
  account_name?: string;
  accountType?: string;
  account_type?: string;
  balance?: number;
  totalDebit?: number;
  total_debit?: number;
  totalCredit?: number;
  total_credit?: number;
}

export interface BalanceAccountsResponse {
  accounts?: BalanceAccountRow[];
}

export interface SummaryByTypeResponse {
  summary?: Record<string, number>;
  byType?: Record<string, number>;
  totals?: Record<string, number>;
}
