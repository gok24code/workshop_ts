import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteStudent, updateStudent } from "@/app/actions/admin";
import { ActionForm, ConfirmForm, SubmitButton } from "@/components/forms";
import { AbsenceBadge, Empty, PageHeader, RateBar, StatCard, StatusDot } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { formatDate, pct, sessionsOf, studentOverviews } from "@/lib/stats";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const db = await readDb();
  const overview = studentOverviews(db).find((o) => o.student.id === id);
  if (!overview) notFound();
  const { student, workshops } = overview;
  const present = workshops.reduce((n, x) => n + x.stats.present, 0);
  const counted = present + overview.totalAbsences;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/ogrenciler", label: "Öğrenciler" }}
        title={student.fullName}
        subtitle={[student.studentNo, student.department, student.email].filter(Boolean).join(" · ")}
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Workshop" value={workshops.length} />
        <StatCard label="Devamsızlık" value={overview.totalAbsences} hint="tüm workshoplarda" />
        <StatCard label="İzinli" value={overview.totalExcused} />
        <StatCard accent label="Katılım" value={pct(counted ? present / counted : 1)} />
      </div>

      <h2 className="mb-3 text-lg font-bold">Workshop bazında hafta hafta yoklama</h2>
      {workshops.length === 0 ? (
        <Empty>Öğrenci henüz bir workshop&apos;a tanımlı değil.</Empty>
      ) : (
        <div className="space-y-4">
          {workshops.map(({ workshop, stats }) => {
            const sessions = sessionsOf(db, workshop.id);
            return (
              <div key={workshop.id} className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link href={`/admin/workshoplar/${workshop.id}`} className="font-semibold hover:text-gold-600">{workshop.title}</Link>
                  <div className="flex items-center gap-4">
                    <RateBar rate={stats.rate} />
                    <AbsenceBadge count={stats.absent} limit={workshop.absenceLimit} />
                  </div>
                </div>
                {sessions.length === 0 ? (
                  <p className="mt-3 text-xs text-navy-700/50">Henüz yoklama alınmadı.</p>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {sessions.map((s) => (
                      <div key={s.id} title={s.topic} className="flex items-center gap-1.5 rounded-lg border border-navy-100 px-2 py-1 text-xs">
                        <StatusDot status={s.attendance[student.id]} />
                        <span className="font-semibold">{s.week}. hf</span>
                        <span className="text-navy-700/60">{formatDate(s.date)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 text-lg font-bold">Bilgileri düzenle</h2>
          <ActionForm action={updateStudent} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={student.id} />
            <div>
              <label className="label" htmlFor="studentNo">Öğrenci no</label>
              <input id="studentNo" name="studentNo" defaultValue={student.studentNo} className="input" required maxLength={30} />
            </div>
            <div>
              <label className="label" htmlFor="fullName">Ad soyad</label>
              <input id="fullName" name="fullName" defaultValue={student.fullName} className="input" required maxLength={100} />
            </div>
            <div>
              <label className="label" htmlFor="email">E-posta</label>
              <input id="email" name="email" type="email" defaultValue={student.email} className="input" maxLength={120} />
            </div>
            <div>
              <label className="label" htmlFor="department">Bölüm</label>
              <input id="department" name="department" defaultValue={student.department} className="input" maxLength={100} />
            </div>
            <div className="sm:col-span-2"><SubmitButton>Kaydet</SubmitButton></div>
          </ActionForm>
        </div>
        <div className="card h-fit p-5">
          <h2 className="mb-1 text-lg font-bold text-red-700">Öğrenciyi sil</h2>
          <p className="mb-4 text-sm text-navy-700/60">Öğrenci tüm workshoplardan çıkarılır ve yoklama kayıtları silinir.</p>
          <ConfirmForm action={deleteStudent} hidden={{ id: student.id }} message={`${student.fullName} kalıcı olarak silinsin mi?`}>
            Öğrenciyi sil
          </ConfirmForm>
        </div>
      </div>
    </>
  );
}
