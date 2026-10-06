import { createWorkshop } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ParticipantsInput } from "@/components/ParticipantsInput";
import { PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";

export default async function NewWorkshopPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader
        back={{ href: "/admin/workshoplar", label: "Workshoplar" }}
        title="Yeni workshop"
        subtitle="Workshop bilgilerini ve katılımcıları girin. Eğitmen, workshop adı ve oluşturulan şifreyle giriş yapacak."
      />
      <ActionForm action={createWorkshop} resetOnSuccess className="space-y-6">
        <div className="card p-5">
          <h2 className="mb-4 text-lg font-bold">1. Workshop bilgileri</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label" htmlFor="title">Workshop adı *</label>
              <input id="title" name="title" className="input" placeholder="ör. Web Güvenliği" required maxLength={120} />
              <p className="mt-1 text-xs text-navy-700/60">Eğitmen bu adla giriş yapacak; kısa ve net tutun.</p>
            </div>
            <div>
              <label className="label" htmlFor="instructorName">Eğitmen adı</label>
              <input id="instructorName" name="instructorName" className="input" maxLength={100} />
            </div>
            <div>
              <label className="label" htmlFor="absenceLimit">Devamsızlık sınırı (hafta)</label>
              <input id="absenceLimit" name="absenceLimit" type="number" min={0} max={52} defaultValue={2} className="input" />
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="description">Açıklama</label>
              <input id="description" name="description" className="input" maxLength={500} />
            </div>
            <div>
              <label className="label" htmlFor="password">Eğitmen şifresi</label>
              <input id="password" name="password" type="text" className="input" placeholder="Boş bırakın → güçlü şifre üretilir" autoComplete="off" maxLength={200} />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-lg font-bold">2. Katılımcılar</h2>
          <ParticipantsInput required initialRows={3} />
        </div>

        <SubmitButton className="btn-gold w-full py-3 text-base">Workshop&apos;u oluştur</SubmitButton>
      </ActionForm>
    </>
  );
}
