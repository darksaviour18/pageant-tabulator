import { useEffect, useCallback } from 'react';

export function useHotkeys(handlers, deps = []) {
  const handleKeyDown = useCallback((event) => {
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName);
    
    const key = event.key.toLowerCase();
    const mod = event.metaKey || event.ctrlKey;
    const shift = event.shiftKey;
    
    for (const [combo, handler] of Object.entries(handlers)) {
      const [k, ctrl, shiftReq] = combo.split('+');
      
      const keyMatch = k === key;
      const ctrlMatch = ctrl === 'mod' ? mod : ctrl === 'ctrl' ? event.ctrlKey : ctrl === 'cmd' ? event.metaKey : !ctrl;
      const shiftMatch = shiftReq ? shift : !shiftReq;
      
      if (!isInput && keyMatch && ctrlMatch && shiftMatch) {
        event.preventDefault();
        handler(event);
        break;
      }
    }
  }, [handlers]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export function HotkeyHint({ keys, label }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
      {keys.map((key, i) => (
        <span key={key}>
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg-subtle)] border border-[var(--color-border)] font-mono text-[10px]">
            {key}
          </kbd>
          {i < keys.length - 1 && <span className="mx-0.5">+</span>}
        </span>
      ))}
      {label && <span className="ml-1.5">{label}</span>}
    </span>
  );
}