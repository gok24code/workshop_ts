"use server";

import { revalidatePath } from "next/cache";
import { createInstructorSession, requireInstructor } from "@/lib/auth";
import { mutateDb } from "@/lib/db";
import type { FormState } from "@/lib/forms";
import { saveSessionIn, UserError, type SaveSessionInput } from "@/lib/mutations";

/**
 * Eğitmenin tek yetkisi: kendi workshop'unda bir haftanın yoklamasını
 * (Var / Yok) kaydetmek veya düzeltmek. Workshop id'si istemciden değil,
 * imzalı oturumdan alınır.
 */
export async function instructorSaveSession(input: Omit<SaveSessionInput, "workshopId">): Promise<FormState> {
  const { workshop } = await requireInstructor();
  try {
    await mutateDb((db) => {
      const w = db.workshops.find((x) => x.id === workshop.id);
      if (!w || w.archived || w.passwordVersion !== workshop.passwordVersion) {
        throw new UserError("Oturumunuz geçersiz. Lütfen tekrar giriş yapın.");
      }
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
    // Aktif eğitmenin çerez ömrünü yenile (süresiz oturum).
    await createInstructorSession(workshop);
    revalidatePath("/yoklama", "layout");
    revalidatePath("/admin", "layout");
    return { ok: "Yoklama kaydedildi." };
  } catch (err) {
    if (err instanceof UserError) return { error: err.message };
    console.error(err);
    return { error: "Beklenmeyen bir hata oluştu." };
  }
}
