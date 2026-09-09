import type { Metadata, Viewport } from "next";
import { Libre_Franklin, Spline_Sans_Mono } from "next/font/google";
import { HrisProvider } from "@/lib/store";
import { Toast } from "@/components/ui";
import "./globals.css";

const libreFranklin = Libre_Franklin({
  variable: "--font-libre-franklin",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const splineMono = Spline_Sans_Mono({
  variable: "--font-spline-sans-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "HRIS",
  description:
    "HRIS dengan absensi GPS geofencing, face verification, dan liveness detection. Satu karyawan, satu profil, satu rekaman kehadiran.",
};

export const viewport: Viewport = {
  themeColor: "#f3f2ed",
};

const CONTRACT_COMMENT = `<!--
DIRECTION CONTRACT — HRIS (seed ed806796)
THESIS: sistem HRIS; kehadiran tervalidasi dicap seperti registri resmi.
OWN-WORLD: kertas arsip sejuk, tinta karbon, garis ledger biru-abu, merah stempel sebagai satu aksen verdict.
STORY: HR percaya tiap rekaman karena verifikasi berlapis; karyawan check-in detik dan melihat cap VALID.
FIRST VIEWPORT: admin = kolom statistik harian bergaya buku kas + tabel kehadiran; employee = kartu shift + tombol CHECK-IN besar.
FORM: peringkat 7 roll grounded list; seed key ed806796.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
-->`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${libreFranklin.variable} ${splineMono.variable} h-full antialiased`}
    >
      <body className="min-h-full" suppressHydrationWarning>
        <div dangerouslySetInnerHTML={{ __html: CONTRACT_COMMENT }} aria-hidden />
        <HrisProvider>
          {children}
          <Toast />
        </HrisProvider>
        {process.env.NODE_ENV === "production" && (
          <script dangerouslySetInnerHTML={{__html:`if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{});}`}} />
        )}
      </body>
    </html>
  );
}
