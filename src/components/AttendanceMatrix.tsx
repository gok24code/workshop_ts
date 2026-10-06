import Link from "next/link";
import { formatDate, studentStatsInWorkshop } from "@/lib/stats";
import type { Session, Student, Workshop } from "@/lib/types";
import { AbsenceBadge, Empty, RateBar, StatusDot } from "./ui";

/** Öğrenci × oturum yoklama tablosu ve öğrenci başına devamsızlık sayıları. */
export function AttendanceMatrix({
  workshop,
  students,
  sessions,
  sessionHref,
  studentHref,
  rowActions,
}: {
  workshop: Workshop;
  students: Student[];
  sessions: Session[];
  sessionHref?: (s: Session) => string;
  studentHref?: (s: Student) => string;
  rowActions?: (s: Student) => React.ReactNode;
}) {
  if (!students.length) return <Empty>Bu eğitime henüz öğrenci eklenmemiş.</Empty>;

  const rows = students
    .map((student) => ({ student, stats: studentStatsInWorkshop(sessions, student.id) }))
    .sort((a, b) => b.stats.absent - a.stats.absent || a.student.fullName.localeCompare(b.student.fullName, "tr"));

  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-48">Öğrenci</th>
            <th className="text-center">Devamsızlık</th>
            <th>Katılım</th>
            {sessions.map((s) => (
              <th key={s.id} className="text-center whitespace-nowrap">
                {sessionHref ? (
                  <Link href={sessionHref(s)} className="hover:text-gold-600" title={s.topic}>
                    {s.week}. hf
                    <div className="text-[10px] font-medium normal-case opacity-70">{formatDate(s.date).slice(0, 5)}</div>
                  </Link>
                ) : (
                  <span title={s.topic}>
                    {s.week}. hf
                    <div className="text-[10px] font-medium normal-case opacity-70">{formatDate(s.date).slice(0, 5)}</div>
                  </span>
                )}
              </th>
            ))}
            {rowActions && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ student, stats }) => {
            const over = stats.absent > workshop.absenceLimit;
            return (
            <tr key={student.id} className={over ? "bg-red-50" : undefined}>
              <td className={`sticky left-0 z-10 ${over ? "bg-red-50" : "bg-white"}`}>
                <div className="font-semibold text-navy-900">
                  {studentHref ? (
                    <Link href={studentHref(student)} className="hover:text-gold-600">{student.fullName}</Link>
                  ) : (
                    student.fullName
                  )}
                </div>
                <div className="text-xs text-navy-700/60">{student.studentNo}</div>
              </td>
              <td className="text-center">
                <AbsenceBadge count={stats.absent} limit={workshop.absenceLimit} />
                {stats.excused > 0 && <div className="mt-1 text-[10px] text-gold-700">+{stats.excused} izinli</div>}
              </td>
              <td><RateBar rate={stats.rate} /></td>
              {sessions.map((s) => (
                <td key={s.id} className="text-center"><StatusDot status={s.attendance[student.id]} /></td>
              ))}
              {rowActions && <td className="text-right">{rowActions(student)}</td>}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
