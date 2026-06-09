import React, { useState } from 'react';
import { useUserInfoQuery } from '../hooks/useApiQuery';
import { useAppStore } from '../store/appStore';
import Spinner from '../components/ui/Spinner';

export default function HomePage() {
  const superApp = useAppStore((s) => s.superApp);
  const authToken = useAppStore((s) => s.authToken);
  
  const { data: userInfo, isLoading: loadingUser, error: userError } = useUserInfoQuery();
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [loadingDevice, setLoadingDevice] = useState(false);
  const [qrResult, setQrResult] = useState<string | null>(null);
  const [customTitle, setCustomTitle] = useState('My Mini App');
  const [showToken, setShowToken] = useState(false);

  // Native scan QR action
  const handleScanQR = async () => {
    if (!superApp) return;
    superApp.hapticFeedback?.('medium');
    try {
      const res = await superApp.scanQR();
      if (res.success && res.code) {
        setQrResult(res.code);
        superApp.showToast(`Scanned: ${res.code}`);
      } else if (res.error) {
        superApp.showToast(`Scan failed: ${res.error}`);
      }
    } catch (e) {
      console.error('Scan QR error:', e);
      superApp.showToast('Scan QR failed');
    }
  };

  // Native Dialog action
  const handleShowDialog = async () => {
    if (!superApp) return;
    superApp.hapticFeedback?.('light');
    const res = await superApp.showDialog({
      title: 'Confirm Action',
      message: 'Are you sure you want to trigger this action from the bridge?',
    });
    
    superApp.showToast(res.confirmed ? 'Confirmed!' : 'Cancelled');
  };

  // Native Toast action
  const handleShowToast = () => {
    if (!superApp) return;
    superApp.hapticFeedback?.('light');
    superApp.showToast('🎉 Hello from Mini App Bridge Toast!');
  };

  // Native Haptic feedback demo
  const handleHaptic = (type: 'light' | 'medium' | 'selection') => {
    if (!superApp) return;
    superApp.hapticFeedback?.(type);
    superApp.showToast(`Triggered ${type} haptic`);
  };

  // Change Header Title action
  const handleSetTitle = () => {
    if (!superApp) return;
    superApp.hapticFeedback?.('light');
    superApp.setTitle(customTitle);
    superApp.showToast(`Header title updated to: ${customTitle}`);
  };

  // Retrieve Device Info
  const handleGetDeviceInfo = async () => {
    if (!superApp) return;
    setLoadingDevice(true);
    superApp.hapticFeedback?.('light');
    try {
      const info = await superApp.getDeviceInfo();
      setDeviceInfo(info);
    } catch (e) {
      console.error('Get device info error:', e);
      superApp.showToast('Failed to get device info');
    } finally {
      setLoadingDevice(false);
    }
  };

  // Close Application
  const handleClose = () => {
    if (!superApp) return;
    superApp.hapticFeedback?.('medium');
    superApp.close();
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 text-slate-800 pb-12 font-sans selection:bg-indigo-100">
      {/* Premium Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-tr from-indigo-700 via-indigo-600 to-violet-500 text-white px-6 pt-10 pb-8 rounded-b-[2.5rem] shadow-lg shadow-indigo-100">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-indigo-500/20 rounded-full blur-xl -ml-10 -mb-10 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-inner mb-4 transition-transform hover:scale-105 duration-300">
            <span className="text-3xl">🔌</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">SuperApp Boilerplate</h1>
          <p className="text-indigo-100/90 text-sm mt-1 max-w-xs">
            Start building custom mini apps with zero-config native bridge integrations.
          </p>
        </div>
      </div>

      <div className="px-5 mt-6 space-y-6">
        {/* Section: User Profile (Dynamic API Query) */}
        <section className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">User Profile Context</h2>
          {loadingUser ? (
            <div className="py-2"><Spinner size="small" message="Fetching profile..." /></div>
          ) : userError ? (
            <div className="text-sm text-red-500 bg-red-50 p-3 rounded-xl">Error fetching profile: {(userError as Error).message}</div>
          ) : userInfo ? (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 text-lg font-bold border border-indigo-100">
                {userInfo.name?.[0] || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 truncate">{userInfo.name || 'Anonymous User'}</div>
                <div className="text-xs text-slate-400 truncate">{userInfo.email || userInfo.username || 'No email provided'}</div>
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                Active
              </span>
            </div>
          ) : (
            <div className="text-sm text-slate-400 italic py-2">No user profile received</div>
          )}
        </section>

        {/* Section: Authentication Credentials */}
        <section className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">JWT Authentication</h2>
            <button 
              onClick={() => setShowToken(!showToken)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 focus:outline-none"
            >
              {showToken ? 'Hide token' : 'Reveal token'}
            </button>
          </div>
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 relative group overflow-hidden">
            <div className="font-mono text-xs text-slate-600 break-all select-all leading-relaxed max-h-24 overflow-y-auto">
              {showToken ? authToken : `${authToken.slice(0, 16)}... •••••••••••••••`}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            The auth token is automatically extracted from `superApp.getAuthToken()` or fallback config.
          </p>
        </section>

        {/* Section: Native Dialogs & Actions */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">Native Bridge Interactions</h2>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleScanQR}
              className="bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left transition-all duration-200 active:scale-[0.98] shadow-sm flex flex-col gap-2 group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center text-lg font-bold group-hover:scale-110 transition-transform duration-200">
                📷
              </div>
              <div>
                <span className="font-semibold text-sm text-slate-800 block">Scan QR Code</span>
                <span className="text-[10px] text-slate-400">Opens scanner</span>
              </div>
            </button>

            <button
              onClick={handleShowDialog}
              className="bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left transition-all duration-200 active:scale-[0.98] shadow-sm flex flex-col gap-2 group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center text-lg font-bold group-hover:scale-110 transition-transform duration-200">
                💬
              </div>
              <div>
                <span className="font-semibold text-sm text-slate-800 block">Show Dialog</span>
                <span className="text-[10px] text-slate-400">Native confirm modal</span>
              </div>
            </button>

            <button
              onClick={handleShowToast}
              className="bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left transition-all duration-200 active:scale-[0.98] shadow-sm flex flex-col gap-2 group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg font-bold group-hover:scale-110 transition-transform duration-200">
                🍞
              </div>
              <div>
                <span className="font-semibold text-sm text-slate-800 block">Show Toast</span>
                <span className="text-[10px] text-slate-400">Native toast alert</span>
              </div>
            </button>

            <button
              onClick={handleGetDeviceInfo}
              className="bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left transition-all duration-200 active:scale-[0.98] shadow-sm flex flex-col gap-2 group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold group-hover:scale-110 transition-transform duration-200">
                📱
              </div>
              <div>
                <span className="font-semibold text-sm text-slate-800 block">Device Info</span>
                <span className="text-[10px] text-slate-400">Get OS, model etc.</span>
              </div>
            </button>
          </div>
        </section>

        {/* QR Scan Output (conditionally displayed) */}
        {qrResult && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-xl">✅</span>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-emerald-800 block uppercase">QR Code Value</span>
              <span className="text-sm text-emerald-900 font-mono break-all">{qrResult}</span>
            </div>
            <button 
              onClick={() => setQrResult(null)}
              className="text-xs font-medium text-emerald-700 hover:underline cursor-pointer"
            >
              Clear
            </button>
          </div>
        )}

        {/* Device Info Panel */}
        {deviceInfo && (
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Device Diagnostics</h2>
              <button 
                onClick={() => setDeviceInfo(null)}
                className="text-xs font-medium text-slate-400 hover:text-slate-500 cursor-pointer"
              >
                Clear
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-50 p-3 rounded-xl">
                <span className="text-xs text-slate-400 block">Platform</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">{deviceInfo.platform || 'N/A'}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl">
                <span className="text-xs text-slate-400 block">OS Version</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">{deviceInfo.osVersion || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Section: Haptics Demos */}
        <section className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Haptic Feedbacks</h2>
          <div className="flex gap-2">
            <button
              onClick={() => handleHaptic('light')}
              className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-100 hover:border-slate-200 py-2.5 rounded-xl text-xs font-medium text-slate-700 transition-colors cursor-pointer"
            >
              Light vibration
            </button>
            <button
              onClick={() => handleHaptic('medium')}
              className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-100 hover:border-slate-200 py-2.5 rounded-xl text-xs font-medium text-slate-700 transition-colors cursor-pointer"
            >
              Medium vibration
            </button>
            <button
              onClick={() => handleHaptic('selection')}
              className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-100 hover:border-slate-200 py-2.5 rounded-xl text-xs font-medium text-slate-700 transition-colors cursor-pointer"
            >
              Selection tick
            </button>
          </div>
        </section>

        {/* Section: Dynamic Header Control */}
        <section className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Header Customization</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Custom Header Title"
            />
            <button
              onClick={handleSetTitle}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-colors duration-150 cursor-pointer shadow-sm shadow-indigo-200"
            >
              Update Title
            </button>
          </div>
        </section>

        {/* Close App Button */}
        <div className="pt-2">
          <button
            onClick={handleClose}
            className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-sm py-3.5 rounded-2xl border border-red-100 transition-colors cursor-pointer text-center block"
          >
            ❌ Exit Application
          </button>
        </div>
      </div>
    </div>
  );
}
