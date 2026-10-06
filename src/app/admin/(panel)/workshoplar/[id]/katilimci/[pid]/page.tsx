import { notFound } from "next/navigation";
import { deleteParticipant, updateParticipant } from "@/app/actions/admin";
import { ActionForm, ConfirmForm, SubmitButton } from "@/components/forms";
import { AbsenceBadge, PageHeader, RateBar, StatCard, StatusDot } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { formatDate, participantStats, pct, sessionsOf } from "@/lib/stats";

export default async function ParticipantPage({ params }: { params: Promise<{ id: string; pid: string }> }) {
  await requireAdmin();
  const { id, pid } = await params;
  const db = await readDb();
  const workshop = db.workshops.find((w) => w.id === id);
  const p = db.participants.find((x) => x.id === pid && x.workshopId === id);
  if (!workshop || !p) notFound();
  const sessions = sessionsOf(db, id);
  const stats = participantStats(sessions, p.id);

  const fields = [
    { name: "fullName", label: "Ad soyad *", value: p.fullName, required: true, max: 100 },
    { name: "studentNo", label: "Öğrenci no", value: p.studentNo, max: 30 },
    { name: "email", label: "E-posta", value: p.email, type: "email", max: 120 },
    { name: "phone", label: "Telefon", value: p.phone, type: "tel", max: 30 },
    { name: "department", label: "Bölüm", value: p.department, max: 100 },
  ];

  return (
    <>
      <PageHeader
        back={{ href: `/admin/workshoplar/${id}`, label: workshop.title }}
        title={p.fullName}
        subtitle={[p.studentNo, p.department, p.email, p.phone].filter(Boolean).join(" · ") || "Ek bilgi girilmemiş"}
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Geldi" value={stats.present} hint="hafta" />
        <StatCard label="Gelmedi" value={<span className={stats.absent > workshop.absenceLimit ? "text-red-600" : ""}>{stats.absent}</span>} hint={`sınır: ${workshop.absenceLimit}`} />
        <StatCard label="İzinli" value={stats.excused} />
        <StatCard accent label="Katılım" value={pct(stats.rate)} />
      </div>

      <div className="card mb-8 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Hafta hafta yoklama</h2>
          <div className="flex items-center gap-4">
            <RateBar rate={stats.rate} />
            <AbsenceBadge count={stats.absent} limit={workshop.absenceLimit} />
          </div>
        </div>
        {sessions.length === 0 ? (
          <p className="text-sm text-navy-700/60">Henüz yoklama alınmadı.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sessions.map((s) => (
              <div key={s.id} title={s.topic} className="flex items-center gap-1.5 rounded-lg border border-navy-100 px-2.5 py-1.5 text-xs">
                <StatusDot status={s.attendance[p.id]} />
                <span className="font-semibold">{s.week}. hafta</span>
                <span className="text-navy-700/60">{formatDate(s.date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="card p-5">
          <h2 className="mb-4 text-lg font-bold">Bilgileri düzenle</h2>
          <ActionForm action={updateParticipant} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={p.id} />
            {fields.map((f) => (
              <div key={f.name}>
                <label className="label" htmlFor={f.name}>{f.label}</label>
                <input id={f.name} name={f.name} type={f.type ?? "text"} defaultValue={f.value} required={f.required} maxLength={f.max} className="input" />
              </div>
            ))}
            <div className="sm:col-span-2"><SubmitButton>Kaydet</SubmitButton></div>
          </ActionForm>
        </div>
        <div className="card h-fit p-5">
          <h2 className="mb-1 text-lg font-bold text-red-700">Katılımcıyı sil</h2>
          <p className="mb-4 text-sm text-navy-700/60">Kişi bu workshop&apos;tan silinir ve bu workshop&apos;taki yoklama kayıtları da silinir. Diğer workshoplar etkilenmez.</p>
          <ConfirmForm action={deleteParticipant} hidden={{ id: p.id, redirect: "1" }} message={`${p.fullName} silinsin mi?`}>
            Katılımcıyı sil
          </ConfirmForm>
        </div>
      </div>
    </>
  );
}
