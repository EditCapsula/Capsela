"use client";

import { useState } from "react";
import { OCC_LABELS } from "@/lib/data";
import { isCatalogId } from "@/lib/catalog";
import { useCapsela } from "@/lib/store";
import AppHeader from "@/components/AppHeader";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { CarteDuLook, LignePieceLook } from "@/components/DetailLook";
import { LIBELLE_SOURCE } from "@/components/CarteLook";
import { useOuvrirPiece } from "@/components/useOuvrirPiece";
import { BoutonMenuLook, FeuillesLook, type FeuilleLook } from "@/components/MenuLook";

/**
 * LE DÉTAIL D'UN LOOK (refonte du 20/11/2026, demandé : « une page plus premium que celle actuellement en ligne », maquette « Tenue du
 * 20/11 » à l'appui, avec les composants du design system et la DA Capsela).
 *
 * De haut en bas : le nom (bandeau), la source (« Look sauvegardé » ou « Look créé par toi », la même que la carte de Mes looks), le
 * nombre de pièces et l'occasion ; la planche du look (FlatLayCapsela, la seule règle de composition, docs/flat-lay.md) ; le texte
 * éditorial du look (texteEditorialLook, le même que l'accueil) et ses couleurs réelles ; la liste des pièces (chacune ouvre sa feuille,
 * useOuvrirPiece) ; « Porter aujourd'hui », puis « Planifier » (planifierComposition : Planifier, la tenue préremplie).
 *
 * Écarté de la maquette, faute d'action réelle derrière (aucune donnée ni bouton inventés) : « Ajouter à une valise » (une valise compose
 * ses looks elle-même) et « Créer une variante » ; « Vue liste » (la liste est la seule vue). La suppression passe dans le menu « ••• »
 * et se confirme dans une feuille (BottomSheet, arbitré le 22/10/2026) — elle était un bouton direct, sans confirmation.
 *
 * Pool de résolution stable (correctif du 20/08/2026, cf. HistoryScreen) : `[...state.items, ...vestiairePool]`, jamais wardrobePool —
 * une tenue enregistrée pendant l'exploration d'un autre style y référence des suggestions absentes de wardrobePool une fois revenue.
 */
export default function LookDetailScreen() {
  const { state, actions, vestiairePool } = useCapsela();
  const ouvrirPiece = useOuvrirPiece();
  // UNE SEULE FEUILLE À LA FOIS (BottomSheet, arbitré le 22/10/2026) : le menu « ••• », puis l'action choisie (MenuLook.tsx).
  const [feuille, setFeuille] = useState<FeuilleLook>(null);
  const look = state.savedLooks.find((l) => l.id === state.activeLookId);
  if (!look) return null;

  const resolvePool = [...state.items, ...vestiairePool];
  const pieces = look.pieceIds
    .map((id) => resolvePool.find((i) => i.id === id))
    .filter((it): it is NonNullable<typeof it> => Boolean(it));
  const occasion = look.occasion && look.occasion !== "all" ? look.occasion : null;

  const menu = <BoutonMenuLook onClick={() => setFeuille("menu")} />;

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      {/* Le nom du look dans le bandeau (13/11/2026, même règle que les autres écrans secondaires). */}
      <AppHeader onBack={actions.closeLookDetail} backLabel="Revenir à Mes looks" titre={look.name} point={false} action={menu} />

      <div className="mt-[10px] flex flex-wrap items-center gap-x-3 gap-y-2">
        <Badge tone="doux" icone={look.source === "saved" ? "✦" : undefined}>
          {LIBELLE_SOURCE[look.source]}
        </Badge>
        <span className="text-[12px] text-muted-3">
          {pieces.length} {pieces.length === 1 ? "pièce" : "pièces"}
          {occasion && <> · {OCC_LABELS[occasion]}</>}
        </span>
      </div>

      <CarteDuLook pieces={pieces} occasion={occasion} onPiece={ouvrirPiece} className="mt-4" />

      <h2 className="t-titre-carte text-ink mt-6 mb-3">Les pièces du look</h2>
      <div className="flex flex-col gap-[10px]">
        {pieces.map((it) => (
          // Une pièce suggérée (une tenue enregistrée peut en contenir, 23/08/2026) reste distincte d'une pièce possédée.
          <LignePieceLook key={it.id} piece={it} suggeree={isCatalogId(it.id)} onClick={() => ouvrirPiece(it)} />
        ))}
      </div>

      <Button variante="principal" className="mt-7 !normal-case !tracking-[0.02em] !text-[15px]" onClick={() => actions.wearLookToday(look.id)}>
        Porter aujourd&apos;hui
      </Button>
      <Button variante="secondaire" className="mt-[10px] !normal-case !tracking-[0.02em] !text-[15px]" onClick={() => actions.planifierComposition(look.pieceIds, false)}>
        Planifier
      </Button>
      <Button variante="secondaire" className="mt-[10px] !normal-case !tracking-[0.02em] !text-[15px]" onClick={() => setFeuille("valise")}>
        Ajouter à une valise
      </Button>

      <FeuillesLook look={look} feuille={feuille} setFeuille={setFeuille} onSupprimer={actions.deleteActiveLook} />
    </div>
  );
}
