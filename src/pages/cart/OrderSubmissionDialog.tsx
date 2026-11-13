import { useEffect, useRef, useState } from 'react';
import { useMiniAppNavigation } from '../../components/MiniAppNavigation';
import { useTranslation } from '../../hooks/useTranslation';
import { dismissKeyboard } from '../../utils/keyboardViewport';

interface Props {
  phase: 'submitting' | 'success' | null;
  orderId?: number;
  onDismiss: () => void;
}

export default function OrderSubmissionDialog({ phase, orderId, onDismiss }: Props) {
  const { t } = useTranslation();
  const { navigateTo } = useMiniAppNavigation();
  const ref = useRef<HTMLDialogElement>(null);
  const pendingNavigation = useRef<(() => void) | null>(null);
  const [displayPhase, setDisplayPhase] = useState<'submitting' | 'success'>('submitting');
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (phase) {
      setDisplayPhase(phase);
      setClosing(false);
      if (!dialog.open) {
        dismissKeyboard();
        dialog.showModal();
        dialog.focus({ preventScroll: true });
      }
      return;
    }
    if (!dialog.open) return;
    setClosing(true);
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160;
    const timer = window.setTimeout(() => {
      dialog.close();
      setClosing(false);
      const navigate = pendingNavigation.current;
      pendingNavigation.current = null;
      navigate?.();
    }, duration);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    const dialog = ref.current;
    return () => {
      pendingNavigation.current = null;
      if (dialog?.open) dialog.close();
    };
  }, []);

  const success = displayPhase === 'success';
  const leave = (to: string, state?: unknown) => {
    if (phase !== 'success' || closing || pendingNavigation.current) return;
    pendingNavigation.current = () => navigateTo(to, true, state);
    onDismiss();
  };

  return (
    <dialog ref={ref} tabIndex={-1} className={`order-submission-dialog${success ? ' order-success-dialog' : ''}`} data-state={displayPhase} data-closing={closing} aria-labelledby="order-submission-title" aria-describedby="order-submission-description" onCancel={(event) => {
      event.preventDefault();
      if (phase === 'success') onDismiss();
    }}>
      <div className="order-success-icon" aria-hidden="true">
        <span className="order-submission-spinner">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ transform: `rotate(${index * 30}deg)`, animationDelay: `${index / 12 - 1}s` }} />)}</span>
        <svg className="order-success-check" width="56" height="56" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="32" cy="32" r="23" /><path pathLength="1" d="m21 32 8 8 15-16" /></svg>
      </div>
      <div key={displayPhase} className="order-submission-copy" role="status" aria-live="polite" aria-atomic="true">
        <h2 id="order-submission-title">{t(success ? 'cart.orderSubmitted' : 'cart.submitting')}</h2>
        <p id="order-submission-description">{t(success ? 'cart.waitingConfirmation' : 'cart.submittingHint')}</p>
      </div>
      <div className="order-submission-actions" inert={phase !== 'success' || closing} aria-hidden={phase !== 'success' || closing}>
        <div className="order-success-actions">
          <button type="button" className="order-success-primary" disabled={phase !== 'success' || closing || !orderId} onClick={() => { if (orderId) leave(`/orders/${orderId}`, { from: '/' }); }}>{t('cart.viewOrder')}</button>
          <button type="button" className="order-success-secondary" disabled={phase !== 'success' || closing} onClick={() => leave('/products')}>{t('cart.createNewPo')}</button>
        </div>
      </div>
    </dialog>
  );
}
