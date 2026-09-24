"use client";

/**
 * BOUTON DE RETOUR — point unique (24/09/2026, signalé : « les flèches de
 * navigation retour ne sont pas les mêmes »).
 *
 * CE QUI COEXISTAIT, RELEVÉ SUR TOUT src/components :
 *
 *   · 12 écrans : un cercle de 38 px (`bg-card`, `border-border`) contenant
 *     le CARACTÈRE « ← » à 17 px. Un de ces douze, ProfileSetupScreen, en
 *     avait sa propre variante à 36 px / 16 px.
 *   · AppHeader (`onBack`) : pas de cercle du tout, un chevron DESSINÉ de
 *     19 px posé nu dans la gouttière de 34 px.
 *
 * Deux formes, deux glyphes, trois tailles. La capture qui l'a signalé
 * montrait les deux côte à côte : un chevron fin sans contour d'un écran à
 * l'autre, un cercle plein à la flèche épaisse.
 *
 * CE QUI EST RETENU. Le CERCLE, parce qu'il est la forme dominante (12 contre
 * 2) et qu'il se lit comme un bouton ; le CHEVRON DESSINÉ, parce que
 * « ← » est un caractère système — sa graisse et son dessin dépendent de la
 * police installée, exactement ce que les glyphes dessinés existent pour
 * éviter depuis le 23/09.
 *
 * TAILLE. 38 px partout, sauf dans AppHeader où le bandeau réserve deux
 * gouttières de 34 px et où l'avatar en occupe une : 34 px y fait du bouton
 * le miroir exact de l'avatar, et déborder à 38 décalerait le logo centré.
 * C'est la seule différence, et elle a une raison mesurable.
 *
 * CIBLE TACTILE. Le bouton fait toujours 44 px et reprend l'écart en marge
 * négative : le cercle DESSINÉ garde sa taille, la zone TOUCHABLE atteint le
 * plancher de l'app. Les 38 px d'origine étaient sous ce plancher partout.
 *
 * NOM ACCESSIBLE OBLIGATOIRE. `label` n'a pas de valeur par défaut : neuf des
 * douze boutons d'origine n'avaient aucun `aria-label`, et leur seul nom
 * accessible était le caractère « ← ». Le rendre obligatoire empêche que ça
 * se reproduise sans qu'on s'en aperçoive.
 */
export default function BoutonRetour({
  onClick,
  label,
  taille = 38,
  sombre = false,
  className = "",
}: {
  onClick: () => void;
  /** Destination réelle, pas « Retour » : « Revenir à l'accueil », « Revenir au dressing ». */
  label: string;
  taille?: number;
  /** Sur fond sombre (bandeau Premium) : chevron crème, cercle translucide. */
  sombre?: boolean;
  className?: string;
}) {
  const marge = -(44 - taille) / 2;
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={"w-11 h-11 flex-shrink-0 flex items-center justify-center cursor-pointer " + className}
      style={{ margin: marge }}
    >
      <span
        className="rounded-full flex items-center justify-center"
        style={{
          width: taille,
          height: taille,
          background: sombre ? "rgba(243,238,229,.12)" : "var(--color-card)",
          border: sombre ? "1px solid rgba(243,238,229,.3)" : "1px solid var(--color-border)",
          color: sombre ? "var(--color-cream)" : "var(--color-ink)",
        }}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
          <path
            d="M15 5 8 12l7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  );
}
