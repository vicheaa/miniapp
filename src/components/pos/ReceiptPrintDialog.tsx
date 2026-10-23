import { useEffect, useRef, useState } from 'react';
import type { SavedReceipt } from '../../utils/receipt';
import type { SuperAppBridge } from '../../types/bridge';
import { openPrinterSettings, printReceipt } from '../../services/bridge/printer';
import TerminalDialog from './TerminalDialog';

export default function ReceiptPrintDialog({ receipt, bridge, onClose }: { receipt: SavedReceipt; bridge: SuperAppBridge | null; onClose: () => void }) {
  const [pending, setPending] = useState(true);
  const [error, setError] = useState('');
  const [printed, setPrinted] = useState(false);
  const started = useRef(false);
  const busy = useRef(false);
  const print = async () => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(''); setPrinted(false);
    try { await printReceipt(bridge, receipt.text); setPrinted(true); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to print the receipt.'); }
    finally { busy.current = false; setPending(false); }
  };
  useEffect(() => {
    // React StrictMode repeats effects in development; submit one print job per sale.
    if (started.current) return;
    started.current = true;
    void print();
  }, []);

  return <TerminalDialog title="Order saved" onClose={onClose} busy={pending}>
    <p className="terminal-muted">{receipt.orderId !== undefined ? `Order ${receipt.orderId} was saved successfully.` : 'Your order was saved successfully.'}</p>
    <p role="status">{pending ? 'Contacting printer…' : printed ? 'Receipt sent to printer.' : 'Receipt printing needs attention.'}</p>
    {error && <p className="terminal-checkout-error" role="alert">{error} The order is already saved. Retry printing only; do not place the order again.</p>}
    <details className="terminal-receipt-preview"><summary>View receipt</summary><pre>{receipt.text}</pre></details>
    <div className="terminal-receipt-actions">
      <button className="terminal-primary" disabled={pending} onClick={() => void print()}>{printed ? 'Print again' : 'Retry printing'}</button>
      <button className="terminal-checkout-back" disabled={pending} onClick={async () => {
        if (busy.current) return;
        busy.current = true; setPending(true); setError('');
        try { await openPrinterSettings(bridge); }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to open printer settings.'); }
        finally { busy.current = false; setPending(false); }
      }}>Printer settings</button>
      <button className="terminal-checkout-back" disabled={pending} onClick={onClose}>Done</button>
    </div>
  </TerminalDialog>;
}
