"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import {
  checkAdminPassword,
  createAdminSession,
  createInstructorSession,
  destroyAdminSession,
  destroyInstructorSession,
} from "@/lib/auth";
import { readDb } from "@/lib/db";
import { str, type FormState } from "@/lib/forms";
import { clearFailures, clientIp, lockedMinutes, recordFailure } from "@/lib/ratelimit";

// Workshop bulunamadığında da bcrypt karşılaştırması yaparak geçersiz ve
// geçerli seçimlerin yanıt süresinden ayırt edilmesini engeller.
const DUMMY_HASH = bcrypt.hashSync("wts-dummy-password", 10);

const lockedMessage = (min: number) => `Çok fazla hatalı deneme. ${min} dakika sonra tekrar deneyin.`;

export async function instructorLogin(_: FormState, fd: FormData): Promise<FormState> {
  const key = `egitmen:${await clientIp()}`;
  const locked = await lockedMinutes(key);
  if (locked) return { error: lockedMessage(locked) };

  const workshopId = str(fd, "workshop");
  const password = str(fd, "password", 200);
  const db = await readDb();
  const workshop = db.workshops.find((w) => !w.archived && w.id === workshopId);
  const ok = await bcrypt.compare(password, workshop?.passwordHash ?? DUMMY_HASH);

  if (!workshop || !ok) {
    await recordFailure(key);
    return { error: "Workshop veya şifre hatalı." };
  }
  await clearFailures(key);
  await createInstructorSession(workshop);
  redirect("/yoklama");
}

export async function instructorLogout(): Promise<void> {
  await destroyInstructorSession();
  redirect("/");
}

export async function adminLogin(_: FormState, fd: FormData): Promise<FormState> {
  const ip = await clientIp();
  const key = `admin:${ip}`;
  const locked = await lockedMinutes(key);
  if (locked) return { error: lockedMessage(locked) };

  if (!checkAdminPassword(str(fd, "password", 500))) {
    await recordFailure(key);
    return { error: "Şifre hatalı." };
  }
  await clearFailures(key);
  await createAdminSession(ip);
  redirect("/admin");
}

export async function adminLogout(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/giris");
}
