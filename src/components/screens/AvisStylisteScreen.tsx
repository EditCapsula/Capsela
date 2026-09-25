"use client";

import BadgePremium from "@/components/BadgePremium";
import BoutonRetour from "@/components/BoutonRetour";
import { useCapsela } from "@/lib/store";

/*
 * AVIS DE STYLISTE — écran 1 (docs/avis-de-styliste.md, sections 3 et 6).
 *
 * LOT 1 (accès Premium, 25/09/2026) : seul l'écran d'arrivée existe. Les deux
 * CTA sont posés avec leurs libellés de la spec mais inactifs — la prise et
 * l'import de photo relèvent du lot suivant. Ils sont désactivés plutôt
 * qu'absents, pour que l'écran ait déjà sa forme définitive.
 *
 * ACCÈS. On n'arrive ici que depuis la carte de l'accueil, qui n'ouvre cet
 * écran qu'à un statut Premium CONFIRMÉ et montre le Premium Gate sinon. Ce
 * masquage côté client n'est pas une protection : le contrôle qui compte est
 * `assertPremium`, côté serveur, avant tout appel au modèle (lot 3).
 *
 * POSITIONNEMENT [DÉCIDÉ] : un conseil de styliste, jamais un « outil
 * d'analyse IA » — aucun de ces mots n'apparaît à l'écran.
 */

export default function AvisStylisteScreen() {
  const { actions } = useCapsela();

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      <div className="flex items-center justify-between">
        <BoutonRetour onClick={actions.goHome} label="Revenir à l'accueil" />
        <BadgePremium />
      </div>

      <div className="mt-[22px]">
        <div className="font-serif text-[27px] leading-[1.12] text-ink">
          Avis de <span className="italic text-terracotta">styliste</span>
        </div>
        {/* Promesse [DÉCIDÉ], section 1. */}
        <div className="text-[14px] text-muted-3 leading-[1.5] mt-[10px]">Montre-moi ta tenue, je te donne mon avis.</div>
      </div>

      {/* À ARBITRER: illustration de l'écran 1 (section 6) — aucune tant
          qu'elle n'est pas fournie. */}

      <div className="mt-[34px] flex flex-col gap-[10px]">
        {/* Libellés de la spec (sections 3 et 6). Inactifs au lot 1. */}
        <button
          type="button"
          disabled
          className="w-full rounded-full bg-terracotta text-cream text-center text-[13px] tracking-[.1em] uppercase py-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Prendre une photo
        </button>
        <button
          type="button"
          disabled
          className="w-full rounded-full border border-border-soft text-terracotta text-center text-[13px] py-[15px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Importer une photo
        </button>
      </div>
    </div>
  );
}
