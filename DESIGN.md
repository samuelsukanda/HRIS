# DESIGN.md — HRIS

Arah visual resmi aplikasi HRIS. Sumber kebenaran token: `src/app/globals.css` (`@theme`). Jika ada perbedaan, globals.css menang.

## Thesis

Setiap kehadiran tervalidasi dicatat dan dicap seperti registri resmi. Aplikasi terasa seperti dokumen administrasi yang hidup — kertas arsip, tinta karbon, garis ledger — bukan dashboard SaaS generik dengan kartu-kartu seragam. Satu aksen merah stempel khusus untuk verdict.

## Palet Warna

| Token | Nilai | Peran |
|-------|-------|-------|
| `paper` | `#f3f2ed` | Latar halaman (kertas arsip off-white sejuk) |
| `card` | `#fcfbf7` | Permukaan kartu/tabel |
| `ink` | `#20242a` | Teks utama |
| `ink-soft` | `#565b63` | Teks sekunder |
| `ink-faint` | `#6d727b` | Label kecil (AA pada paper) |
| `rule` | `#dbd9d0` | Border hairline kartu & kontrol |
| `ledger` | `#c4ceda` | Garis ledger biru-abu, scrollbar |
| `stamp` | `#c03a2c` | Merah stempel — SATU aksen verdict/aksi destruktif |
| `stamp-deep` | `#9e2e22` | Merah gelap teks rejected |
| `official` | `#2b4a6f` | Biru tinta resmi — link, focus ring, caret, tombol approve |
| `official-deep` | `#20395a` | Biru gelap teks approved |

Aturan pakai:
- Light mode only (office daylight scene), tidak ada dark mode.
- Merah stempel hanya untuk verdict negatif dan aksi berbahaya. Approve memakai biru official.
- Semantik status: **approved** = double border biru · **rejected** = solid merah · **pending** = dashed abu · **neutral** = solid hitam.

## Tipografi

- **Sans kerja**: Libre Franklin (400–800) — semua UI.
- **Mono registri**: Spline Sans Mono — nomor rekaman (`ATT-…`, `LOG-…`), timestamp, label uppercase tracking lebar, angka tabel.
- Kelas `.tnum`: tabular-nums + mono untuk semua kolom angka/jam agar rata seperti buku kas.
- Judul extrabold tracking-tight; body 14–15px leading-relaxed.

## Bentuk & Garis

- Radius: kartu 6px (`--radius-card`), kontrol 4px (`--radius-control`). Tanpa pill.
- Border hairline `rule` di mana-mana; tanpa drop shadow besar. Elevasi dari garis, bukan bayangan.
- `.ledger-rule`: hairline ganda pemisah baris bergaya buku kas.
- Ikon: Phosphor duotone untuk identitas, regular untuk fungsional.

## Gerak

- `.btn-press`: tekan turun 1px + scale 0.985, 120ms — seperti membubuhkan cap.
- `.stamp-in`: cap mendarat (rotate −14°→−2°, scale 1.6→1) saat absensi sukses, 420ms.
- `prefers-reduced-motion`: semua animasi dimatikan, stempel tanpa rotasi.
- Dilarang bounce/easing pegas; gunakan kurva keluar tegas (`cubic-bezier(0.16,1,0.3,1)`).

## Komponen Inti (`src/components/ui.tsx`)

- `Stamp` / `StatusStamp` — cap status sesuai semantik di atas.
- `Btn` varian: primary (ink solid), secondary (border rule), danger (stamp), ghost, **official** (biru, khusus approval).
- `PageHead` — judul halaman + subjudul + slot aksi kanan.
- `Field`/`Input`/`Select`/`Textarea` — kontrol 4px, border rule, focus ring official.
- `Modal` — panel card 6px di atas scrim.
- `EmptyState` — arsip kosong dengan mono caption.

## Pola Halaman

- **Admin desktop**: sidebar kiri (grup nav mono uppercase), konten max-w-6xl, PageHead di atas setiap modul, tabel dengan header mono uppercase kecil dan baris ledger-rule.
- **Employee mobile-web**: max-w-lg tengah, bottom nav 5 item, kartu shift + tombol CHECK-IN besar di home, alur absensi bernomor tahap 01–07.

## Aksesibilitas

WCAG AA minimum. Focus-visible outline official 2px. Target sentuh ≥40px. `prefers-reduced-motion` wajib dihormati. Pesan error absensi spesifik dan edukatif (jarak aktual vs radius), bukan generik.
