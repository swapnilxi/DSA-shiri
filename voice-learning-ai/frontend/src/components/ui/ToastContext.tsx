"use client";
import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium transition-all duration-300 ${
              toast.type === "success" ? "bg-status-ok/10/95 border-status-ok/30 text-status-ok"
              : toast.type === "error" ? "bg-status-error/10/95 border-status-error/30 text-status-error"
              : "bg-surface-2/95 border-border-default text-text-primary"
            }`}
          >
            {toast.type === "success" && <CheckCircle2 size={16} className="text-status-ok shrink-0" />}
            {toast.type === "error" && <AlertCircle size={16} className="text-status-error shrink-0" />}
            {toast.type === "info" && <Info size={16} className="text-accent shrink-0" />}
            
            <span className="flex-1 min-w-0">{toast.message}</span>
            
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-2 p-1 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
