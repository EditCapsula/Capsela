"use client";

import { useMemo, useRef, useState } from "react";
import { useContexteRepris, useDefilementRepris, useGarderContexte } from "@/lib/memoireEcrans";
import CarteLook from "@/components/CarteLook";
import { BarreRecherche, BoutonTri, CarteSynthese, Puces, type Tri } from "@/components/DressingUI";
import { isWishlistLook, lookWornCount } from "@/lib/selectors";
import { useCapsela } from "@/lib/store";
import type { Item } from "@/lib/types";
import { filtresLooksDisponibles, looksAffiches, type CleFiltreLook } from "@/lib/looksFiltre";
import EmptyState from "@/components/EmptyState";
import { BoutonMenuLook, FeuillesLook, type FeuilleLook } from "@/components/MenuLook";

/**
 * L'ONGLET « MES LOOKS » DU DRESSING (15/11/2026, brief « Refonte UX/UI – Page Dressing ») — l'ancien écran « Mes looks » (25/09/2026)
 * devenu le second onglet du Dressing, monté par WardrobeScreen à côté de Mon dressing : passer d'un onglet à l'autre ne le démonte pas,
 * sa recherche, son filtre, son tri et son défilement restent.
 *
 * Les looks restent ceux de la personne (`state.savedLooks`, créés ou enregistrés), résolus sur `[...items, ...vestiairePool]`, jamais
 * sur `wardrobePool` (correctif du 20/08/2026, cf. WardrobeScreen). Les puces sont celles que les données permettent
 * (filtresLooksDisponibles) : les occasions réellement portées par les looks, Créés / Enregistrés, Suggérés — pas de « Favoris », aucun
 * look n'en porte la donnée. Le filtre « looks suggérés » (anciennement atteint par la ligne « ✦ N looks suggérés ») devient une puce.
 */
export function PanneauLooks() {
  const { state, actions, vestiairePool } = useCapsela();
  // AU RETOUR DU DÉTAIL D'UN LOOK (22/10/2026, memoireEcrans.ts) : la recherche, le filtre, le tri et le défilement d'avant. Ouvert par
  // goLooks (une autre page), l'onglet repart à neuf.
  type ContexteLooks = { recherche: string; filtre: CleFiltreLook; tri: Tri; defilement: number };
  const repris = useContexteRepris<ContexteLooks>("looks");
  const [recherche, setRecherche] = useState(repris?.recherche ?? "");
  const [filtre, setFiltre] = useState<CleFiltreLook>(repris?.filtre ?? "tous");
  const [tri, setTri] = useState<Tri>(repris?.tri ?? "recent");
  const zone = useRef<HTMLDivElement | null>(null);
  const defilement = useDefilementRepris(zone, repris?.defilement);
  useGarderContexte("looks", (): ContexteLooks => ({ recherche, filtre, tri, defilement: defilement.position.current }));
  const pool = useMemo(() => [...state.items, ...vestiairePool], [state.items, vestiairePool]);
  // Le look dont le menu « ••• » est ouvert, et sa feuille (une seule à la fois).
  const [menu, setMenu] = useState<{ id: string; feuille: FeuilleLook } | null>(null);
  const lookDuMenu = menu ? state.savedLooks.find((l) => l.id === menu.id) : undefined;

  const puces = filtresLooksDisponibles(state.savedLooks);
  // Un filtre qui n'a plus de look (le dernier look de l'occasion supprimé) retombe sur « Tous » plutôt que sur une grille vide.
  const filtreValide: CleFiltreLook = puces.some((p) => p.cle === filtre) ? filtre : "tous";
  const looks = looksAffiches(state.savedLooks, { recherche, filtre: filtreValide, tri });
  const n = state.savedLooks.length;
  const pl = (k: number) => `${k} ${k <= 1 ? "look" : "looks"}`;
  const terme = recherche.trim();
  const puceActive = puces.find((p) => p.cle === filtreValide);
  const libelleResultats = terme ? `${pl(looks.length)} pour « ${terme} »` : filtreValide !== "tous" && puceActive ? `${puceActive.libelle} · ${pl(looks.length)}` : `Tous tes looks · ${n}`;

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex-shrink-0 px-6">
        <CarteSynthese nombre={n} libelle={n <= 1 ? "look" : "looks"} action="Créer un look" onAction={() => actions.goCreateLook()} />
        {n > 0 && (
          <>
            <BarreRecherche valeur={recherche} onChange={setRecherche} placeholder="Rechercher un look…" ariaLabel="Rechercher un look" />
            {puces.length > 1 ? <Puces ariaLabel="Filtrer mes looks" puces={puces.map((p) => ({ id: p.cle, libelle: p.libelle, n: p.n }))} actif={filtreValide} onChange={setFiltre} /> : <div className="h-3" />}
          </>
        )}
      </div>

      <div ref={zone} onScroll={defilement.onScroll} className="scrollarea flex-1 min-h-0 overflow-y-auto px-6 border-t border-border" style={{ paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 88px)" }}>
        {n === 0 ? (
          <EmptyState className="mt-5">Tes looks enregistrés et créés apparaîtront ici. Enregistre une tenue proposée, ou crée ton propre look.</EmptyState>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 min-h-[44px]">
              <span role="status" aria-live="polite" className="text-[12px] text-muted-3 min-w-0">
                {libelleResultats}
              </span>
              <BoutonTri tri={tri} onChange={setTri} libelles={{ recent: "Récents d'abord", ancien: "Anciens d'abord" }} />
            </div>
            {looks.length === 0 ? (
              <EmptyState className="mt-3">{terme ? `Aucun look pour « ${terme} ».` : "Aucun look dans cette catégorie pour l'instant."}</EmptyState>
            ) : (
              <div className="grid grid-cols-2 min-[600px]:grid-cols-3 gap-x-[14px] gap-y-[22px] mt-1">
                {looks.map((look) => {
                  const pieces = look.pieceIds.map((id) => pool.find((i) => i.id === id)).filter((it): it is Item => Boolean(it));
                  return (
                    // Le menu « ••• » de la carte (21/11/2026, arbitré : Renommer, Ajouter à une valise, Supprimer — MenuLook.tsx), posé
                    // sur la mosaïque, À CÔTÉ du bouton de la carte (jamais un bouton dans un bouton).
                    <div key={look.id} className="relative min-w-0">
                      <CarteLook
                        look={look}
                        pieces={pieces}
                        porte={lookWornCount(look, state.history)}
                        suggere={isWishlistLook(look)}
                        onOuvrir={() => actions.openLook(look.id)}
                      />
                      <BoutonMenuLook nom={look.name} onClick={() => setMenu({ id: look.id, feuille: "menu" })} className="absolute top-[6px] right-[6px] !w-[30px] !h-[30px] shadow-sm" />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      {lookDuMenu && menu && (
        <FeuillesLook
          look={lookDuMenu}
          feuille={menu.feuille}
          setFeuille={(f) => setMenu(f ? { id: lookDuMenu.id, feuille: f } : null)}
          onSupprimer={() => {
            actions.supprimerLook(lookDuMenu.id);
            setMenu(null);
          }}
        />
      )}
    </div>
  );
}
