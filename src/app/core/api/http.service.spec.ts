import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpService } from './http.service';
import { apiEnvelopeInterceptor } from './api-envelope.interceptor';

describe('HttpService', () => {
  let service: HttpService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HttpService,
        provideHttpClient(withInterceptors([apiEnvelopeInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(HttpService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('returns typed envelope for get()', () => {
    let actual: unknown;
    service.get<{ ok: boolean }>('/health').subscribe((response) => (actual = response));

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/health'));
    req.flush({
      status: 'success',
      message: 'ok',
      data: { ok: true },
      metadata: { timestamp: '2026-01-01T00:00:00.000Z', version: 'v1' },
    });

    expect(actual).toEqual({
      status: 'success',
      message: 'ok',
      data: { ok: true },
      metadata: { timestamp: '2026-01-01T00:00:00.000Z', version: 'v1' },
    });
  });

  it('maps envelope data for legacy getData()', () => {
    let actual: unknown;
    service.getData<{ accounts: unknown[] }>('/accounts/asset').subscribe((response) => (actual = response));

    const req = httpMock.expectOne((r) => r.url.endsWith('/api/accounts/asset'));
    req.flush({
      status: 'success',
      message: 'ok',
      data: { accounts: [{ id: '1' }] },
      metadata: { timestamp: '2026-01-01T00:00:00.000Z', version: 'v1' },
    });

    expect(actual).toEqual({ accounts: [{ id: '1' }] });
  });
});
