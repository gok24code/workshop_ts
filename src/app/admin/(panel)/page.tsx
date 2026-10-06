import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { formatDate, pct, studentOverviews, workshopStats } from "@/lib/stats";
import { AbsenceBadge, Empty, PageHeader, RateBar, StatCard } from "@/components/ui";

export default async function AdminHome() {
  await requireAdmin();
  const db = await readDb();
  const active = db.workshops.filter((w) => !w.archived);
  const wStats = active.map((w) => ({ w, s: workshopStats(db, w) }));

  let present = 0;
  let absent = 0;
  for (const s of db.sessions) {
    for (const v of Object.values(s.attendance)) {
      if (v === "present") present++;
      else if (v === "absent") absent++;
    }
  }
  const overall = present + absent ? present / (present + absent) : 1;

  const overLimit = studentOverviews(db)
    .flatMap((o) =>
      o.workshops
        .filter((x) => !x.workshop.archived && x.stats.absent > x.workshop.absenceLimit)
        .map((x) => ({ student: o.student, ...x })),
    )
    .sort((a, b) => b.stats.absent - a.stats.absent);

  const recent = [...db.sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);

  return (
    <>
      <PageHeader title="Genel Bakış" subtitle="Tüm workshopların yoklama ve devamsızlık özeti." />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard accent label="Genel katılım" value={pct(overall)} hint={`${absent} toplam devamsızlık`} />
        <StatCard label="Aktif workshop" value={active.length} hint={`${db.workshops.length - active.length} arşivde`} />
        <StatCard label="Öğrenci" value={db.students.length} />
        <StatCard label="Alınan yoklama" value={db.sessions.length} hint="hafta" />
      </div>

      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Aktif workshoplar</h2>
          <Link href="/admin/workshoplar" className="text-sm font-semibold text-navy-600 hover:text-gold-600">Tümü →</Link>
        </div>
        {wStats.length === 0 ? (
          <Empty>Henüz aktif workshop yok. <Link className="font-semibold text-gold-700" href="/admin/workshoplar">Workshop oluşturun</Link>.</Empty>
        ) : (
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Workshop</th>
                  <th>Eğitmen</th>
                  <th className="text-center">Öğrenci</th>
                  <th className="text-center">Hafta</th>
                  <th className="text-center">Devamsızlık</th>
                  <th>Katılım</th>
                  <th className="text-center">Sınır aşan</th>
                </tr>
              </thead>
              <tbody>
                {wStats.map(({ w, s }) => (
                  <tr key={w.id}>
                    <td><Link href={`/admin/workshoplar/${w.id}`} className="font-semibold hover:text-gold-600">{w.title}</Link></td>
                    <td className="text-navy-700/80">{w.instructorName || "—"}</td>
                    <td className="text-center tabular-nums">{s.studentCount}</td>
                    <td className="text-center tabular-nums">{s.sessionCount}</td>
                    <td className="text-center tabular-nums">{s.totalAbsences}</td>
                    <td><RateBar rate={s.rate} /></td>
                    <td className="text-center">
                      <span className={s.overLimit ? "font-bold text-red-600" : "text-navy-700/50"}>{s.overLimit}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-bold">Devamsızlık sınırını aşanlar</h2>
          {overLimit.length === 0 ? (
            <Empty>Sınırı aşan öğrenci yok.</Empty>
          ) : (
            <div className="card divide-y divide-navy-100">
              {overLimit.slice(0, 12).map((x) => (
                <Link key={x.student.id + x.workshop.id} href={`/admin/ogrenciler/${x.student.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-navy-50">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{x.student.fullName}</div>
                    <div className="truncate text-xs text-navy-700/60">{x.student.studentNo} · {x.workshop.title}</div>
                  </div>
                  <AbsenceBadge count={x.stats.absent} limit={x.workshop.absenceLimit} />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">Son yoklamalar</h2>
          {recent.length === 0 ? (
            <Empty>Henüz yoklama alınmadı.</Empty>
          ) : (
            <div className="card divide-y divide-navy-100">
              {recent.map((s) => {
                const w = db.workshops.find((x) => x.id === s.workshopId);
                const vals = Object.values(s.attendance);
                return (
                  <Link key={s.id} href={`/admin/workshoplar/${s.workshopId}/hafta/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-navy-50">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{w?.title} · {s.week}. hafta</div>
                      <div className="truncate text-xs text-navy-700/60">
                        {formatDate(s.date)} · {s.takenBy === "admin" ? "Yönetim" : "Eğitmen"}{s.topic ? ` · ${s.topic}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs font-semibold">
                      <span className="text-emerald-700">{vals.filter((v) => v === "present").length} geldi</span>
                      <span className="mx-1 text-navy-700/30">·</span>
                      <span className="text-red-700">{vals.filter((v) => v === "absent").length} gelmedi</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
