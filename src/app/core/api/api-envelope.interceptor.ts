import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import type { ApiErrorResponse, ApiSuccessResponse } from './api.types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSuccessEnvelope<T>(body: unknown): body is ApiSuccessResponse<T> {
  return isObject(body) && body['status'] === 'success' && 'data' in body;
}

function isErrorEnvelope(body: unknown): body is ApiErrorResponse {
  return isObject(body) && body['status'] === 'error' && typeof body['message'] === 'string';
}

export const apiEnvelopeInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  return next(req).pipe(
    map((event) => {
      if (!(event instanceof HttpResponse)) return event;
      if (!isSuccessEnvelope(event.body)) return event;
      return event.clone({ body: event.body as ApiSuccessResponse<unknown> });
    }),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && isErrorEnvelope(error.error)) {
        return throwError(() => error);
      }
      return throwError(() => error);
    }),
  );
};
