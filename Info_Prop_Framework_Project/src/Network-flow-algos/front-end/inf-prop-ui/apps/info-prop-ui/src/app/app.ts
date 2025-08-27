import { Component, inject, HostListener, OnInit } from '@angular/core';
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
export class App implements OnInit {
  protected title = 'Information Propagation Framework';
  protected isDrawerOpen = false;
  protected isDarkTheme = true; // Default to dark mode
  protected isMobile = false;

  // Inject analysis state service for tab enable/disable logic
  protected analysisState = inject(AnalysisStateService);

  constructor() {
    // Set dark mode as default on app initialization
    document.documentElement.setAttribute('data-theme', 'dark');
    this.checkScreenSize();
  }

  ngOnInit() {
    // Open drawer by default on larger screens
    if (!this.isMobile) {
      this.isDrawerOpen = true;
    }
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
    // Adjust drawer behavior based on screen size
    if (!this.isMobile && !this.isDrawerOpen) {
      this.isDrawerOpen = true;
    }
  }

  private checkScreenSize() {
    this.isMobile = window.innerWidth < 1200;
  }

  toggleDrawer() {
    this.isDrawerOpen = !this.isDrawerOpen;
  }

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
    document.documentElement.setAttribute('data-theme', this.isDarkTheme ? 'dark' : 'light');
  }

  // Responsive drawer behavior
  getDrawerMode(): 'side' | 'over' {
    return this.isMobile ? 'over' : 'side';
  }

  shouldDisableClose(): boolean {
    // Don't allow closing by clicking outside on desktop
    return !this.isMobile;
  }

  // Progress tracking methods
  getOverallProgress(): number {
    const totalSteps = this.getTotalSteps();
    const completedSteps = this.getCompletedSteps();
    return totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  }

  getTotalSteps(): number {
    // Total analysis steps (excluding home)
    return 6;
  }

  getCompletedSteps(): number {
    let completed = 0;
    
    if (this.analysisState.uploadTab().completed) completed++;
    if (this.analysisState.networkStructureTab().completed) completed++;
    if (this.analysisState.diamondAnalysisTab().completed) completed++;
    if (this.analysisState.exactInferenceTab().completed) completed++;
    if (this.analysisState.flowAnalysisTab().completed) completed++;
    if (this.analysisState.criticalPathTab().completed) completed++;
    
    return completed;
  }
}
