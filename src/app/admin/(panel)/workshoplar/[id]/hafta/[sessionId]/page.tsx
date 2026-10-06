import { notFound } from "next/navigation";
import { adminDeleteSession, adminSaveSession } from "@/app/actions/admin";
import { AttendanceTaker } from "@/components/AttendanceTaker";
import { ConfirmForm } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { formatDate, sessionsOf, studentsOf, studentStatsInWorkshop } from "@/lib/stats";

export default async function AdminEditWeekPage({ params }: { params: Promise<{ id: string; sessionId: string }> }) {
  await requireAdmin();
  const { id, sessionId } = await params;
  const db = await readDb();
  const workshop = db.workshops.find((w) => w.id === id);
  if (!workshop) notFound();
  const sessions = sessionsOf(db, id);
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) notFound();
  const others = sessions.filter((s) => s.id !== session.id);

  return (
    <>
      <PageHeader
        back={{ href: `/admin/workshoplar/${id}`, label: workshop.title }}
        title={`${session.week}. hafta yoklaması`}
        subtitle={`${formatDate(session.date)}${session.topic ? ` · ${session.topic}` : ""} · Son düzenleyen: ${session.takenBy === "admin" ? "Yönetim" : "Eğitmen"}`}
        actions={
          <ConfirmForm action={adminDeleteSession} hidden={{ id: session.id, workshopId: id }} message="Bu haftanın yoklaması silinsin mi?">
            Yoklamayı sil
          </ConfirmForm>
        }
      />
      <AttendanceTaker
        workshopId={id}
        sessionId={session.id}
        initialWeek={session.week}
        initialDate={session.date}
        initialTopic={session.topic}
        initialAttendance={session.attendance}
        absenceLimit={workshop.absenceLimit}
        allowExcused
        sidebar
        students={studentsOf(db, workshop).map((s) => ({ id: s.id, studentNo: s.studentNo, fullName: s.fullName, absences: studentStatsInWorkshop(others, s.id).absent }))}
        save={adminSaveSession}
        doneHref={`/admin/workshoplar/${id}`}
      />
    </>
  );
}
