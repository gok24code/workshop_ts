import Link from "next/link";
import { instructorAddParticipants, instructorDeleteParticipant } from "@/app/actions/instructor";
import { ActionForm, ConfirmForm, SubmitButton } from "@/components/forms";
import { ParticipantsInput } from "@/components/ParticipantsInput";
import { Empty } from "@/components/ui";
import { requireInstructor } from "@/lib/auth";
import { participantsOf } from "@/lib/stats";

export default async function MembersPage() {
  const { workshop, db } = await requireInstructor();
  const students = participantsOf(db, workshop.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/yoklama" className="mb-3 inline-block text-sm font-medium text-navy-600">← Geri</Link>
        <h1 className="mb-1 text-2xl font-bold">Üye bilgisi düzenle</h1>
        <p className="text-sm text-navy-700/70">Katılımcı ekleyin veya listeden çıkarın. Çıkarılan kişinin yoklama kayıtları da silinir.</p>
      </div>

      <section>
        <h2 className="mb-3 text-base font-bold text-navy-900">Katılımcılar ({students.length})</h2>
        {students.length === 0 ? (
          <Empty>Henüz katılımcı yok. Aşağıdan ekleyebilirsiniz.</Empty>
        ) : (
          <div className="card divide-y divide-navy-100">
            {students.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{s.fullName}</div>
                  <div className="text-xs text-navy-700/60">{s.studentNo ?? s.email ?? ""}</div>
                </div>
                <ConfirmForm
                  action={instructorDeleteParticipant}
                  hidden={{ id: s.id }}
                  message={`${s.fullName} bu workshop'tan çıkarılsın mı? Yoklama kayıtları da silinir.`}
                  className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Sil
                </ConfirmForm>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="card p-5">
        <h2 className="mb-1 text-lg font-bold">Katılımcı ekle</h2>
        <p className="mb-4 text-sm text-navy-700/60">
          Listede zaten olan kişiler (aynı öğrenci no, numara yoksa aynı ad soyad) tekrar eklenmez.
        </p>
        <ActionForm action={instructorAddParticipants} resetOnSuccess className="space-y-4">
          <ParticipantsInput required initialRows={1} />
          <SubmitButton>Katılımcıları kaydet</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
