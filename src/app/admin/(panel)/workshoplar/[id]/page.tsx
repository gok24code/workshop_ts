import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteWorkshop, enrollStudents, resetWorkshopPassword, unenrollStudent, updateWorkshop } from "@/app/actions/admin";
import { AttendanceMatrix } from "@/components/AttendanceMatrix";
import { ActionForm, ConfirmForm, SubmitButton } from "@/components/forms";
import { PageHeader, StatCard } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { nextWeek, pct, sessionsOf, studentsOf, workshopStats } from "@/lib/stats";

export default async function AdminWorkshopPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const db = await readDb();
  const workshop = db.workshops.find((w) => w.id === id);
  if (!workshop) notFound();

  const students = studentsOf(db, workshop);
  const sessions = sessionsOf(db, workshop.id);
  const stats = workshopStats(db, workshop);
  const notEnrolled = db.students
    .filter((s) => !workshop.studentIds.includes(s.id))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "tr"));

  return (
    <>
      <PageHeader
        back={{ href: "/admin/workshoplar", label: "Workshoplar" }}
        title={workshop.title}
        subtitle={`${workshop.instructorName || "Eğitmen adı girilmedi"} · Devamsızlık sınırı: ${workshop.absenceLimit} hafta${workshop.archived ? " · Arşivlenmiş" : ""}`}
        actions={
          <>
            <a href={`/admin/csv/${workshop.id}`} className="btn-ghost">CSV indir</a>
            <Link href={`/admin/workshoplar/${workshop.id}/hafta/yeni`} className="btn-gold">+ {nextWeek(sessions)}. hafta yoklaması</Link>
          </>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Öğrenci" value={stats.studentCount} />
        <StatCard label="Yoklama" value={stats.sessionCount} hint="alınan hafta" />
        <StatCard label="Toplam devamsızlık" value={stats.totalAbsences} />
        <StatCard accent label="Katılım oranı" value={pct(stats.rate)} hint={`${stats.overLimit} öğrenci sınırı aştı`} />
      </div>

      <h2 className="mb-1 text-lg font-bold">Hafta hafta yoklama</h2>
      <p className="mb-3 text-xs text-navy-700/60">Düzenlemek için hafta başlığına tıklayın. Yeşil: geldi · Kırmızı: gelmedi · Sarı: izinli</p>
      <AttendanceMatrix
        workshop={workshop}
        students={students}
        sessions={sessions}
        sessionHref={(s) => `/admin/workshoplar/${workshop.id}/hafta/${s.id}`}
        studentHref={(s) => `/admin/ogrenciler/${s.id}`}
        rowActions={(s) => (
          <ConfirmForm
            action={unenrollStudent}
            hidden={{ workshopId: workshop.id, studentId: s.id }}
            message={`${s.fullName} bu workshop'tan çıkarılsın mı? (Yoklama kayıtları silinmez.)`}
            className="text-xs font-semibold text-red-600 hover:underline"
          >
            Çıkar
          </ConfirmForm>
        )}
      />

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="card h-fit p-5">
          <h2 className="mb-1 text-lg font-bold">Öğrenci tanımla</h2>
          <p className="mb-4 text-sm text-navy-700/60">Kayıtlı öğrencilerden seçin veya yeni öğrencileri toplu yapıştırın.</p>
          <ActionForm action={enrollStudents} resetOnSuccess className="space-y-4">
            <input type="hidden" name="workshopId" value={workshop.id} />
            {notEnrolled.length > 0 && (
              <div>
                <label className="label" htmlFor="studentIds">Kayıtlı öğrenciler (Ctrl/⌘ ile çoklu seçim)</label>
                <select id="studentIds" name="studentIds" multiple size={Math.min(8, notEnrolled.length)} className="input">
                  {notEnrolled.map((s) => (
                    <option key={s.id} value={s.id}>{s.fullName} — {s.studentNo}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label" htmlFor="bulk">Toplu ekle</label>
              <textarea
                id="bulk"
                name="bulk"
                rows={5}
                className="input font-mono text-xs"
                placeholder={"numara, ad soyad, e-posta, bölüm\n2101001, Ayşe Yılmaz, ayse@ornek.edu.tr, Bilgisayar Müh."}
              />
            </div>
            <SubmitButton>Workshop&apos;a ekle</SubmitButton>
          </ActionForm>
        </div>

        <div className="space-y-8">
          <div className="card p-5">
            <h2 className="mb-1 text-lg font-bold">Eğitmen şifresi</h2>
            <p className="mb-4 text-sm text-navy-700/60">
              Şifreler geri okunamayacak şekilde saklanır. Yeni şifre belirlendiğinde eğitmenin açık oturumları kapanır.
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
                <label className="label" htmlFor="title">Workshop adı (eğitmen girişinde kullanılır)</label>
                <input id="title" name="title" defaultValue={workshop.title} className="input" required maxLength={120} />
              </div>
              <div>
                <label className="label" htmlFor="instructorName">Eğitmen adı</label>
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
                Arşivle (eğitmen giriş yapamaz)
              </label>
              <SubmitButton>Kaydet</SubmitButton>
            </ActionForm>
          </div>

          <div className="card border-red-100 p-5">
            <h2 className="mb-1 text-lg font-bold text-red-700">Workshop&apos;u sil</h2>
            <p className="mb-4 text-sm text-navy-700/60">Workshop ve tüm yoklama kayıtları kalıcı olarak silinir. Öğrenciler sistemde kalır.</p>
            <ConfirmForm action={deleteWorkshop} hidden={{ id: workshop.id }} message={`“${workshop.title}” ve tüm yoklamaları kalıcı olarak silinsin mi?`}>
              Workshop&apos;u sil
            </ConfirmForm>
          </div>
        </div>
      </div>
    </>
  );
}
