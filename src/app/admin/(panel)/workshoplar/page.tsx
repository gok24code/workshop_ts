import Link from "next/link";
import { createWorkshop } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, PageHeader, RateBar } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { workshopStats } from "@/lib/stats";

export default async function WorkshopsPage() {
  await requireAdmin();
  const db = await readDb();
  const workshops = [...db.workshops].sort(
    (a, b) => Number(a.archived) - Number(b.archived) || a.title.localeCompare(b.title, "tr"),
  );

  return (
    <>
      <PageHeader title="Workshoplar" subtitle="Her workshop'un eğitmeni, workshop adı ve size özel şifreyle giriş yapar." />

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div>
          {workshops.length === 0 ? (
            <Empty>Henüz workshop yok. Sağdaki formdan ilk workshop&apos;u oluşturun.</Empty>
          ) : (
            <div className="card overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Workshop</th>
                    <th className="text-center">Öğrenci</th>
                    <th className="text-center">Hafta</th>
                    <th className="text-center">Devamsızlık</th>
                    <th>Katılım</th>
                  </tr>
                </thead>
                <tbody>
                  {workshops.map((w) => {
                    const s = workshopStats(db, w);
                    return (
                      <tr key={w.id} className={w.archived ? "opacity-60" : undefined}>
                        <td>
                          <Link href={`/admin/workshoplar/${w.id}`} className="font-semibold hover:text-gold-600">{w.title}</Link>
                          {w.archived && <span className="ml-2 rounded bg-navy-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase">Arşiv</span>}
                          <div className="text-xs text-navy-700/60">{w.instructorName || "Eğitmen adı girilmedi"}</div>
                        </td>
                        <td className="text-center tabular-nums">{s.studentCount}</td>
                        <td className="text-center tabular-nums">{s.sessionCount}</td>
                        <td className="text-center tabular-nums">
                          {s.totalAbsences}
                          {s.overLimit > 0 && <div className="text-[10px] font-semibold text-red-600">{s.overLimit} sınır aşan</div>}
                        </td>
                        <td><RateBar rate={s.rate} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card h-fit p-5">
          <h2 className="mb-4 text-lg font-bold">Yeni workshop</h2>
          <ActionForm action={createWorkshop} resetOnSuccess className="space-y-4">
            <div>
              <label className="label" htmlFor="title">Workshop adı *</label>
              <input id="title" name="title" className="input" placeholder="ör. Web Güvenliği" required maxLength={120} />
              <p className="mt-1 text-xs text-navy-700/60">Eğitmen bu adla giriş yapacak; kısa ve net tutun.</p>
            </div>
            <div>
              <label className="label" htmlFor="instructorName">Eğitmen adı</label>
              <input id="instructorName" name="instructorName" className="input" maxLength={100} />
            </div>
            <div>
              <label className="label" htmlFor="description">Açıklama</label>
              <textarea id="description" name="description" rows={2} className="input" maxLength={500} />
            </div>
            <div>
              <label className="label" htmlFor="absenceLimit">Devamsızlık sınırı (hafta)</label>
              <input id="absenceLimit" name="absenceLimit" type="number" min={0} max={52} defaultValue={2} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="password">Eğitmen şifresi</label>
              <input id="password" name="password" type="text" className="input" placeholder="Boş bırakın → güçlü şifre üretilir" autoComplete="off" maxLength={200} />
            </div>
            <SubmitButton>Oluştur</SubmitButton>
          </ActionForm>
        </div>
      </div>
    </>
  );
}
