import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { getJSON, putJSON, PreconditionFailedError } from "./r2";
import { emptyDatabase, type AdminSession, type Database, type LoginFailure } from "./types";

const MAX_RETRIES = 5;

/**
 * R2 bilgileri tanımlı değilse ve production'da değilsek, geliştirme kolaylığı
 * için veriyi yerel `.data/` klasöründe tutarız. Production'da R2 zorunludur.
 */
const isLocalStore = () => !process.env.R2_ACCOUNT_ID && process.env.NODE_ENV !== "production";
const localPath = (key: string) => path.join(process.cwd(), ".data", key.replace(/\//g, "_"));

async function load<T>(key: string, fallback: () => T): Promise<{ data: T; etag: string | null }> {
  if (isLocalStore()) {
    try {
      return { data: JSON.parse(await fs.readFile(localPath(key), "utf-8")), etag: "local" };
    } catch {
      return { data: fallback(), etag: null };
    }
  }
  const res = await getJSON<T>(key);
  return res ? { data: res.data, etag: res.etag } : { data: fallback(), etag: null };
}

async function save(key: string, data: unknown, etag: string | null): Promise<void> {
  if (isLocalStore()) {
    await fs.mkdir(path.dirname(localPath(key)), { recursive: true });
    await fs.writeFile(localPath(key), JSON.stringify(data, null, 2));
    return;
  }
  await putJSON(key, data, etag);
}

/** Bir JSON dokümanını atomik olarak günceller; eşzamanlı yazmada yeniden dener. */
async function mutate<T, R>(key: string, fallback: () => T, fn: (data: T) => R): Promise<R> {
  for (let attempt = 0; ; attempt++) {
    const { data, etag } = await load(key, fallback);
    const result = fn(data);
    try {
      await save(key, data, etag);
      return result;
    } catch (err) {
      if (err instanceof PreconditionFailedError && attempt < MAX_RETRIES) continue;
      throw err;
    }
  }
}

/* ---- Ana veritabanı: öğrenciler, workshoplar, yoklamalar ---- */

const DB_KEY = "wts/db.json";

export const readDb = async (): Promise<Database> => (await load(DB_KEY, emptyDatabase)).data;
export const mutateDb = <R>(fn: (db: Database) => R) => mutate(DB_KEY, emptyDatabase, fn);

/* ---- Admin oturumları ---- */

const SESSIONS_KEY = "wts/admin-sessions.json";

export const readAdminSessions = async (): Promise<AdminSession[]> => (await load(SESSIONS_KEY, () => [])).data;
export const mutateAdminSessions = <R>(fn: (s: AdminSession[]) => R) =>
  mutate<AdminSession[], R>(SESSIONS_KEY, () => [], fn);

/* ---- Başarısız giriş denemeleri ---- */

const FAILURES_KEY = "wts/login-failures.json";

export const readLoginFailures = async (): Promise<LoginFailure[]> => (await load(FAILURES_KEY, () => [])).data;
export const mutateLoginFailures = <R>(fn: (f: LoginFailure[]) => R) =>
  mutate<LoginFailure[], R>(FAILURES_KEY, () => [], fn);

export const newId = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
