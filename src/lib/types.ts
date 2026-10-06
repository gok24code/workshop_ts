export type AttendanceStatus = "present" | "absent" | "excused";

export interface Student {
  id: string;
  studentNo: string;
  fullName: string;
  email?: string;
  department?: string;
  createdAt: string;
}

export interface Workshop {
  id: string;
  title: string;
  description?: string;
  /** Yalnızca gösterim amaçlı (ör. "Ahmet Yılmaz"). */
  instructorName?: string;
  /** Eğitmen girişi için workshop'a özel şifrenin bcrypt hash'i. */
  passwordHash: string;
  /** Şifre her değiştiğinde artar; eski eğitmen oturumları geçersiz olur. */
  passwordVersion: number;
  studentIds: string[];
  /** Bu sayıdan fazla devamsızlık yapan öğrenci uyarı alır. */
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
  attendance: Record<string, AttendanceStatus>;
  takenBy: "admin" | "instructor";
  updatedAt: string;
}

export interface Database {
  version: 2;
  students: Student[];
  workshops: Workshop[];
  sessions: Session[];
}

export const emptyDatabase = (): Database => ({ version: 2, students: [], workshops: [], sessions: [] });

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
