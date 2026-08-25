import React, { useState } from 'react';
import type { SuperAppBridge } from '../../types/bridge';
import { useMiniAppStore } from '../../store/miniAppStore';
import { useWorkflowStore } from '../../store/workflowStore';

interface DevPanelProps {
  superApp: SuperAppBridge;
  authToken: string;
  onSaveToken: (token: string) => void;
}

export default function DevPanel({ superApp, authToken, onSaveToken }: DevPanelProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [tokenInput, setTokenInput] = useState(authToken);

  const language = useMiniAppStore((s) => s.language);
  const myRequest = useWorkflowStore((s) => s.myRequest);
  const setMyRequest = useWorkflowStore((s) => s.setMyRequest);

  // Keep input in sync when external token changes
  React.useEffect(() => {
    setTokenInput(authToken);
  }, [authToken]);

  const handleScanQR = async () => {
    const result = await superApp.scanQR();
    console.log('[DevPanel] scanQR result:', result);
  };

  const handleShowDialog = async () => {
    await superApp.showDialog({
      title: 'Hello from Mini App!',
      message: 'This dialog was triggered from a React component.',
    });
  };

  const handleShowToast = () => {
    superApp.showToast('🎉 Toast from the mini app!');
  };

  const handleClose = () => {
    superApp.close();
  };

  const handleToggleLanguage = () => {
    const nextLang = language === 'en' ? 'km' : 'en';
    (window as any).__mockLanguage = nextLang;
    if ((window as any).triggerMockEvent) {
      (window as any).triggerMockEvent('onLanguageChanged', { language: nextLang });
    }
  };

  const handleToggleMyRequest = () => {
    setMyRequest(!myRequest);
  };

  if (!showPanel) {
    return (
      <div style={styles.wrapper}>
        <button onClick={() => setShowPanel(true)} style={styles.pillBtn}>
          <span>🛠️ Dev Mode</span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              backgroundColor: myRequest ? '#10b981' : '#374151',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            myRequest: {myRequest ? 'TRUE' : 'FALSE'}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.panel}>
        <div style={styles.panelHeader}>
          <span style={styles.panelTitle}>🛠️ Dev Bridge Console</span>
          <button onClick={() => setShowPanel(false)} style={styles.closeBtn}>
            ×
          </button>
        </div>

        <div style={styles.panelBody}>
          <p style={styles.descText}>
            Running standalone. Using static fallback token and mock bridge actions.
          </p>

          {/* Workflow Store Controls */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Workflow Filters:</label>
            <button
              onClick={handleToggleMyRequest}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                borderRadius: '8px',
                border: myRequest ? '1px solid #10b981' : '1px solid #374151',
                backgroundColor: myRequest ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color: myRequest ? '#34d399' : '#cbd5e0',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
            >
              <span>📋 myRequest (Task List Filter)</span>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  backgroundColor: myRequest ? '#10b981' : '#4b5563',
                  color: '#ffffff',
                }}
              >
                {myRequest ? '✓ TRUE (My Requests)' : '✗ FALSE (Approvals)'}
              </span>
            </button>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Auth Token Fallback:</label>
            <div style={styles.inputRow}>
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                style={styles.input}
                placeholder="Enter token..."
              />
              <button
                onClick={() => onSaveToken(tokenInput)}
                style={styles.saveBtn}
              >
                Save
              </button>
            </div>
          </div>

          <div style={styles.actionsGroup}>
            <span style={styles.label}>Test Bridge Actions:</span>
            <div style={styles.btnGrid}>
              <button onClick={handleScanQR} style={styles.testBtn}>
                Scan QR
              </button>
              <button onClick={handleShowDialog} style={styles.testBtn}>
                Show Dialog
              </button>
              <button onClick={handleShowToast} style={styles.testBtn}>
                Show Toast
              </button>
              <button onClick={handleToggleLanguage} style={styles.testBtn}>
                Toggle Lang ({language === 'en' ? 'EN ➔ KM' : 'KM ➔ EN'})
              </button>
              <button onClick={handleClose} style={styles.testBtn}>
                Close App
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    width: '90%',
    maxWidth: '440px',
    fontFamily: "'Kantumruy Pro', sans-serif",
  },
  pillBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    margin: '0 auto',
    padding: '8px 14px',
    background: 'rgba(26, 26, 46, 0.95)',
    border: '1px solid rgba(67, 97, 238, 0.4)',
    borderRadius: '30px',
    color: '#93c5fd',
    fontSize: '12.5px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    transition: 'all 0.2s',
  },
  panel: {
    background: 'rgba(26, 26, 46, 0.98)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    padding: '16px',
    color: '#fff',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(10px)',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    paddingBottom: '8px',
  },
  panelTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#e2e8f0',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#a0aec0',
    fontSize: '20px',
    cursor: 'pointer',
    lineHeight: 1,
    padding: '0 4px',
  },
  panelBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  descText: {
    fontSize: '11px',
    color: '#a0aec0',
    margin: 0,
    lineHeight: 1.4,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#cbd5e0',
  },
  inputRow: {
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    background: '#121224',
    border: '1px solid #2d3748',
    borderRadius: '8px',
    padding: '8px 12px',
    color: '#fff',
    fontSize: '12px',
    outline: 'none',
    fontFamily: 'monospace',
  },
  saveBtn: {
    background: '#4361ee',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  actionsGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '4px',
  },
  btnGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
  },
  testBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#e2e8f0',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '8px',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};

