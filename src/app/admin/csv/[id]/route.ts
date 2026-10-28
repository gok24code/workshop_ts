import { getAdminSessionId } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { formatDate, sessionsOf, participantsOf, participantStats } from "@/lib/stats";

const LABEL = { present: "Geldi", absent: "Gelmedi", excused: "İzinli" } as const;

const cell = (v: string | number | undefined) => {
  const s = String(v ?? "");
  // Excel formül enjeksiyonuna karşı
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSessionId())) return new Response("Yetkisiz", { status: 401 });
  const { id } = await params;
  const db = await readDb();
  const workshop = db.workshops.find((w) => w.id === id);
  if (!workshop) return new Response("Bulunamadı", { status: 404 });

  const sessions = sessionsOf(db, id);
  const header = ["Ad Soyad", "Bölüm", ...sessions.map((s) => `${s.week}. hafta (${formatDate(s.date)})`), "Devamsızlık", "İzinli"];
  const lines = [header.map(cell).join(";")];
  for (const st of participantsOf(db, workshop.id)) {
    const stats = participantStats(sessions, st.id);
    const marks = sessions.map((s) => {
      const v = s.attendance[st.id];
      return v ? LABEL[v] : "";
    });
    lines.push([st.fullName, st.department, ...marks, stats.absent, stats.excused].map(cell).join(";"));
  }

  const filename = `${workshop.title.replace(/[^\p{L}\p{N}]+/gu, "_")}_yoklama.csv`;
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="yoklama.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
