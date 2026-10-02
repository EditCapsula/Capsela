"use client";

import { repartirPiecesAvis, titresAffichables, type AvisStyliste, type PieceSuggeree } from "@/lib/avisStylisteClient";
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
 *
 * LES TITRES (30/09/2026, validé le jour même) : la styliste les produit
 * désormais elle-même (AvisStyliste.titres — verdict et raisons dans des listes
 * fermées, étiquettes, titres du conseil et des pistes). Ils s'affichent
 * quand ils sont là ; un avis plus ancien, ou dont un groupe a été écarté,
 * se lit comme ci-dessus. Toujours rien d'inventé côté app.
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

const trait = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
/**
 * Le pictogramme de chaque titre de raison (TITRES_RAISON, liste fermée du
 * serveur). Un titre inconnu — qui ne devrait pas arriver — prend la coche.
 */
const PICTO_RAISON: Record<string, React.ReactNode> = {
  Structure: <path d="M8.5 3.5 4.5 6v14.5h5V10l2.5 3.5 2.5-3.5v10.5h5V6l-4-2.5L12 9z" {...trait} />,
  Proportions: <path d="M7.5 3.5h9l1 17h-4L12 10l-1.5 10.5h-4z" {...trait} />,
  Harmonie: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.4-.8 1.1-1.6-.4-1 .2-2.2 1.4-2.2h2a4 4 0 0 0 4-4c0-5.2-3.8-9.2-8.5-9.2z" {...trait} />
      <circle cx="8" cy="11" r="1" fill="currentColor" />
      <circle cx="11" cy="7.5" r="1" fill="currentColor" />
      <circle cx="15" cy="8.5" r="1" fill="currentColor" />
    </>
  ),
  Couleurs: (
    <>
      <circle cx="9" cy="9.5" r="4.5" {...trait} />
      <circle cx="15" cy="9.5" r="4.5" {...trait} />
      <circle cx="12" cy="14.5" r="4.5" {...trait} />
    </>
  ),
  Matières: <path d="M4 7c2.7-1.8 5.3 1.8 8 0s5.3-1.8 8 0v10c-2.7-1.8-5.3 1.8-8 0s-5.3-1.8-8 0z" {...trait} />,
  Équilibre: <path d="M12 4.5v15M7 19.5h10M5 8h14M5 8l-2.5 6h5zM19 8l-2.5 6h5z" {...trait} />,
  Accessoires: <path d="M5.5 8.5h13l1 12h-15zM9 8.5V7a3 3 0 0 1 6 0v1.5" {...trait} />,
  Style: <path d="M12 3.5l1.7 5.3 5.3 1.7-5.3 1.7L12 17.5l-1.7-5.3L5 10.5l5.3-1.7z" {...trait} />,
};
const COCHE = <path d="M5 12.5l4.5 4.5L19 7.5" {...trait} strokeWidth={2} />;

/**
 * Une raison. Avec son titre : pictogramme du titre, titre serif, texte de la
 * styliste. Sans : la coche et le texte seul, comme un avis d'avant les titres.
 */
