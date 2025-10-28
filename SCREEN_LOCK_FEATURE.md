# Screen Lock Feature - Anti-Cheating Security

## Overview

The Screen Lock feature is a comprehensive anti-cheating security system that prevents candidates from accessing external resources during interviews. It provides real-time monitoring and violation detection to ensure interview integrity.

## Features

### 🔒 **Fullscreen Mode**
- Automatically requests fullscreen mode when interview starts
- Prevents easy access to other applications
- Monitors fullscreen exit attempts

### 👁️ **Tab & Window Monitoring**
- Detects when user switches tabs or minimizes the browser
- Monitors window focus/blur events
- Tracks application switching attempts

### 🚫 **Input Blocking**
- Blocks copy/paste operations
- Disables right-click context menu
- Prevents keyboard shortcuts (F12, Ctrl+Shift+I, etc.)

### ⚠️ **Violation Detection**
- Real-time monitoring of security violations
- Configurable violation thresholds
- Progressive warnings and termination

### 📊 **Security Dashboard**
- Live security status display
- Violation count tracking
- Detailed violation history

## Implementation

### Core Components

1. **ScreenLockService** (`src/services/screenLockService.ts`)
   - Main service handling all security features
   - Event monitoring and violation detection
   - Configuration management

2. **ScreenLockPermission** (`src/components/ScreenLockPermission.tsx`)
   - Permission request modal
   - Feature explanation and setup
   - User consent handling

3. **SecurityStatus** (`src/components/SecurityStatus.tsx`)
   - Live security status display
   - Violation warnings
   - Real-time monitoring dashboard

### Integration Points

- **MultiRoundInterview**: Main entry point with permission request
- **TechnicalRound**: Security monitoring during DSA questions
- **CoreRound**: Security monitoring during core subjects
- **HRRound**: Security monitoring during behavioral questions

## Configuration

### Violation Thresholds
```typescript
const config = {
  violationThreshold: 3,    // Show warning after 3 violations
  maxViolations: 5,         // Terminate interview after 5 violations
  enableScreenLock: true,   // Enable fullscreen mode
  enableTabSwitchDetection: true,
  enableWindowFocusDetection: true,
  enableCopyPasteBlocking: true
};
```

### Violation Types
- `tab_switch`: Tab switching or browser minimization
- `window_blur`: Window losing focus
- `copy_attempt`: Copy operation attempted
- `paste_attempt`: Paste operation attempted
- `right_click`: Right-click context menu
- `keyboard_shortcut`: Blocked keyboard shortcut

## User Experience

### Permission Request Flow
1. User clicks "Start Multi-Round Interview"
2. Screen lock permission modal appears
3. User can choose to:
   - **Activate Screen Lock** (Recommended)
   - **Skip Security** (Not recommended)

### Security Status Display
- **Green**: No violations detected
- **Yellow**: Warning level (3+ violations)
- **Red**: Critical level (5+ violations, interview terminated)

### Violation Warnings
- Real-time violation notifications
- Detailed violation history
- Progressive warning system

## Security Benefits

### 🛡️ **Interview Integrity**
- Prevents external resource access
- Ensures fair assessment conditions
- Maintains professional interview standards

### 📈 **Compliance**
- Meets enterprise security requirements
- Provides audit trail of violations
- Supports regulatory compliance needs

### 🎯 **User Experience**
- Clear security status feedback
- Non-intrusive monitoring
- Graceful violation handling

## Technical Details

### Browser Compatibility
- Modern browsers with Fullscreen API support
- Event listener compatibility
- Media device access permissions

### Performance
- Lightweight monitoring with minimal CPU usage
- Efficient event handling
- Real-time violation detection

### Fallback Handling
- Graceful degradation if fullscreen fails
- Fallback security measures
- User notification of limitations

## Usage Example

```typescript
// Initialize screen lock service
import { screenLockService } from '../services/screenLockService';

// Request permission
const granted = await screenLockService.requestScreenLock();

// Monitor violations
screenLockService.onViolation((violation) => {
  console.log('Security violation:', violation);
});

// Release when done
screenLockService.releaseScreenLock();
```

## Best Practices

1. **Always request permission** before starting interviews
2. **Provide clear explanations** of security measures
3. **Handle violations gracefully** with appropriate warnings
4. **Release screen lock** when interview completes
5. **Log violations** for audit purposes

## Future Enhancements

- [ ] Advanced biometric monitoring
- [ ] AI-powered cheating detection
- [ ] Integration with proctoring services
- [ ] Mobile device support
- [ ] Advanced violation analytics

---

*This feature significantly enhances the integrity and security of the NERV interview platform, ensuring fair and professional assessment conditions.*

