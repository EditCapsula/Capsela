"use client";

/**
 * Carte radio pleine largeur de l'onboarding (Genre, Intensité, questionnaire
 * de colorimétrie). Toute la carte est le bouton ; `aria-pressed` dit l'état
 * aux lecteurs d'écran. Sortie de ProfileSetupScreen le 30/09/2026 pour
 * servir aussi le questionnaire (EtapesColorimetrie), sans changement.
 *
 * `description` et `pastilles` (30/09/2026, étape Intensité) sont
 * facultatifs : sans eux, la carte est exactement celle d'avant. Les
 * pastilles illustrent une famille de couleurs — décoratives, le libellé
 * reste la seule information (aria-hidden).
 */
export default function OptionRow({
  label,
  on,
  onClick,
  description,
  pastilles,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  description?: string;
  pastilles?: string[];
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={
        "flex items-center gap-3 px-4 py-[15px] rounded-[14px] cursor-pointer text-[13px] leading-[1.4] text-left border " +
        (on ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border")
      }
    >
      <span className="flex-1 min-w-0">
        {/* Libellé et pastilles sur une ligne, la phrase dessous sur toute
            la largeur : dans une colonne étroite à côté des pastilles, elle
            passait sur quatre lignes à 360 px. */}
        <span className="flex items-center gap-2">
          <span className="flex-1 min-w-0">{label}</span>
          {pastilles && (
            /* L'ÉVENTAIL SUR LES PETITS ÉCRANS : sous ~380 px, les pastilles
               se chevauchent de 3 px au plus plutôt que de
               rapetisser à 16 px ou de faire passer le libellé sur deux
               lignes — mesuré à 360, 375 et 390 px. Au-delà, elles
               s'espacent. Un liseré de la couleur de la carte sépare deux
               pastilles qui se touchent. Par une marge gauche : un `gap`
               négatif n'existe pas en CSS. */
            <span aria-hidden="true" className="flex items-center flex-shrink-0">
              {pastilles.map((hex, i) => (
                <span
                  key={i}
                  className="block rounded-full"
                  style={{
                    marginLeft: i === 0 ? 0 : "clamp(-3px, calc((100vw - 380px) * 0.3), 6px)",
                    width: "clamp(20px, 5.6vw, 24px)",
                    height: "clamp(20px, 5.6vw, 24px)",
                    background: hex,
                    // Liseré couleur de carte (crème, ou encre une fois sélectionnée), puis un filet à peine
                    // visible qui détache les teintes claires de la carte claire et les profondes de l'encre.
                    boxShadow: on
                      ? "0 0 0 1.5px var(--color-ink), 0 0 0 2.5px rgba(243,238,229,.28)"
                      : "0 0 0 1.5px var(--color-card), inset 0 0 0 1px rgba(29,26,22,.09)",
                  }}
                />
              ))}
            </span>
          )}
        </span>
        {description && (
          <span
            className="block text-[11.5px] leading-[1.45] mt-[4px]"
            style={{ color: on ? "rgba(243,238,229,.72)" : "var(--color-muted)", textWrap: "pretty" }}
          >
            {description}
          </span>
        )}
      </span>
      <span
        className={
          "w-5 h-5 rounded-full flex-shrink-0 text-[11px] flex items-center justify-center " +
          (on ? "bg-terracotta text-cream border border-terracotta" : "border-[1.5px] border-dots text-transparent")
        }
      >
        {on ? "✓" : ""}
      </span>
    </button>
  );
}
