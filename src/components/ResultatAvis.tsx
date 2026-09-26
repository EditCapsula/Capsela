"use client";

import { repartirPiecesAvis, type AvisStyliste, type PieceSuggeree } from "@/lib/avisStylisteClient";
import { resolveItemImage } from "@/lib/catalogImages";
import type { Item } from "@/lib/types";

/*
 * Le contenu d'un avis de styliste (docs/avis-de-styliste.md, écrans 6 à 10),
 * partagé par le résultat d'une analyse (AvisStylisteScreen) et par un avis
 * rouvert depuis le Journal (AvisEnregistreScreen) : une seule mise en page,
 * pour qu'un avis enregistré se relise exactement comme il a été lu.
 *
 * OPTIMISATION DU PARCOURS (26/09/2026). Ordre : verdict, ce qui fonctionne,
 * mon conseil, à tester. Rien n'est ajouté au contenu généré : seule sa
 * présentation change.
 *   - Le verdict est `overallAssessment`, sous un surtitre neutre « Mon
 *     verdict » — pas de qualificatif (« Une tenue réussie ») que le serveur
 *     ne produit pas, pas de note.
 *   - Les pièces RÉELLES du dressing que le serveur a rattachées à l'avis
 *     sont rangées là où elles servent : sous le conseil, ou dans la carte de
 *     la suggestion correspondante, avec « Voir dans mon dressing → ». Une
 *     suggestion sans pièce reste une carte texte : aucun produit inventé.
 */

const TITRES = {
  verdict: "Mon verdict",
  ceQuiFonctionne: "Ce qui fonctionne", // décision produit n° 9
  monConseil: "Mon conseil", // décision produit n° 9
  aTester: "À tester", // décision produit n° 9
  avecTonDressing: "Avec ton dressing", // décision produit n° 9
};

/** Apparition échelonnée des sections : même fondu que les cartes de la Capsule, jamais sous « réduire les animations ». */
function apparition(rang: number) {
  return {
    className: "motion-safe:animate-[capsule-apparition_320ms_ease-out_both]",
    style: { animationDelay: `${rang * 70}ms` },
  };
}

function Section({ titre, rang, children }: { titre: React.ReactNode; rang: number; children: React.ReactNode }) {
  const a = apparition(rang);
  return (
    <section className={"mt-[26px] " + a.className} style={a.style}>
      <div className="t-surtitre text-muted mb-[10px]">{titre}</div>
      {children}
    </section>
  );
}

function Points({ points }: { points: string[] }) {
  return (
    <ul className="flex flex-col gap-[10px]">
      {points.map((p, i) => (
        <li key={i} className="flex items-start gap-[10px] text-[14px] text-ink leading-[1.5]">
          <span aria-hidden="true" className="text-terracotta text-[11px] mt-[4px] flex-shrink-0">
            ✦
          </span>
          {p}
        </li>
      ))}
    </ul>
  );
}

export function Vignette({ item, taille }: { item: Item; taille: number }) {
  const image = resolveItemImage(item);
  return (
    <span
      className="block flex-shrink-0 rounded-[12px] border border-border overflow-hidden"
      style={{ width: taille, aspectRatio: "4/5", background: image.url ? "#F3EDE1" : item.hex }}
    >
      {image.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.url} alt="" loading="lazy" className="w-full h-full object-contain block" style={{ padding: 4, boxSizing: "border-box" }} />
      )}
    </span>
  );
}

/** Une pièce du dressing rattachée à un conseil : sa vignette, son nom, et l'action. Toute la ligne est le bouton. */
function PieceDuDressing({ item, onClick }: { item: Item; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-[12px] text-left cursor-pointer rounded-[14px] transition-colors active:bg-card/60"
      aria-label={`${item.name}, voir dans mon dressing`}
    >
      <Vignette item={item} taille={44} />
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] text-ink leading-[1.3] line-clamp-2">{item.name}</span>
        <span className="block t-lien text-terracotta mt-[3px]">Voir dans mon dressing →</span>
      </span>
    </button>
  );
}

