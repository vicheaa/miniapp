import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, ChevronDown, ChevronLeft, ChevronRight, Eye, PanelLeft, Pencil, Plus, RotateCw, Search, ShoppingCart, Smartphone, Trash2, X } from 'lucide-react';
import { fetchPosApps } from '../services/api/pos-apps';
import { useMiniAppStore } from '../store/miniAppStore';
import type { PosApp } from '../types/pos-app';
import './pos-apps.css';

const unavailable = 'This action needs an additional API endpoint.';

function AppDetails({ app, onClose }: { app: PosApp; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const rows = [
    ['App key', app.app_key], ['Merchant', app.merchant?.name || '—'],
    ['Merchant code', app.merchant?.code || '—'], ['Currency', app.ccy],
    ['Second currency', app.second_ccy || '—'], ['Status', app.is_active ? 'Active' : 'Inactive'],
    ['Order sources', String(app.order_sources_count)], ['ID', app.id],
    ['Created', new Date(app.created_at).toLocaleString()],
    ['Last updated', new Date(app.updated_at).toLocaleString()],
  ];
  return (
    <dialog ref={dialog} className="pos-dialog" onCancel={onClose} onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }} aria-labelledby="pos-detail-title">
      <div className="pos-dialog-body">
        <div className="pos-dialog-heading">
          <h2 id="pos-detail-title">{app.name}</h2>
          <button className="pos-icon-button" onClick={onClose} aria-label="Close details"><X size={19} /></button>
        </div>
        <dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </div>
    </dialog>
  );
}

export default function HomePage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<PosApp | null>(null);
  const token = useMiniAppStore((state) => state.authToken);
  const bridge = useMiniAppStore((state) => state.superApp);
  const apps = useQuery({ queryKey: ['pos-apps', page, token], queryFn: ({ signal }) => fetchPosApps(page, signal) });
  const user = useQuery({
    queryKey: ['bridge-user', bridge], queryFn: () => bridge!.getUserInfo(), enabled: !!bridge,
  });
  const userName = typeof user.data?.name === 'string' ? user.data.name : 'Account';
  const term = search.trim().toLowerCase();
  const visibleApps = apps.data?.data.filter((app) =>
    app.name.toLowerCase().includes(term) || app.app_key.toLowerCase().includes(term)) || [];

  return (
    <div className="pos-page">
      <header className="pos-header">
        <PanelLeft className="pos-panel-icon" size={19} aria-hidden="true" />
        <div className="pos-page-heading"><h1>POS Apps</h1><p>Manage POS App instances and access credentials.</p></div>
        <div className="pos-account">
          <button type="button" className="pos-icon-button" aria-label="Reload POS" title="Reload POS" onClick={() => window.location.reload()}><RotateCw size={19} /></button>
          <span className="pos-notification" title="Notifications"><Bell size={20} /></span>
          <span className="pos-avatar" aria-hidden="true">{userName.charAt(0).toUpperCase()}</span>
          <span className="pos-user-name">{userName}</span><ChevronDown size={15} aria-hidden="true" />
        </div>
      </header>

      <main className="pos-content">
        <div className="pos-toolbar">
          <label className="pos-search"><Search size={18} aria-hidden="true" />
            <input type="search" placeholder="Search POS Apps by name or key..." aria-label="Search POS apps on this page" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <button className="pos-add" disabled title={unavailable}><Plus size={17} />Add POS App</button>
        </div>
        {apps.data && apps.data.last_page > 1 && <p className="pos-search-note">Search filters the current page.</p>}

        <div className="pos-table-wrap" aria-busy={apps.isFetching}>
          <table className="pos-table">
            <thead><tr><th scope="col">Name</th><th scope="col">App key</th><th scope="col">Merchant</th><th scope="col">Currency</th><th scope="col">Status</th><th scope="col" className="pos-actions-heading">Actions</th></tr></thead>
            <tbody>
              {apps.isPending && [0, 1, 2].map((row) => <tr key={row} aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((cell) => <td key={cell}><span className="pos-skeleton skeleton-shimmer" /></td>)}</tr>)}
              {apps.isError && <tr><td colSpan={6}><div className="pos-state" role="alert"><h2>Unable to load POS apps</h2><p>{apps.error instanceof Error ? apps.error.message : 'Check your connection and try again.'}</p><button onClick={() => void apps.refetch()} disabled={apps.isFetching}>{apps.isFetching ? 'Retrying…' : 'Try again'}</button></div></td></tr>}
              {!apps.isPending && !apps.isError && visibleApps.length === 0 && <tr><td colSpan={6}><div className="pos-state"><Smartphone size={26} /><h2>{term ? 'No matching POS apps' : 'No POS apps yet'}</h2><p>{term ? 'Try another name or app key.' : 'POS apps will appear here when available.'}</p>{term && <button onClick={() => setSearch('')}>Clear search</button>}</div></td></tr>}
              {!apps.isError && visibleApps.map((app) => (
                <tr key={app.id}>
                  <td><div className="pos-app-name"><span className="pos-device"><Smartphone size={16} /></span><span>{app.name}</span></div></td>
                  <td><code className="pos-app-key">{app.app_key}</code></td>
                  <td className="pos-merchant">{app.merchant?.name || '—'}</td>
                  <td><div className="pos-currencies"><span className="pos-currency pos-primary-currency">{app.ccy}</span>{app.second_ccy && <span className="pos-currency pos-secondary-currency">{app.second_ccy}</span>}</div></td>
                  <td><span className={`pos-status ${app.is_active ? 'is-active' : 'is-inactive'}`}>{app.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td><div className="pos-actions">
                    <Link className="pos-icon-button pos-orders" to={`/pos-apps/${encodeURIComponent(app.id)}/pos`} aria-label={`Open POS terminal for ${app.name}`} title="Open POS Terminal"><ShoppingCart size={17} /></Link>
                    <button className="pos-icon-button" onClick={() => setSelectedApp(app)} aria-label={`View ${app.name}`} title="View details"><Eye size={17} /></button>
                    <button className="pos-icon-button" disabled aria-label={`Edit ${app.name}`} title={unavailable}><Pencil size={17} /></button>
                    <button className="pos-icon-button" disabled aria-label={`Delete ${app.name}`} title={unavailable}><Trash2 size={17} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {apps.isPending && <span className="pos-sr-only" role="status">Loading POS apps…</span>}
        </div>
        {apps.data && apps.data.last_page > 1 && <nav className="pos-pagination" aria-label="POS apps pagination">
          <span>{apps.data.from ?? 0}–{apps.data.to ?? 0} of {apps.data.total} apps</span>
          <div><button disabled={page <= 1 || apps.isFetching} onClick={() => { setPage((value) => value - 1); setSearch(''); }} aria-label="Previous page"><ChevronLeft size={17} /></button><span>Page {page} of {apps.data.last_page}</span><button disabled={page >= apps.data.last_page || apps.isFetching} onClick={() => { setPage((value) => value + 1); setSearch(''); }} aria-label="Next page"><ChevronRight size={17} /></button></div>
        </nav>}
      </main>
      {selectedApp && <AppDetails app={selectedApp} onClose={() => setSelectedApp(null)} />}
    </div>
  );
}
