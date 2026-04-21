/** Legacy API error shape: { error: string } */
export interface ApiErrorBody {
  error: string;
}

export interface ApiResponseMetadata {
  timestamp: string;
  version: string;
}

export interface ApiFieldError {
  path: string;
  message: string;
}

export interface ApiSuccessResponse<T> {
  status: 'success';
  message: string;
  data: T;
  metadata: ApiResponseMetadata;
}

export interface ApiErrorResponse {
  status: 'error';
  message: string;
  data: null;
  errors?: ApiFieldError[];
  metadata: ApiResponseMetadata;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface HealthResponse {
  ok: boolean;
}

export type AccountType = 'asset' | 'income' | 'expense' | 'liability' | 'equity';

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
  account_id?: string;
  accountName?: string;
  account_name?: string;
  account?: string;
  accountType?: string;
  account_type?: string;
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

export interface TrialBalanceRow {
  accountId: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalanceResponse {
  rows: TrialBalanceRow[];
}

export interface ProfitLossResponse {
  income: number;
  expense: number;
  netProfit: number;
}

export interface BalanceSheetResponse {
  assets: number;
  liabilities: number;
  equity: number;
}

// ─── Receipts ────────────────────────────────────────────────────────────────

export type ReceiptStatus = 'issued' | 'void';

/** One service line sent to POST /api/receipts and PUT /api/receipts/:id */
export interface ReceiptItemInput {
  /** UUID of the asset account used as payment method (e.g. Cash) */
  fromAccountId: string;
  /** UUID of the income account that records the revenue */
  reasonAccountId: string;
  /** qty × unitPrice — computed in the frontend before sending */
  amount: number;
  itemDescription?: string;
}

export interface CreateReceiptBody {
  date: string;
  customerName: string;
  description: string;
  items: ReceiptItemInput[];
}

export interface UpdateReceiptBody {
  date?: string;
  customerName?: string;
  description?: string;
  items?: ReceiptItemInput[];
  status?: ReceiptStatus;
}

export interface ReceiptSummary {
  receiptId: string;
  receiptNumber: string;
  customerName: string;
  receiptDate: string;
  description: string;
  totalAmount: string;
  status: ReceiptStatus;
  journalEntryId: string;
  journalReference: string;
  lineCount: number;
}

export interface CreateReceiptResponse {
  receipt: ReceiptSummary;
}

export interface ReceiptListItem {
  receiptId: string;
  receiptNumber: string;
  customerName: string;
  receiptDate: string;
  description: string;
  totalAmount: string;
  status: ReceiptStatus;
  journalEntryId: string;
  journalReference: string;
  createdAt: string;
}

export interface ReceiptListResponse {
  receipts: ReceiptListItem[];
}

/** One Dr/Cr journal line returned by GET /api/receipts/:id */
export interface ReceiptJournalLine {
  lineId: string;
  accountName: string;
  accountType: string;
  debit: string;
  credit: string;
}

export interface ReceiptDetailResponse {
  receipt: ReceiptSummary;
  lines: ReceiptJournalLine[];
}

export interface ReceiptSummaryByAccount {
  accountName: string;
  receiptCount: string;
  totalIncome: string;
}

export interface ReceiptSummaryData {
  totalReceipts: number;
  grandTotal: string;
  byIncomeAccount: ReceiptSummaryByAccount[];
}

export interface ReceiptSummaryResponse {
  summary: ReceiptSummaryData;
}
