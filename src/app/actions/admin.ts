"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { mutateAdminSessions, mutateDb, newId, now } from "@/lib/db";
import { int, str, type FormState } from "@/lib/forms";
import {
  addParticipants,
  findDuplicate,
  generatePassword,
  normalizeName,
  parseParticipantsJson,
  removeParticipant,
  removeWorkshop,
  saveSessionIn,
  UserError,
  validateParticipant,
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
    throw new UserError("Bu ada çok benzeyen bir workshop zaten var. Sorumlu girişi ada göre yapıldığından farklı bir ad seçin.");
  }
}

/* ---------------------------- Workshoplar ---------------------------- */

export async function createWorkshop(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const title = str(fd, "title", 120);
    if (!title) throw new UserError("Workshop adı zorunludur.");
    const { rows, errors } = parseParticipantsJson(str(fd, "participants", 500_000));
    if (errors.length) throw new UserError(`Katılımcı listesinde hata var — ${errors.slice(0, 5).join(" · ")}`);
    if (!rows.length) throw new UserError("Workshop'u açarken en az bir katılımcı girin.");
    const password = passwordFrom(fd);
    const passwordHash = await bcrypt.hash(password, 12);
    const id = newId();
    const { added, skipped } = await mutateDb((db) => {
      assertUniqueTitle(db, title);
      db.workshops.push({
        id,
        title,
        description: str(fd, "description", 500) || undefined,
        instructorName: str(fd, "instructorName", 100) || undefined,
        passwordHash,
        passwordVersion: 1,
        absenceLimit: int(fd, "absenceLimit", 2, 52),
        archived: false,
        createdAt: now(),
      });
      return addParticipants(db, id, rows);
    });
    const dup = skipped.length ? ` (${skipped.length} tekrar eden satır atlandı)` : "";
    return {
      ok: `“${title}” ${added} katılımcıyla oluşturuldu${dup}. Sorumlu girişi için şifre aşağıda; bu şifre bir daha gösterilmeyecek.`,
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

/** Yeni şifre belirler ve o workshop'taki tüm açık sorumlu oturumlarını kapatır. */
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
    return { ok: "Yeni şifre belirlendi, sorumlunun açık oturumları kapatıldı. Şifre bir daha gösterilmeyecek.", secret: password };
  });
}

export async function deleteWorkshop(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = str(fd, "id");
  await mutateDb((db) => removeWorkshop(db, id));
  revalidateAll();
  redirect("/admin/workshoplar");
}

export async function addParticipantsToWorkshop(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const workshopId = str(fd, "workshopId");
    const { rows, errors } = parseParticipantsJson(str(fd, "participants", 500_000));
    if (errors.length) throw new UserError(`Katılımcı listesinde hata var — ${errors.slice(0, 5).join(" · ")}`);
    if (!rows.length) throw new UserError("En az bir katılımcı girin.");
    const { added, skipped } = await mutateDb((db) => addParticipants(db, workshopId, rows));
    const dup = skipped.length ? ` ${skipped.length} kişi zaten listede olduğu için atlandı: ${skipped.slice(0, 5).join(", ")}` : "";
    return `${added} katılımcı eklendi.${dup}`;
  });
}

export async function updateParticipant(_: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const id = str(fd, "id");
    const data = validateParticipant({
      fullName: str(fd, "fullName", 100),
      department: str(fd, "department", 100),
    });
    await mutateDb((db) => {
      const p = db.participants.find((x) => x.id === id);
      if (!p) throw new UserError("Katılımcı bulunamadı.");
      if (findDuplicate(db, p.workshopId, data, id)) throw new UserError("Bu workshop'ta aynı kişi zaten kayıtlı.");
      Object.assign(p, { department: undefined }, data);
    });
  });
}

export async function deleteParticipant(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = str(fd, "id");
  const workshopId = await mutateDb((db) => {
    const wid = db.participants.find((p) => p.id === id)?.workshopId;
    removeParticipant(db, id);
    return wid;
  });
  revalidateAll();
  if (fd.get("redirect") === "1" && workshopId) redirect(`/admin/workshoplar/${encodeURIComponent(workshopId)}`);
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
