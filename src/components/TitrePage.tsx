/**
 * LE TITRE D'UNE PAGE MAJEURE (12/11/2026, demandé : « aucun des titres de page n'est raccord ! Taille. Police. Emplacement.
 * Marge »). Un seul dessin pour l'Accueil, le Dressing, la Capsule, Planifier et le Journal :
 *   · 18 px sous le bandeau (AppHeader), sans surtitre — l'onglet actif de la barre du bas dit déjà où l'on est ; « PLANIFIER »
 *     et « TON JOURNAL », qui le répétaient et poussaient leur titre plus bas que les autres, sont retirés ;
 *   · le titre en t-titre-ecran (Bodoni 24 px), second temps en italique terracotta — l'Accueil quitte t-display (28 px) ;
 *   · la phrase dessous en t-chapeau, muted-3, 6 px sous le titre.
 * `droite` : un élément aligné sur le titre (le choix de la période du Journal). `decalage` : la marge du haut, quand l'écran pose
 * son bandeau hors de la zone qui défile (Planifier) et que sa zone a déjà sa propre marge.
 */
export default function TitrePage({
  children,
  chapeau,
  droite,
  decalage = 18,
  ariaLive,
}: {
  children: React.ReactNode;
  chapeau?: React.ReactNode;
  droite?: React.ReactNode;
  decalage?: number;
  ariaLive?: boolean;
}) {
  return (
    <div style={{ marginTop: decalage }}>
      <div className="flex items-start justify-between gap-3">
        <h1 className="t-titre-ecran text-ink min-w-0" style={{ textWrap: "balance" }} aria-live={ariaLive ? "polite" : undefined}>
          {children}
        </h1>
        {droite && <div className="flex-shrink-0">{droite}</div>}
      </div>
      {chapeau && (
        <div className="t-chapeau text-muted-3 mt-[6px]" style={{ textWrap: "pretty" }}>
          {chapeau}
        </div>
      )}
    </div>
  );
}
