/**
 * LE LOGO CAPSELA (05/10/2026, « renommer partout L'édit Capsela en Capsela ») : le mot en capitales, en serif éditoriale
 * (Fraunces, comme les titres), et un trait terracotta dessous — sans cintre. Un composant et non une image : le même
 * logo, net à toute taille, aux jetons de l'app, en clair sur fond crème et en crème sur fond sombre. Le fichier d'origine
 * de la marque n'est pas dans le dépôt : si une version dessinée existe, elle remplacera ce composant à cet endroit seulement.
 */
const TAILLES = {
  sm: { texte: 17, trait: 24 },
  md: { texte: 22, trait: 30 },
  lg: { texte: 38, trait: 48 },
} as const;

export default function LogoCapsela({ taille = "md", claire = false, className = "" }: { taille?: keyof typeof TAILLES; claire?: boolean; className?: string }) {
  const t = TAILLES[taille];
  return (
    <span role="img" aria-label="Capsela" className={"inline-flex flex-col items-center leading-none " + className}>
      <span
        aria-hidden="true"
        className={"font-serif uppercase " + (claire ? "text-cream" : "text-ink")}
        // Le blanc de fin d'interlettrage est compensé à gauche : le mot reste centré sur son trait.
        style={{ fontSize: t.texte, letterSpacing: ".16em", paddingLeft: ".16em", fontWeight: 400 }}
      >
        Capsela
      </span>
      <span aria-hidden="true" className="block bg-terracotta rounded-full" style={{ width: t.trait, height: 2, marginTop: Math.round(t.texte * 0.28) }} />
    </span>
  );
}
