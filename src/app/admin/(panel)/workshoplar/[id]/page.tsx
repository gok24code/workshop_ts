import Link from "next/link";
import { notFound } from "next/navigation";
import { addParticipantsToWorkshop, deleteParticipant, deleteWorkshop, resetWorkshopPassword, updateWorkshop } from "@/app/actions/admin";
import { AttendanceMatrix } from "@/components/AttendanceMatrix";
import { ActionForm, ConfirmForm, SubmitButton } from "@/components/forms";
import { ParticipantsInput } from "@/components/ParticipantsInput";
import { PageHeader, StatCard } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { formatDate, nextWeek, participantsOf, pct, sessionsOf, workshopStats } from "@/lib/stats";

export default async function AdminWorkshopPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const db = await readDb();
  const workshop = db.workshops.find((w) => w.id === id);
  if (!workshop) notFound();

  const participants = participantsOf(db, workshop.id);
  const sessions = sessionsOf(db, workshop.id);
  const stats = workshopStats(db, workshop);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/workshoplar", label: "Workshoplar" }}
        title={workshop.title}
        subtitle={`${workshop.instructorName || "Sorumlu adı girilmedi"} · Devamsızlık sınırı: ${workshop.absenceLimit} hafta${workshop.archived ? " · Arşivlenmiş" : ""}`}
        actions={
          <>
            <a href={`/admin/csv/${workshop.id}`} className="btn-ghost">CSV indir</a>
            <Link href={`/admin/workshoplar/${workshop.id}/hafta/yeni`} className="btn-gold">+ {nextWeek(sessions)}. hafta yoklaması</Link>
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Katılımcı" value={stats.participantCount} />
        <StatCard label="Yoklama" value={stats.sessionCount} hint="alınan hafta" />
        <StatCard label="Toplam devamsızlık" value={stats.totalAbsences} />
        <StatCard accent label="Katılım oranı" value={pct(stats.rate)} hint={`${stats.overLimit} katılımcı sınırı aştı`} />
      </div>

      <h2 className="mb-1 text-lg font-bold">Hafta hafta yoklama</h2>
      <p className="mb-3 text-xs text-navy-700/60">Düzenlemek için hafta başlığına tıklayın. Yeşil: geldi · Kırmızı: gelmedi · Sarı: izinli</p>
      <AttendanceMatrix
        workshop={workshop}
        participants={participants}
        sessions={sessions}
        sessionHref={(s) => `/admin/workshoplar/${workshop.id}/hafta/${s.id}`}
        participantHref={(p) => `/admin/workshoplar/${workshop.id}/katilimci/${p.id}`}
        rowActions={(p) => (
          <ConfirmForm
            action={deleteParticipant}
            hidden={{ id: p.id }}
            message={`${p.fullName} bu workshop'tan silinsin mi? Bu workshop'taki yoklama kayıtları da silinir.`}
            className="text-xs font-semibold text-red-600 hover:underline"
          >
            Sil
          </ConfirmForm>
        )}
      />

      {sessions.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">Alınan yoklamalar</h2>
          <div className="card divide-y divide-navy-100">
            {sessions.map((s) => {
              const vals = Object.values(s.attendance);
              return (
                <Link key={s.id} href={`/admin/workshoplar/${workshop.id}/hafta/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-navy-50">
                  <div className="min-w-0">
                    <div className="font-semibold">{s.week}. hafta</div>
                    <div className="truncate text-xs text-navy-700/60">
                      {formatDate(s.date)} · {s.takenBy === "admin" ? "Yönetim" : "Sorumlu"}{s.topic ? ` · ${s.topic}` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-xs font-semibold">
                    <span>
                      <span className="text-emerald-700">{vals.filter((v) => v === "present").length} geldi</span>
                      <span className="mx-1 text-navy-700/30">·</span>
                      <span className="text-red-700">{vals.filter((v) => v === "absent").length} gelmedi</span>
                    </span>
                    <span className="text-gold-700">Düzenle →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="card mt-8 p-5">
        <h2 className="mb-1 text-lg font-bold">Katılımcı ekle</h2>
        <p className="mb-4 text-sm text-navy-700/60">
          Listede zaten olan kişiler (aynı öğrenci no, numara yoksa aynı ad soyad) tekrar eklenmez.
        </p>
        <ActionForm action={addParticipantsToWorkshop} resetOnSuccess className="space-y-4">
          <input type="hidden" name="workshopId" value={workshop.id} />
          <ParticipantsInput required initialRows={1} />
          <SubmitButton>Katılımcıları kaydet</SubmitButton>
        </ActionForm>
      </div>

      <div className="mt-8 grid gap-8 items-start lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-1 text-lg font-bold">Sorumlu şifresi</h2>
          <p className="mb-4 text-sm text-navy-700/60">
            Şifreler geri okunamayacak şekilde saklanır. Yeni şifre belirlendiğinde sorumlunun açık oturumları kapanır.
          </p>
          <ActionForm action={resetWorkshopPassword} resetOnSuccess className="flex flex-wrap gap-2">
            <input type="hidden" name="id" value={workshop.id} />
            <input name="password" type="text" className="input min-w-0 flex-1" placeholder="Boş → otomatik üret" autoComplete="off" maxLength={200} />
            <SubmitButton className="btn-navy">Yeni şifre</SubmitButton>
          </ActionForm>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-lg font-bold">Workshop ayarları</h2>
          <ActionForm action={updateWorkshop} className="space-y-4">
            <input type="hidden" name="id" value={workshop.id} />
            <div>
              <label className="label" htmlFor="title">Workshop adı (sorumlu girişinde kullanılır)</label>
              <input id="title" name="title" defaultValue={workshop.title} className="input" required maxLength={120} />
            </div>
            <div>
              <label className="label" htmlFor="instructorName">Sorumlu adı</label>
              <input id="instructorName" name="instructorName" defaultValue={workshop.instructorName} className="input" maxLength={100} />
            </div>
            <div>
              <label className="label" htmlFor="description">Açıklama</label>
              <textarea id="description" name="description" rows={2} defaultValue={workshop.description} className="input" maxLength={500} />
            </div>
            <div>
              <label className="label" htmlFor="absenceLimit">Devamsızlık sınırı (hafta)</label>
              <input id="absenceLimit" name="absenceLimit" type="number" min={0} max={52} defaultValue={workshop.absenceLimit} className="input" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="archived" defaultChecked={workshop.archived} className="accent-gold-600" />
              Arşivle (sorumlu giriş yapamaz)
            </label>
            <SubmitButton>Kaydet</SubmitButton>
          </ActionForm>
        </div>

        <div className="card border-red-100 p-5">
          <h2 className="mb-1 text-lg font-bold text-red-700">Workshop&apos;u sil</h2>
          <p className="mb-4 text-sm text-navy-700/60">Workshop, katılımcı listesi ve tüm yoklama kayıtları kalıcı olarak silinir.</p>
          <ConfirmForm action={deleteWorkshop} hidden={{ id: workshop.id }} message={`“${workshop.title}” ve tüm yoklamaları kalıcı olarak silinsin mi?`}>
            Workshop&apos;u sil
          </ConfirmForm>
        </div>
      </div>
    </>
  );
}
