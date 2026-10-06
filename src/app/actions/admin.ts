"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { mutateAdminSessions, mutateDb, newId, now } from "@/lib/db";
import { int, str, type FormState } from "@/lib/forms";
import {
  enroll,
  generatePassword,
  normalizeName,
  parseStudentLines,
  saveSessionIn,
  upsertStudent,
  UserError,
  type SaveSessionInput,
} from "@/lib/mutations";
import type { Database } from "@/lib/types";

function revalidateAll() {
  revalidatePath("/admin", "layout");
  revalidatePath("/yoklama", "layout");
}

async function run(fn: () => Promise<FormState | string | void>): Promise<FormState> {
  await requireAdmin();
  try {
    const result = await fn();
    revalidateAll();
    if (result && typeof result === "object") return result;
    return { ok: result || "Kaydedildi." };
  } catch (err) {
    if (err instanceof UserError) return { error: err.message };
    console.error(err);
    return { error: "Beklenmeyen bir hata oluştu." };
  }
}

/** Formdan gelen şifreyi alır; boşsa güçlü bir şifre üretir. */
function passwordFrom(fd: FormData): string {
  const custom = str(fd, "password", 200);
  if (!custom) return generatePassword();
  if (custom.length < 8) throw new UserError("Şifre en az 8 karakter olmalı (boş bırakırsanız otomatik üretilir).");
  return custom;
}

function assertUniqueTitle(db: Database, title: string, exceptId?: string) {
  const n = normalizeName(title);
  if (!n) throw new UserError("Workshop adı harf veya rakam içermeli.");
  if (db.workshops.some((w) => w.id !== exceptId && normalizeName(w.title) === n)) {
    throw new UserError("Bu ada çok benzeyen bir workshop zaten var. Eğitmen girişi ada göre yapıldığından farklı bir ad seçin.");
  }
}

/* ---------------------------- Workshoplar ---------------------------- */

export async function createWorkshop(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const title = str(fd, "title", 120);
    if (!title) throw new UserError("Workshop adı zorunludur.");
    const password = passwordFrom(fd);
    const passwordHash = await bcrypt.hash(password, 12);
    await mutateDb((db) => {
      assertUniqueTitle(db, title);
      db.workshops.push({
        id: newId(),
        title,
        description: str(fd, "description", 500) || undefined,
        instructorName: str(fd, "instructorName", 100) || undefined,
        passwordHash,
        passwordVersion: 1,
        studentIds: [],
        absenceLimit: int(fd, "absenceLimit", 2, 52),
        archived: false,
        createdAt: now(),
      });
    });
    return {
      ok: `“${title}” oluşturuldu. Eğitmen girişi için şifre aşağıda; bu şifre bir daha gösterilmeyecek.`,
      secret: password,
    };
  });
}

export async function updateWorkshop(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const id = str(fd, "id");
    const title = str(fd, "title", 120);
    if (!title) throw new UserError("Workshop adı zorunludur.");
    await mutateDb((db) => {
      const w = db.workshops.find((x) => x.id === id);
      if (!w) throw new UserError("Workshop bulunamadı.");
      assertUniqueTitle(db, title, id);
      w.title = title;
      w.description = str(fd, "description", 500) || undefined;
      w.instructorName = str(fd, "instructorName", 100) || undefined;
      w.absenceLimit = int(fd, "absenceLimit", w.absenceLimit, 52);
      w.archived = fd.get("archived") === "on";
    });
  });
}

/** Yeni şifre belirler ve o workshop'taki tüm açık eğitmen oturumlarını kapatır. */
export async function resetWorkshopPassword(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const id = str(fd, "id");
    const password = passwordFrom(fd);
    const passwordHash = await bcrypt.hash(password, 12);
    await mutateDb((db) => {
      const w = db.workshops.find((x) => x.id === id);
      if (!w) throw new UserError("Workshop bulunamadı.");
      w.passwordHash = passwordHash;
      w.passwordVersion++;
    });
    return { ok: "Yeni şifre belirlendi, eğitmenin açık oturumları kapatıldı. Şifre bir daha gösterilmeyecek.", secret: password };
  });
}

