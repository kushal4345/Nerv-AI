import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Eye, 
  EyeOff,
  Monitor,
  Keyboard,
  Mouse,
  Lock,
  Unlock
} from 'lucide-react';
import { screenLockService, ViolationEvent } from '../services/screenLockService';

interface SecurityStatusProps {
  isVisible: boolean;
  onViolationWarning?: (violationCount: number) => void;
  onInterviewTermination?: () => void;
}

const SecurityStatus: React.FC<SecurityStatusProps> = ({
  isVisible,
  onViolationWarning,
  onInterviewTermination
}) => {
  const [isLocked, setIsLocked] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [recentViolations, setRecentViolations] = useState<ViolationEvent[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [isTerminated, setIsTerminated] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    // Get initial state
    const state = screenLockService.getState();
    setIsLocked(state.isLocked);
    setViolationCount(state.violationCount);
    setRecentViolations(state.violations.slice(-3));
    setIsTerminated(false); // No longer terminating interviews

    // Set up violation monitoring
    const handleViolation = (violation: ViolationEvent) => {
      setViolationCount(prev => prev + 1);
      setRecentViolations(prev => [...prev.slice(-2), violation]);
      
      if (onViolationWarning) {
        onViolationWarning(violationCount + 1);
      }
    };

    const handleWarning = () => {
      if (onViolationWarning) {
        onViolationWarning(violationCount);
      }
    };

    screenLockService.onViolation(handleViolation);
    screenLockService.onWarning(handleWarning);

    return () => {
      // Cleanup handled by service
    };
  }, [isVisible, violationCount, onViolationWarning, onInterviewTermination]);

  const getViolationIcon = (type: string) => {
    switch (type) {
      case 'tab_switch': return <Monitor className="h-3 w-3" />;
      case 'window_blur': return <EyeOff className="h-3 w-3" />;
      case 'copy_attempt': return <Keyboard className="h-3 w-3" />;
      case 'paste_attempt': return <Keyboard className="h-3 w-3" />;
      case 'right_click': return <Mouse className="h-3 w-3" />;
      case 'keyboard_shortcut': return <Keyboard className="h-3 w-3" />;
      default: return <AlertTriangle className="h-3 w-3" />;
    }
  };

  const getStatusColor = () => {
    if (violationCount >= 10) return 'text-red-400';
    if (violationCount >= 5) return 'text-yellow-400';
    if (violationCount > 0) return 'text-orange-400';
    return 'text-green-400';
  };

  const getStatusIcon = () => {
    if (violationCount >= 10) return <AlertTriangle className="h-4 w-4" />;
    if (violationCount >= 5) return <AlertTriangle className="h-4 w-4" />;
    if (violationCount > 0) return <AlertTriangle className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  if (!isVisible || !isLocked) return null;

  return (
    <div className="fixed top-4 left-4 z-30">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-black/80 backdrop-blur-sm border border-gray-600/50 rounded-lg p-3 min-w-[200px]"
      >
        {/* Main Status */}
        <div className="flex items-center space-x-2 mb-2">
          {isLocked ? (
            <Lock className="h-4 w-4 text-green-400" />
          ) : (
            <Unlock className="h-4 w-4 text-red-400" />
          )}
          <span className="text-sm font-medium text-white">Security Active</span>
          <div className={`flex items-center space-x-1 ${getStatusColor()}`}>
            {getStatusIcon()}
            <span className="text-xs">
              {violationCount === 0 ? 'Secure' : `${violationCount} violations`}
            </span>
          </div>
        </div>

        {/* Violation Bar */}
        {violationCount > 0 && (
          <div className="mb-2">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Violations</span>
              <span>{violationCount}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    violationCount >= 10 ? 'bg-red-500' :
                    violationCount >= 5 ? 'bg-yellow-500' :
                    'bg-orange-500'
                  }`}
                  style={{ width: `${Math.min((violationCount / 10) * 100, 100)}%` }}
                />
            </div>
          </div>
        )}

        {/* Toggle Details */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>

        {/* Detailed View */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 pt-3 border-t border-gray-600/50"
            >
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-gray-300">Security Features:</h4>
                <div className="grid grid-cols-2 gap-1 text-xs text-gray-400">
                  <div className="flex items-center space-x-1">
                    <Monitor className="h-3 w-3" />
                    <span>Fullscreen</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Eye className="h-3 w-3" />
                    <span>Tab Monitor</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Keyboard className="h-3 w-3" />
                    <span>Copy/Paste Block</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Mouse className="h-3 w-3" />
                    <span>Right-click Block</span>
                  </div>
                </div>

                {recentViolations.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-xs font-medium text-gray-300 mb-2">Recent Violations:</h4>
                    <div className="space-y-1">
                      {recentViolations.map((violation, index) => (
                        <div key={index} className="flex items-center space-x-2 text-xs text-gray-400">
                          {getViolationIcon(violation.type)}
                          <span className="flex-1 truncate">
                            {violation.type.replace('_', ' ')}
                          </span>
                          <span className="text-gray-500">
                            {violation.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default SecurityStatus;
