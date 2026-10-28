import Link from "next/link";
import { AbsenceBadge, Empty, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { personOverviews } from "@/lib/stats";

export default async function AllParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; workshop?: string; filtre?: string }>;
}) {
  await requireAdmin();
  const { q = "", workshop = "", filtre } = await searchParams;
  const db = await readDb();
  const query = String(q).trim().toLocaleLowerCase("tr");

  const people = personOverviews(db)
    .filter((o) => !workshop || o.entries.some((e) => e.workshop.id === workshop))
    .filter((o) => filtre !== "sinir" || o.overLimit)
    .filter((o) => {
      if (!query) return true;
      const p = o.person;
      return [p.fullName, p.department].some((v) => v?.toLocaleLowerCase("tr").includes(query));
    })
    .sort((a, b) => b.totalAbsences - a.totalAbsences || a.person.fullName.localeCompare(b.person.fullName, "tr"));

  const workshops = [...db.workshops].sort((a, b) => a.title.localeCompare(b.title, "tr"));

  return (
    <>
      <PageHeader
        title="Tüm Katılımcılar"
        subtitle={`${db.participants.length} kayıt · aynı ad soyad birden fazla workshop'taysa tek satırda gösterilir`}
      />

      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="İsim, bölüm…" className="input max-w-xs" maxLength={100} />
        <select name="workshop" defaultValue={workshop} className="input w-auto">
          <option value="">Tüm workshoplar</option>
          {workshops.map((w) => <option key={w.id} value={w.id}>{w.title}</option>)}
        </select>
        <select name="filtre" defaultValue={filtre ?? ""} className="input w-auto">
          <option value="">Herkes</option>
          <option value="sinir">Sınırı aşanlar</option>
        </select>
        <button className="btn-navy">Filtrele</button>
      </form>

      {people.length === 0 ? (
        <Empty>{db.participants.length ? "Aramaya uyan katılımcı yok." : "Henüz katılımcı yok. Workshop oluştururken katılımcıları girin."}</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Katılımcı</th>
                <th>Workshop · devamsızlık</th>
                <th className="text-center">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {people.map(({ key, person, entries, totalAbsences, totalExcused, overLimit }) => (
                <tr key={key} className={overLimit ? "bg-red-50/60" : undefined}>
                  <td>
                    <div className="font-semibold">{person.fullName}</div>
                    <div className="text-xs text-navy-700/60">{person.department || "—"}</div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1.5">
                      {entries.map(({ participant, workshop: w, stats }) => (
                        <Link
                          key={participant.id}
                          href={`/admin/workshoplar/${w.id}/katilimci/${participant.id}`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-navy-100 bg-white py-0.5 pr-0.5 pl-2.5 text-xs hover:border-gold-500"
                          title={`${stats.present} geldi · ${stats.absent} gelmedi${stats.excused ? ` · ${stats.excused} izinli` : ""}`}
                        >
                          {w.title}
                          {w.archived && <span className="text-[10px] text-navy-700/50">(arşiv)</span>}
                          <AbsenceBadge count={stats.absent} limit={w.absenceLimit} />
                        </Link>
                      ))}
                    </div>
                  </td>
                  <td className="text-center">
                    <span className={`text-lg font-bold tabular-nums ${overLimit ? "text-red-600" : "text-navy-900"}`}>{totalAbsences}</span>
                    {totalExcused > 0 && <div className="text-[10px] text-gold-700">+{totalExcused} izinli</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
