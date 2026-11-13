import { useEffect, useRef, type ReactNode } from 'react';
import { dismissKeyboard } from '../../utils/keyboardViewport';

export default function BottomSheet({ title, onClose, children, className = '', swipeToClose = false }: { title: string; onClose: () => void; children: ReactNode; className?: string; swipeToClose?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ y: number; time: number; offset: number } | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      dismissKeyboard();
      dialog.showModal();
    }
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return <dialog ref={ref} className={`checkout-sheet ${className}`} aria-label={title} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => {
    if (!swipeToClose || event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientY < bounds.top || event.clientY > bounds.bottom || event.clientX < bounds.left || event.clientX > bounds.right) onClose();
  }}>
    <div className={`checkout-sheet-grabber${swipeToClose ? ' is-draggable' : ''}`} aria-hidden="true"
      onPointerDown={(event) => {
        if (!swipeToClose || !event.isPrimary || event.button !== 0) return;
        drag.current = { y: event.clientY, time: performance.now(), offset: 0 };
        event.currentTarget.setPointerCapture(event.pointerId);
        if (ref.current) ref.current.style.transition = 'none';
      }}
      onPointerMove={(event) => {
        if (!drag.current || !ref.current) return;
        drag.current.offset = Math.max(0, event.clientY - drag.current.y);
        ref.current.style.transform = `translateY(${drag.current.offset}px)`;
      }}
      onPointerUp={(event) => {
        const gesture = drag.current;
        drag.current = null;
        if (!gesture || !ref.current) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        ref.current.style.transition = '';
        ref.current.style.transform = '';
        const velocity = gesture.offset / Math.max(1, performance.now() - gesture.time);
        if (gesture.offset > 80 || (gesture.offset > 30 && velocity > .5)) onClose();
      }}
      onPointerCancel={() => {
        drag.current = null;
        if (ref.current) { ref.current.style.transition = ''; ref.current.style.transform = ''; }
      }}><div className="checkout-sheet-handle" /></div>
    {children}
  </dialog>;
}
