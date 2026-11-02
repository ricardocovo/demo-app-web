import { useEffect, useRef, type ReactNode } from 'react';
import { AlertCircle, LoaderCircle, X } from 'lucide-react';
import { errorMessage } from './api';

export function Loading({ label = 'Loading your league...' }: { label?: string }) {
  return <div className="state" role="status"><LoaderCircle className="spin" size={26} /><p>{label}</p></div>;
}
export function Failure({ error, retry }: { error: unknown; retry?: () => void }) {
  return <div className="error-box" role="alert"><AlertCircle size={20} /><div><strong>That didn&apos;t go to plan</strong><p>{errorMessage(error)}</p>{retry && <button className="text-button" onClick={retry}>Try again</button>}</div></div>;
}
export function Empty({ title = 'A fresh start', children }: { title?: string; children: ReactNode }) {
  return <div className="state empty"><span className="empty-ball" aria-hidden="true">&#9917;</span><h2>{title}</h2><p>{children}</p></div>;
}
export function Modal({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current!;
    dialog.showModal();
    dialog.querySelector<HTMLElement>('[autofocus], input, select, button')?.focus();
    return () => {
      dialog.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return <dialog ref={ref} aria-labelledby="modal-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} onKeyDown={e => {
    if (e.key !== 'Tab') return;
    const items = Array.from(ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')).filter(element => element.getClientRects().length > 0);
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  }}>
    <div className="modal-header"><h2 id="modal-title">{title}</h2><button className="icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog>;
}
