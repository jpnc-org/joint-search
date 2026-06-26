import { createContext, useCallback, useContext, useState, useRef } from 'react';
import { X } from 'lucide-react';

interface Toast {
  id: number;
  message: string;
  type: 'error' | 'success';
}

const ToastContext = createContext<(message: string, type?: 'error' | 'success') => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2 ${
              t.type === 'error'
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-green-600 text-white'
            }`}
          >
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-70 hover:opacity-100 cursor-pointer">
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
