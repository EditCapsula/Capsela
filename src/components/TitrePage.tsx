/**
 * LE TITRE D'UNE PAGE (13/11/2026, demandé ; planche « option A ») : Bodoni 24 px, graisse 500, TOUT EN NOIR — le second temps reste
 * en italique, sans terracotta —, et un point final qui renvoie au point du logo « capsela. ». Un seul dessin, que le titre soit
 * dans le bandeau (AppHeader `titre`, toutes les pages sauf l'accueil) ou sous le logo (l'accueil, par TitrePage).
 *   · le point est décoratif pour un lecteur d'écran (aria-hidden) ; `point={false}` pour un titre qui finit par « ? » ou « ! » ;
 *   · font-synthesis: none — la graisse et l'italique viennent des fichiers variables de Bodoni (400 à 900, layout.tsx) : jamais
 *     d'italique ou de gras fabriqués par le moteur, que WebKit (iOS) appliquerait sinon autrement que Chromium.
 */
export function TitreDePage({
  children,
  point = true,
  className = "",
  ariaLive,
}: {
  children: React.ReactNode;
  point?: boolean;
  className?: string;
  ariaLive?: boolean;
}) {
  return (
    <h1 className={"t-titre-page text-ink min-w-0 " + className} style={{ textWrap: "balance" }} aria-live={ariaLive ? "polite" : undefined}>
      {children}
      {point && <span aria-hidden="true">.</span>}
    </h1>
  );
}

/**
 * LA PHRASE SOUS LE TITRE D'UNE PAGE MAJEURE (12/11/2026, « aucun des titres de page n'est raccord ! Taille. Police. Emplacement.
 * Marge ») : t-chapeau, muted-3. Depuis le 13/11/2026 le titre est dans le bandeau (AppHeader `titre`) sur toutes les pages sauf
 * l'accueil : TitrePage n'y porte plus que la phrase, 6 px sous le bandeau. Sur l'accueil, il porte encore le titre (la salutation),
 * 18 px sous le logo, et la phrase 6 px dessous.
 * `droite` : un élément aligné sur la ligne du haut (le choix de la période du Journal). `decalage` : la marge du haut.
 */
export default function TitrePage({
  children,
  chapeau,
  droite,
  decalage,
  ariaLive,
}: {
  children?: React.ReactNode;
  chapeau?: React.ReactNode;
  droite?: React.ReactNode;
  decalage?: number;
  ariaLive?: boolean;
}) {
  const avecTitre = children !== undefined;
  const phrase = chapeau && (
    <div className={"t-chapeau text-muted-3 min-w-0" + (avecTitre ? " mt-[6px]" : "")} style={{ textWrap: "pretty" }} aria-live={!avecTitre && ariaLive ? "polite" : undefined}>
      {chapeau}
    </div>
  );
  return (
    <div style={{ marginTop: decalage ?? (avecTitre ? 18 : 0) }}>
      {avecTitre ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <TitreDePage ariaLive={ariaLive}>{children}</TitreDePage>
            {droite && <div className="flex-shrink-0">{droite}</div>}
          </div>
          {phrase}
        </>
      ) : droite ? (
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">{phrase}</div>
          <div className="flex-shrink-0">{droite}</div>
        </div>
      ) : (
        phrase
      )}
    </div>
  );
}
