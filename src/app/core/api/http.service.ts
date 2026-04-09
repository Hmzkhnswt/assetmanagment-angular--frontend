import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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

  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.http.get<T>(this.url(path), { params: params as HttpParams | undefined });
  }

  post<T>(path: string, body: unknown, headers: HttpHeaders = JSON_HEADERS): Observable<T> {
    return this.http.post<T>(this.url(path), body, { headers });
  }

  put<T>(path: string, body: unknown, headers: HttpHeaders = JSON_HEADERS): Observable<T> {
    return this.http.put<T>(this.url(path), body, { headers });
  }

  delete<T>(path: string, params?: QueryParams): Observable<T> {
    return this.http.delete<T>(this.url(path), { params: params as HttpParams | undefined });
  }
}
