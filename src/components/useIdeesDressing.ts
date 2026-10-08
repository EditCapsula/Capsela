"use client";

import { useEffect, useMemo, useState } from "react";
import { calculerIdeesTenues, poolPourIdees } from "@/components/screens/ItemOutfitsScreen";
import { useAuth } from "@/lib/auth";
import { computeDefaultCapsule, currentSeasonKey, representativeWeatherFor } from "@/lib/capsule";
import { colorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import type { ItemOutfitVariation } from "@/lib/logic";
import { paletteHexes } from "@/lib/profile";
import { saisonPourIdees } from "@/lib/saisons";
import { useCapsela } from "@/lib/store";
import type { CapsuleSeason, Item } from "@/lib/types";

/**
 * LES IDÉES DE LOOKS D'UNE LISTE DE PIÈCES (08/10/2026) — les mêmes que « Comment porter … ? » (calculerIdeesTenues, même pool, même
 * saison de la pièce) : le nombre annoncé sur un écran est celui qu'on trouve en y arrivant. Le calcul coûte ≈ 40 ms par pièce : il se
 * fait APRÈS le premier rendu (rendu `null` d'abord, la Map ensuite), et seulement pour les pièces transmises. Une pièce sans idée
 * n'a pas d'entrée utile : l'écran n'affiche rien plutôt qu'un nombre approximatif.
 */
export function useIdeesDressing(pieces: Item[]): Map<number, ItemOutfitVariation[]> | null {
  const { state, defaultCapsule, vestiairePool } = useCapsela();
  const { profile } = useAuth();
  const items = state.items;
  const preferredHexes = useMemo(() => paletteHexes(profile), [profile]);
  const colorimetrie = useMemo(() => colorimetrieMoteur(profile.colorimetrie), [profile]);
  const [idees, setIdees] = useState<Map<number, ItemOutfitVariation[]> | null>(null);
  const cle = pieces.map((p) => p.id).join(",");
  useEffect(() => {
    if (!pieces.length) return;
    const t = setTimeout(() => {
      const courante = state.capsuleSeason || currentSeasonKey();
      const pools = new Map<CapsuleSeason, Item[]>();
      const poolDe = (saison: CapsuleSeason) => {
        let pool = pools.get(saison);
        if (!pool) {
          const capsule =
            saison === courante
              ? defaultCapsule
              : computeDefaultCapsule(profile, representativeWeatherFor(saison), state.suggestedExcluded, saison, vestiairePool);
          pool = poolPourIdees(items, capsule, saison);
          pools.set(saison, pool);
        }
        return pool;
      };
      const m = new Map<number, ItemOutfitVariation[]>();
      for (const p of pieces) {
        const saison = saisonPourIdees(p, courante);
        const pool = poolDe(saison);
        const avecPivot = pool.some((i) => i.id === p.id) ? pool : [...pool, p];
        m.set(p.id, calculerIdeesTenues(p, avecPivot, items, saison, preferredHexes, profile.gender, colorimetrie));
      }
      setIdees(m);
    }, 40);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, defaultCapsule, items]);
  return idees;
}
