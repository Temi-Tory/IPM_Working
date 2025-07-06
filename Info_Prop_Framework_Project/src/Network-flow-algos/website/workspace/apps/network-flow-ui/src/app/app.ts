import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  imports: [RouterModule, CommonModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'Information Propagation Framework';
  protected isSidebarCollapsed = false;
  protected isMobile = false;
  protected showMobileOverlay = false;

  constructor() {
    this.checkScreenSize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.checkScreenSize());
    }
  }

  protected toggleSidebar(): void {
    if (this.isMobile) {
      this.showMobileOverlay = !this.showMobileOverlay;
    } else {
      this.isSidebarCollapsed = !this.isSidebarCollapsed;
    }
  }

  protected closeMobileMenu(): void {
    this.showMobileOverlay = false;
  }

  private checkScreenSize(): void {
    if (typeof window !== 'undefined') {
      this.isMobile = window.innerWidth < 1024;
      if (!this.isMobile) {
        this.showMobileOverlay = false;
      }
    }
  }

  protected navigationItems = [
    {
      path: '/network-setup',
      label: 'Network Setup',
      icon: 'M4 7v10c0 2.21 3.79 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.79 4 8 4s8-1.79 8-4M4 7c0-2.21 3.79-4 8-4s8 1.79 8 4',
      description: 'Configure and upload network data'
    },
    {
      path: '/visualization',
      label: 'Visualization',
      icon: 'M3 3v18h18M7 16l4-4 4 4 6-6',
      description: 'Analyze network flow patterns'
    }
  ];
}