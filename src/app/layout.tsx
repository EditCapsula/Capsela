import type { Metadata, Viewport } from "next";
import { Caveat, Manrope } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

/**
 * Police des titres : Bodoni Moda (19/10/2026, fournie par la propriétaire, licence SIL OFL 1.1), à la place de Fraunces — une didone,
 * comme le logo « capsela. ». Fichiers variables (graisse 400 à 900, taille optique 6 à 96 que le navigateur règle seul sur la taille
 * du texte), convertis en WOFF2 et servis par l'app : aucun appel à Google Fonts pour elle.
 */
const bodoni = localFont({
  variable: "--font-bodoni",
  src: [
    { path: "./fonts/BodoniModa.woff2", weight: "400 900", style: "normal" },
    { path: "./fonts/BodoniModa-Italic.woff2", weight: "400 900", style: "italic" },
  ],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/**
 * Écriture manuscrite — demandée le 23/09/2026 pour la phrase d'ambiance de
 * la card Tenue. Caveat plutôt qu'une anglaise calligraphique : à 16 px sur
 * fond terracotta, une plume fine perd ses jambages, et cette phrase doit
 * rester une information lisible, pas un ornement. Un seul poids (500) —
 * elle n'a qu'un usage, et chaque graisse est un fichier de plus à charger.
 */
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  title: "Capsela — ton styliste personnel, chaque matin",
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
    <html lang="fr" className={`${bodoni.variable} ${manrope.variable} ${caveat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
