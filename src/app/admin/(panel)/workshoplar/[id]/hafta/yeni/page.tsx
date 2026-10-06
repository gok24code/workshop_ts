import { notFound } from "next/navigation";
import { adminSaveSession } from "@/app/actions/admin";
import { AttendanceTaker } from "@/components/AttendanceTaker";
import { Empty, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { nextWeek, sessionsOf, participantsOf, participantStats, today } from "@/lib/stats";

export default async function AdminNewWeekPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const db = await readDb();
  const workshop = db.workshops.find((w) => w.id === id);
  if (!workshop) notFound();
  const sessions = sessionsOf(db, id);
  const students = participantsOf(db, workshop.id);

  return (
    <>
      <PageHeader back={{ href: `/admin/workshoplar/${id}`, label: workshop.title }} title="Yoklama ekle" />
      {students.length === 0 ? (
        <Empty>Yoklama almak için önce workshop&apos;a katılımcı ekleyin.</Empty>
      ) : (
        <AttendanceTaker
          workshopId={id}
          initialWeek={nextWeek(sessions)}
          initialDate={today()}
          absenceLimit={workshop.absenceLimit}
          allowExcused
          sidebar
          students={students.map((s) => ({ id: s.id, studentNo: s.studentNo, fullName: s.fullName, absences: participantStats(sessions, s.id).absent }))}
          save={adminSaveSession}
          doneHref={`/admin/workshoplar/${id}`}
        />
      )}
    </>
  );
}
