import Link from "next/link";
import { Empty, StatCard } from "@/components/ui";
import { requireInstructor } from "@/lib/auth";
import { formatDate, nextWeek, pct, sessionsOf, studentsOf, studentStatsInWorkshop, workshopStats } from "@/lib/stats";

export default async function InstructorHome() {
  const { workshop, db } = await requireInstructor();
  const sessions = sessionsOf(db, workshop.id);
  const students = studentsOf(db, workshop);
  const stats = workshopStats(db, workshop);

  return (
    <div className="space-y-6">
      <Link href="/yoklama/yeni" className="btn-gold w-full py-4 text-base shadow-md">
        {nextWeek(sessions)}. hafta yoklamasını al
      </Link>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Öğrenci" value={stats.studentCount} />
        <StatCard label="Hafta" value={stats.sessionCount} />
        <StatCard accent label="Katılım" value={pct(stats.rate)} />
      </div>

      <section>
        <h2 className="mb-3 text-base font-bold text-navy-900">Alınan yoklamalar</h2>
        {sessions.length === 0 ? (
          <Empty>Henüz yoklama alınmadı.</Empty>
        ) : (
          <div className="card divide-y divide-navy-100">
            {[...sessions].reverse().map((s) => {
              const vals = Object.values(s.attendance);
              return (
                <Link key={s.id} href={`/yoklama/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3 active:bg-navy-50">
                  <div className="min-w-0">
                    <div className="font-semibold">{s.week}. hafta</div>
                    <div className="truncate text-xs text-navy-700/60">{formatDate(s.date)}{s.topic ? ` · ${s.topic}` : ""}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs font-semibold">
                    <div className="text-emerald-700">{vals.filter((v) => v === "present").length} geldi</div>
                    <div className="text-red-700">{vals.filter((v) => v === "absent").length} gelmedi</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-bold text-navy-900">Öğrenciler ve devamsızlık</h2>
        {students.length === 0 ? (
          <Empty>Bu workshop&apos;a henüz öğrenci tanımlanmadı. Yönetimle iletişime geçin.</Empty>
        ) : (
          <div className="card divide-y divide-navy-100">
            {students.map((s) => {
              const st = studentStatsInWorkshop(sessions, s.id);
              const over = st.absent > workshop.absenceLimit;
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{s.fullName}</div>
                    <div className="text-xs text-navy-700/60">{s.studentNo}</div>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${over ? "text-red-600" : "text-navy-800"}`}>
                    {st.absent}/{workshop.absenceLimit}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
