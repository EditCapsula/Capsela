"use client";

import { useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import { Icone, I_CINTRE } from "@/components/ProfilUI";
import { Vignette } from "@/components/ResultatAvis";
import { CATS } from "@/lib/data";
import {
  compositionReconnue,
  compositionUtilisable,
  etatVetement,
  piecesPourModifier,
  type ChoixReconnaissance,
  type EtatVetement,
  type VetementReconnu,
} from "@/lib/reconnaissance";
import type { Item } from "@/lib/types";

/*
 * « PIÈCES RECONNUES SUR LA PHOTO » — refonte non bloquante (26/09/2026).
 *
 * « Pièces reconnues DANS TON DRESSING » disait faux pour un vêtement vu sur
 * la photo mais absent du dressing, et « Non reconnue » disait mal qu'on
 * l'avait bien reconnu. Chaque vêtement est une carte, avec un état
 * (etatVetement) :
 *
 *   ✓ Associée      — une pièce du dressing, sa photo ;
 *     À identifier  — Capsela hésite entre plusieurs de tes pièces ;
 *     À associer    — aucune pièce du dressing ne lui ressemble ;
 *     Sans association — tu as continué sans l'associer.
 *
 * Un vêtement sans pièce n'a pas de photo : l'analyse le décrit mais ne dit
 * pas où il est sur la photo — un pictogramme neutre plutôt qu'une image
 * générique (arbitrage validé le 26/09).
 *
 * La carte ouvre « Quelle pièce est-ce ? » : les pièces possibles en photo
 * (piecesPourModifier), ou « aucune pièce similaire » — et toujours deux
 * sorties : « Ajouter cette pièce au dressing » (formulaire prérempli,
 * retour ici) et « Continuer sans l'associer ». Rien ne bloque : l'avis reste
 * lu, les autres pièces restent utilisables.
 */

const libelleCategorie = (cat: string) => CATS.find(([k]) => k === cat)?.[1] ?? cat;
const majuscule = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const PASTILLE: Record<EtatVetement, { texte: string; classe: string }> = {
  associee: { texte: "✓ Associée", classe: "bg-[#E7EEDF] text-[#5B7A5E]" },
  a_identifier: { texte: "À identifier", classe: "border border-terracotta/45 text-terracotta" },
  a_associer: { texte: "À associer", classe: "bg-warm-bg text-terracotta" },
  ignoree: { texte: "Sans association", classe: "border border-border text-muted" },
};

/** Le vêtement sans pièce : un pictogramme, jamais une image qui ne serait pas la sienne. */
function Pictogramme({ taille }: { taille: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex-shrink-0 rounded-[12px] bg-warm-bg text-terracotta flex items-center justify-center"
      style={{ width: taille, aspectRatio: "4/5" }}
    >
      <Icone taille={Math.round(taille * 0.42)}>{I_CINTRE}</Icone>
    </span>
  );
}

export default function PiecesReconnues({
  reconnaissance,
  dressing,
  onCorriger,
  onOuvrirPiece,
  onAjouterPiece,
  etatJournal,
  onReessayerJournal,
  messageEchec = "Ces pièces n'ont pas pu être gardées avec l'avis dans ton Journal.",
}: {
  reconnaissance: VetementReconnu[];
  dressing: Item[];
  onCorriger: (index: number, choix: ChoixReconnaissance) => void;
  onOuvrirPiece: (id: number) => void;
  /** Vêtement sans pièce → formulaire d'ajout prérempli (catégorie, nom suggéré). */
  onAjouterPiece?: (categorie: VetementReconnu["categorie"], nom: string) => void;
  /** Report des corrections dans le Journal : seul l'échec se dit. */
  etatJournal?: "en_cours" | "faite" | "echec";
  onReessayerJournal?: () => void;
  messageEchec?: string;
}) {
  const [choix, setChoix] = useState<number | null>(null);
  if (reconnaissance.length === 0) return null;

  const etats = reconnaissance.map((v) => etatVetement(v, dressing));
  const principalesAssociees = compositionUtilisable(compositionReconnue(reconnaissance, dressing));
  const enAttente = etats.some((e) => e === "a_associer" || e === "a_identifier");

  const ouvert = choix !== null ? reconnaissance[choix] : null;
  const etatOuvert = choix !== null ? etats[choix] : null;
  const pieceOuverte = ouvert && ouvert.pieceId !== null ? dressing.find((d) => d.id === ouvert.pieceId) : undefined;
  const proposees = choix !== null ? piecesPourModifier(reconnaissance, choix, dressing) : [];
  const choisir = (c: ChoixReconnaissance) => {
    if (choix === null) return;
    onCorriger(choix, c);
    setChoix(null);
  };

  return (
    <>
    <section className="mt-[30px] motion-safe:animate-[capsule-apparition_320ms_ease-out_both]" aria-labelledby="avis-pieces-reconnues">
      <div id="avis-pieces-reconnues" className="t-surtitre text-muted" style={{ scrollMarginTop: 12 }}>
        Pièces reconnues sur la photo
      </div>
      <ul className="mt-[10px] flex flex-col gap-[8px]">
        {reconnaissance.map((v, i) => {
          // Une pièce supprimée du dressing depuis l'analyse n'est plus associée (etatVetement).
          const item = etats[i] === "associee" ? dressing.find((d) => d.id === v.pieceId) : undefined;
          const titre = item ? item.name : libelleCategorie(v.categorie);
          // Pour une pièce associée, ce que la styliste a vu seulement s'il dit autre chose que son nom.
          const vu = v.libelle && v.libelle.trim().toLowerCase() !== item?.name.trim().toLowerCase() ? majuscule(v.libelle) : "";
          const detail = item ? (v.statut === "corrigee" ? "Choisie par toi" : vu) : majuscule(v.libelle);
          const pastille = PASTILLE[etats[i]];
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => setChoix(i)}
                aria-haspopup="dialog"
                aria-label={`${titre}${detail ? `, ${detail}` : ""} : ${pastille.texte.replace("✓ ", "")}. ${item ? "Modifier" : "Associer une pièce"}`}
                className="w-full flex items-center gap-[12px] bg-card border border-border rounded-[18px] pl-[10px] pr-3 py-[9px] text-left cursor-pointer active:bg-warm-bg/60"
              >
                {item ? <Vignette item={item} taille={48} /> : <Pictogramme taille={48} />}
                <span className="flex-1 min-w-0">
                  <span className="block t-titre-ligne text-ink truncate">{titre}</span>
                  {detail && <span className="block text-[12px] text-muted leading-[1.35] mt-[2px] line-clamp-2">{detail}</span>}
                </span>
                {/* La clé suit l'état : la pastille réapparaît en douceur quand il change. */}
                <span
                  key={etats[i]}
                  className={"flex-shrink-0 t-pastille rounded-full px-[9px] py-[4px] whitespace-nowrap motion-safe:animate-[capsule-apparition_220ms_ease-out_both] " + pastille.classe}
                >
                  {pastille.texte}
                </span>
                <span aria-hidden="true" className="text-placeholder text-[15px] flex-shrink-0">
                  ›
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {principalesAssociees ? (
        <div className="mt-[12px] flex items-start gap-[10px] bg-warm-bg border border-warm-border rounded-[18px] px-4 py-[12px]" role="status">
          <span aria-hidden="true" className="text-terracotta text-[14px] leading-[1.3]">
            ✦
          </span>
          <span className="text-[12px] text-warm-text-2 leading-[1.45]">
            <span className="block text-[13px] text-ink">Les pièces principales sont associées</span>
            Cette tenue peut maintenant être portée ou planifiée dans Capsela.
          </span>
        </div>
      ) : (
        enAttente && (
          <div className="mt-[12px] flex items-start gap-[10px] bg-warm-bg border border-warm-border rounded-[18px] px-4 py-[12px]">
            <span aria-hidden="true" className="text-terracotta flex-shrink-0 mt-[1px]">
              <Icone taille={18}>{I_CINTRE}</Icone>
            </span>
            <span className="text-[12px] text-warm-text-2 leading-[1.45]">
              <span className="block t-label text-terracotta mb-[3px]">Tu ne trouves pas la bonne pièce ?</span>
              Tu peux l&apos;ajouter à ton dressing, ou continuer sans l&apos;associer : l&apos;avis reste le même.
            </span>
          </div>
        )
      )}

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

    </section>

      {/* HORS de la section animée (26/09/2026, signalé en capture : la
          feuille n'assombrissait que la section). L'animation d'apparition
          laisse une transformation — même identité — qui fait de la section
          le repère des éléments « fixed » : la feuille s'y calait au lieu de
          couvrir l'écran. */}
      <BottomSheet title="Quelle pièce est-ce ?" open={ouvert !== null} onClose={() => setChoix(null)}>
        {ouvert && (
          <>
            <div className="flex items-center gap-[14px]">
              {pieceOuverte ? <Vignette item={pieceOuverte} taille={64} /> : <Pictogramme taille={64} />}
              <div className="min-w-0">
                <div className="t-label text-muted">J&apos;ai identifié</div>
                <div className="t-titre-carte text-ink mt-[3px]">{majuscule(ouvert.libelle) || libelleCategorie(ouvert.categorie)}</div>
                {pieceOuverte && (
                  <button type="button" onClick={() => onOuvrirPiece(pieceOuverte.id)} className="t-lien text-terracotta min-h-[36px] cursor-pointer">
                    Associée à {pieceOuverte.name} · Voir →
                  </button>
                )}
              </div>
            </div>

            {proposees.length > 0 ? (
              <>
                <div className="text-[13px] text-muted-3 leading-[1.45] mt-[16px]">
                  {pieceOuverte ? "Ou choisis une autre pièce de ton dressing." : "Choisis la pièce correspondante dans ton dressing."}
                </div>
                <ul className="mt-[10px] flex flex-col gap-[6px] max-h-[34vh] overflow-y-auto">
                  {proposees.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => choisir(p.id)}
                        className="w-full flex items-center gap-[12px] py-[6px] px-[6px] -mx-[6px] text-left cursor-pointer rounded-[14px] active:bg-warm-bg"
                      >
                        <Vignette item={p} taille={44} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] text-ink leading-[1.3] line-clamp-2">{p.name}</span>
                          <span className="block t-lien text-terracotta mt-[2px]">Choisir cette pièce →</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              !pieceOuverte && (
                <div className="text-[13px] text-muted-3 leading-[1.5] mt-[16px]">Aucune pièce similaire n&apos;est disponible dans ton dressing pour le moment.</div>
              )
            )}

            <div className="mt-[18px] flex flex-col gap-[8px]">
              {onAjouterPiece && (
                <button
                  type="button"
                  onClick={() => {
                    setChoix(null);
                    onAjouterPiece(ouvert.categorie, majuscule(ouvert.libelle));
                  }}
                  className={
                    "w-full flex items-center gap-[12px] rounded-[18px] px-4 py-[12px] text-left cursor-pointer " +
                    (proposees.length === 0 && !pieceOuverte
                      ? "bg-terracotta-deep active:bg-terracotta-hover text-cream"
                      : "bg-card border border-border text-ink active:bg-warm-bg")
                  }
                >
                  <span aria-hidden="true" className="text-[20px] leading-none flex-shrink-0">
                    +
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px]">Ajouter cette pièce au dressing</span>
                    <span className={"block text-[11px] leading-[1.4] mt-[2px] " + (proposees.length === 0 && !pieceOuverte ? "opacity-85" : "text-muted")}>
                      Elle sera enregistrée dans ton dressing ; tu pourras ensuite l&apos;associer ici.
                    </span>
                  </span>
                  <span aria-hidden="true" className="flex-shrink-0">
                    ›
                  </span>
                </button>
              )}
              {etatOuvert !== "associee" && etatOuvert !== "ignoree" && (
                <button
                  type="button"
                  onClick={() => choisir("ignoree")}
                  className="w-full flex items-center gap-[12px] rounded-[18px] px-4 py-[12px] text-left cursor-pointer bg-card border border-border text-ink active:bg-warm-bg"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px]">Continuer sans l&apos;associer</span>
                    <span className="block text-[11px] text-muted leading-[1.4] mt-[2px]">
                      L&apos;avis de Capsela reste le même. Certaines actions pourront être limitées tant que cette pièce n&apos;est pas associée.
                    </span>
                  </span>
                  <span aria-hidden="true" className="flex-shrink-0 text-terracotta">
                    →
                  </span>
                </button>
              )}
              {pieceOuverte && (
                <button type="button" onClick={() => choisir(null)} className="w-full text-center text-[13px] text-muted-3 min-h-[44px] cursor-pointer">
                  Ce n&apos;est aucune de mes pièces
                </button>
              )}
            </div>
          </>
        )}
      </BottomSheet>
    </>
  );
}
