export const API_ENDPOINTS = {
  HEALTH: '/health',

  ACCOUNTS: '/accounts',
  ACCOUNTS_BY_TYPE: (type: string) => `/accounts/${encodeURIComponent(type)}`,

  EMPLOYEES: '/employees',

  JOURNAL_INVOICES: '/invoices/journal',
  JOURNAL_INVOICE_DETAIL: (id: string) => `/invoices/journal/${encodeURIComponent(id)}`,

  BALANCES_TRANSACTIONS: '/balances/transactions',
  BALANCES_ACCOUNT_TRANSACTIONS: '/balances/account-transactions',
  BALANCES_ACCOUNTS: '/balances/accounts',
  BALANCES_SUMMARY_BY_TYPE: '/balances/summary-by-type',

  ORGANIZATION_ACCOUNTS: '/balances/organization/accounts',
  ORGANIZATION_SUMMARY_BY_TYPE: '/balances/organization/summary-by-type',
  BALANCES_TRIAL_BALANCE: '/balances/reports/trial-balance',
  BALANCES_PROFIT_LOSS: '/balances/reports/profit-loss',
  BALANCES_BALANCE_SHEET: '/balances/reports/balance-sheet',

  RECEIPTS: '/receipts',
  RECEIPT_DETAIL: (id: string) => `/receipts/${encodeURIComponent(id)}`,
  RECEIPT_SUMMARY: '/receipts/summary',
} as const;
