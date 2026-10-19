/**
 * LE LOGO CAPSELA (19/10/2026, logo définitif fourni par la propriétaire : « capsela. » en bas de casse, « el » et « a » en italique,
 * point final). Il remplace « CAPSELA » en capitales du 18/10/2026. Une image, pas du texte : le dessin des lettres ne se reproduit
 * pas avec une police. Deux fichiers tels que fournis, rognés (public/brand) : noir sur fond clair, blanc sur fond sombre (`claire`).
 * Hauteurs relevées d'un cran par rapport aux capitales : la hauteur du fichier compte le jambage du p, le corps des lettres est plus bas.
 */
const HAUTEURS = { sm: 22, md: 30, lg: 52 } as const;
/** Proportions du fichier (1524 × 441) : la largeur est réservée avant le chargement, sans saut de mise en page. */
const RAPPORT = 1524 / 441;

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
