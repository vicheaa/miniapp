import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { MockBridgeController } from '../../services/bridge/mock-bridge';
import { useMiniAppStore } from '../../store/miniAppStore';

export default function DevPanel({ controller }: { controller: MockBridgeController }) {
  const [open, setOpen] = useState(false);
  const token = useMiniAppStore((state) => state.authToken);
  const language = useMiniAppStore((state) => state.language);
  const [input, setInput] = useState(token);
  const [result, setResult] = useState('');
  const queryClient = useQueryClient();
  const bridge = controller.bridge;

  const run = async (action: () => unknown) => {
    try {
      const value = await action();
      setResult(value === undefined ? 'Done' : JSON.stringify(value, null, 2));
    } catch (error) { setResult(error instanceof Error ? error.message : String(error)); }
  };
  const saveToken = () => {
    controller.setToken(input);
    useMiniAppStore.getState().setAuthToken(input);
    void queryClient.cancelQueries();
    queryClient.clear();
    try {
      sessionStorage.setItem('dev_auth_token', input);
    } catch { /* Browser storage may be disabled. The in-memory token still works. */ }
    setResult('Development token updated for this tab.');
  };

  return (
    <aside className="dev-panel" aria-label="Development bridge tools">
      <button className="action-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="dev-tools">
        {open ? 'Close dev tools' : 'Dev tools'}
      </button>
      {open && (
        <div id="dev-tools" className="dev-panel-body">
          <h2 className="text-lg font-semibold">Dev Bridge Console</h2>
          <p className="my-3 text-sm text-slate-600">Browser mock active. Native actions are simulated.</p>
          <label htmlFor="dev-token">Development auth token</label>
          <input id="dev-token" type="password" autoComplete="off" value={input} onChange={(event) => setInput(event.target.value)} />
          <button className="action-button" onClick={saveToken}>Save token</button>
          <div className="dev-actions">
            <button onClick={() => void run(() => bridge.scanQR())}>Scan QR</button>
            <button onClick={() => void run(() => bridge.showDialog({ title: 'Mini App', message: 'Test bridge dialog' }))}>Dialog</button>
            <button onClick={() => void run(() => bridge.showToast('Hello from the mini-app'))}>Toast</button>
            <button onClick={() => void run(() => controller.setLanguage(language === 'en' ? 'km' : 'en'))}>Language: {language.toUpperCase()}</button>
            <button onClick={() => void run(() => bridge.getInitParams())}>Launch params</button>
            <button onClick={() => void run(() => bridge.getDeviceInfo())}>Device info</button>
            <button onClick={() => void run(() => bridge.getUserInfo())}>User info</button>
            <button onClick={() => void run(() => bridge.hapticFeedback('light'))}>Haptic</button>
            <button onClick={() => void run(() => bridge.openPrinterSettings())}>Printer settings</button>
            <button onClick={() => void run(() => bridge.printText('Mini App test print', false))}>Print preview</button>
            <button onClick={() => void run(() => bridge.close())}>Close mini-app</button>
          </div>
          {result && <pre className="selectable" role="status">{result}</pre>}
        </div>
      )}
    </aside>
  );
}
