import "server-only";
import { randomInt } from "crypto";
import { newId, now } from "./db";
import type { AttendanceStatus, Database, SaveSessionInput, Student } from "./types";

export type { SaveSessionInput };

export class UserError extends Error {}


/**
 * Bir haftanın yoklamasını oluşturur veya günceller.
 * `allowed` dışındaki durumlar yok sayılır; eğitmen yalnızca Var/Yok girebilir,
 * yönetimin girdiği "İzinli" kayıtları eğitmen düzenlemesinde korunur.
 */
export function saveSessionIn(
  db: Database,
  input: SaveSessionInput,
  by: "admin" | "instructor",
): string {
  const workshop = db.workshops.find((w) => w.id === input.workshopId);
  if (!workshop) throw new UserError("Workshop bulunamadı.");
  if (typeof input.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date))) {
    throw new UserError("Geçerli bir tarih seçin.");
  }
  const week = Math.trunc(Number(input.week));
  if (!Number.isFinite(week) || week < 1 || week > 100) throw new UserError("Geçerli bir hafta numarası girin.");

  const existing = input.sessionId
    ? db.sessions.find((s) => s.id === input.sessionId && s.workshopId === workshop.id)
    : undefined;
  if (input.sessionId && !existing) throw new UserError("Yoklama bulunamadı.");
  if (db.sessions.some((s) => s.workshopId === workshop.id && s.week === week && s.id !== existing?.id)) {
    throw new UserError(`${week}. haftanın yoklaması zaten alınmış. Düzenlemek için o haftayı açın.`);
  }

  const allowed: AttendanceStatus[] = by === "admin" ? ["present", "absent", "excused"] : ["present", "absent"];
  const attendance: Record<string, AttendanceStatus> = {};
  for (const sid of workshop.studentIds) {
    const prev = existing?.attendance[sid];
    if (by === "instructor" && prev === "excused") {
      attendance[sid] = prev;
      continue;
    }
    const status = typeof input.attendance === "object" && input.attendance ? input.attendance[sid] : undefined;
    if (status && allowed.includes(status)) attendance[sid] = status;
  }

  const topic = String(input.topic ?? "").trim().slice(0, 200) || undefined;
  if (existing) {
    Object.assign(existing, { week, date: input.date, topic, attendance, takenBy: by, updatedAt: now() });
    return existing.id;
  }
  const id = newId();
  db.sessions.push({ id, workshopId: workshop.id, week, date: input.date, topic, attendance, takenBy: by, updatedAt: now() });
  return id;
}

/** Öğrenci numarasına göre öğrenciyi bulur, yoksa oluşturur. */
export function upsertStudent(
  db: Database,
  data: { studentNo: string; fullName: string; email?: string; department?: string },
): Student {
  const studentNo = data.studentNo.trim().slice(0, 30);
  const fullName = data.fullName.trim().slice(0, 100);
  if (!studentNo) throw new UserError("Öğrenci numarası zorunludur.");
  const existing = db.students.find((s) => s.studentNo === studentNo);
  if (existing) return existing;
  if (!fullName) throw new UserError(`${studentNo} için ad soyad zorunludur.`);
  const student: Student = {
    id: newId(),
    studentNo,
    fullName,
    email: data.email?.trim().slice(0, 120) || undefined,
    department: data.department?.trim().slice(0, 100) || undefined,
    createdAt: now(),
  };
  db.students.push(student);
  return student;
}

export function enroll(db: Database, workshopId: string, studentId: string): void {
  const workshop = db.workshops.find((w) => w.id === workshopId);
  if (!workshop) throw new UserError("Workshop bulunamadı.");
  if (!workshop.studentIds.includes(studentId)) workshop.studentIds.push(studentId);
}

/**
 * Satır başına bir öğrenci: `numara, ad soyad[, e-posta[, bölüm]]`.
 * Virgül, noktalı virgül veya sekme ayırıcı olabilir.
 */
export function parseStudentLines(text: string) {
  return text
    .split(/\r?\n/)
    .slice(0, 2000)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [studentNo = "", fullName = "", email, department] = line.split(/[,;\t]/).map((p) => p.trim());
      return { studentNo, fullName, email, department };
    })
    .filter((row) => !/^(no|numara|öğrenci ?no)$/i.test(row.studentNo));
}

/** Giriş için workshop adını karşılaştırılabilir hale getirir (büyük/küçük harf, Türkçe karakter, boşluk). */
export function normalizeName(name: string): string {
  return name
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Karıştırılması kolay karakterler (0/O, 1/l/I) olmadan rastgele şifre üretir. */
export function generatePassword(length = 10): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}
