import Image from "next/image";

export const ORG_NAME = "ISUBÜ Siber Güvenlik ve Yapay Zeka Topluluğu";
export const UNIVERSITY_NAME = "Isparta Uygulamalı Bilimler Üniversitesi";

/** Topluluk logosu (dairesel). */
export function LogoMark({ className = "h-10 w-10", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-full shadow-md ring-1 ring-gold-500/40 ${className}`}>
      <Image src="/logo-topluluk.png" alt={ORG_NAME} fill sizes="(max-width: 640px) 120px, 160px" className="object-cover" priority={priority} />
    </span>
  );
}

export function Logo({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark className="h-11 w-11" />
      <div className="leading-tight">
        <div className="text-gold-gradient text-xl font-black tracking-[0.2em]">WTS</div>
        {subtitle && <div className="text-[11px] font-medium text-white/60">Workshop Takip Sistemi</div>}
      </div>
    </div>
  );
}

/** Üniversite logosu. Renkli logo koyu zeminde okunmadığı için beyaz kutu içinde gösterilir. */
export function UniversityLogo({ className = "h-14" }: { className?: string }) {
  return (
    <span className="inline-flex items-center justify-center rounded-xl bg-white p-1.5 shadow-sm">
      <Image src="/logo-isubu.webp" alt={UNIVERSITY_NAME} width={613} height={640} className={`w-auto ${className}`} />
    </span>
  );
}

/** Giriş ekranlarının altındaki kurum bilgisi. */
export function OrgFooter() {
  return (
    <footer className="flex flex-col items-center gap-2 px-4 py-5 text-center">
      <UniversityLogo />
      <p className="text-xs font-medium text-white/60">{ORG_NAME}</p>
    </footer>
  );
}
