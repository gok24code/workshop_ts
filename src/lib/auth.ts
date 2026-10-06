import "server-only";
import { createHash, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { mutateAdminSessions, newId, now, readAdminSessions, readDb } from "./db";
import type { Workshop } from "./types";

/* ------------------------------------------------------------------ */
/* Ortak                                                               */
/* ------------------------------------------------------------------ */

const ISSUER = "wts";
const ADMIN_AUD = "wts-admin";
const INSTRUCTOR_AUD = "wts-instructor";

const ADMIN_COOKIE = "wts_admin";
const INSTRUCTOR_COOKIE = "wts_egitmen";

/** Tarayıcıların izin verdiği en uzun çerez ömrü (400 gün). */
const INSTRUCTOR_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

const secure = () => process.env.NODE_ENV === "production";

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET en az 32 karakter olmalı (.env dosyasını kontrol edin).");
  }
  return new TextEncoder().encode(secret);
}

async function verify(token: string | undefined, audience: string): Promise<JWTPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"], issuer: ISSUER, audience });
    return payload;
  } catch {
    return null;
  }
}

const sha256 = (s: string) => createHash("sha256").update(s).digest();

/* ------------------------------------------------------------------ */
/* Admin: tarayıcıya bağlı, süreli, sunucuda kayıtlı ve iptal edilebilir */
/* ------------------------------------------------------------------ */

export function adminSessionTtlMinutes(): number {
  const n = Number.parseInt(process.env.ADMIN_SESSION_MINUTES ?? "", 10);
  return Number.isFinite(n) && n >= 5 ? n : 120;
}

async function userAgent(): Promise<string> {
  return ((await headers()).get("user-agent") ?? "").slice(0, 300);
}

export function checkAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length < 12) {
    throw new Error("ADMIN_PASSWORD en az 12 karakter olmalı (.env dosyasını kontrol edin).");
  }
  return timingSafeEqual(sha256(input), sha256(expected));
}

export async function createAdminSession(ip: string): Promise<void> {
  const ttl = adminSessionTtlMinutes() * 60;
  const ua = await userAgent();
  const id = newId();
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  await mutateAdminSessions((list) => {
    const t = now();
    for (let i = list.length - 1; i >= 0; i--) if (list[i].expiresAt <= t) list.splice(i, 1);
    list.push({ id, uaHash: sha256(ua).toString("hex"), userAgent: ua, ip, createdAt: t, expiresAt });
  });

  const token = await new SignJWT({ sid: id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(ADMIN_AUD)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secretKey());

  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: secure(),
    sameSite: "strict",
    path: "/admin",
    maxAge: ttl,
  });
}

/** Geçerli admin oturumunun id'sini döner; yoksa `null`. */
export async function getAdminSessionId(): Promise<string | null> {
  const payload = await verify((await cookies()).get(ADMIN_COOKIE)?.value, ADMIN_AUD);
  if (!payload || typeof payload.sid !== "string") return null;
  const session = (await readAdminSessions()).find((s) => s.id === payload.sid);
  if (!session || session.expiresAt <= now()) return null;
  // Çerez başka bir tarayıcıya taşınmışsa reddet.
  const uaHash = sha256(await userAgent()).toString("hex");
  if (!timingSafeEqual(Buffer.from(uaHash), Buffer.from(session.uaHash))) return null;
  return session.id;
}

export async function requireAdmin(): Promise<string> {
  const sid = await getAdminSessionId();
  if (!sid) redirect("/admin/giris");
  return sid;
}

export async function destroyAdminSession(): Promise<void> {
  const payload = await verify((await cookies()).get(ADMIN_COOKIE)?.value, ADMIN_AUD);
  if (payload && typeof payload.sid === "string") {
    const sid = payload.sid;
    await mutateAdminSessions((list) => {
      const i = list.findIndex((s) => s.id === sid);
      if (i >= 0) list.splice(i, 1);
    });
  }
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
}

/* ------------------------------------------------------------------ */
/* Eğitmen: workshop'a bağlı, süresiz; şifre değişince geçersiz olur     */
/* ------------------------------------------------------------------ */

export async function createInstructorSession(workshop: Workshop): Promise<void> {
  const token = await new SignJWT({ wid: workshop.id, v: workshop.passwordVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(INSTRUCTOR_AUD)
    .setIssuedAt()
    .sign(secretKey());

  (await cookies()).set(INSTRUCTOR_COOKIE, token, {
    httpOnly: true,
    secure: secure(),
    sameSite: "lax",
    path: "/",
    maxAge: INSTRUCTOR_COOKIE_MAX_AGE,
  });
}

/** Eğitmen oturumunun bağlı olduğu workshop'u döner; geçersizse `null`. */
export async function getInstructorWorkshop() {
  const payload = await verify((await cookies()).get(INSTRUCTOR_COOKIE)?.value, INSTRUCTOR_AUD);
  if (!payload || typeof payload.wid !== "string" || typeof payload.v !== "number") return null;
  const db = await readDb();
  const workshop = db.workshops.find((w) => w.id === payload.wid);
  if (!workshop || workshop.archived || workshop.passwordVersion !== payload.v) return null;
  return { workshop, db };
}

export async function requireInstructor() {
  const result = await getInstructorWorkshop();
  if (!result) redirect("/");
  return result;
}

export async function destroyInstructorSession(): Promise<void> {
  (await cookies()).delete(INSTRUCTOR_COOKIE);
}
