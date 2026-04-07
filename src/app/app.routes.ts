import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home';
import { InvoiceComponent } from './components/invoice/invoice';
import { PostedJournalInvoicesComponent } from './components/invoice/posted-journal-invoices';
import { AssetsBalancesComponent } from './components/assets-balances/assets-balances.component';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'payments/invoices', component: InvoiceComponent },
  { path: 'payments/posted-journal-invoices', component: PostedJournalInvoicesComponent },
  { path: 'payments/assets-balances', component: AssetsBalancesComponent },
  { path: 'invoice', redirectTo: 'payments/invoices' },
  { path: 'invoices', redirectTo: 'payments/invoices' },
  { path: '**', redirectTo: 'home' },
];