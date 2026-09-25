/**
 * Le badge Premium — le dessin exact de la pastille de l'accueil (« Et si on
 * préparait la suite ? ») : même taille, même couleur, même glyphe ✦. Aucune
 * couleur propre au Premium. Informatif, jamais un bouton.
 *
 * Sorti de PlanifierScreen le 25/09/2026 pour la carte « Avis de styliste »
 * de l'accueil, qui devait réutiliser « le composant Premium existant » plutôt
 * qu'en redessiner un. `fond` : la pastille se pose sur une carte blanche
 * (fond warm-bg, défaut du hub) ou sur un bloc warm-bg (fond carte).
 */
export default function BadgePremium({ fond = "warm" }: { fond?: "warm" | "carte" }) {
  return (
    <span
      className={
        "inline-flex items-center gap-[4px] rounded-full px-[9px] py-[4px] text-[9px] tracking-[.1em] uppercase text-terracotta whitespace-nowrap " +
        (fond === "warm" ? "bg-warm-bg" : "bg-card")
      }
    >
      <span aria-hidden="true">✦</span> Premium
    </span>
  );
}
