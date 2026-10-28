import "server-only";
import { randomInt } from "crypto";
import { newId, now } from "./db";
import type { AttendanceStatus, Database, SaveSessionInput } from "./types";

export type { SaveSessionInput };

export class UserError extends Error {}


/**
 * Bir haftanın yoklamasını oluşturur veya günceller.
 * `allowed` dışındaki durumlar yok sayılır; sorumlu yalnızca Var/Yok girebilir,
 * yönetimin girdiği "İzinli" kayıtları sorumlu düzenlemesinde korunur.
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
  for (const { id: sid } of db.participants.filter((p) => p.workshopId === workshop.id)) {
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

export interface ParticipantInput {
  fullName: string;
  studentNo?: string;
  email?: string;
  phone?: string;
  department?: string;
}

const clean = (v: string | undefined, max: number) => (v ?? "").trim().slice(0, max) || undefined;

/** Katılımcı alanlarını doğrular ve kırpar. */
export function validateParticipant(input: ParticipantInput): Required<Pick<ParticipantInput, "fullName">> & ParticipantInput {
  const fullName = (input.fullName ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
  if (!fullName) throw new UserError("Ad soyad zorunludur.");
  const email = clean(input.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserError(`Geçersiz e-posta: ${email}`);
  return {
    fullName,
    studentNo: clean(input.studentNo, 30),
    email,
    phone: clean(input.phone, 30),
    department: clean(input.department, 100),
  };
}

const sameName = (a: string, b: string) => normalizeName(a) === normalizeName(b);

/** Workshop'ta aynı kişi zaten var mı? (öğrenci numarası, numara yoksa ad soyad) */
export function findDuplicate(db: Database, workshopId: string, p: ParticipantInput, exceptId?: string) {
  return db.participants.find(
    (x) =>
      x.workshopId === workshopId &&
      x.id !== exceptId &&
      (p.studentNo && x.studentNo ? x.studentNo === p.studentNo : sameName(x.fullName, p.fullName)),
  );
}

/** Katılımcıları workshop'a ekler; aynı kişi zaten varsa atlar. */
export function addParticipants(db: Database, workshopId: string, rows: ParticipantInput[]) {
  if (!db.workshops.some((w) => w.id === workshopId)) throw new UserError("Workshop bulunamadı.");
  let added = 0;
  const skipped: string[] = [];
  for (const row of rows) {
    const p = validateParticipant(row);
    if (findDuplicate(db, workshopId, p)) {
      skipped.push(p.fullName);
      continue;
    }
    db.participants.push({ id: newId(), workshopId, ...p, createdAt: now() });
    added++;
  }
  return { added, skipped };
}

/** Bir workshop'u katılımcıları ve yoklamalarıyla birlikte siler. */
export function removeWorkshop(db: Database, workshopId: string) {
  db.workshops = db.workshops.filter((w) => w.id !== workshopId);
  db.participants = db.participants.filter((p) => p.workshopId !== workshopId);
  db.sessions = db.sessions.filter((s) => s.workshopId !== workshopId);
}

/** Katılımcıyı ve yoklama kayıtlarını siler. */
export function removeParticipant(db: Database, participantId: string) {
  const p = db.participants.find((x) => x.id === participantId);
  if (!p) return;
  db.participants = db.participants.filter((x) => x.id !== participantId);
  for (const s of db.sessions) if (s.workshopId === p.workshopId) delete s.attendance[participantId];
}

/**
 * Formdaki katılımcı tablosundan gelen JSON'u doğrular. Hatalı satırlar
 * satır numarasıyla bildirilir; tamamen boş satırlar yok sayılır.
 */
export function parseParticipantsJson(json: string): { rows: ParticipantInput[]; errors: string[] } {
  let data: unknown;
  try {
    data = JSON.parse(json || "[]");
  } catch {
    return { rows: [], errors: ["Katılımcı listesi okunamadı."] };
  }
  if (!Array.isArray(data)) return { rows: [], errors: ["Katılımcı listesi okunamadı."] };

  const rows: ParticipantInput[] = [];
  const errors: string[] = [];
  data.slice(0, 2000).forEach((item, i) => {
    const r = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const val = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : "");
    const input = { fullName: val("fullName"), studentNo: val("studentNo"), email: val("email"), phone: val("phone"), department: val("department") };
    if (Object.values(input).every((v) => !v.trim())) return;
    try {
      rows.push(validateParticipant(input));
    } catch (err) {
      errors.push(`${i + 1}. satır: ${err instanceof Error ? err.message : "geçersiz"}`);
    }
  });
  return { rows, errors };
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
