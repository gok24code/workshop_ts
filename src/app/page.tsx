import { redirect } from "next/navigation";
import { instructorLogin } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms";
import { LogoMark, OrgFooter } from "@/components/Logo";
import { getInstructorWorkshop } from "@/lib/auth";

export const metadata = { title: "Eğitmen Girişi" };

export default async function InstructorLoginPage() {
  if (await getInstructorWorkshop()) redirect("/yoklama");
  return (
    <div className="bg-navy-gradient relative flex min-h-dvh flex-col overflow-hidden text-white">
      <div className="pointer-events-none absolute -top-40 -right-40 h-[420px] w-[420px] rounded-full bg-gold-500/10 blur-3xl" />
      <main className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="h-28 w-28" priority />
          <h1 className="text-gold-gradient mt-4 text-5xl font-black tracking-[0.25em]">WTS</h1>
          <p className="mt-2 text-sm font-medium text-white/70">Workshop Takip Sistemi</p>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white text-navy-900 shadow-2xl">
          <div className="bg-gold-gradient h-1" />
          <div className="p-6">
            <h2 className="text-lg font-bold">Eğitmen Girişi</h2>
            <p className="mt-1 mb-5 text-sm text-navy-700/70">Workshop adını ve size verilen şifreyi girin.</p>
            <ActionForm action={instructorLogin} className="space-y-4">
              <div>
                <label className="label" htmlFor="workshop">Workshop adı</label>
                <input id="workshop" name="workshop" className="input py-3 text-base" autoComplete="username" autoCapitalize="words" required maxLength={120} />
              </div>
              <div>
                <label className="label" htmlFor="password">Şifre</label>
                <input id="password" name="password" type="password" className="input py-3 text-base" autoComplete="current-password" required maxLength={200} />
              </div>
              <SubmitButton className="btn-gold w-full py-3 text-base" pendingText="Giriş yapılıyor…">Giriş yap</SubmitButton>
            </ActionForm>
          </div>
        </div>
      </main>
      <div className="bg-gold-gradient h-1 w-full" />
      <OrgFooter />
    </div>
  );
}
