import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';

export interface NavItem {
  label: string;
  icon: string;
  route?: string;
  action?: () => void;
  children?: NavItem[];
}

@Component({
  selector: 'app-navigation',
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatToolbarModule
  ],
  templateUrl: './navigation.html',
  styleUrl: './navigation.scss',
})
export class Navigation {
  isExpanded = true;
  
  navItems: NavItem[] = [
    {
      label: 'Upload File',
      icon: 'cloud_upload',
      route: '/upload'
    },
    {
      label: 'Modify Input Parameters',
      icon: 'settings',
      route: '/parameters'
    },
    {
      label: 'Network Structure',
      icon: 'hub',
      route: '/network-structure'
    },
    {
      label: 'Network Visualization',
      icon: 'scatter_plot',
      route: '/visualization'
    },
    {
      label: 'Diamond Analysis',
      icon: 'auto_awesome',
      route: '/diamond-analysis'
    },
    {
      label: 'Reachability Analysis',
      icon: 'share',
      route: '/reachability'
    },
    {
      label: 'Critical Path Analysis',
      icon: 'alt_route',
      route: '/critical-path'
    }
  ];

  toggleSidebar(): void {
    this.isExpanded = !this.isExpanded;
  }

  onNavItemClick(item: NavItem): void {
    if (item.action) {
      item.action();
    }
    // Navigation will be handled by routerLink in template
  }
}
