"use client";

import { useEffect, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import { PAL_COULEURS } from "@/lib/palCouleurs";
import { teinteDe, type ColorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import type { ConseilCouleur } from "@/lib/conseilsCouleurs";
import type { RetourAccord } from "@/lib/retoursAccords";
import type { Item } from "@/lib/types";

/**
 * La card « Accord de saison » (02/10/2026), avec trois gestes discrets sous le conseil :
 * les couleurs citées (une feuille avec leur détail), « J'aime cette association » (action
 * principale, réversible) et « Pas pour moi » (secondaire). Les retours restent sur l'appareil
 * (retoursAccords.ts). La card ne disparaît jamais d'un coup : « Pas pour moi » la laisse en place,
 * l'accord n'est simplement plus proposé la prochaine fois.
 */

const hexDe = (nom: string) => PAL_COULEURS.find(([n]) => n === nom)?.[1];

export default function CarteAccordSaison({
  conseil,
  retour,
  onRetour,
  piecesTenue,
  dressing,
  colorimetrie,
  onVoirDansDressing,
}: {
  conseil: ConseilCouleur;
  retour: RetourAccord | undefined;
  /** Donne (ou retire) un retour ; rend l'état qui en résulte. */
  onRetour: (r: RetourAccord) => RetourAccord | undefined;
  piecesTenue: readonly Item[];
  dressing: readonly Item[];
  colorimetrie: ColorimetrieMoteur | null;
  /** Ouvre « Mes pièces » filtré sur cette teinte (nom PAL_COULEURS, et son hex). */
  onVoirDansDressing: (nom: string, hex: string) => void;
}) {
  const [couleur, setCouleur] = useState<string | null>(null);
  // « Compris… » reste quelques secondes, puis laisse place à une mention discrète.
  const [confirmation, setConfirmation] = useState(false);

  useEffect(() => {
    if (!confirmation) return;
    const t = setTimeout(() => setConfirmation(false), 4000);
    return () => clearTimeout(t);
  }, [confirmation]);

  const donner = (r: RetourAccord) => {
    const resultat = onRetour(r);
    setConfirmation(r === "pas_pour_moi" && resultat === "pas_pour_moi");
  };

  const couleurs = [...conseil.accord, conseil.pointe];
  const detail = couleur ? hexDe(couleur) : undefined;
  const dansTenue = detail ? piecesTenue.filter((p) => teinteDe(p) === detail) : [];
  const dansDressing = detail ? dressing.filter((p) => teinteDe(p) === detail).length : 0;
  const rolePalette =
    detail && colorimetrie ? (colorimetrie.harmonie.has(detail) ? "Une couleur de ta palette." : colorimetrie.loinDuVisage.has(detail) ? "À doser près du visage." : null) : null;

  return (
    <div className="mt-[12px] bg-card border border-border rounded-[20px] p-4">
      <div className="t-label text-terracotta">Accord de saison</div>
      <div className="text-[13px] text-[#3F3B34] leading-[1.5] mt-[6px]">{conseil.texte}</div>

      {/* Les couleurs citées : explorables, sans quitter l'écran. */}
      <ul className="flex flex-wrap items-center gap-x-[4px] gap-y-0 mt-[8px] -mx-[6px]">
        {couleurs.map((nom, i) => (
          <li key={nom} className="flex items-center">
            {i > 0 && <span aria-hidden="true" className="text-[11px] text-placeholder">·</span>}
            <button
              onClick={() => setCouleur(nom)}
              aria-label={`Voir la couleur ${nom}`}
              className="flex items-center gap-[6px] px-[6px] text-[11.5px] text-muted cursor-pointer"
              style={{ minHeight: 36 }}
            >
              <span aria-hidden="true" className="w-[10px] h-[10px] rounded-full flex-shrink-0" style={{ background: hexDe(nom), boxShadow: "inset 0 0 0 1px rgba(29,26,22,.10)" }} />
              {nom}
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-x-[12px] mt-[4px] pt-[4px] border-t border-border">
        {retour === "pas_pour_moi" ? (
          <div className="flex items-center justify-between gap-3 w-full" style={{ minHeight: 44 }} role="status">
            <span className="text-[12px] text-muted transition-opacity duration-500">
              {confirmation ? "Compris. On ne te proposera plus cet accord." : "Accord écarté."}
            </span>
            <button onClick={() => donner("pas_pour_moi")} className="t-lien text-terracotta cursor-pointer" style={{ minHeight: 44 }}>
              Annuler
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => donner("aime")}
              aria-pressed={retour === "aime"}
              className="flex items-center gap-[7px] text-[12px] text-terracotta cursor-pointer"
              style={{ minHeight: 44 }}
            >
              <span aria-hidden="true">{retour === "aime" ? "♥" : "♡"}</span>
              <span className={retour === "aime" ? "font-semibold" : ""}>J&apos;aime cette association</span>
            </button>
            <button onClick={() => donner("pas_pour_moi")} aria-pressed={false} className="text-[11.5px] text-muted cursor-pointer" style={{ minHeight: 44 }}>
              Pas pour moi
            </button>
          </>
        )}
      </div>

      <BottomSheet title={couleur ?? ""} open={!!couleur} onClose={() => setCouleur(null)}>
        {detail && (
          <div className="flex items-center gap-[14px]">
            <span aria-hidden="true" className="w-[56px] h-[56px] rounded-full flex-shrink-0" style={{ background: detail, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.10)" }} />
            <div className="text-[13px] text-[#3F3B34] leading-[1.5]">
              {couleur === conseil.pointe && !conseil.pointePresente ? "La touche qui rendrait cet accord parfait." : "Une des couleurs de cet accord."}
              {rolePalette && <div className="text-[12px] text-muted mt-[2px]">{rolePalette}</div>}
            </div>
          </div>
        )}
        {dansTenue.length > 0 && (
          <div className="mt-[16px]">
            <div className="t-label text-terracotta">Dans cette tenue</div>
            <div className="text-[13px] text-[#3F3B34] leading-[1.5] mt-[6px]">{dansTenue.map((p) => p.name).join(", ")}</div>
          </div>
        )}
        {dansDressing > 0 && couleur && detail ? (
          <button
            onClick={() => {
              setCouleur(null);
              onVoirDansDressing(couleur, detail);
            }}
            className="mt-[16px] w-full rounded-full border border-terracotta text-terracotta text-[12px] cursor-pointer"
            style={{ minHeight: 44 }}
          >
            {`Voir ${dansDressing > 1 ? `les ${dansDressing} pièces` : "la pièce"} dans mon dressing`}
          </button>
        ) : (
          <div className="mt-[16px] text-[12px] text-muted leading-[1.5]">Aucune pièce de cette couleur dans ton dressing pour l&apos;instant.</div>
        )}
      </BottomSheet>
    </div>
  );
}