function Points({ points, titres }: { points: string[]; titres?: string[] }) {
  return (
    <ul className="flex flex-col gap-[16px]">
      {points.map((p, i) => {
        const titre = titres?.[i];
        return (
          <li key={i} className="flex items-start gap-[12px] text-[14px] text-ink leading-[1.5]">
            <span
              aria-hidden="true"
              className={"flex-shrink-0 rounded-full bg-warm-bg text-terracotta flex items-center justify-center " + (titre ? "w-[40px] h-[40px]" : "w-[30px] h-[30px]")}
            >
              <svg width={titre ? 20 : 14} height={titre ? 20 : 14} viewBox="0 0 24 24" style={{ display: "block" }}>
                {(titre && PICTO_RAISON[titre]) || COCHE}
              </svg>
            </span>
            <span className={"flex-1 min-w-0 " + (titre ? "pt-[1px]" : "pt-[4px]")}>
              {titre && <span className="block t-titre-ligne text-ink">{titre}</span>}
              <span className={titre ? "block text-[13px] text-muted-3 leading-[1.5] mt-[2px]" : ""}>{p}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** « Très réussi » → « Très » à l'encre, « réussi » en italique terracotta : le titre en deux temps de l'app. */
function TitreDeuxTemps({ texte }: { texte: string }) {
  const i = texte.lastIndexOf(" ");
  if (i < 0) return <span className="italic text-terracotta">{texte}</span>;
  return (
    <>
      {texte.slice(0, i)} <span className="italic text-terracotta">{texte.slice(i + 1)}</span>
    </>
  );
}

export function Vignette({ item, taille }: { item: Item; taille: number }) {
  const image = resolveItemImage(item);
  return (
    <span
      className="block flex-shrink-0 rounded-champ border border-border overflow-hidden"
      style={{ width: taille, aspectRatio: "4/5", background: image.url ? "var(--color-photo-bg)" : item.hex }}
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
      className="w-full flex items-center gap-[12px] text-left cursor-pointer rounded-bloc transition-colors active:bg-card/60"
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
function CarteATester({
  numero,
  titre,
  texte,
  pieces,
  onOuvrirPiece,
}: {
  numero: number;
  /** Le titre de la piste, quand la styliste l'a donné (« Remplacer le top noir »). */
  titre?: string;
  texte: string;
  pieces: Item[];
  onOuvrirPiece: (id: number) => void;
}) {
  const num = String(numero).padStart(2, "0");
  const corps = titre ? (
    <>
      <span className="block text-[14px] font-semibold text-ink leading-[1.35]">{titre}</span>
      <span className="block text-[13px] text-muted-3 leading-[1.45] mt-[3px]">{texte}</span>
    </>
  ) : (
    texte
  );
  if (pieces.length === 1) {
    const it = pieces[0];
    return (
      <li>
        <button
          type="button"
          onClick={() => onOuvrirPiece(it.id)}
          aria-label={`${num}. ${titre ? `${titre}. ` : ""}${texte} ${it.name}, voir dans mon dressing`}
          className="w-full flex items-center gap-[12px] bg-card border border-divider rounded-carte pl-[10px] pr-[14px] py-[10px] text-left cursor-pointer active:bg-warm-bg/60"
        >
          <Vignette item={it} taille={56} />
          <span className="flex-1 min-w-0">
            <span aria-hidden="true" className="block font-serif italic text-[17px] leading-none text-terracotta">
              {num}
            </span>
            <span className="block text-[13px] text-ink leading-[1.45] mt-[5px]">{corps}</span>
          </span>
          <span aria-hidden="true" className="text-placeholder text-[17px] flex-shrink-0">
            ›
          </span>
        </button>
      </li>
    );
  }
  return (
    <li className="bg-card border border-divider rounded-carte px-4 py-[15px]">
      <div className="flex items-start gap-[12px] text-[14px] text-ink leading-[1.5]">
        <span aria-hidden="true" className="font-serif italic text-[20px] leading-[1.05] text-terracotta flex-shrink-0 w-[26px]">
          {num}
        </span>
        <span className="flex-1 min-w-0">{corps}</span>
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
  const titres = titresAffichables(avis);
  const verdict = apparition(0);
  return (
    <>
      {/* LE VERDICT, carte éditoriale : la synthèse de la styliste, en serif. */}
      <div className={"mt-[22px] bg-card border border-divider rounded-feuille px-[18px] py-[18px] " + verdict.className} style={verdict.style}>
        <div className="t-label text-terracotta">
          <span aria-hidden="true">✦ </span>
          {TITRES.verdict}
        </div>
        {titres.verdict ? (
          <>
            {/* Avec un titre : le titre en serif, les étiquettes, puis la synthèse en texte courant. */}
            <div className="t-titre-ecran text-ink mt-[8px]">
              <TitreDeuxTemps texte={titres.verdict} />
            </div>
            {titres.etiquettes && (
              <ul className="flex flex-wrap gap-[6px] mt-[12px]" aria-label="En quelques mots">
                {titres.etiquettes.map((e) => (
                  <li key={e} className="text-[11px] text-sand-text bg-warm-bg rounded-full px-[11px] py-[5px] leading-[1.3]">
                    {e}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-[14px] text-[14px] leading-[1.55] text-ink" style={{ textWrap: "pretty" }}>
              {avis.overallAssessment}
            </div>
          </>
        ) : (
          <div className="mt-[10px] font-serif text-[19px] leading-[1.38] text-ink" style={{ textWrap: "pretty" }}>
            {avis.overallAssessment}
          </div>
        )}
        {personnalisation.length > 0 && (
          <div className="text-[12px] text-muted mt-[10px] leading-[1.45]">Avis donné en tenant compte de {joindre(personnalisation)}.</div>
        )}
      </div>

      {/* Une section sans contenu ne s'affiche pas — un avis ancien ou tronqué ne montre pas de titre vide. */}
      {pointsForts.length > 0 && (
        <Section titre={TITRES.ceQuiFonctionne} rang={1}>
          <Points points={pointsForts} titres={titres.pointsForts} />
        </Section>
      )}

      {avis.mainAdvice.trim() && (
        <Section rang={2} titre={TITRES.monConseil}>
          <div className="bg-warm-bg border border-warm-border rounded-carte px-[18px] py-[16px]">
            {titres.conseil && <div className="t-titre-carte text-ink mb-[6px]">{titres.conseil}</div>}
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
              <CarteATester key={i} numero={i + 1} titre={titres.suggestions?.[i]} texte={s} pieces={parSuggestion[i] ?? []} onOuvrirPiece={onOuvrirPiece} />
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
