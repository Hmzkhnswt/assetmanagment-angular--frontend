import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home';
import { InvoiceComponent } from './components/invoice/invoice';
import { PostedJournalInvoicesComponent } from './components/invoice/posted-journal-invoices';
import { AssetsBalancesComponent } from './components/assets-balances/assets-balances.component';
import { ReceiptComponent } from './components/receipts/receipt';
import { PostedReceiptsComponent } from './components/receipts/posted-receipts';
import { JournalEntriesReportComponent } from './components/reports/journal-entries-report';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'payments/invoices/new', component: InvoiceComponent },
  { path: 'payments/invoices', component: PostedJournalInvoicesComponent },
  { path: 'payments/posted-journal-invoices', redirectTo: 'payments/invoices', pathMatch: 'full' },
  { path: 'payments/assets-balances', component: AssetsBalancesComponent },
  { path: 'reports/journal-entries', component: JournalEntriesReportComponent },
  { path: 'receipts/new', component: ReceiptComponent },
  { path: 'receipts/posted', redirectTo: 'receipts', pathMatch: 'full' },
  { path: 'receipts', component: PostedReceiptsComponent },
  { path: 'invoice', redirectTo: 'payments/invoices' },
  { path: 'invoices', redirectTo: 'payments/invoices' },
  { path: '**', redirectTo: 'home' },
];