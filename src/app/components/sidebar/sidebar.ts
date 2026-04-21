import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';


@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.css']
})
export class SidebarComponent {

  isPaymentsOpen = false;
  isReceiptsOpen = false;
  isReportsOpen = false;

  togglePayments(): void {
    this.isPaymentsOpen = !this.isPaymentsOpen;
  }

  toggleReceipts(): void {
    this.isReceiptsOpen = !this.isReceiptsOpen;
  }

  toggleReports(): void {
    this.isReportsOpen = !this.isReportsOpen;
  }
}