import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { ApiClient, getApiErrorMessage } from '../../core/api/api-client.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.html',
})
export class HomeComponent implements OnInit {
  private readonly api = inject(ApiClient);

  healthStatus: 'idle' | 'ok' | 'error' = 'idle';
  healthMessage = '';

  async ngOnInit(): Promise<void> {
    try {
      const res = await firstValueFrom(this.api.health());
      this.healthStatus = res?.ok === true ? 'ok' : 'error';
      this.healthMessage = this.healthStatus === 'ok' ? 'API is reachable.' : 'API health check returned an unexpected body.';
    } catch (err) {
      this.healthStatus = 'error';
      this.healthMessage = getApiErrorMessage(err) || 'Could not reach /api/health.';
    }
  }
}
