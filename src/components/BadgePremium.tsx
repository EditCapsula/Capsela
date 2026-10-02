import Badge from "@/components/Badge";

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
    <Badge tone={fond === "warm" ? "doux" : "carte"} icone="✦">
      Premium
    </Badge>
  );
}
