import { Component, inject, HostListener, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';

import { AnalysisStateService } from './shared/services/analysis-state.service';
import { MatChip, MatChipsModule } from "@angular/material/chips";

@Component({
  imports: [
    RouterModule,
    MatToolbarModule,
    MatSidenavModule,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatChipsModule
],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected title = 'Information Propagation Framework';
  protected isDrawerOpen = false;
  protected isSidenavCollapsed = false; // For collapsible sidenav functionality
  protected isDarkTheme = true; // Default to dark mode
  protected isMobile = false;

  // Inject analysis state service for tab enable/disable logic
  protected analysisState = inject(AnalysisStateService);
  private snackBar = inject(MatSnackBar);

  constructor() {
    // Set dark mode as default on app initialization
    document.documentElement.setAttribute('data-theme', 'dark');
    this.checkScreenSize();
  }

  ngOnInit() {
    if (!this.isMobile) {
      this.isDrawerOpen = true;
    }
    
    // Load parsed data from session first
    this.analysisState.loadParsedDataFromSession();
    
    // Don't make API calls during app initialization
    // Let individual components handle their own API calls when user navigates to them
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

  toggleSidenavCollapse() {
    this.isSidenavCollapsed = !this.isSidenavCollapsed;
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

  // Save/Export functionality
  saveAnalysisToStorage(): void {
    this.snackBar.open('Save full analysis to storage button clicked', 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }

  exportAnalysisReport(): void {
    this.snackBar.open('Export full analysis as PDF report button clicked', 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }
}
