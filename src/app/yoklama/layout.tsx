import Link from "next/link";
import { instructorLogout } from "@/app/actions/auth";
import { LogoMark } from "@/components/Logo";
import { requireInstructor } from "@/lib/auth";

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const { workshop } = await requireInstructor();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-navy-gradient sticky top-0 z-30 text-white shadow-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/yoklama" className="flex min-w-0 flex-1 items-center gap-3">
            <LogoMark className="h-9 w-9 shrink-0" />
            <div className="min-w-0 leading-tight">
              <div className="text-gold-gradient text-xs font-black tracking-[0.2em]">WTS</div>
              <div className="truncate text-sm font-semibold">{workshop.title}</div>
            </div>
          </Link>
          <form action={instructorLogout}>
            <button className="rounded-lg px-3 py-2 text-sm font-medium text-gold-300 hover:bg-white/5">Çıkış</button>
          </form>
        </div>
        <div className="bg-gold-gradient h-[3px]" />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
