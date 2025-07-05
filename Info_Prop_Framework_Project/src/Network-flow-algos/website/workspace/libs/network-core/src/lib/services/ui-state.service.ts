import { Injectable, signal, computed, effect } from '@angular/core';

// UI state interfaces
export interface BreadcrumbItem {
  label: string;
  route?: string;
  icon?: string;
}

export interface NotificationMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  duration?: number;
  persistent?: boolean;
}

export interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number;
}

export type ThemeMode = 'light' | 'dark' | 'auto';
export type SidenavMode = 'over' | 'side' | 'push';

/**
 * UI State Service using Angular 20 Native Signals
 * Manages all UI-related state including layout, theme, notifications
 */
@Injectable({ providedIn: 'root' })
export class UIStateService {
  // Private signals for internal state
  private _sidenavOpen = signal(true);
  private _sidenavMode = signal<SidenavMode>('side');
  private _theme = signal<ThemeMode>('light');
  private _compactMode = signal(false);
  private _currentRoute = signal('');
  private _breadcrumbs = signal<BreadcrumbItem[]>([]);
  private _globalLoading = signal<LoadingState>({ isLoading: false });
  private _notifications = signal<NotificationMessage[]>([]);
  private _isFullscreen = signal(false);
  private _screenSize = signal<'xs' | 'sm' | 'md' | 'lg' | 'xl'>('lg');

  // Public readonly signals
  readonly sidenavOpen = this._sidenavOpen.asReadonly();
  readonly sidenavMode = this._sidenavMode.asReadonly();
  readonly theme = this._theme.asReadonly();
  readonly compactMode = this._compactMode.asReadonly();
  readonly currentRoute = this._currentRoute.asReadonly();
  readonly breadcrumbs = this._breadcrumbs.asReadonly();
  readonly globalLoading = this._globalLoading.asReadonly();
  readonly notifications = this._notifications.asReadonly();
  readonly isFullscreen = this._isFullscreen.asReadonly();
  readonly screenSize = this._screenSize.asReadonly();

