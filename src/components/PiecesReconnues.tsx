"use client";

import { useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import { Vignette } from "@/components/ResultatAvis";
import { CATS } from "@/lib/data";
import { piecesPourModifier, type VetementReconnu } from "@/lib/reconnaissance";
import type { Item } from "@/lib/types";

/*
 * « PIÈCES RECONNUES DANS TON DRESSING » (26/09/2026) — ce que la styliste a
 * relié entre la photo et le dressing, vérifiable et corrigeable avant d'agir.
 *
 *   ✓ une pièce reconnue : sa miniature, son nom, et « Modifier » ;
 *   ◌ un vêtement non reconnu : ce que la styliste voit (« pantalon noir »),
 *     jamais une pièce devinée, et « Associer ».
 *
 * « Modifier » / « Associer » ouvrent le choix : les pièces que le serveur
 * juge possibles d'abord, puis le reste de la catégorie (piecesPourModifier)
 * — et « Ce n'est aucune de mes pièces ». Chaque choix passe par
 * corrigerReconnaissance : la composition des actions suit, le Journal aussi.
 */

const libelleCategorie = (cat: string) => CATS.find(([k]) => k === cat)?.[1] ?? cat;

export default function PiecesReconnues({
  reconnaissance,
  dressing,
  onCorriger,
  onOuvrirPiece,
  etatJournal,
  onReessayerJournal,
  messageEchec = "Ces pièces n'ont pas pu être gardées avec l'avis dans ton Journal.",
}: {
  reconnaissance: VetementReconnu[];
  dressing: Item[];
  onCorriger: (index: number, pieceId: number | null) => void;
  onOuvrirPiece: (id: number) => void;
  /** Report des corrections dans le Journal : seul l'échec se dit. */
  etatJournal?: "en_cours" | "faite" | "echec";
  onReessayerJournal?: () => void;
  messageEchec?: string;
}) {
  const [choix, setChoix] = useState<number | null>(null);
  if (reconnaissance.length === 0) return null;

  const ouvert = choix !== null ? reconnaissance[choix] : null;
  const proposees = choix !== null ? piecesPourModifier(reconnaissance, choix, dressing) : [];
  const choisir = (pieceId: number | null) => {
    if (choix === null) return;
    onCorriger(choix, pieceId);
    setChoix(null);
  };

  return (
    <section className="mt-[30px] motion-safe:animate-[capsule-apparition_320ms_ease-out_both]" aria-labelledby="avis-pieces-reconnues">
      <div id="avis-pieces-reconnues" className="t-surtitre text-muted">
        Pièces reconnues dans ton dressing
      </div>
      <ul className="mt-[10px] bg-card border border-border rounded-[20px] px-4 divide-y divide-border">
        {reconnaissance.map((v, i) => {
          // Une pièce supprimée du dressing depuis l'analyse se lit comme non reconnue.
          const item = v.pieceId !== null ? dressing.find((d) => d.id === v.pieceId) : undefined;
          return (
            <li key={i} className="flex items-center gap-[12px] py-[10px]">
              {item ? (
                <button type="button" onClick={() => onOuvrirPiece(item.id)} aria-label={`${item.name}, voir dans mon dressing`} className="flex-shrink-0 cursor-pointer">
                  <Vignette item={item} taille={44} />
                </button>
              ) : (
                <span aria-hidden="true" className="flex-shrink-0 w-[44px] rounded-[12px] border border-dashed border-border-soft" style={{ aspectRatio: "4/5" }} />
              )}
              <span className="flex-1 min-w-0">
                {item ? (
                  <span className="flex items-start gap-[6px] text-[13px] text-ink leading-[1.3]">
                    <span aria-hidden="true" className="text-terracotta flex-shrink-0">
                      ✓
                    </span>
                    <span className="line-clamp-2">{item.name}</span>
                  </span>
                ) : (
                  <>
                    <span className="block text-[13px] text-muted-3 leading-[1.3]">Non reconnue</span>
                    <span className="block text-[11px] text-muted leading-[1.3] mt-[2px] line-clamp-1">
                      {v.libelle ? `Sur la photo : ${v.libelle}` : libelleCategorie(v.categorie)}
                    </span>
                  </>
                )}
                {v.statut === "corrigee" && item && <span className="block text-[11px] text-muted mt-[2px]">Choisie par toi</span>}
              </span>
              <button
                type="button"
                onClick={() => setChoix(i)}
                aria-label={item ? `Modifier : ${item.name}` : `Associer une pièce : ${v.libelle || libelleCategorie(v.categorie)}`}
                className="flex-shrink-0 t-lien text-terracotta min-h-[44px] pl-2 cursor-pointer"
              >
                {item ? "Modifier" : "Associer"}
              </button>
            </li>
          );
        })}
      </ul>
      {etatJournal === "echec" && (
        <div className="mt-[8px] text-[12px] text-rust leading-[1.45]" role="alert">
          {messageEchec}{" "}
          {onReessayerJournal && (
            <button type="button" onClick={onReessayerJournal} className="underline cursor-pointer">
              Réessayer
            </button>
          )}
        </div>
      )}

      <BottomSheet title="Quelle pièce est-ce ?" open={ouvert !== null} onClose={() => setChoix(null)}>
        {ouvert && (
          <>
            <div className="text-[12px] text-muted-3 leading-[1.45]">
              {ouvert.libelle ? `Sur la photo : ${ouvert.libelle}.` : `${libelleCategorie(ouvert.categorie)} de la photo.`} Choisis la pièce de ton dressing.
            </div>
            {proposees.length > 0 ? (
              <ul className="mt-[12px] flex flex-col gap-[4px] max-h-[46vh] overflow-y-auto">
                {proposees.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => choisir(p.id)} className="w-full flex items-center gap-[12px] py-[6px] text-left cursor-pointer rounded-[12px] active:bg-warm-bg">
                      <Vignette item={p} taille={40} />
                      <span className="flex-1 min-w-0 text-[13px] text-ink leading-[1.3] line-clamp-2">{p.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-[12px] text-[13px] text-ink leading-[1.5]">Aucune autre pièce de cette catégorie dans ton dressing.</div>
            )}
            {ouvert.pieceId !== null && (
              <button type="button" onClick={() => choisir(null)} className="mt-[14px] w-full text-center text-[13px] text-muted-3 py-[10px] cursor-pointer border-t border-border">
                Ce n&apos;est aucune de mes pièces
              </button>
            )}
          </>
        )}
      </BottomSheet>
    </section>
  );
}
