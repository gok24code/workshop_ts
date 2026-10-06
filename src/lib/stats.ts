import type { Database, Session, Student, Workshop } from "./types";

export interface StudentWorkshopStats {
  present: number;
  absent: number;
  excused: number;
  /** Öğrencinin yoklamada işaretlendiği hafta sayısı. */
  total: number;
  rate: number; // 0-1 arası katılım oranı (mazeretli hariç)
}

export function sessionsOf(db: Database, workshopId: string): Session[] {
  return db.sessions
    .filter((s) => s.workshopId === workshopId)
    .sort((a, b) => a.week - b.week);
}

export function studentStatsInWorkshop(sessions: Session[], studentId: string): StudentWorkshopStats {
  let present = 0;
  let absent = 0;
  let excused = 0;
  for (const s of sessions) {
    const status = s.attendance[studentId];
    if (status === "present") present++;
    else if (status === "absent") absent++;
    else if (status === "excused") excused++;
  }
  const counted = present + absent;
  return { present, absent, excused, total: present + absent + excused, rate: counted ? present / counted : 1 };
}

export interface WorkshopStats {
  sessionCount: number;
  studentCount: number;
  totalAbsences: number;
  rate: number;
  overLimit: number;
}

export function workshopStats(db: Database, w: Workshop): WorkshopStats {
  const sessions = sessionsOf(db, w.id);
  let present = 0;
  let absent = 0;
  let overLimit = 0;
  for (const sid of w.studentIds) {
    const st = studentStatsInWorkshop(sessions, sid);
    present += st.present;
    absent += st.absent;
    if (st.absent > w.absenceLimit) overLimit++;
  }
  const counted = present + absent;
  return {
    sessionCount: sessions.length,
    studentCount: w.studentIds.length,
    totalAbsences: absent,
    rate: counted ? present / counted : 1,
    overLimit,
  };
}

export interface StudentOverview {
  student: Student;
  workshops: { workshop: Workshop; stats: StudentWorkshopStats }[];
  totalAbsences: number;
  totalExcused: number;
  overLimit: boolean;
}

export function studentOverviews(db: Database): StudentOverview[] {
  const sessionsByWorkshop = new Map<string, Session[]>();
  for (const w of db.workshops) sessionsByWorkshop.set(w.id, sessionsOf(db, w.id));

  return db.students.map((student) => {
    const workshops = db.workshops
      .filter((w) => w.studentIds.includes(student.id))
      .map((workshop) => ({
        workshop,
        stats: studentStatsInWorkshop(sessionsByWorkshop.get(workshop.id) ?? [], student.id),
      }));
    return {
      student,
      workshops,
      totalAbsences: workshops.reduce((n, x) => n + x.stats.absent, 0),
      totalExcused: workshops.reduce((n, x) => n + x.stats.excused, 0),
      overLimit: workshops.some((x) => x.stats.absent > x.workshop.absenceLimit),
    };
  });
}

export const pct = (rate: number) => `%${Math.round(rate * 100)}`;

export function formatDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

/** İstanbul saatine göre bugünün tarihi (YYYY-MM-DD). */
export const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Istanbul" });

/** Workshop'ta yoklaması alınmamış ilk sonraki hafta. */
export const nextWeek = (sessions: Session[]) => sessions.reduce((m, s) => Math.max(m, s.week), 0) + 1;

/** Workshop'a kayıtlı öğrencileri ada göre sıralı döner. */
export function studentsOf(db: Database, w: Workshop): Student[] {
  return w.studentIds
    .map((id) => db.students.find((s) => s.id === id))
    .filter((s) => s !== undefined)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "tr"));
}
