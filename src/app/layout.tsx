import type { Metadata, Viewport } from "next";
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

/**
 * Manrope et Caveat servies par l'app elles aussi (02/11/2026) : `next/font/google` les téléchargeait à CHAQUE construction, et une
 * panne de Google Fonts vue des machines de GitHub faisait échouer la CI (deux fois de suite, PR #281). Fichiers obtenus de Google
 * Fonts (licence SIL OFL 1.1), réduits au latin et au latin étendu (œ, ’, «  », …) comme avant ; Manrope est variable (200 à 800).
 */
const manrope = localFont({
  variable: "--font-manrope",
  src: [{ path: "./fonts/Manrope.woff2", weight: "200 800", style: "normal" }],
});

/**
 * LES CHIFFRES EN MANROPE, MÊME DANS LES TITRES (04/11/2026, retour des testeurs : « la typo est mauvaise en terme de lisibilité, des
 * chiffres ou mêmes au niveau des titres »). Les chiffres d'une didone, filiformes et à boules, se lisent mal à l'écran : la même
 * Manrope, réduite par `unicode-range` aux chiffres, au degré et au pourcentage, passe AVANT Bodoni dans la pile de la serif
 * (--font-serif, globals.css). Tout chiffre écrit en serif — date, température, compteur — s'affiche donc en Manrope, partout, sans
 * toucher aux écrans ; les lettres restent en Bodoni. Même fichier que Manrope : rien de plus à télécharger.
 */
const chiffres = localFont({
  variable: "--font-chiffres",
  src: [{ path: "./fonts/Manrope.woff2", weight: "200 800", style: "normal" }],
  declarations: [{ prop: "unicode-range", value: "U+0030-0039, U+00B0, U+0025" }],
  adjustFontFallback: false,
  preload: false,
});

/**
 * Écriture manuscrite — demandée le 23/09/2026 pour la phrase d'ambiance de
 * la card Tenue. Caveat plutôt qu'une anglaise calligraphique : à 16 px sur
 * fond terracotta, une plume fine perd ses jambages, et cette phrase doit
 * rester une information lisible, pas un ornement. Un seul poids (500) —
 * elle n'a qu'un usage, et chaque graisse est un fichier de plus à charger.
 */
const caveat = localFont({
  variable: "--font-caveat",
  src: [{ path: "./fonts/Caveat-Medium.woff2", weight: "500", style: "normal" }],
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
    <html lang="fr" className={`${bodoni.variable} ${chiffres.variable} ${manrope.variable} ${caveat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
