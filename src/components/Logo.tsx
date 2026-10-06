export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id="wts-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b8912a" />
          <stop offset="0.5" stopColor="#f5dc8a" />
          <stop offset="1" stopColor="#d4af37" />
        </linearGradient>
      </defs>
      <path
        d="M24 3 6 10v12c0 11.5 7.7 20.4 18 23 10.3-2.6 18-11.5 18-23V10L24 3Z"
        fill="#0a1a33"
        stroke="url(#wts-gold)"
        strokeWidth="2.5"
      />
      <path d="m15 24 6 6 12-13" fill="none" stroke="url(#wts-gold)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark />
      <div className="leading-tight">
        <div className="text-gold-gradient text-xl font-black tracking-[0.2em]">WTS</div>
        {subtitle && <div className="text-[11px] font-medium text-white/60">Workshop Takip Sistemi</div>}
      </div>
    </div>
  );
}
