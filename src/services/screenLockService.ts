/**
 * Screen Lock Service for Interview Security
 * Prevents cheating by locking the screen and detecting violations
 */

export interface ScreenLockConfig {
  enableScreenLock: boolean;
  enableTabSwitchDetection: boolean;
  enableWindowFocusDetection: boolean;
  enableCopyPasteBlocking: boolean;
  violationThreshold: number; // Number of violations before warning
}

export interface ViolationEvent {
  type: 'tab_switch' | 'window_blur' | 'copy_attempt' | 'paste_attempt' | 'right_click' | 'keyboard_shortcut';
  timestamp: Date;
  details?: string;
}

export interface ScreenLockState {
  isLocked: boolean;
  violations: ViolationEvent[];
  violationCount: number;
  isWarningShown: boolean;
}

export class ScreenLockService {
  private config: ScreenLockConfig;
  private state: ScreenLockState;
  private eventListeners: Array<() => void> = [];
  private violationCallbacks: Array<(violation: ViolationEvent) => void> = [];
  private warningCallbacks: Array<() => void> = [];
  private originalTitle: string = '';
  private originalFavicon: string = '';
  private isFullscreen: boolean = false;

  constructor(config: Partial<ScreenLockConfig> = {}) {
    this.config = {
      enableScreenLock: true,
      enableTabSwitchDetection: true,
      enableWindowFocusDetection: true,
      enableCopyPasteBlocking: true,
      violationThreshold: 3,
      ...config
    };

    this.state = {
      isLocked: false,
      violations: [],
      violationCount: 0,
      isWarningShown: false
    };

    this.originalTitle = document.title;
  }

  /**
   * Request screen lock permission and start monitoring
   */
  async requestScreenLock(): Promise<boolean> {
    try {
      // Request fullscreen permission
      if (this.config.enableScreenLock) {
        const fullscreenGranted = await this.requestFullscreen();
        if (!fullscreenGranted) {
          console.warn('Fullscreen permission denied, continuing without screen lock');
        }
      }

      // Start monitoring
      this.startMonitoring();
      this.state.isLocked = true;
      
      console.log('Screen lock activated successfully');
      return true;
    } catch (error) {
      console.error('Failed to activate screen lock:', error);
      return false;
    }
  }

  /**
   * Request fullscreen mode
   */
  private async requestFullscreen(): Promise<boolean> {
    try {
      const element = document.documentElement;
      
      // Try different fullscreen methods
      if (element.requestFullscreen) {
        await element.requestFullscreen();
        this.isFullscreen = true;
        console.log('Fullscreen activated successfully');
        return true;
      } else if ((element as any).webkitRequestFullscreen) {
        await (element as any).webkitRequestFullscreen();
        this.isFullscreen = true;
        console.log('Fullscreen activated successfully (webkit)');
        return true;
      } else if ((element as any).mozRequestFullScreen) {
        await (element as any).mozRequestFullScreen();
        this.isFullscreen = true;
        console.log('Fullscreen activated successfully (moz)');
        return true;
      } else if ((element as any).msRequestFullscreen) {
        await (element as any).msRequestFullscreen();
        this.isFullscreen = true;
        console.log('Fullscreen activated successfully (ms)');
        return true;
      }
      
      console.warn('Fullscreen not supported in this browser');
      return false;
    } catch (error) {
      console.error('Fullscreen request failed:', error);
      return false;
    }
  }

  /**
   * Exit fullscreen mode
   */
  private exitFullscreen(): void {
    try {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
      this.isFullscreen = false;
      console.log('Exited fullscreen mode');
    } catch (error) {
      console.error('Failed to exit fullscreen:', error);
    }
  }

