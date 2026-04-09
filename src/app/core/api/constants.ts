export const API_ENDPOINTS = {
  HEALTH: '/health',

  ACCOUNTS: '/accounts',
  EMPLOYEES: '/employees',

  JOURNAL_INVOICES: '/invoices/journal',
  JOURNAL_INVOICE_DETAIL: (id: string) => `/invoices/journal/${encodeURIComponent(id)}`,

  BALANCES_TRANSACTIONS: '/balances/transactions',
  BALANCES_ACCOUNTS: '/balances/accounts',
  BALANCES_SUMMARY_BY_TYPE: '/balances/summary-by-type',

  ORGANIZATION_ACCOUNTS: '/balances/organization/accounts',
  ORGANIZATION_SUMMARY_BY_TYPE: '/balances/organization/summary-by-type',
} as const;
