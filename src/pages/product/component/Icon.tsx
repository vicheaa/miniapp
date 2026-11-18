export default function Icon({ name }: { name: 'back' | 'back-ios' | 'chevron-right' | 'calendar' | 'location' | 'locate' | 'layers' | 'search' | 'edit' | 'plus' | 'minus' | 'close' | 'image' | 'bottle' | 'grid' | 'list' | 'copy' | 'check' | 'phone' }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === 'back' && <path d="m14 5-7 7 7 7M7 12h14" />}
      {name === 'back-ios' && <path d="m15 4-8 8 8 8" />}
      {name === 'chevron-right' && <path d="m9 5 7 7-7 7" />}
      {name === 'calendar' && <><rect x="4" y="5" width="16" height="16" rx="3" /><path d="M8 3v4m8-4v4M4 11h16" /></>}
      {name === 'location' && <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>}
      {name === 'locate' && <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></>}
      {name === 'layers' && <><path d="m12 3 10 6-10 6L2 9l10-6Z" /><path d="m2 13 10 6 10-6M2 17l10 6 10-6" /></>}
      {name === 'search' && <><circle cx="10.5" cy="10.5" r="7.5" /><path d="m16 16 5 5" /></>}
      {name === 'edit' && <><path d="m14 5 5 5M4 20l4-1 12-12a2.8 2.8 0 0 0-4-4L4 15v5Z" /></>}
      {name === 'plus' && <path d="M12 6v12M6 12h12" />}
      {name === 'minus' && <path d="M6 12h12" />}
      {name === 'close' && <path d="m6 6 12 12M6 18 18 6" />}
      {name === 'copy' && <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>}
      {name === 'check' && <path d="m5 12 4 4L19 6" />}
      {name === 'phone' && <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.79a2 2 0 0 1-.45 2.11L8.09 9.89a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.89.33 1.83.56 2.79.69A2 2 0 0 1 22 16.92Z" />}
      {name === 'image' && <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 4-6 5 7" /></>}
      {name === 'bottle' && <><path d="M10 2h4v5l2 3v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10l2-3V2Z" /><path d="M8 13h8" /></>}
      {name === 'grid' && <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>}
      {name === 'list' && <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>}
    </svg>
  );
}
