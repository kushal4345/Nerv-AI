import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Lock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Monitor,
  Eye,
  EyeOff,
  Keyboard,
  Mouse
} from 'lucide-react';
import { screenLockService, ViolationEvent } from '../services/screenLockService';

interface ScreenLockPermissionProps {
  onPermissionGranted: () => void;
  onPermissionDenied: () => void;
  isVisible: boolean;
}

interface ViolationWarningProps {
  violations: ViolationEvent[];
  violationCount: number;
  maxViolations: number;
  onDismiss: () => void;
}

const ViolationWarning: React.FC<ViolationWarningProps> = ({
  violations,
  violationCount,
  maxViolations,
  onDismiss
}) => {
  const getViolationIcon = (type: string) => {
    switch (type) {
      case 'tab_switch': return <Monitor className="h-4 w-4" />;
      case 'window_blur': return <EyeOff className="h-4 w-4" />;
      case 'copy_attempt': return <Keyboard className="h-4 w-4" />;
      case 'paste_attempt': return <Keyboard className="h-4 w-4" />;
      case 'right_click': return <Mouse className="h-4 w-4" />;
      case 'keyboard_shortcut': return <Keyboard className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getViolationMessage = (type: string) => {
    switch (type) {
      case 'tab_switch': return 'Tab switching detected';
      case 'window_blur': return 'Window focus lost';
      case 'copy_attempt': return 'Copy attempt blocked';
      case 'paste_attempt': return 'Paste attempt blocked';
      case 'right_click': return 'Right-click blocked';
      case 'keyboard_shortcut': return 'Blocked keyboard shortcut';
      default: return 'Security violation detected';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed top-4 right-4 z-50 bg-red-900/90 backdrop-blur-sm border border-red-500/50 rounded-lg p-4 max-w-md"
    >
      <div className="flex items-start space-x-3">
        <AlertTriangle className="h-6 w-6 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-red-300 mb-2">
            Security Warning
          </h3>
          <p className="text-red-200 text-sm mb-3">
            {violationCount} of {maxViolations} violations detected. 
            {violationCount >= maxViolations ? ' Interview will be terminated.' : ' Please focus on the interview.'}
          </p>
          
          <div className="space-y-2 mb-4">
            <h4 className="text-sm font-medium text-red-300">Recent violations:</h4>
            {violations.slice(-3).map((violation, index) => (
              <div key={index} className="flex items-center space-x-2 text-xs text-red-200">
                {getViolationIcon(violation.type)}
                <span>{getViolationMessage(violation.type)}</span>
                <span className="text-red-400">
                  {violation.timestamp.toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={onDismiss}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const ScreenLockPermission: React.FC<ScreenLockPermissionProps> = ({
  onPermissionGranted,
  onPermissionDenied,
  isVisible
}) => {
  console.log('ScreenLockPermission rendered with isVisible:', isVisible);
  const [isRequesting, setIsRequesting] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const [violations, setViolations] = useState<ViolationEvent[]>([]);
  const [violationCount, setViolationCount] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    // Set up violation monitoring
    const handleViolation = (violation: ViolationEvent) => {
      setViolations(prev => [...prev, violation]);
      setViolationCount(prev => prev + 1);
    };

    const handleWarning = () => {
      setShowViolationWarning(true);
    };

    const handleTermination = () => {
      setShowViolationWarning(true);
      // Could trigger interview termination here
    };

    screenLockService.onViolation(handleViolation);
    screenLockService.onWarning(handleWarning);
    screenLockService.onTermination(handleTermination);

    return () => {
      // Cleanup is handled by the service
    };
  }, [isVisible]);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    setPermissionStatus('idle');

    try {
      const granted = await screenLockService.requestScreenLock();
      
      if (granted) {
        setPermissionStatus('granted');
        setTimeout(() => {
          onPermissionGranted();
        }, 1500);
      } else {
        setPermissionStatus('denied');
        setTimeout(() => {
          onPermissionDenied();
        }, 2000);
      }
    } catch (error) {
      console.error('Screen lock request failed:', error);
      setPermissionStatus('denied');
      setTimeout(() => {
        onPermissionDenied();
      }, 2000);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismissWarning = () => {
    setShowViolationWarning(false);
  };

  if (!isVisible) {
    console.log('ScreenLockPermission: Not visible, returning null');
    return null;
  }
  
  console.log('ScreenLockPermission: Visible, rendering modal');

  return (
    <>
      <AnimatePresence>
        {showViolationWarning && (
          <ViolationWarning
            violations={violations}
            violationCount={violationCount}
            maxViolations={5}
            onDismiss={handleDismissWarning}
          />
        )}
      </AnimatePresence>

      {/* Simple test modal first */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
        style={{ zIndex: 9999 }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-2xl w-full"
        >
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-blue-600/20 rounded-full">
                <Shield className="h-12 w-12 text-blue-400" />
              </div>
            </div>

            <h1 className="text-3xl font-bold text-white mb-4">
              Interview Security Setup
            </h1>
            
            <p className="text-gray-300 text-lg mb-8">
              To ensure a fair and secure interview experience, we need to activate screen lock mode.
            </p>

            <div className="bg-gray-800/50 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center justify-center">
                <Lock className="h-5 w-5 mr-2" />
                Security Features
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center space-x-3 text-gray-300">
                  <Monitor className="h-4 w-4 text-green-400" />
                  <span>Fullscreen mode activation</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-300">
                  <Eye className="h-4 w-4 text-green-400" />
                  <span>Tab switching detection</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-300">
                  <Keyboard className="h-4 w-4 text-green-400" />
                  <span>Copy/paste blocking</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-300">
                  <Mouse className="h-4 w-4 text-green-400" />
                  <span>Right-click blocking</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-300">
                  <AlertTriangle className="h-4 w-4 text-green-400" />
                  <span>Keyboard shortcut blocking</span>
                </div>
                <div className="flex items-center space-x-3 text-gray-300">
                  <Shield className="h-4 w-4 text-green-400" />
                  <span>Real-time violation monitoring</span>
                </div>
              </div>
            </div>

            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-8">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <h3 className="text-yellow-300 font-semibold mb-2">Important Notice</h3>
                  <ul className="text-yellow-200 text-sm space-y-1">
                    <li>• The interview will be conducted in fullscreen mode</li>
                    <li>• Switching tabs or applications will be detected</li>
                    <li>• Copy, paste, and right-click functions will be disabled</li>
                    <li>• Multiple violations may result in interview termination</li>
                    <li>• Ensure you have a stable internet connection</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {permissionStatus === 'idle' && (
                <>
                  <button
                    onClick={() => {
                      console.log('Activate Screen Lock clicked');
                      handleRequestPermission();
                    }}
                    disabled={isRequesting}
                    className="flex items-center justify-center space-x-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-semibold rounded-lg transition-colors"
                  >
                    {isRequesting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        <span>Activating Security...</span>
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4" />
                        <span>Activate Screen Lock</span>
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => {
                      console.log('Skip Security clicked');
                      onPermissionDenied();
                    }}
                    disabled={isRequesting}
                    className="px-8 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600/50 text-white font-semibold rounded-lg transition-colors"
                  >
                    Skip Security (Not Recommended)
                  </button>
                </>
              )}

              {permissionStatus === 'granted' && (
                <div className="flex items-center justify-center space-x-2 text-green-400">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-lg font-semibold">Security Activated Successfully!</span>
                </div>
              )}

              {permissionStatus === 'denied' && (
                <div className="flex items-center justify-center space-x-2 text-red-400">
                  <XCircle className="h-5 w-5" />
                  <span className="text-lg font-semibold">Security Setup Failed</span>
                </div>
              )}
            </div>

            <p className="text-gray-400 text-sm mt-6">
              By proceeding, you agree to the interview security measures and understand that violations may be recorded.
            </p>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default ScreenLockPermission;

