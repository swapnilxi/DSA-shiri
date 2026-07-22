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
              toast.type === "success" ? "bg-emerald-950/95 border-emerald-800 text-emerald-200"
              : toast.type === "error" ? "bg-red-950/95 border-red-800 text-red-200"
              : "bg-gray-800/95 border-gray-700 text-gray-200"
            }`}
          >
            {toast.type === "success" && <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />}
            {toast.type === "error" && <AlertCircle size={16} className="text-red-400 shrink-0" />}
            {toast.type === "info" && <Info size={16} className="text-blue-400 shrink-0" />}
            
            <span className="flex-1 min-w-0">{toast.message}</span>
            
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-2 p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded transition-colors shrink-0"
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
