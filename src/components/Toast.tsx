import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, Coffee, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'coffee' | 'warm';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  text: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (type: ToastType, text: string, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, text: string, title?: string, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = { id, type, text, title, duration };
    
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const contextValue = useMemo(() => ({ addToast, removeToast }), [addToast, removeToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      
      {/* Toast Portal Container */}
      <div 
        className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none"
        id="toast_container"
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            // Pick visual theme & icons
            let bgClass = 'bg-[#0c1e15]/95 border-emerald-900 text-emerald-200';
            let icon = <Info className="w-5 h-5 text-emerald-400" />;
            let titleColor = 'text-emerald-300';
            
            if (toast.type === 'success') {
              bgClass = 'bg-[#0f241a]/95 border-lime-500/30 text-lime-100 shadow-[0_0_20px_rgba(132,204,22,0.1)]';
              icon = <CheckCircle2 className="w-5 h-5 text-lime-400 animate-bounce" style={{ animationDuration: '2s' }} />;
              titleColor = 'text-lime-300';
            } else if (toast.type === 'error') {
              bgClass = 'bg-[#290d11]/95 border-rose-500/20 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.1)]';
              icon = <AlertCircle className="w-5 h-5 text-rose-400" />;
              titleColor = 'text-rose-300';
            } else if (toast.type === 'warning') {
              bgClass = 'bg-[#261d0f]/95 border-amber-500/20 text-amber-100';
              icon = <AlertCircle className="w-5 h-5 text-amber-400" />;
              titleColor = 'text-amber-300';
            } else if (toast.type === 'coffee' || toast.type === 'warm') {
              // Delightful Tequila Café branding
              bgClass = 'bg-[#152e23] border-[#a3e635]/30 text-emerald-100 shadow-[0_4px_24px_rgba(16,36,27,0.8)]';
              icon = <Coffee className="w-5 h-5 text-lime-400" />;
              titleColor = 'text-lime-400';
            }

            return (
              <motion.div
                key={toast.id}
                id={`toast_item_${toast.id}`}
                layout
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: -10, transition: { duration: 0.2 } }}
                className={`pointer-events-auto flex gap-3.5 p-4 rounded-xl border backdrop-blur-md shadow-2xl relative group overflow-hidden ${bgClass}`}
              >
                {/* Visual Accent Glow Bar */}
                <div className="absolute top-0 bottom-0 left-0 w-1 bg-lime-500/40" />

                {/* Icon Box */}
                <div className="flex-shrink-0 pt-0.5" id={`toast_icon_${toast.id}`}>
                  {icon}
                </div>

                {/* Content Area */}
                <div className="flex-grow pr-4" id={`toast_content_${toast.id}`}>
                  {toast.title && (
                    <h5 className={`text-sm font-bold tracking-tight mb-0.5 ${titleColor}`}>
                      {toast.title}
                    </h5>
                  )}
                  <p className="text-xs leading-relaxed text-slate-300 font-medium">
                    {toast.text}
                  </p>
                </div>

                {/* Manual Close Button */}
                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="absolute top-3 right-3 text-emerald-600 hover:text-emerald-300 transition-colors p-1 rounded-lg hover:bg-emerald-950/40 pointer-events-auto"
                  aria-label="Close Toast"
                  id={`toast_close_${toast.id}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};
