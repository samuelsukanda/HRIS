import type { Metadata, Viewport } from "next";
import { Libre_Franklin, Spline_Sans_Mono } from "next/font/google";
import { HrisProvider } from "@/lib/store";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${libreFranklin.variable} ${splineMono.variable} h-full antialiased`}
    >
      <body className="min-h-full" suppressHydrationWarning>
        <HrisProvider>
          {children}
        </HrisProvider>
      </body>
    </html>
  );
}
