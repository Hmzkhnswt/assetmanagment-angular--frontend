import { ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiClient, getApiErrorMessage } from '../../core/api/api-client.service';
import { applyApiValidationErrors, clearServerErrors } from '../../core/api/api-error.utils';
import type { AccountRow, CreateReceiptBody } from '../../core/api/api.types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-receipt',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './receipt.component.html',
  styleUrls: ['./receipt.component.css'],
})
export class ReceiptComponent {
  private readonly api = inject(ApiClient);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  /** Asset accounts — used as the "Payment Method" (fromAccountId) per line */
  assetAccounts: AccountRow[] = [];
  /** Income accounts — the revenue account credited per line */
  incomeAccounts: AccountRow[] = [];

  isLoadingData = false;
  isSubmitting = false;

  accountsError = '';
  submitError = '';

  toastMessage = '';
  toastVisible = false;
  toastIsError = false;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  receiptForm: FormGroup;

  constructor() {
    this.receiptForm = this.fb.group({
      date: [this.getTodayDate(), Validators.required],
      customerName: ['', [Validators.required, Validators.maxLength(200)]],
      description: ['', Validators.required],
      items: this.fb.array([]),
    });

    this.addItem();
    this.loadAccounts();

    this.destroyRef.onDestroy(() => {
      if (this.toastTimer) clearTimeout(this.toastTimer);
    });
  }

  // ── Form accessors ───────────────────────────────────────────────────────────

  get items(): FormArray {
    return this.receiptForm.get('items') as FormArray;
  }

  get subtotal(): number {
    return this.items.controls.reduce((sum, c) => {
      return sum + Number(c.get('amount')?.value || 0);
    }, 0);
  }

  // ── Item management ──────────────────────────────────────────────────────────

  addItem(): void {
    this.items.push(
      this.fb.group({
        fromAccountId:   ['', [Validators.required, this.uuidValidator()]],
        reasonAccountId: ['', [Validators.required, this.uuidValidator()]],
        amount:          [null as number | null, [Validators.required, Validators.min(0.01)]],
      }),
    );
  }

  removeItem(index: number): void {
    if (this.items.length > 1) this.items.removeAt(index);
  }

  // ── Data loading ─────────────────────────────────────────────────────────────

  loadAccounts(): void {
    this.isLoadingData = true;
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
        this.isLoadingData  = false;
        this.cdr.detectChanges();
      });
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  openPostedReceiptsPage(): void {
    void this.router.navigate(['/receipts']);
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async onSubmit(): Promise<void> {
    this.submitError = '';
    clearServerErrors(this.receiptForm);
    this.dismissToast();

    if (this.items.length === 0) {
      this.submitError = 'Add at least one service item before saving.';
      return;
    }
    if (this.receiptForm.invalid) {
      this.submitError = 'Please fill all required fields.';
      this.receiptForm.markAllAsTouched();
      return;
    }
    if (this.subtotal <= 0) {
      this.submitError = 'Total amount must be greater than zero.';
      return;
    }

    const body = this.buildBody();
    this.isSubmitting = true;
    try {
      const res = await firstValueFrom(this.api.createReceipt(body));
      const ref = res.receipt?.receiptNumber ?? res.receipt?.receiptId ?? '';
      this.showToast(`Receipt saved${ref ? ` (${ref})` : ''}.`, false);
      this.items.clear();
      this.addItem();
      this.receiptForm.patchValue({ customerName: '', description: '' });
    } catch (err) {
      applyApiValidationErrors(this.receiptForm, err, {
        assetAccountId: 'items.0.fromAccountId',
        incomeAccountId: 'items.0.reasonAccountId',
      });
      this.submitError = getApiErrorMessage(err) || 'Failed to save receipt.';
    } finally {
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }

  // ── Builder ──────────────────────────────────────────────────────────────────

  private buildBody(): CreateReceiptBody {
    const v = this.receiptForm.value as {
      date: string;
      customerName: string;
      description: string;
      items: { fromAccountId: string; reasonAccountId: string; amount: number }[];
    };

    return {
      date:         v.date,
      customerName: v.customerName.trim(),
      description:  v.description.trim(),
      items: v.items.map((i) => ({
        fromAccountId:   i.fromAccountId,
        reasonAccountId: i.reasonAccountId,
        amount:          Number(i.amount),
      })),
    };
  }

  private uuidValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = String(control.value ?? '').trim();
      if (!value) return null;
      return UUID_REGEX.test(value) ? null : { uuid: true };
    };
  }

  // ── Toast ────────────────────────────────────────────────────────────────────

  showToast(message: string, isError: boolean): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage = message;
    this.toastIsError = isError;
    this.toastVisible = true;
    this.toastTimer = setTimeout(() => {
      this.toastVisible = false;
      this.cdr.detectChanges();
    }, 4500);
  }

  dismissToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.toastVisible = false;
  }

  private getTodayDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