/** Une piste « À tester » : le texte de la styliste, et — s'il en a une — la pièce de ton dressing qui la réalise. */
function CarteATester({ texte, pieces, onOuvrirPiece }: { texte: string; pieces: Item[]; onOuvrirPiece: (id: number) => void }) {
  return (
    <li className="bg-card border border-border rounded-[18px] px-4 py-[14px]">
      <div className="flex items-start gap-[10px] text-[14px] text-ink leading-[1.5]">
        <span aria-hidden="true" className="text-terracotta text-[11px] mt-[4px] flex-shrink-0">
          ✦
        </span>
        <span className="flex-1 min-w-0">{texte}</span>
      </div>
      {pieces.length > 0 && (
        <div className="flex flex-col gap-[10px] mt-[12px] pt-[12px] border-t border-border">
          {pieces.map((it) => (
            <PieceDuDressing key={it.id} item={it} onClick={() => onOuvrirPiece(it.id)} />
          ))}
        </div>
      )}
    </li>
  );
}

export default function ResultatAvis({
  avis,
  pieces,
  items,
  onOuvrirPiece,
  personnalisation = [],
}: {
  avis: AvisStyliste;
  pieces: PieceSuggeree[];
  /** Le dressing actuel : une pièce suggérée qui n'y est plus n'est pas affichée (arbitré). */
  items: Item[];
  onOuvrirPiece: (id: number) => void;
  /** Ce que l'avis a pris en compte (personnalisationAvis) — vide : la ligne ne s'affiche pas. */
  personnalisation?: string[];
}) {
  // Trois au plus, comme le serveur l'exige déjà (LIMITES.pointsMax) : la
  // coupe ne sert que si un avis ancien en portait davantage.
  const pointsForts = avis.strengths.slice(0, 3);
  const suggestions = avis.suggestions.slice(0, 3);
  const { conseil, parSuggestion, autres } = repartirPiecesAvis(pieces, items, suggestions.length);
  const verdict = apparition(0);
  return (
    <>
      <div className={"mt-[22px] " + verdict.className} style={verdict.style}>
        <div className="t-surtitre text-terracotta">
          <span aria-hidden="true">✦ </span>
          {TITRES.verdict}
        </div>
        <div className="mt-[8px] font-serif text-[19px] leading-[1.35] text-ink">{avis.overallAssessment}</div>
        {personnalisation.length > 0 && (
          <div className="text-[12px] text-muted mt-[8px] leading-[1.45]">Avis donné en tenant compte de {joindre(personnalisation)}.</div>
        )}
      </div>

      <Section titre={TITRES.ceQuiFonctionne} rang={1}>
        <Points points={pointsForts} />
      </Section>

      <Section
        rang={2}
        titre={
          <>
            <span aria-hidden="true">♡ </span>
            {TITRES.monConseil}
          </>
        }
      >
        <div className="bg-warm-bg border border-warm-border rounded-[18px] px-4 py-[15px]">
          <div className="text-[14px] text-ink leading-[1.55]">{avis.mainAdvice}</div>
          {conseil.length > 0 && (
            <div className="flex flex-col gap-[10px] mt-[12px] pt-[12px] border-t border-warm-border">
              {conseil.map((it) => (
                <PieceDuDressing key={it.id} item={it} onClick={() => onOuvrirPiece(it.id)} />
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section titre={TITRES.aTester} rang={3}>
        <ul className="flex flex-col gap-[10px]">
          {suggestions.map((s, i) => (
            <CarteATester key={i} texte={s} pieces={parSuggestion[i] ?? []} onOuvrirPiece={onOuvrirPiece} />
          ))}
        </ul>
      </Section>

      {/* Filet de sécurité : une pièce dont le lien n'a pas pu être lu reste
          visible ici plutôt que de disparaître. */}
      {autres.length > 0 && (
        <Section titre={TITRES.avecTonDressing} rang={4}>
          <div className="flex flex-col gap-[10px]">
            {autres.map((it) => (
              <PieceDuDressing key={it.id} item={it} onClick={() => onOuvrirPiece(it.id)} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

/** « ton style Bohème, ta silhouette et tes couleurs ». */
function joindre(l: string[]): string {
  return l.length <= 1 ? l.join("") : l.slice(0, -1).join(", ") + " et " + l[l.length - 1];
}
