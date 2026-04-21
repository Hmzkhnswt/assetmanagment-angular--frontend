import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiClient, getApiErrorMessage } from '../../core/api/api-client.service';
import { applyApiValidationErrors, clearServerErrors } from '../../core/api/api-error.utils';
import type {
  AccountRow,
  ReceiptDetailResponse,
  ReceiptJournalLine,
  ReceiptListItem,
  ReceiptStatus,
  UpdateReceiptBody,
} from '../../core/api/api.types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-posted-receipts',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DatePipe],
  templateUrl: './posted-receipts.html',
  styleUrls: ['./posted-receipts.css'],
})
export class PostedReceiptsComponent implements OnInit {
  private readonly api = inject(ApiClient);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  receipts: ReceiptListItem[] = [];
  assetAccounts: AccountRow[] = [];
  incomeAccounts: AccountRow[] = [];

  selectedReceipt: ReceiptListItem | null = null;
  isEditing = false;

  isLoadingList = false;
  isLoadingAccounts = false;
  isLoadingDetail = false;
  isUpdating = false;

  listError = '';
  accountsError = '';
  detailError = '';
  submitError = '';

  // ── Filter state ─────────────────────────────────────────────────────────────
  filterStatus = '';
  filterCustomer = '';
  filterFrom = '';
  filterTo = '';

  readonly statusOptions: { value: ReceiptStatus | ''; label: string }[] = [
    { value: '',       label: 'All Statuses' },
    { value: 'issued', label: 'Issued' },
    { value: 'void',   label: 'Void' },
  ];

  editForm: FormGroup = this.fb.group({
    date:         [this.getTodayDate(), Validators.required],
    customerName: ['', [Validators.required, Validators.maxLength(200)]],
    description:  ['', Validators.required],
    status:       ['issued' as ReceiptStatus],
    items:        this.fb.array([]),
  });

  ngOnInit(): void {
    this.loadList();
    this.loadAccounts();
  }

  // ── Edit form accessors ───────────────────────────────────────────────────────

  get items(): FormArray {
    return this.editForm.get('items') as FormArray;
  }

  lineTotal(index: number): number {
    return Number(this.items.at(index).get('amount')?.value || 0);
  }

  get editSubtotal(): number {
    return this.items.controls.reduce((sum, c) => sum + Number(c.get('amount')?.value || 0), 0);
  }

  addItem(prefill?: Partial<{ fromAccountId: string; reasonAccountId: string; amount: number }>): void {
    this.items.push(
      this.fb.group({
        fromAccountId:   [prefill?.fromAccountId   ?? '', [Validators.required, this.uuidValidator()]],
        reasonAccountId: [prefill?.reasonAccountId ?? '', [Validators.required, this.uuidValidator()]],
        amount:          [prefill?.amount          ?? null, [Validators.required, Validators.min(0.01)]],
      }),
    );
  }

  removeItem(index: number): void {
    if (this.items.length > 1) this.items.removeAt(index);
  }

  // ── Filters ───────────────────────────────────────────────────────────────────

  applyFilters(): void {
    this.loadList();
  }

  clearFilters(): void {
    this.filterStatus   = '';
    this.filterCustomer = '';
    this.filterFrom     = '';
    this.filterTo       = '';
    this.loadList();
  }

  // ── Editor ────────────────────────────────────────────────────────────────────

