import Link from "next/link";
import { importStudents } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { AbsenceBadge, Empty, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { studentOverviews } from "@/lib/stats";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; filtre?: string }> }) {
  await requireAdmin();
  const { q = "", filtre } = await searchParams;
  const db = await readDb();
  const query = String(q).trim().toLocaleLowerCase("tr");

  const rows = studentOverviews(db)
    .filter(
      (o) =>
        !query ||
        o.student.fullName.toLocaleLowerCase("tr").includes(query) ||
        o.student.studentNo.includes(query) ||
        o.student.department?.toLocaleLowerCase("tr").includes(query),
    )
    .filter((o) => filtre !== "sinir" || o.overLimit)
    .sort((a, b) => b.totalAbsences - a.totalAbsences || a.student.fullName.localeCompare(b.student.fullName, "tr"));

  return (
    <>
      <PageHeader title="Öğrenciler" subtitle={`${db.students.length} kayıtlı öğrenci · devamsızlıklar her workshop için ayrı sayılır`} />

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <form className="mb-4 flex flex-wrap gap-2">
            <input name="q" defaultValue={q} placeholder="İsim, numara veya bölüm ara…" className="input max-w-xs" maxLength={100} />
            <select name="filtre" defaultValue={filtre ?? ""} className="input w-auto">
              <option value="">Tümü</option>
              <option value="sinir">Sınırı aşanlar</option>
            </select>
            <button className="btn-navy">Filtrele</button>
          </form>

          {rows.length === 0 ? (
            <Empty>Öğrenci bulunamadı.</Empty>
          ) : (
            <div className="card overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Öğrenci</th>
                    <th>Workshoplar ve devamsızlık</th>
                    <th className="text-center">Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.student.id} className={o.overLimit ? "bg-red-50/60" : undefined}>
                      <td>
                        <Link href={`/admin/ogrenciler/${o.student.id}`} className="font-semibold hover:text-gold-600">{o.student.fullName}</Link>
                        <div className="text-xs text-navy-700/60">{o.student.studentNo}{o.student.department ? ` · ${o.student.department}` : ""}</div>
                      </td>
                      <td>
                        {o.workshops.length === 0 ? (
                          <span className="text-xs text-navy-700/50">Kayıtlı workshop yok</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {o.workshops.map((x) => (
                              <span key={x.workshop.id} className="inline-flex items-center gap-1.5 rounded-full border border-navy-100 bg-white py-0.5 pr-0.5 pl-2.5 text-xs">
                                {x.workshop.title}
                                <AbsenceBadge count={x.stats.absent} limit={x.workshop.absenceLimit} />
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="text-center">
                        <span className={`text-lg font-bold tabular-nums ${o.overLimit ? "text-red-600" : "text-navy-900"}`}>{o.totalAbsences}</span>
                        {o.totalExcused > 0 && <div className="text-[10px] text-gold-700">+{o.totalExcused} izinli</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card h-fit p-5">
          <h2 className="mb-1 text-lg font-bold">Öğrenci ekle</h2>
          <p className="mb-4 text-sm text-navy-700/60">
            Her satıra bir öğrenci: <code className="text-xs">numara, ad soyad, e-posta, bölüm</code>. Excel’den doğrudan yapıştırabilirsiniz.
            Workshop&apos;a atamak için workshop sayfasını kullanın.
          </p>
          <ActionForm action={importStudents} resetOnSuccess className="space-y-4">
            <textarea name="bulk" rows={8} className="input font-mono text-xs" placeholder={"2101001, Ayşe Yılmaz, ayse@ornek.edu.tr, Bilgisayar Müh.\n2101002, Mehmet Kaya"} required />
            <SubmitButton>Ekle</SubmitButton>
          </ActionForm>
        </div>
      </div>
    </>
  );
}
