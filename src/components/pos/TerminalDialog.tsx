import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function TerminalDialog({ title, header, className = '', onClose, children, busy = false }: { title: string; header?: React.ReactNode; className?: string; onClose: () => void; children: React.ReactNode; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className={`terminal-dialog ${className}`} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby="terminal-dialog-title" onClick={(event) => {
    if (!busy && event.target === event.currentTarget) onClose();
  }}><div className="terminal-dialog-content"><header>{header || <h2 id="terminal-dialog-title">{title}</h2>}<button disabled={busy} aria-label="Close" onClick={onClose}><X size={19} /></button></header>{children}</div></dialog>;
}
