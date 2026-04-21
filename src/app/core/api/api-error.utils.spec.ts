import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { applyApiValidationErrors, getApiErrorMessage } from './api-error.utils';

describe('api-error utils', () => {
  it('prefers structured envelope message', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: {
        status: 'error',
        message: 'Validation failed',
        data: null,
        errors: [{ path: 'description', message: 'Description is required' }],
        metadata: { timestamp: new Date().toISOString(), version: 'v1' },
      },
    });

    expect(getApiErrorMessage(err)).toBe('Validation failed');
  });

  it('maps field errors into nested form controls', () => {
    const form = new FormGroup({
      description: new FormControl(''),
      items: new FormArray([
        new FormGroup({
          fromAccountId: new FormControl(''),
          reasonAccountId: new FormControl(''),
          amount: new FormControl(null),
        }),
      ]),
    });

    const err = new HttpErrorResponse({
      status: 400,
      error: {
        status: 'error',
        message: 'Validation failed',
        data: null,
        errors: [
          { path: 'description', message: 'Description is required' },
          { path: 'items.0.amount', message: 'Amount must be positive' },
        ],
        metadata: { timestamp: new Date().toISOString(), version: 'v1' },
      },
    });

    const mapped = applyApiValidationErrors(form, err);
    expect(mapped).toBe(true);
    expect(form.get('description')?.errors?.['server']).toBe('Description is required');
    expect(form.get('items.0.amount')?.errors?.['server']).toBe('Amount must be positive');
  });
});
