import Link from "next/link";
import { instructorSaveSession } from "@/app/actions/instructor";
import { AttendanceTaker } from "@/components/AttendanceTaker";
import { Empty } from "@/components/ui";
import { requireInstructor } from "@/lib/auth";
import { nextWeek, sessionsOf, studentsOf, studentStatsInWorkshop, today } from "@/lib/stats";

export default async function NewWeekPage() {
  const { workshop, db } = await requireInstructor();
  const sessions = sessionsOf(db, workshop.id);
  const students = studentsOf(db, workshop);

  return (
    <>
      <Link href="/yoklama" className="mb-3 inline-block text-sm font-medium text-navy-600">← Geri</Link>
      <h1 className="mb-1 text-2xl font-bold">Yoklama al</h1>
      <p className="mb-5 text-sm text-navy-700/70">Her öğrenci için “Geldi” veya “Gelmedi” seçin.</p>
      {students.length === 0 ? (
        <Empty>Bu workshop&apos;a henüz öğrenci tanımlanmadı. Yönetimle iletişime geçin.</Empty>
      ) : (
        <AttendanceTaker
          workshopId={workshop.id}
          initialWeek={nextWeek(sessions)}
          initialDate={today()}
          absenceLimit={workshop.absenceLimit}
          allowExcused={false}
          students={students.map((s) => ({ id: s.id, studentNo: s.studentNo, fullName: s.fullName, absences: studentStatsInWorkshop(sessions, s.id).absent }))}
          save={instructorSaveSession}
          doneHref="/yoklama"
        />
      )}
    </>
  );
}
