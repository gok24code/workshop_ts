import Link from "next/link";
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
      <PageHeader
        title="Workshoplar"
        subtitle="Her workshop'un kendi katılımcı listesi ve eğitmen şifresi vardır."
        actions={<Link href="/admin/workshoplar/yeni" className="btn-gold">+ Yeni workshop</Link>}
      />
      {workshops.length === 0 ? (
        <Empty>
          Henüz workshop yok. <Link href="/admin/workshoplar/yeni" className="font-semibold text-gold-700">İlk workshop&apos;u oluşturun</Link>.
        </Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Workshop</th>
                <th className="text-center">Katılımcı</th>
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
                    <td className="text-center tabular-nums">{s.participantCount}</td>
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
    </>
  );
}