export async function deleteWorkshop(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = str(fd, "id");
  await mutateDb((db) => {
    db.workshops = db.workshops.filter((w) => w.id !== id);
    db.sessions = db.sessions.filter((s) => s.workshopId !== id);
  });
  revalidateAll();
  redirect("/admin/workshoplar");
}

export async function enrollStudents(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const workshopId = str(fd, "workshopId");
    const ids = fd.getAll("studentIds").map(String);
    const rows = parseStudentLines(str(fd, "bulk", 200_000));
    const added = await mutateDb((db) => {
      let count = 0;
      for (const id of ids) {
        if (db.students.some((s) => s.id === id)) {
          enroll(db, workshopId, id);
          count++;
        }
      }
      for (const row of rows) {
        enroll(db, workshopId, upsertStudent(db, row).id);
        count++;
      }
      return count;
    });
    if (!added) throw new UserError("Eklenecek öğrenci seçilmedi.");
    return `${added} öğrenci workshop'a eklendi.`;
  });
}

export async function unenrollStudent(fd: FormData): Promise<void> {
  await requireAdmin();
  const workshopId = str(fd, "workshopId");
  const studentId = str(fd, "studentId");
  await mutateDb((db) => {
    const w = db.workshops.find((x) => x.id === workshopId);
    if (w) w.studentIds = w.studentIds.filter((id) => id !== studentId);
  });
  revalidateAll();
}

export async function adminSaveSession(input: SaveSessionInput): Promise<FormState> {
  return run(async () => {
    await mutateDb((db) => saveSessionIn(db, input, "admin"));
    return "Yoklama kaydedildi.";
  });
}

export async function adminDeleteSession(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = str(fd, "id");
  const workshopId = str(fd, "workshopId");
  await mutateDb((db) => {
    db.sessions = db.sessions.filter((s) => s.id !== id);
  });
  revalidateAll();
  redirect(`/admin/workshoplar/${encodeURIComponent(workshopId)}`);
}

/* ---------------------------- Öğrenciler ---------------------------- */

export async function importStudents(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const rows = parseStudentLines(str(fd, "bulk", 200_000));
    if (!rows.length) throw new UserError("En az bir satır girin: numara, ad soyad, e-posta, bölüm");
    const created = await mutateDb((db) => {
      const before = db.students.length;
      for (const row of rows) upsertStudent(db, row);
      return db.students.length - before;
    });
    const existing = rows.length - created;
    return `${created} yeni öğrenci eklendi${existing ? `, ${existing} zaten kayıtlıydı` : ""}.`;
  });
}

export async function updateStudent(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const id = str(fd, "id");
    const studentNo = str(fd, "studentNo", 30);
    const fullName = str(fd, "fullName", 100);
    if (!studentNo || !fullName) throw new UserError("Numara ve ad soyad zorunludur.");
    await mutateDb((db) => {
      const s = db.students.find((x) => x.id === id);
      if (!s) throw new UserError("Öğrenci bulunamadı.");
      if (db.students.some((x) => x.id !== id && x.studentNo === studentNo)) {
        throw new UserError("Bu numara başka bir öğrenciye ait.");
      }
      s.studentNo = studentNo;
      s.fullName = fullName;
      s.email = str(fd, "email", 120) || undefined;
      s.department = str(fd, "department", 100) || undefined;
    });
  });
}

export async function deleteStudent(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = str(fd, "id");
  await mutateDb((db) => {
    db.students = db.students.filter((s) => s.id !== id);
    for (const w of db.workshops) w.studentIds = w.studentIds.filter((x) => x !== id);
    for (const s of db.sessions) delete s.attendance[id];
  });
  revalidateAll();
  redirect("/admin/ogrenciler");
}

/* ---------------------------- Admin oturumları ---------------------------- */

export async function revokeAdminSession(fd: FormData): Promise<void> {
  const current = await requireAdmin();
  const id = str(fd, "id");
  const all = fd.get("all") === "1";
  await mutateAdminSessions((list) => {
    for (let i = list.length - 1; i >= 0; i--) {
      if (all ? list[i].id !== current : list[i].id === id) list.splice(i, 1);
    }
  });
  revalidatePath("/admin/oturumlar");
}
