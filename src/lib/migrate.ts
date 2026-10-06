import "server-only";
import { createHash } from "crypto";
import { emptyDatabase, type Database, type Participant } from "./types";

interface StudentV2 {
  id: string;
  studentNo: string;
  fullName: string;
  email?: string;
  department?: string;
  createdAt: string;
}

/** Aynı girdiden her zaman aynı id'yi üretir; böylece taşıma tekrarlansa da bağlantılar bozulmaz. */
function stableId(...parts: string[]): string {
  const h = createHash("sha256").update(parts.join("|")).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * Eski sürümdeki ortak öğrenci havuzunu (v2) workshop'a özel katılımcılara (v3)
 * dönüştürür. Bir öğrenci birden fazla workshop'taysa her workshop için ayrı
 * katılımcı oluşur ve o workshop'un yoklamaları yeni id'ye taşınır.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrate(raw: any): Database {
  if (!raw || typeof raw !== "object") return emptyDatabase();
  if (raw.version === 3) return raw as Database;

  const students: StudentV2[] = raw.students ?? [];
  const byId = new Map(students.map((s) => [s.id, s]));
  const participants: Participant[] = [];
  const idMap = new Map<string, Map<string, string>>(); // workshopId → (eski öğrenci id → katılımcı id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workshops = (raw.workshops ?? []).map((w: any) => {
    const map = new Map<string, string>();
    for (const sid of (w.studentIds ?? []) as string[]) {
      const st = byId.get(sid);
      if (!st) continue;
      const id = stableId(w.id, sid);
      map.set(sid, id);
      participants.push({
        id,
        workshopId: w.id,
        fullName: st.fullName,
        studentNo: st.studentNo || undefined,
        email: st.email,
        department: st.department,
        createdAt: st.createdAt,
      });
    }
    idMap.set(w.id, map);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { studentIds, ...rest } = w;
    return rest;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessions = (raw.sessions ?? []).map((s: any) => {
    const map = idMap.get(s.workshopId) ?? new Map<string, string>();
    const attendance: Record<string, string> = {};
    for (const [sid, status] of Object.entries(s.attendance ?? {})) {
      const pid = map.get(sid);
      if (pid) attendance[pid] = status as string;
    }
    return { ...s, attendance };
  });

  return { version: 3, participants, workshops, sessions } as Database;
}
