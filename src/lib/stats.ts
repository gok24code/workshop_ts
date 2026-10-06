import type { Database, Participant, Session, Workshop } from "./types";

export interface ParticipantStats {
  present: number;
  absent: number;
  excused: number;
  /** Katılımcının yoklamada işaretlendiği hafta sayısı. */
  total: number;
  rate: number; // 0-1 arası katılım oranı (mazeretli hariç)
}

export function sessionsOf(db: Database, workshopId: string): Session[] {
  return db.sessions
    .filter((s) => s.workshopId === workshopId)
    .sort((a, b) => a.week - b.week);
}

export function participantStats(sessions: Session[], participantId: string): ParticipantStats {
  let present = 0;
  let absent = 0;
  let excused = 0;
  for (const s of sessions) {
    const status = s.attendance[participantId];
    if (status === "present") present++;
    else if (status === "absent") absent++;
    else if (status === "excused") excused++;
  }
  const counted = present + absent;
  return { present, absent, excused, total: present + absent + excused, rate: counted ? present / counted : 1 };
}

export interface WorkshopStats {
  sessionCount: number;
  participantCount: number;
  totalAbsences: number;
  rate: number;
  overLimit: number;
}

export function workshopStats(db: Database, w: Workshop): WorkshopStats {
  const sessions = sessionsOf(db, w.id);
  let present = 0;
  let absent = 0;
  let overLimit = 0;
  const participants = participantsOf(db, w.id);
  for (const p of participants) {
    const st = participantStats(sessions, p.id);
    present += st.present;
    absent += st.absent;
    if (st.absent > w.absenceLimit) overLimit++;
  }
  const counted = present + absent;
  return {
    sessionCount: sessions.length,
    participantCount: participants.length,
    totalAbsences: absent,
    rate: counted ? present / counted : 1,
    overLimit,
  };
}

export interface PersonOverview {
  /** Aynı kişiyi workshoplar arasında eşleştiren anahtar (öğrenci no, yoksa e-posta). */
  key: string;
  /** Kişinin en son girilen bilgileri. */
  person: Participant;
  entries: { participant: Participant; workshop: Workshop; stats: ParticipantStats }[];
  totalAbsences: number;
  totalExcused: number;
  overLimit: boolean;
}

/**
 * Tüm katılımcıları kişi bazında gruplar. Aynı öğrenci numarası (numara yoksa
 * aynı e-posta) birden fazla workshop'ta geçiyorsa tek kişi olarak gösterilir.
 */
export function personOverviews(db: Database): PersonOverview[] {
  const workshops = new Map(db.workshops.map((w) => [w.id, w]));
  const sessionsByWorkshop = new Map(db.workshops.map((w) => [w.id, sessionsOf(db, w.id)]));
  const groups = new Map<string, PersonOverview>();

  for (const participant of db.participants) {
    const workshop = workshops.get(participant.workshopId);
    if (!workshop) continue;
    const key = participant.studentNo
      ? `no:${participant.studentNo}`
      : participant.email
        ? `mail:${participant.email.toLowerCase()}`
        : `id:${participant.id}`;
    const stats = participantStats(sessionsByWorkshop.get(workshop.id) ?? [], participant.id);
    let g = groups.get(key);
    if (!g) {
      g = { key, person: participant, entries: [], totalAbsences: 0, totalExcused: 0, overLimit: false };
      groups.set(key, g);
    }
    if (participant.createdAt > g.person.createdAt) g.person = participant;
    g.entries.push({ participant, workshop, stats });
    g.totalAbsences += stats.absent;
    g.totalExcused += stats.excused;
    if (stats.absent > workshop.absenceLimit) g.overLimit = true;
  }
  return [...groups.values()];
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

/** Workshop'un katılımcılarını ada göre sıralı döner. */
export function participantsOf(db: Database, workshopId: string): Participant[] {
  return db.participants
    .filter((p) => p.workshopId === workshopId)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "tr"));
}
