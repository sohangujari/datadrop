import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
  Loader2,
} from 'lucide-react';

// Toast Types
const ToastType = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  LOADING: 'loading',
};

// Toast Configuration
const toastConfig = {
  success: {
    icon: CheckCircle2,
    bgClass: 'bg-green-500/10 border-green-500/30',
    iconClass: 'text-green-400',
    progressClass: 'bg-green-500',
  },
  error: {
    icon: XCircle,
    bgClass: 'bg-red-500/10 border-red-500/30',
    iconClass: 'text-red-400',
    progressClass: 'bg-red-500',
  },
  warning: {
    icon: AlertTriangle,
    bgClass: 'bg-yellow-500/10 border-yellow-500/30',
    iconClass: 'text-yellow-400',
    progressClass: 'bg-yellow-500',
  },
  info: {
    icon: Info,
    bgClass: 'bg-blue-500/10 border-blue-500/30',
    iconClass: 'text-blue-400',
    progressClass: 'bg-blue-500',
  },
  loading: {
    icon: Loader2,
    bgClass: 'bg-purple-500/10 border-purple-500/30',
    iconClass: 'text-purple-400',
    progressClass: 'bg-purple-500',
  },
};

// Single Toast Component
function ToastItem({ id, type, title, message, duration, onClose }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [progress, setProgress] = useState(100);

  const config = toastConfig[type] || toastConfig.info;
  const Icon = config.icon;
  const isLoading = type === ToastType.LOADING;

  // Enter animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // Auto close timer
  useEffect(() => {
    if (isLoading || duration === 0) return;

    const interval = 10;
    const decrement = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          handleClose();
          return 0;
        }
        return prev - decrement;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [duration, isLoading]);

  const handleClose = useCallback(() => {
    setIsLeaving(true);
    setTimeout(() => onClose(id), 300);
  }, [id, onClose]);

  return (
    <div
      className={`
        relative w-full max-w-sm overflow-hidden rounded-xl border backdrop-blur-sm
        shadow-lg transition-all duration-300 ease-out
        ${config.bgClass}
        ${isVisible && !isLeaving 
          ? 'translate-x-0 opacity-100' 
          : 'translate-x-full opacity-0'
        }
      `}
    >
      <div className="flex items-start gap-3 p-4">
        <div className={`shrink-0 ${isLoading ? 'animate-spin' : ''}`}>
          <Icon className={`h-5 w-5 ${config.iconClass}`} />
        </div>

        <div className="flex-1 min-w-0">
          {title && (
            <p className="font-semibold text-white text-sm">{title}</p>
          )}
          {message && (
            <p className={`text-sm text-gray-300 ${title ? 'mt-1' : ''}`}>
              {message}
            </p>
          )}
        </div>

        {!isLoading && (
          <button
            onClick={handleClose}
            className="shrink-0 p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-4 w-4 text-gray-400 hover:text-white" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {!isLoading && duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700/50">
          <div
            className={`h-full transition-all duration-100 ease-linear ${config.progressClass}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

// Toast Container Component
function ToastContainer({ toasts, removeToast, position = 'bottom-right' }) {
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  const isTop = position.startsWith('top');

  return (
    <div
      className={`fixed z-50 flex flex-col gap-3 ${positionClasses[position] || positionClasses['bottom-right']}`}
      style={{ maxHeight: 'calc(100vh - 2rem)' }}
    >
      {(isTop ? toasts : [...toasts].reverse()).map((toast) => (
        <ToastItem
          key={toast.id}
          {...toast}
          onClose={removeToast}
        />
      ))}
    </div>
  );
}

// Toast Context
const ToastContext = createContext(null);

// Toast Provider
export function ToastProvider({ children, position = 'bottom-right', maxToasts = 5 }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((options) => {
    const id = Date.now() + Math.random();
    const toast = {
      id,
      type: options.type || ToastType.INFO,
      title: options.title || '',
      message: options.message || '',
      duration: options.duration ?? 4000,
    };

    setToasts((prev) => {
      const newToasts = [...prev, toast];
      // Limit max toasts
      if (newToasts.length > maxToasts) {
        return newToasts.slice(-maxToasts);
      }
      return newToasts;
    });

    return id;
  }, [maxToasts]);

  const updateToast = useCallback((id, options) => {
    setToasts((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, ...options }
          : t
      )
    );
  }, []);

  // Convenience methods
  const toast = useCallback((message, options = {}) => {
    return addToast({ message, ...options });
  }, [addToast]);

  toast.success = (message, options = {}) =>
    addToast({ type: ToastType.SUCCESS, message, ...options });

  toast.error = (message, options = {}) =>
    addToast({ type: ToastType.ERROR, message, ...options });

  toast.warning = (message, options = {}) =>
    addToast({ type: ToastType.WARNING, message, ...options });

  toast.info = (message, options = {}) =>
    addToast({ type: ToastType.INFO, message, ...options });

  toast.loading = (message, options = {}) =>
    addToast({ type: ToastType.LOADING, message, duration: 0, ...options });

  toast.dismiss = removeToast;
  toast.update = updateToast;

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer
        toasts={toasts}
        removeToast={removeToast}
        position={position}
      />
    </ToastContext.Provider>
  );
}

// Hook to use toast
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Standalone Toast Component (without provider)
export function Toast({
  type = 'info',
  title = '',
  message = '',
  duration = 4000,
  onClose,
  show = true,
}) {
  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <ToastItem
        id="standalone"
        type={type}
        title={title}
        message={message}
        duration={duration}
        onClose={onClose || (() => {})}
      />
    </div>
  );
}

// Export types
Toast.Type = ToastType;

export default Toast;