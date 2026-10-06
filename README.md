# WTS · Workshop Takip Sistemi

İSÜBÜ Siber Güvenlik ve Yapay Zeka Kulübü workshopları için haftalık yoklama ve devamsızlık takip sistemi.

| Adres | Kim kullanır | Ne yapar |
| --- | --- | --- |
| `/` | Eğitmen (telefondan) | **Workshop adı + workshop'a özel şifre** ile giriş. Hafta hafta yalnızca *Geldi / Gelmedi* işaretler. |
| `/admin` | Topluluk başkanları, danışman hocalar | Workshop ve öğrenci tanımlar, eğitmen şifrelerini yönetir, her öğrencinin her workshop'taki haftalık yoklamasını ve devamsızlığını görür, CSV indirir. |

Teknoloji: Next.js (App Router, Server Actions) · Tailwind CSS · Cloudflare R2 (private bucket) · Vercel.

## Güvenlik

- **Admin oturumu:** `.env` içindeki `ADMIN_PASSWORD` ile açılır. Oturum sunucuda kayıtlıdır, açıldığı tarayıcıya bağlıdır (çerez başka tarayıcıya taşınırsa geçersiz olur) ve `ADMIN_SESSION_MINUTES` (varsayılan 120 dk) sonunda biter. *Oturumlar* sayfasından tek tek veya topluca kapatılabilir. Çerez `httpOnly`, `Secure`, `SameSite=Strict`, yalnızca `/admin` yoluna gönderilir.
- **Eğitmen oturumu:** Süresizdir (eğitmen her hafta yeniden giriş yapmaz). Admin o workshop'un şifresini değiştirdiği anda tüm açık eğitmen oturumları geçersiz olur. Workshop arşivlenir veya silinirse de oturum düşer.
- **Eğitmen yetkisi:** Yalnızca kendi workshop'unda haftalık *Geldi/Gelmedi* kaydı. Öğrenci ekleyemez, yoklama silemez, *İzinli* giremez; workshop kimliği istemciden değil imzalı oturumdan alınır.
- **Şifreler:** Workshop şifreleri bcrypt ile saklanır, geri okunamaz; oluşturulurken bir kez gösterilir.
- **Kaba kuvvet koruması:** Aynı IP'den 15 dk içinde 5 hatalı giriş → 15 dk kilit (admin ve eğitmen girişi ayrı ayrı).
- **Diğer:** HSTS, clickjacking koruması (`frame-ancestors 'none'`), `nosniff`, arama motorlarına kapalı (`noindex`), kişisel veri içeren sayfalarda `no-store`, CSV'de Excel formül enjeksiyonu koruması.

## Kurulum

### 1. Cloudflare R2

1. **R2 → Create bucket** ile bucket oluşturun (ör. `wts`). Public erişimi **kapalı** bırakın.
2. **R2 → Manage R2 API Tokens → Create API token**: izin *Object Read & Write*, kapsam yalnızca bu bucket.
3. Son ekrandaki **Access Key ID**, **Secret Access Key** ve endpoint'teki Account ID'yi kaydedin (secret bir daha gösterilmez).

### 2. Ortam değişkenleri

```bash
openssl rand -base64 24   # ADMIN_PASSWORD
openssl rand -base64 48   # SESSION_SECRET (isteğe bağlı)
```

| Değişken | Açıklama |
| --- | --- |
| `ADMIN_PASSWORD` | `/admin` şifresi (en az 12 karakter) |
| `ADMIN_SESSION_MINUTES` | Admin oturum süresi, dakika (varsayılan 120) |
| `SESSION_SECRET` | *İsteğe bağlı.* Boş bırakılırsa ilk çalışmada rastgele bir anahtar üretilip private bucket'ta (`wts/signing-secret.json`) saklanır. Doldurulursa en az 32 karakter olmalı. Anahtar değişirse herkesin oturumu kapanır. |
| `R2_ACCOUNT_ID` | Cloudflare hesap ID'si |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 API token bilgileri |
| `R2_BUCKET_NAME` | Bucket adı |

> Geliştirmede `R2_ACCOUNT_ID` boşsa veri yerel `.data/` klasörüne yazılır. Production'da R2 zorunludur.

### 3. Çalıştırma

```bash
npm install
npm run dev
```

### 4. Vercel

1. Projeyi GitHub'a gönderin, Vercel'de **Add New → Project** ile içe aktarın.
2. **Settings → Environment Variables** altına tüm değişkenleri ekleyin.
3. Deploy edin. (IP tabanlı giriş kilidi Vercel'in `x-vercel-forwarded-for` başlığına dayanır; başka bir platformda barındırılacaksa güvenilir IP başlığı ayarlanmalıdır.)

## Kullanım

1. `/admin` → **Workshoplar**: workshop oluşturun. Şifre alanını boş bırakırsanız güçlü bir şifre üretilir; workshop adı ve şifreyi eğitmene iletin.
2. Workshop sayfasında öğrencileri tanımlayın (Excel'den `numara, ad soyad, e-posta, bölüm` satırlarını yapıştırabilirsiniz).
3. Eğitmen telefondan ana sayfaya girer, workshop adı ve şifreyle giriş yapar, her hafta **“N. hafta yoklamasını al”** ile yoklama kaydeder. Workshop adında büyük/küçük harf ve Türkçe karakter farkı önemli değildir.
4. Admin panelinde workshop tablosunda hafta hafta yoklamayı, öğrenci sayfasında her öğrencinin tüm workshoplardaki haftalarını ve devamsızlık sayısını görürsünüz. Sınırı aşanlar kırmızı vurgulanır.
