import { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, ...toast }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, toast.duration || 3000);
    
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[var(--z-toast)] space-y-2">
        {toasts.map(toast => (
          <Toast 
            key={toast.id} 
            {...toast} 
            onClose={() => removeToast(toast.id)} 
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ type = 'info', message, onClose }) {
  const { isDark } = useContext(require('../context/ThemeContext').useTheme) || { isDark: false };
  
  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
  };

  const styles = {
    success: isDark ? 'bg-green-900/90 border-green-700' : 'bg-green-50 border-green-200',
    error: isDark ? 'bg-red-900/90 border-red-700' : 'bg-red-50 border-red-200',
    info: isDark ? 'bg-blue-900/90 border-blue-700' : 'bg-blue-50 border-blue-200',
  };

  const textStyles = {
    success: isDark ? 'text-green-100' : 'text-green-800',
    error: isDark ? 'text-red-100' : 'text-red-800',
    info: isDark ? 'text-blue-100' : 'text-blue-800',
  };

  return (
    <div 
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg
        transform transition-all duration-300 ease-out animate-slide-in-right
        ${styles[type]}
      `}
    >
      {icons[type]}
      <span className={`text-sm font-medium ${textStyles[type]}`}>{message}</span>
      <button 
        onClick={onClose}
        className={`ml-2 p-1 rounded hover:bg-black/10 ${textStyles[type]}`}
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      addToast: (msg) => console.log('[Toast]', msg),
      removeToast: () => {},
    };
  }
  return context;
}

export function toast(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
}