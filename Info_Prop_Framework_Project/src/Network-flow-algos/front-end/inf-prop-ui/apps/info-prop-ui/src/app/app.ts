import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CommonModule } from '@angular/common';
import { AnalysisStateService } from './shared/services/analysis-state.service';

@Component({
  imports: [
    RouterModule, 
    CommonModule,
    MatToolbarModule,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatSlideToggleModule
  ],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'Information Propagation Framework';
  protected isDrawerOpen = false;
  protected isDarkTheme = true; // Default to dark mode

  // Inject analysis state service for tab enable/disable logic
  protected analysisState = inject(AnalysisStateService);

  constructor() {
    // Set dark mode as default on app initialization
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  toggleDrawer() {
    this.isDrawerOpen = !this.isDrawerOpen;
  }

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
    document.documentElement.setAttribute('data-theme', this.isDarkTheme ? 'dark' : 'light');
  }
}
