/**
 * LE LOGO CAPSELA (18/10/2026, nouveau logo fourni par la propriétaire : « CAPSELA » en didone, le A en terracotta). Il remplace le mot
 * composé en Fraunces avec un trait dessous (05/10/2026). Une image, pas du texte : le dessin des lettres et le A croisé ne se
 * reproduisent pas avec une police. Deux fichiers (public/brand, dérivés par scripts/generer-marque.mjs) : encre sur fond crème,
 * crème sur fond sombre (`claire`). Le terracotta du A est celui du logo, inchangé.
 */
const HAUTEURS = { sm: 20, md: 26, lg: 44 } as const;
/** Proportions du fichier (741 × 158) : la largeur est réservée avant le chargement, sans saut de mise en page. */
const RAPPORT = 741 / 158;

export default function LogoCapsela({ taille = "md", claire = false, className = "" }: { taille?: keyof typeof HAUTEURS; claire?: boolean; className?: string }) {
  const h = HAUTEURS[taille];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={claire ? "/brand/capsela-logo-claire.png" : "/brand/capsela-logo.png"}
      alt="Capsela"
      width={Math.round(h * RAPPORT)}
      height={h}
      decoding="async"
      className={"block " + className}
      style={{ height: h, width: "auto" }}
    />
  );
}
