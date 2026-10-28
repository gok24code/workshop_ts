export type AttendanceStatus = "present" | "absent" | "excused";

/** Bir workshop'a ait katılımcı. Her workshop'un katılımcı listesi kendine özeldir. */
export interface Participant {
  id: string;
  workshopId: string;
  fullName: string;
  department?: string;
  createdAt: string;
}

export interface Workshop {
  id: string;
  title: string;
  description?: string;
  /** Yalnızca gösterim amaçlı (ör. "Ahmet Yılmaz"). */
  instructorName?: string;
  /** Sorumlu girişi için workshop'a özel şifrenin bcrypt hash'i. */
  passwordHash: string;
  /** Şifre her değiştiğinde artar; eski sorumlu oturumları geçersiz olur. */
  passwordVersion: number;
  /** Bu sayıdan fazla devamsızlık yapan katılımcı uyarı alır. */
  absenceLimit: number;
  archived: boolean;
  createdAt: string;
}

export interface Session {
  id: string;
  workshopId: string;
  week: number;
  date: string; // YYYY-MM-DD
  topic?: string;
  /** Katılımcı id'si → durum */
  attendance: Record<string, AttendanceStatus>;
  takenBy: "admin" | "instructor";
  updatedAt: string;
}

export interface Database {
  version: 3;
  participants: Participant[];
  workshops: Workshop[];
  sessions: Session[];
}

export const emptyDatabase = (): Database => ({ version: 3, participants: [], workshops: [], sessions: [] });

export interface AdminSession {
  id: string;
  /** Oturumun açıldığı tarayıcının User-Agent hash'i. */
  uaHash: string;
  userAgent: string;
  ip: string;
  createdAt: string;
  expiresAt: string;
}

export interface LoginFailure {
  key: string;
  count: number;
  firstAt: number;
  lockedUntil?: number;
}

export interface SaveSessionInput {
  workshopId: string;
  sessionId?: string;
  week: number;
  date: string;
  topic?: string;
  attendance: Record<string, AttendanceStatus>;
}