  /**
   * Start monitoring for violations
   */
  private startMonitoring(): void {
    // Tab visibility change detection
    if (this.config.enableTabSwitchDetection) {
      const handleVisibilityChange = () => {
        if (document.hidden && this.state.isLocked) {
          this.recordViolation('tab_switch', 'Tab switched or minimized');
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      this.eventListeners.push(() => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      });
    }

    // Window focus/blur detection
    if (this.config.enableWindowFocusDetection) {
      const handleWindowBlur = () => {
        if (this.state.isLocked) {
          this.recordViolation('window_blur', 'Window lost focus');
        }
      };

      const handleWindowFocus = () => {
        // Reset some states when window regains focus
        if (this.state.isLocked && this.state.violationCount > 0) {
          console.log('Window regained focus after violation');
        }
      };

      window.addEventListener('blur', handleWindowBlur);
      window.addEventListener('focus', handleWindowFocus);
      
      this.eventListeners.push(() => {
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('focus', handleWindowFocus);
      });
    }

    // Copy/Paste blocking
    if (this.config.enableCopyPasteBlocking) {
      const handleCopy = (e: ClipboardEvent) => {
        if (this.state.isLocked) {
          e.preventDefault();
          e.stopPropagation();
          this.recordViolation('copy_attempt', 'Copy attempt blocked');
          console.log('Copy blocked!');
          return false;
        }
      };

      const handlePaste = (e: ClipboardEvent) => {
        if (this.state.isLocked) {
          e.preventDefault();
          e.stopPropagation();
          this.recordViolation('paste_attempt', 'Paste attempt blocked');
          console.log('Paste blocked!');
          return false;
        }
      };

      const handleCut = (e: ClipboardEvent) => {
        if (this.state.isLocked) {
          e.preventDefault();
          e.stopPropagation();
          this.recordViolation('copy_attempt', 'Cut attempt blocked');
          console.log('Cut blocked!');
          return false;
        }
      };

      // Add event listeners with capture to catch events early
      document.addEventListener('copy', handleCopy, true);
      document.addEventListener('paste', handlePaste, true);
      document.addEventListener('cut', handleCut, true);
      
      this.eventListeners.push(() => {
        document.removeEventListener('copy', handleCopy, true);
        document.removeEventListener('paste', handlePaste, true);
        document.removeEventListener('cut', handleCut, true);
      });
    }

    // Right-click blocking
    const handleContextMenu = (e: MouseEvent) => {
      if (this.state.isLocked) {
        e.preventDefault();
        e.stopPropagation();
        this.recordViolation('right_click', 'Right-click blocked');
        console.log('Right-click blocked!');
        return false;
      }
    };

    document.addEventListener('contextmenu', handleContextMenu, true);
    this.eventListeners.push(() => {
      document.removeEventListener('contextmenu', handleContextMenu, true);
    });

    // Keyboard shortcut blocking
    const handleKeyDown = (e: KeyboardEvent) => {
      if (this.state.isLocked) {
        // Block common shortcuts
        const blockedShortcuts = [
          'F12', // Developer tools
          'Ctrl+Shift+I', // Developer tools
          'Ctrl+Shift+J', // Console
          'Ctrl+U', // View source
          'Ctrl+S', // Save
          'Ctrl+P', // Print
          'Ctrl+R', // Refresh
          'F5', // Refresh
          'Ctrl+F5', // Hard refresh
          'Alt+Tab', // Switch applications
          'Ctrl+Tab', // Switch tabs
          'Ctrl+W', // Close tab
          'Ctrl+T', // New tab
          'Ctrl+N', // New window
          'Ctrl+C', // Copy
          'Ctrl+V', // Paste
          'Ctrl+X', // Cut
          'Ctrl+A', // Select all
        ];

        const keyCombo = this.getKeyCombo(e);
        
        if (blockedShortcuts.includes(keyCombo)) {
          e.preventDefault();
          e.stopPropagation();
          this.recordViolation('keyboard_shortcut', `Blocked shortcut: ${keyCombo}`);
          console.log(`Blocked keyboard shortcut: ${keyCombo}`);
          return false;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    this.eventListeners.push(() => {
      document.removeEventListener('keydown', handleKeyDown, true);
    });

    // Fullscreen change detection
    const handleFullscreenChange = () => {
      if (this.state.isLocked && !document.fullscreenElement) {
        this.recordViolation('tab_switch', 'Exited fullscreen mode');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    this.eventListeners.push(() => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    });
  }

  /**
   * Record a violation
   */
  private recordViolation(type: ViolationEvent['type'], details?: string): void {
    const violation: ViolationEvent = {
      type,
      timestamp: new Date(),
      details
    };

    this.state.violations.push(violation);
    this.state.violationCount++;

    console.warn(`Security violation detected: ${type}`, violation);

    // Notify violation callbacks
    this.violationCallbacks.forEach(callback => callback(violation));

    // Check if warning should be shown
    if (this.state.violationCount >= this.config.violationThreshold && !this.state.isWarningShown) {
      this.state.isWarningShown = true;
      this.warningCallbacks.forEach(callback => callback());
    }

    // Violations are now just counted, no termination
  }

  /**
   * Get key combination string
   */
  private getKeyCombo(e: KeyboardEvent): string {
    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    if (e.metaKey) parts.push('Meta');
    parts.push(e.key);
    return parts.join('+');
  }


  /**
   * Release screen lock
   */
  releaseScreenLock(): void {
    this.state.isLocked = false;
    
    // Remove all event listeners
    this.eventListeners.forEach(removeListener => removeListener());
    this.eventListeners = [];

    // Exit fullscreen if we entered it
    if (this.isFullscreen && document.fullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }

    // Restore original title and favicon
    document.title = this.originalTitle;
    
    console.log('Screen lock released');
  }

  /**
   * Get current state
   */
  getState(): ScreenLockState {
    return { ...this.state };
  }

  /**
   * Get violation count
   */
  getViolationCount(): number {
    return this.state.violationCount;
  }

  /**
   * Get all violations for summary
   */
  getAllViolations(): ViolationEvent[] {
    return [...this.state.violations];
  }


  /**
   * Add violation callback
   */
  onViolation(callback: (violation: ViolationEvent) => void): void {
    this.violationCallbacks.push(callback);
  }

  /**
   * Add warning callback
   */
  onWarning(callback: () => void): void {
    this.warningCallbacks.push(callback);
  }


  /**
   * Reset violation count (for new interview)
   */
  resetViolations(): void {
    this.state.violations = [];
    this.state.violationCount = 0;
    this.state.isWarningShown = false;
  }

  /**
   * Completely deactivate screen lock (for interview completion)
   */
  deactivate(): void {
    console.log('Deactivating screen lock service...');
    
    // Remove all event listeners
    this.eventListeners.forEach(removeListener => removeListener());
    this.eventListeners = [];
    
    // Exit fullscreen if active
    if (this.isFullscreen) {
      this.exitFullscreen();
    }
    
    // Reset state
    this.state.isLocked = false;
    this.state.violations = [];
    this.state.violationCount = 0;
    this.state.isWarningShown = false;
    
    // Restore original title and favicon
    document.title = this.originalTitle;
    
    console.log('Screen lock service deactivated');
  }
}

// Create default instance
export const screenLockService = new ScreenLockService();
