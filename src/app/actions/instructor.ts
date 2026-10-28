"use server";

import { revalidatePath } from "next/cache";
import { createInstructorSession, requireInstructor } from "@/lib/auth";
import { mutateDb } from "@/lib/db";
import { str, type FormState } from "@/lib/forms";
import {
  addParticipants,
  parseParticipantsJson,
  removeParticipant,
  saveSessionIn,
  UserError,
  type SaveSessionInput,
} from "@/lib/mutations";
import type { Database, Workshop } from "@/lib/types";

/*
 * Sorumlunun yetkileri: kendi workshop'unda bir haftanın yoklamasını
 * (Var / Yok) kaydetmek veya düzeltmek ve katılımcı eklemek/çıkarmak.
 * Workshop id'si istemciden değil, imzalı oturumdan alınır.
 */

/** Oturum açıldıktan sonra workshop silinmiş, arşivlenmiş veya şifresi değişmişse reddeder. */
function assertActive(db: Database, workshop: Workshop) {
  const w = db.workshops.find((x) => x.id === workshop.id);
  if (!w || w.archived || w.passwordVersion !== workshop.passwordVersion) {
    throw new UserError("Oturumunuz geçersiz. Lütfen tekrar giriş yapın.");
  }
}

function revalidateAll() {
  revalidatePath("/yoklama", "layout");
  revalidatePath("/admin", "layout");
}

async function run(fn: (workshop: Workshop) => Promise<string>): Promise<FormState> {
  const { workshop } = await requireInstructor();
  try {
    const ok = await fn(workshop);
    // Aktif sorumlunun çerez ömrünü yenile (süresiz oturum).
    await createInstructorSession(workshop);
    revalidateAll();
    return { ok };
  } catch (err) {
    if (err instanceof UserError) return { error: err.message };
    console.error(err);
    return { error: "Beklenmeyen bir hata oluştu." };
  }
}

export async function instructorSaveSession(input: Omit<SaveSessionInput, "workshopId">): Promise<FormState> {
  return run(async (workshop) => {
    await mutateDb((db) => {
      assertActive(db, workshop);
      return saveSessionIn(
        db,
        {
          workshopId: workshop.id,
          sessionId: typeof input.sessionId === "string" ? input.sessionId : undefined,
          week: input.week,
          date: input.date,
          topic: input.topic,
          attendance: input.attendance,
        },
        "instructor",
      );
    });
    return "Yoklama kaydedildi.";
  });
}

export async function instructorAddParticipants(_: FormState, fd: FormData): Promise<FormState> {
  return run(async (workshop) => {
    const { rows, errors } = parseParticipantsJson(str(fd, "participants", 500_000));
    if (errors.length) throw new UserError(`Katılımcı listesinde hata var — ${errors.slice(0, 5).join(" · ")}`);
    if (!rows.length) throw new UserError("En az bir katılımcı girin.");
    const { added, skipped } = await mutateDb((db) => {
      assertActive(db, workshop);
      return addParticipants(db, workshop.id, rows);
    });
    const dup = skipped.length ? ` ${skipped.length} kişi zaten listede olduğu için atlandı: ${skipped.slice(0, 5).join(", ")}` : "";
    return `${added} katılımcı eklendi.${dup}`;
  });
}

export async function instructorDeleteParticipant(fd: FormData): Promise<void> {
  const { workshop } = await requireInstructor();
  const id = str(fd, "id");
  await mutateDb((db) => {
    assertActive(db, workshop);
    const p = db.participants.find((x) => x.id === id);
    if (!p || p.workshopId !== workshop.id) throw new UserError("Katılımcı bulunamadı.");
    removeParticipant(db, id);
  });
  revalidateAll();
}