  // Computed signals
  readonly isMobile = computed(() => 
    this._screenSize() === 'xs' || this._screenSize() === 'sm'
  );
  readonly isTablet = computed(() => this._screenSize() === 'md');
  readonly isDesktop = computed(() => 
    this._screenSize() === 'lg' || this._screenSize() === 'xl'
  );
  readonly shouldAutoCloseSidenav = computed(() => this.isMobile());
  readonly effectiveSidenavMode = computed(() => {
    if (this.isMobile()) return 'over';
    return this._sidenavMode();
  });
  readonly hasNotifications = computed(() => this._notifications().length > 0);
  readonly unreadNotificationCount = computed(() => this._notifications().length);
  readonly isDarkTheme = computed(() => {
    const theme = this._theme();
    if (theme === 'auto') {
      // Check system preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return theme === 'dark';
  });
  readonly mainContentClass = computed(() => {
    const classes = ['main-content'];
    
    if (this._compactMode()) classes.push('compact');
    if (this._isFullscreen()) classes.push('fullscreen');
    if (this._sidenavOpen() && this.effectiveSidenavMode() === 'side') {
      classes.push('sidenav-open');
    }
    
    return classes.join(' ');
  });

  constructor() {
    // Effect: Auto-close sidenav on mobile
    effect(() => {
      if (this.shouldAutoCloseSidenav() && this._sidenavOpen()) {
        this._sidenavOpen.set(false);
      }
    });

    // Effect: Apply theme to document
    effect(() => {
      const isDark = this.isDarkTheme();
      document.documentElement.classList.toggle('dark-theme', isDark);
      document.documentElement.classList.toggle('light-theme', !isDark);
    });

    // Effect: Auto-remove temporary notifications
    effect(() => {
      const notifications = this._notifications();
      notifications.forEach(notification => {
        if (!notification.persistent && notification.duration) {
          setTimeout(() => {
            this.removeNotification(notification.id);
          }, notification.duration);
        }
      });
    });

    // Effect: Save preferences to localStorage
    effect(() => {
      const preferences = {
        theme: this._theme(),
        compactMode: this._compactMode(),
        sidenavOpen: this._sidenavOpen(),
        sidenavMode: this._sidenavMode()
      };
      
      try {
        localStorage.setItem('ui-preferences', JSON.stringify(preferences));
      } catch (error) {
        console.warn('Failed to save UI preferences:', error);
      }
    });

    // Initialize from saved preferences and screen size
    this.loadPreferences();
    this.initializeScreenSize();
  }

  // Layout methods
  toggleSidenav(): void {
    this._sidenavOpen.update(open => !open);
  }

  openSidenav(): void {
    this._sidenavOpen.set(true);
  }

  closeSidenav(): void {
    this._sidenavOpen.set(false);
  }

  setSidenavMode(mode: SidenavMode): void {
    this._sidenavMode.set(mode);
  }

  // Theme methods
  setTheme(theme: ThemeMode): void {
    this._theme.set(theme);
  }

  toggleTheme(): void {
    const current = this._theme();
    if (current === 'light') {
      this._theme.set('dark');
    } else if (current === 'dark') {
      this._theme.set('light');
    } else {
      // If auto, toggle to opposite of current system preference
      const isDarkSystem = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this._theme.set(isDarkSystem ? 'light' : 'dark');
    }
  }

  setCompactMode(compact: boolean): void {
    this._compactMode.set(compact);
  }

  toggleCompactMode(): void {
    this._compactMode.update(compact => !compact);
  }

  // Navigation methods
  setCurrentRoute(route: string): void {
    this._currentRoute.set(route);
  }

  setBreadcrumbs(breadcrumbs: BreadcrumbItem[]): void {
    this._breadcrumbs.set(breadcrumbs);
  }

  addBreadcrumb(item: BreadcrumbItem): void {
    this._breadcrumbs.update(crumbs => [...crumbs, item]);
  }

  // Loading methods
  setGlobalLoading(loading: boolean, message?: string, progress?: number): void {
    this._globalLoading.set({
      isLoading: loading,
      message,
      progress
    });
  }

  updateLoadingProgress(progress: number): void {
    this._globalLoading.update(state => ({
      ...state,
      progress
    }));
  }

  // Notification methods
  showNotification(
    type: NotificationMessage['type'],
    title: string,
    message: string,
    options?: {
      duration?: number;
      persistent?: boolean;
    }
  ): string {
    const notification: NotificationMessage = {
      id: crypto.randomUUID(),
      type,
      title,
      message,
      timestamp: new Date(),
      duration: options?.duration ?? (type === 'error' ? 8000 : 4000),
      persistent: options?.persistent ?? false
    };

    this._notifications.update(notifications => [notification, ...notifications]);
    return notification.id;
  }

  showSuccess(title: string, message: string, duration?: number): string {
    return this.showNotification('success', title, message, { duration });
  }

  showError(title: string, message: string, persistent = false): string {
    return this.showNotification('error', title, message, { 
      persistent,
      duration: persistent ? undefined : 8000
    });
  }

  showWarning(title: string, message: string, duration?: number): string {
    return this.showNotification('warning', title, message, { duration });
  }

  showInfo(title: string, message: string, duration?: number): string {
    return this.showNotification('info', title, message, { duration });
  }

  removeNotification(id: string): void {
    this._notifications.update(notifications => 
      notifications.filter(n => n.id !== id)
    );
  }

  clearAllNotifications(): void {
    this._notifications.set([]);
  }

  // Fullscreen methods
  toggleFullscreen(): void {
    this._isFullscreen.update(fullscreen => !fullscreen);
  }

  setFullscreen(fullscreen: boolean): void {
    this._isFullscreen.set(fullscreen);
  }

  // Screen size methods
  setScreenSize(size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'): void {
    this._screenSize.set(size);
  }

  // Utility methods
  getNotificationById(id: string): NotificationMessage | undefined {
    return this._notifications().find(n => n.id === id);
  }

  // Private methods
  private loadPreferences(): void {
    try {
      const saved = localStorage.getItem('ui-preferences');
      if (saved) {
        const preferences = JSON.parse(saved);
        
        if (preferences.theme) this._theme.set(preferences.theme);
        if (typeof preferences.compactMode === 'boolean') {
          this._compactMode.set(preferences.compactMode);
        }
        if (typeof preferences.sidenavOpen === 'boolean') {
          this._sidenavOpen.set(preferences.sidenavOpen);
        }
        if (preferences.sidenavMode) {
          this._sidenavMode.set(preferences.sidenavMode);
        }
      }
    } catch (error) {
      console.warn('Failed to load UI preferences:', error);
    }
  }

  private initializeScreenSize(): void {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      
      if (width < 576) {
        this._screenSize.set('xs');
      } else if (width < 768) {
        this._screenSize.set('sm');
      } else if (width < 992) {
        this._screenSize.set('md');
      } else if (width < 1200) {
        this._screenSize.set('lg');
      } else {
        this._screenSize.set('xl');
      }
    };

    // Initial size
    updateScreenSize();

    // Listen for resize events
    window.addEventListener('resize', updateScreenSize);
    
    // Listen for theme preference changes
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        // Trigger theme update if in auto mode
        if (this._theme() === 'auto') {
          // Force re-computation by updating the signal
          this._theme.set('auto');
        }
      });
  }
}