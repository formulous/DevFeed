import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'error';
interface ToastItem {
  id: number;
  text: string;
  tone: Tone;
}

const ToastContext = createContext<((text: string, tone?: Tone) => void) | null>(null);
const DURATION = 3500;
let seq = 0;

function ToastView({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDone(item.id), DURATION);
    return () => clearTimeout(timer);
  }, [item.id, onDone]);
  return (
    <div
      className={cn(
        'pointer-events-auto rounded-lg px-4 py-2.5 text-sm text-on-inverse shadow-pop',
        item.tone === 'error' ? 'bg-danger' : 'bg-inverse',
      )}
    >
      {item.text}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((text: string, tone: Tone = 'info') => {
    seq += 1;
    setItems((prev) => [...prev.slice(-2), { id: seq, text, tone }]);
  }, []);
  const remove = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);
  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {items.map((item) => (
          <ToastView key={item.id} item={item} onDone={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('ToastProvider 밖에서 useToast 호출');
  return ctx;
}