  openEditor(receipt: ReceiptListItem): void {
    this.selectedReceipt = receipt;
    this.isEditing = true;
    this.loadReceiptDetail(receipt.receiptId);
    setTimeout(() => {
      document.getElementById('posted-receipt-editor')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  }

  closeEditor(): void {
    this.isEditing = false;
    this.selectedReceipt = null;
    this.detailError = '';
    this.submitError = '';
    clearServerErrors(this.editForm);
    this.items.clear();
    this.editForm.reset({ date: this.getTodayDate(), customerName: '', description: '', status: 'issued' });
  }

  async save(): Promise<void> {
    if (!this.selectedReceipt) return;
    this.submitError = '';

    if (this.items.length === 0) {
      this.submitError = 'At least one item is required.';
      return;
    }
    if (this.editForm.invalid) {
      this.submitError = 'Please fill all required fields.';
      this.editForm.markAllAsTouched();
      return;
    }

    const v = this.editForm.value as {
      date: string;
      customerName: string;
      description: string;
      status: ReceiptStatus;
      items: { fromAccountId: string; reasonAccountId: string; amount: number }[];
    };

    const payload: UpdateReceiptBody = {
      date:         v.date || undefined,
      customerName: v.customerName.trim(),
      description:  v.description.trim(),
      status:       v.status,
      items: v.items.map((i) => {
        return {
          fromAccountId:   i.fromAccountId,
          reasonAccountId: i.reasonAccountId,
          amount:          Number(i.amount),
        };
      }),
    };

    this.isUpdating = true;
    try {
      await firstValueFrom(this.api.updateReceipt(this.selectedReceipt.receiptId, payload));
      this.closeEditor();
      this.loadList();
    } catch (err) {
      applyApiValidationErrors(this.editForm, err, {
        assetAccountId: 'items.0.fromAccountId',
        incomeAccountId: 'items.0.reasonAccountId',
      });
      this.submitError = getApiErrorMessage(err) || 'Failed to update receipt.';
    } finally {
      this.isUpdating = false;
      this.cdr.detectChanges();
    }
  }

  addReceipt(): void {
    void this.router.navigate(['/receipts/new']);
  }

  statusBadgeClass(status: ReceiptStatus): string {
    return status === 'issued' ? 'bg-success' : 'bg-secondary';
  }

  // ── Private: data loading ─────────────────────────────────────────────────────

  loadList(): void {
    this.listError = '';
    this.isLoadingList = true;

    this.api
      .listReceipts({
        status:       this.filterStatus   || undefined,
        customerName: this.filterCustomer || undefined,
        from:         this.filterFrom     || undefined,
        to:           this.filterTo       || undefined,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          this.listError = getApiErrorMessage(err) || 'Failed to load receipts.';
          return of({ receipts: [] as ReceiptListItem[] });
        }),
      )
      .subscribe(({ receipts }) => {
        this.receipts = receipts ?? [];
        this.isLoadingList = false;
        this.cdr.detectChanges();
      });
  }

  private loadAccounts(): void {
    this.isLoadingAccounts = true;
    this.accountsError = '';

    forkJoin({
      asset:  this.api.getAssetAccounts().pipe(
        catchError((err) => {
          this.accountsError = getApiErrorMessage(err) || 'Failed to load asset accounts.';
          return of({ accounts: [] as AccountRow[] });
        }),
      ),
      income: this.api.getIncomeAccounts().pipe(
        catchError((err) => {
          if (!this.accountsError)
            this.accountsError = getApiErrorMessage(err) || 'Failed to load income accounts.';
          return of({ accounts: [] as AccountRow[] });
        }),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ asset, income }) => {
        this.assetAccounts  = asset.accounts;
        this.incomeAccounts = income.accounts;
        this.isLoadingAccounts = false;
        this.cdr.detectChanges();
      });
  }

  private loadReceiptDetail(receiptId: string): void {
    this.detailError = '';
    this.submitError = '';
    this.isLoadingDetail = true;
    this.items.clear();

    this.api
      .getReceiptDetail(receiptId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => {
          this.detailError = getApiErrorMessage(err) || 'Failed to load receipt details.';
          return of(null);
        }),
      )
      .subscribe((res) => {
        this.isLoadingDetail = false;
        if (!res) { this.cdr.detectChanges(); return; }
        try {
          this.patchDetail(res);
        } catch (err) {
          this.detailError = getApiErrorMessage(err) || 'Unexpected receipt detail shape.';
          this.items.clear();
          this.addItem();
        }
        this.cdr.detectChanges();
      });
  }

  private patchDetail(res: ReceiptDetailResponse): void {
    const r = res.receipt ?? {};
    const dateRaw = (r.receiptDate ?? this.getTodayDate()) as string;

    this.editForm.patchValue({
      date:         this.getDateInputValue(dateRaw),
      customerName: r.customerName ?? this.selectedReceipt?.customerName ?? '',
      description:  r.description  ?? this.selectedReceipt?.description  ?? '',
      status:       r.status       ?? this.selectedReceipt?.status       ?? 'issued',
    });

    const reconstructed = this.reconstructItems(res.lines ?? []);
    if (reconstructed.length === 0) { this.addItem(); return; }
    reconstructed.forEach((item) => this.addItem(item));
  }

  /**
   * The detail endpoint returns raw Dr/Cr journal lines.
   * Asset lines (debit > 0) are the fromAccountId; income lines (credit > 0) are the reasonAccountId.
   * Pair them by matching amounts, then look up accountId by accountName in loaded accounts.
   */
  private reconstructItems(lines: ReceiptJournalLine[]): Partial<{ fromAccountId: string; reasonAccountId: string; amount: number }>[] {
    const debitLines  = lines.filter((l) => Number(l.debit)  > 0);
    const creditLines = lines.filter((l) => Number(l.credit) > 0);
    const used = new Set<number>();
    const items: Partial<{ fromAccountId: string; reasonAccountId: string; amount: number }>[] = [];

    for (const dl of debitLines) {
      const amt = Number(dl.debit);
      const ciIdx = creditLines.findIndex((cl, idx) => !used.has(idx) && Number(cl.credit) === amt);
      if (ciIdx < 0) continue;
      used.add(ciIdx);

      const fromId   = this.findAccountId(dl.accountName,  this.assetAccounts)  ?? '';
      const reasonId = this.findAccountId(creditLines[ciIdx].accountName, this.incomeAccounts) ?? '';
      items.push({ fromAccountId: fromId, reasonAccountId: reasonId, amount: amt });
    }
    return items;
  }

  private findAccountId(name: string, accounts: AccountRow[]): string | undefined {
    return accounts.find((a) => a.name === name)?.id;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private getDateInputValue(raw?: string): string {
    if (!raw) return this.getTodayDate();
    const datePart = raw.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return this.getTodayDate();
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }

  private uuidValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = String(control.value ?? '').trim();
      if (!value) return null;
      return UUID_REGEX.test(value) ? null : { uuid: true };
    };
  }

  private getTodayDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
