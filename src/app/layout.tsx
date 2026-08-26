import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "L'édit Capsela — ton styliste personnel, chaque matin",
  description:
    "Des tenues pensées pour ta silhouette, tes goûts, la météo et tes sorties — à partir de ton propre dressing.",
};

// maximumScale retiré le 26/08/2026 (audit avant lancement) : le verrouiller
// à 1 désactive le zoom à deux doigts, ce qui contrevient au critère WCAG
// 1.4.4 (redimensionnement du texte jusqu'à 200 %) et gêne réellement toute
// personne qui a besoin d'agrandir. Le gain — éviter le zoom involontaire au
// double-tap sur iOS — ne vaut pas ce prix : les cibles tactiles de l'app
// sont déjà dimensionnées pour éviter ce cas.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F3EEE5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
