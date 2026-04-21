import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import type { ApiSuccessResponse } from './api.types';

const JSON_HEADERS = new HttpHeaders({ 'Content-Type': 'application/json' });

export type QueryParams = HttpParams | Record<string, string | number | boolean>;

@Injectable({ providedIn: 'root' })
export class HttpService {
  private readonly http = inject(HttpClient);

  private url(path: string): string {
    const base = environment.apiUrl.replace(/\/$/, '');
    const segment = path.startsWith('/') ? path : `/${path}`;
    return `${base}/api${segment}`;
  }

  get<T>(path: string, params?: QueryParams): Observable<ApiSuccessResponse<T>> {
    return this.http.get<ApiSuccessResponse<T>>(this.url(path), { params: params as HttpParams | undefined });
  }

  post<T>(path: string, body: unknown, headers: HttpHeaders = JSON_HEADERS): Observable<ApiSuccessResponse<T>> {
    return this.http.post<ApiSuccessResponse<T>>(this.url(path), body, { headers });
  }

  put<T>(path: string, body: unknown, headers: HttpHeaders = JSON_HEADERS): Observable<ApiSuccessResponse<T>> {
    return this.http.put<ApiSuccessResponse<T>>(this.url(path), body, { headers });
  }

  delete<T>(path: string, params?: QueryParams): Observable<ApiSuccessResponse<T>> {
    return this.http.delete<ApiSuccessResponse<T>>(this.url(path), { params: params as HttpParams | undefined });
  }

  // Legacy-safe mapper: allows incremental migration of old call sites.
  getData<T>(path: string, params?: QueryParams): Observable<T> {
    return this.get<T>(path, params).pipe(map((response) => response.data));
  }

  postData<T>(path: string, body: unknown, headers: HttpHeaders = JSON_HEADERS): Observable<T> {
    return this.post<T>(path, body, headers).pipe(map((response) => response.data));
  }

  putData<T>(path: string, body: unknown, headers: HttpHeaders = JSON_HEADERS): Observable<T> {
    return this.put<T>(path, body, headers).pipe(map((response) => response.data));
  }

  deleteData<T>(path: string, params?: QueryParams): Observable<T> {
    return this.delete<T>(path, params).pipe(map((response) => response.data));
  }
}
