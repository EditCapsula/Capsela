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
 *   - Le verdict est `overallAssessment`, sous un surtitre neutre — pas de
 *     qualificatif (« Très réussi ») que le serveur ne produit pas, pas de
 *     note.
 *   - Les pièces RÉELLES du dressing que le serveur a rattachées à l'avis
 *     sont rangées là où elles servent : sous le conseil, ou dans la carte de
 *     la suggestion correspondante, avec « Voir dans mon dressing → ». Une
 *     suggestion sans pièce reste une carte texte : aucun produit inventé.
 *
 * REFONTE ÉDITORIALE (30/09/2026, brief « Avis du styliste »). Le verdict
 * devient une carte, les raisons une liste à pictogrammes, le conseil une
 * carte chaude, les pistes des cartes numérotées. Le brief demandait aussi un
 * titre de verdict, des étiquettes, et un titre par raison, par conseil et par
 * piste : l'avis n'en contient pas (AvisStyliste : overallAssessment,
 * strengths, mainAdvice, suggestions — quatre textes). Les inventer côté app
 * ferait dire à la styliste ce qu'elle n'a pas dit ; ils n'apparaissent pas,
 * et la génération n'est pas touchée.
 */

// Libellés du brief du 30/09/2026, qui remplacent ceux de la décision
// produit n° 9 (« Mon verdict », « Ce qui fonctionne », « Mon conseil »).
const TITRES = {
  verdict: "Le verdict",
  ceQuiFonctionne: "Pourquoi ça fonctionne",
  monConseil: "Conseil du styliste",
  aTester: "À tester",
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
    <section className={"mt-[30px] " + a.className} style={a.style}>
      <div className="t-surtitre text-ink mb-[12px]">
        <span aria-hidden="true" className="text-terracotta">
          ✦{" "}
        </span>
        {titre}
      </div>
      {children}
    </section>
  );
}

/** Une raison : un pictogramme fin dans une pastille chaude, puis le texte de la styliste. */
function Points({ points }: { points: string[] }) {
  return (
    <ul className="flex flex-col gap-[14px]">
      {points.map((p, i) => (
        <li key={i} className="flex items-start gap-[12px] text-[14px] text-ink leading-[1.5]">
          <span aria-hidden="true" className="flex-shrink-0 w-[30px] h-[30px] rounded-full bg-warm-bg text-terracotta flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" style={{ display: "block" }}>
              <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="flex-1 min-w-0 pt-[4px]">{p}</span>
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

/**
 * Une piste « À tester », numérotée : le texte de la styliste, et — s'il en a
 * une — la pièce de ton dressing qui la réalise.
 *
 * Une seule pièce (le cas courant) : la carte ENTIÈRE devient le bouton, sa
 * vignette à gauche et un chevron à droite, comme la maquette du 30/09/2026.
 * Plusieurs : la liste sous le texte, chacune son « Voir → ». Aucune : une
 * carte texte, sans chevron — elle ne mène nulle part.
 */
function CarteATester({ numero, texte, pieces, onOuvrirPiece }: { numero: number; texte: string; pieces: Item[]; onOuvrirPiece: (id: number) => void }) {
  const num = String(numero).padStart(2, "0");
  if (pieces.length === 1) {
    const it = pieces[0];
    return (
      <li>
        <button
          type="button"
          onClick={() => onOuvrirPiece(it.id)}
          aria-label={`${num}. ${texte} ${it.name}, voir dans mon dressing`}
          className="w-full flex items-center gap-[12px] bg-card border border-[#EFE7DA] rounded-[20px] pl-[10px] pr-[14px] py-[10px] text-left cursor-pointer active:bg-warm-bg/60"
        >
          <Vignette item={it} taille={56} />
          <span className="flex-1 min-w-0">
            <span aria-hidden="true" className="block font-serif italic text-[17px] leading-none text-terracotta">
              {num}
            </span>
            <span className="block text-[13px] text-ink leading-[1.45] mt-[5px]">{texte}</span>
          </span>
          <span aria-hidden="true" className="text-placeholder text-[17px] flex-shrink-0">
            ›
          </span>
        </button>
      </li>
    );
  }
  return (
    <li className="bg-card border border-[#EFE7DA] rounded-[20px] px-4 py-[15px]">
      <div className="flex items-start gap-[12px] text-[14px] text-ink leading-[1.5]">
        <span aria-hidden="true" className="font-serif italic text-[20px] leading-[1.05] text-terracotta flex-shrink-0 w-[26px]">
          {num}
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
      {/* LE VERDICT, carte éditoriale : la synthèse de la styliste, en serif. */}
      <div className={"mt-[22px] bg-card border border-[#EFE7DA] rounded-[22px] px-[18px] py-[18px] " + verdict.className} style={verdict.style}>
        <div className="t-label text-terracotta">
          <span aria-hidden="true">✦ </span>
          {TITRES.verdict}
        </div>
        <div className="mt-[10px] font-serif text-[19px] leading-[1.38] text-ink" style={{ textWrap: "pretty" }}>
          {avis.overallAssessment}
        </div>
        {personnalisation.length > 0 && (
          <div className="text-[12px] text-muted mt-[10px] leading-[1.45]">Avis donné en tenant compte de {joindre(personnalisation)}.</div>
        )}
      </div>

      {/* Une section sans contenu ne s'affiche pas — un avis ancien ou tronqué ne montre pas de titre vide. */}
      {pointsForts.length > 0 && (
        <Section titre={TITRES.ceQuiFonctionne} rang={1}>
          <Points points={pointsForts} />
        </Section>
      )}

      {avis.mainAdvice.trim() && (
        <Section rang={2} titre={TITRES.monConseil}>
          <div className="bg-warm-bg border border-warm-border rounded-[20px] px-[18px] py-[16px]">
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
      )}

      {suggestions.length > 0 && (
        <Section titre={TITRES.aTester} rang={3}>
          <ul className="flex flex-col gap-[10px]">
            {suggestions.map((s, i) => (
              <CarteATester key={i} numero={i + 1} texte={s} pieces={parSuggestion[i] ?? []} onOuvrirPiece={onOuvrirPiece} />
            ))}
          </ul>
        </Section>
      )}

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
