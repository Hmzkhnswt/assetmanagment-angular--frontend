import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { InvoiceComponent } from './invoice';
import { ApiClient } from '../../core/api/api-client.service';

describe('InvoiceComponent', () => {
  let component: InvoiceComponent;
  let fixture: ComponentFixture<InvoiceComponent>;

  beforeEach(async () => {
    const apiStub: Pick<
      ApiClient,
      'getAccounts' | 'getEmployees' | 'listJournalInvoices' | 'createJournalInvoice'
    > = {
      getAccounts: () =>
        of({
          accounts: [
            { id: 'a1', name: 'Cash', type: 'asset', parent_id: null, created_at: '' },
            { id: 'e1', name: 'Payroll', type: 'expense', parent_id: null, created_at: '' },
          ],
        }),
      getEmployees: () => of({ employees: [{ id: '1', fullName: 'Test User', salary: 0, userId: 7, created_at: '' }] }),
      listJournalInvoices: () => of({ invoices: [] }),
      createJournalInvoice: () =>
        of({
          invoice: {
            journalEntryId: 'j1',
            reference: 'REF-1',
            description: 'd',
            entryDate: '2026-01-01',
            userId: 7,
            employeeName: 'Test User',
            totalDebit: 1,
            totalCredit: 1,
            lineCount: 1,
          },
        }),
    };

    await TestBed.configureTestingModule({
      imports: [InvoiceComponent],
      providers: [{ provide: ApiClient, useValue: apiStub }],
    }).compileComponents();

    fixture = TestBed.createComponent(InvoiceComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
