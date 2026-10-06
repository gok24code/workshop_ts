import Link from "next/link";
import { notFound } from "next/navigation";
import { instructorSaveSession } from "@/app/actions/instructor";
import { AttendanceTaker } from "@/components/AttendanceTaker";
import { requireInstructor } from "@/lib/auth";
import { sessionsOf, participantsOf, participantStats } from "@/lib/stats";

export default async function EditWeekPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { workshop, db } = await requireInstructor();
  const sessions = sessionsOf(db, workshop.id);
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) notFound();
  const others = sessions.filter((s) => s.id !== session.id);

  return (
    <>
      <Link href="/yoklama" className="mb-3 inline-block text-sm font-medium text-navy-600">← Geri</Link>
      <h1 className="mb-5 text-2xl font-bold">{session.week}. hafta yoklaması</h1>
      <AttendanceTaker
        workshopId={workshop.id}
        sessionId={session.id}
        initialWeek={session.week}
        initialDate={session.date}
        initialTopic={session.topic}
        initialAttendance={session.attendance}
        absenceLimit={workshop.absenceLimit}
        allowExcused={false}
        students={participantsOf(db, workshop.id).map((s) => ({ id: s.id, studentNo: s.studentNo, fullName: s.fullName, absences: participantStats(others, s.id).absent }))}
        save={instructorSaveSession}
        doneHref="/yoklama"
      />
    </>
  );
}
