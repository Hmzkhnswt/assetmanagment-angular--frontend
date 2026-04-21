import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import type { ApiErrorResponse, ApiFieldError } from './api.types';

const PATH_SPLIT_REGEX = /[\.\[\]]+/;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!isObject(value)) return false;
  return value['status'] === 'error' && typeof value['message'] === 'string';
}

export function extractApiErrorResponse(err: unknown): ApiErrorResponse | null {
  if (!(err instanceof HttpErrorResponse)) return null;
  return isApiErrorResponse(err.error) ? err.error : null;
}

export function getApiErrorMessage(err: unknown): string {
  const structured = extractApiErrorResponse(err);
  if (structured?.message) return structured.message;

  if (err instanceof HttpErrorResponse) {
    const body = err.error;
    if (isObject(body) && typeof body['error'] === 'string') {
      return body['error'];
    }
    if (typeof body === 'string' && body.length > 0) {
      return body;
    }
    return err.message || `Request failed (${err.status})`;
  }
  if (err instanceof Error) return err.message;
  return 'Request failed';
}

export function getApiFieldErrors(err: unknown): ApiFieldError[] {
  const structured = extractApiErrorResponse(err);
  if (!structured?.errors || !Array.isArray(structured.errors)) return [];
  return structured.errors.filter((e) => !!e?.path && !!e?.message);
}

function resolveControl(root: AbstractControl, rawPath: string): AbstractControl | null {
  const segments = rawPath.split(PATH_SPLIT_REGEX).filter(Boolean);
  if (segments.length === 0) return null;

  let current: AbstractControl | null = root;
  for (const seg of segments) {
    if (!current) return null;
    if (current instanceof FormGroup) {
      current = current.get(seg);
      continue;
    }
    if (current instanceof FormArray) {
      const idx = Number(seg);
      if (!Number.isInteger(idx) || idx < 0 || idx >= current.length) return null;
      current = current.at(idx);
      continue;
    }
    return null;
  }
  return current;
}

function addServerError(control: AbstractControl, message: string): void {
  const existing = control.errors ?? {};
  control.setErrors({ ...existing, server: message });
  control.markAsTouched();
}

export function clearServerErrors(control: AbstractControl): void {
  const errors = control.errors;
  if (errors && 'server' in errors) {
    const { server: _server, ...rest } = errors;
    control.setErrors(Object.keys(rest).length ? rest : null);
  }
  if (control instanceof FormGroup) {
    Object.values(control.controls).forEach((child) => clearServerErrors(child));
  } else if (control instanceof FormArray) {
    control.controls.forEach((child) => clearServerErrors(child));
  }
}

export function applyApiValidationErrors(
  form: AbstractControl,
  err: unknown,
  aliases: Record<string, string> = {},
): boolean {
  const fieldErrors = getApiFieldErrors(err);
  if (fieldErrors.length === 0) return false;

  for (const fieldError of fieldErrors) {
    const normalizedPath = aliases[fieldError.path] ?? fieldError.path;
    const control = resolveControl(form, normalizedPath);
    if (control) {
      addServerError(control, fieldError.message);
    }
  }

  return true;
}
