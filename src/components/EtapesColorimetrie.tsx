"use client";

import { useEffect, useRef, useState } from "react";
import {
  colorimetrieUtilisable,
  estSaison,
  explicationsDesReponses,
  QUESTIONS_COLORIMETRIE,
  SAISONS,
  SIGNATURE_AFFICHEE_MAX,
  type Colorimetrie,
} from "@/lib/colorimetrie";
import { INTENSITE_VISUELS, paletteColorName, type Intensite } from "@/lib/profile";
import Card from "@/components/Card";

/**
 * LES ÉCRANS DU PARCOURS COLORIMÉTRIE (25/09/2026 ; refonte UX/UI le
 * 30/09/2026, brief « Refonte UX/UI du parcours colorimétrie »).
 *
 * Ces composants ne dessinent QUE le corps de chaque écran. Le titre, le bouton
 * retour, la progression et le bouton principal sont ceux de l'onboarding
 * (ProfileSetupScreen), pilotés par la machine à états colorimetrieParcours.ts :
 * un seul en-tête, un seul pied d'écran, comme toutes les autres étapes.
 *
 * Le questionnaire est la seule voie (arbitré le 30/09/2026 : « pas
 * d'analyse photo pour le moment ») : aucun écran ne demande de photo.
 */

const T = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/* ───────── Pictogrammes au trait, même famille que le reste de l'app ───────── */

const PICTOS = {
  horloge: <><circle cx="12" cy="12" r="8.5" {...T} /><path d="M12 7.5V12l3 2" {...T} /></>,
  sansPhoto: <><path d="M4 8.5h3l1.5-2h7l1.5 2h3v10H4z" {...T} /><circle cx="12" cy="13" r="3.2" {...T} /><path d="M3.5 4.5l17 16" {...T} /></>,
  etoile: <path d="M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6L4.5 11l5.6-1.9z" {...T} />,
  bijoux: <><circle cx="12" cy="14" r="5.5" {...T} /><path d="M9.5 5.5h5l-2.5 3z" {...T} /></>,
  blanc: <><path d="M5 5h14v14H5z" {...T} /><path d="M5 12c3-2 5 2 8 0s4-1 6 0" {...T} /></>,
  cheveux: <><path d="M8 4c2.5 3-2.5 5.5 0 8.5S5.5 18 8 20" {...T} /><path d="M12 4c2.5 3-2.5 5.5 0 8.5S9.5 18 12 20" {...T} /><path d="M16 4c2.5 3-2.5 5.5 0 8.5s-2.5 5.5 0 7.5" {...T} /></>,
  yeux: <><path d="M3 12s3.5-5.5 9-5.5 9 5.5 9 5.5-3.5 5.5-9 5.5S3 12 3 12z" {...T} /><circle cx="12" cy="12" r="2.6" {...T} /></>,
  tenue: <path d="M9 4c.8 1.4 5.2 1.4 6 0l4 2 1 4-2.5 1V20h-11v-9L4 10l1-4z" {...T} />,
  harmonie: <><circle cx="9" cy="10" r="4.5" {...T} /><circle cx="15" cy="10" r="4.5" {...T} /><circle cx="12" cy="15" r="4.5" {...T} /></>,
  cintre: <><path d="M12 7.5a2 2 0 1 0-2-2" {...T} /><path d="M12 7.5v1.5L3.5 15.5c-.8.6-.4 1.5.6 1.5h15.8c1 0 1.4-.9.6-1.5L12 9" {...T} /></>,
  repere: <><path d="M12 3.5l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9v-5z" {...T} /><path d="M9 12l2 2 4-4" {...T} /></>,
};
type Picto = keyof typeof PICTOS;

function Pictogramme({ nom, taille = 20, className = "text-terracotta" }: { nom: Picto; taille?: number; className?: string }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" className={"flex-shrink-0 " + className} style={{ display: "block" }}>
      {PICTOS[nom]}
    </svg>
  );
}

/* ───────── 1. Les questions, en toutes lettres ───────── */

/**
 * LES QUATRE QUESTIONS, dites en toutes lettres (13/10/2026, brief « Optimisation UX de l'écran d'introduction à la colorimétrie »). Le texte
 * est celui des questions RÉELLES : leur nombre vient de QUESTIONS_COLORIMETRIE, leur contenu (métal, blanc près du visage, cheveux d'origine,
 * yeux) est vérifié par un test contre les identifiants de ces questions — si une question change, le test casse avant que l'écran mente.
 */
export const RESUME_DES_QUESTIONS = "le métal qui te va, le blanc près de ton visage, la couleur d'origine de tes cheveux et celle de tes yeux";

/* ───────── 2 bis. Le formulaire sur un écran (31/10/2026, lot 3) ───────── */

/**
 * LES QUATRE QUESTIONS SUR UN ÉCRAN. Cheveux et yeux d'abord (ce qu'on sait de soi), puis « Pour affiner » : bijoux et
 * blanc, facultatifs mais utiles — sans eux, les profils châtains ou bruns aux yeux marron restent sans saison
 * (docs/onboarding-evolution, § 1.6). Les visuels sont ceux du questionnaire d'avant, réutilisés tels quels.
 *
 * Chaque réponse est une tuile compacte (vignette + libellé) en grille de deux : vingt cartes pleine largeur auraient fait
 * défiler trois écrans. Même marque de sélection que le reste de l'onboarding (bordure terracotta, fond teinté, coche).
 */
export function FormulaireColorimetrie({
  principales,
  pourAffiner,
  reponses,
  onChoisir,
}: {
  principales: number[];
  pourAffiner: number[];
  reponses: (number | null)[];
  onChoisir: (question: number, indice: number) => void;
}) {
  const bloc = (i: number) => {
    const q = QUESTIONS_COLORIMETRIE[i];
    return (
      <div key={q.id} className="mt-[24px]" role="group" aria-label={q.question}>
        <div className="text-[14px] font-semibold text-ink leading-[1.35]">{q.question}</div>
        <div className="grid grid-cols-2 gap-[8px] mt-[10px]">
          {q.reponses.map((r, j) => {
            const on = reponses[i] === j;
            return (
              <button
                key={r.libelle}
                onClick={() => onChoisir(i, j)}
                aria-pressed={on}
                className={
                  "relative flex items-center gap-[10px] pl-[8px] pr-[26px] py-[8px] rounded-tuile text-left cursor-pointer border-[1.5px] transition-colors duration-150 " +
                  (on ? "border-terracotta" : "border-border bg-card")
                }
                style={on ? { background: "var(--color-selected-bg)" } : undefined}
              >
                <span aria-hidden="true" className="w-[38px] h-[38px] rounded-champ overflow-hidden flex-shrink-0 bg-warm-bg">
                  {r.visuel && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.visuel} alt="" width={38} height={38} decoding="async" className="w-full h-full object-cover block" />
                  )}
                </span>
                <span className="text-[12.5px] leading-[1.3] text-ink" style={{ textWrap: "balance" }}>
                  {r.libelle}
                </span>
                {on && (
                  <span aria-hidden="true" className="absolute top-[7px] right-[7px] w-[16px] h-[16px] rounded-full bg-terracotta flex items-center justify-center">
                    <svg width="8" height="7" viewBox="0 0 11 9" fill="none">
                      <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };
  return (
    <>
      {principales.map(bloc)}
      <div className="mt-[30px] pt-[18px] border-t border-border">
        <div className="t-surtitre text-muted">Pour affiner</div>
        <div className="text-[12px] text-muted mt-[6px] leading-[1.45]" style={{ textWrap: "pretty" }}>
          Facultatif, mais ces deux réponses départagent souvent les palettes chaudes et froides.
        </div>
        {pourAffiner.map(bloc)}
      </div>
    </>
  );
}

/* ───────── 3. L'analyse ───────── */

const ETAPES_ANALYSE = [...QUESTIONS_COLORIMETRIE.map((q) => q.analyse), "Ton contraste naturel"];

/**
 * UNE MICRO-ANIMATION, PAS UNE ATTENTE (brief, §8). Le calcul est instantané
 * (saisonDuQuestionnaire) : l'écran relit les cinq éléments que le calcul
 * croise réellement — les quatre réponses, et le contraste qui naît de la
 * profondeur — en 1,7 s au total, puis passe la main. Mouvement réduit : tout
 * est coché d'emblée, et l'écran ne reste que 0,9 s.
 */
export function AnalyseColorimetrie({ onFini }: { onFini: () => void }) {
  const [reduit] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const [faits, setFaits] = useState(reduit ? ETAPES_ANALYSE.length : 0);
  const fin = useRef(onFini);
  useEffect(() => {
    fin.current = onFini;
  }, [onFini]);
  useEffect(() => {
    const PAS = 220;
    const minuteries = reduit ? [] : ETAPES_ANALYSE.map((_, i) => setTimeout(() => setFaits(i + 1), 150 + i * PAS));
    minuteries.push(setTimeout(() => fin.current(), reduit ? 900 : 150 + ETAPES_ANALYSE.length * PAS + 450));
    return () => minuteries.forEach(clearTimeout);
  }, [reduit]);
  const complet = faits >= ETAPES_ANALYSE.length;
  return (
    <div className="mt-[22px]" aria-live="polite">
      {/* Une rosace de nuances autour de l'étoile de Capsela : décorative, elle
          ne montre aucune palette (le résultat n'est pas encore affiché). */}
      <div aria-hidden="true" className="relative mx-auto mb-[24px]" style={{ width: 118, height: 118 }}>
        {(["#CF7358", "#9AA389", "#DCCFBC", "#D6A9A0", "#A8967C"] as const).map((c, i) => {
          const a = (i / 5) * 2 * Math.PI - Math.PI / 2;
          return (
            <span
              key={c}
              className="absolute rounded-full"
              style={{ width: 48, height: 48, left: 35 + Math.cos(a) * 30, top: 35 + Math.sin(a) * 30, background: c, opacity: 0.72 }}
            />
          );
        })}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-[40px] h-[40px] rounded-full bg-cream flex items-center justify-center">
            <span className="etoile-pouls">
              <Pictogramme nom="etoile" taille={20} />
            </span>
          </span>
        </span>
      </div>
      <ul className="flex flex-col gap-[12px]">
        {ETAPES_ANALYSE.map((e, i) => {
          const fait = i < faits;
          return (
            <li key={e} className="flex items-center gap-[12px]">
              <span
                aria-hidden="true"
                className={
                  "w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200 " +
                  (fait ? "bg-terracotta" : "border-[1.5px] border-dots")
                }
              >
                {fait && (
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                    <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className={"text-[14px] transition-colors duration-200 " + (fait ? "text-ink" : "text-muted")}>{e}</span>
            </li>
          );
        })}
      </ul>
      <div className={"font-serif italic text-[18px] text-terracotta mt-[26px] transition-opacity duration-300 " + (complet ? "opacity-100" : "opacity-0")}>
        Ta palette se dessine…
      </div>
    </div>
  );
}

/* ───────── 4. Pas de saison nette ───────── */

/** Jamais un échec : l'écran dit ce que la réponse signifie, et ce que Capsela fait à la place. */
export function IndecisColorimetrie() {
  return (
    <div className="mt-[24px]">
      {/* Trois nuances qui se superposent : l'idée d'une gamme large, sans
          prétendre montrer une palette qui n'a pas été trouvée. Décoratif. */}
      <div aria-hidden="true" className="relative h-[92px] mx-auto" style={{ width: 150 }}>
        {(
          [
            ["#A8967C", 0, 12],
            ["#9AA389", 44, 0],
            ["#D6A9A0", 88, 16],
          ] as const
        ).map(([c, x, y]) => (
          <span key={c} className="absolute rounded-full" style={{ width: 70, height: 70, left: x - 4, top: y, background: c, opacity: 0.55 }} />
        ))}
      </div>
      <Card className="px-[16px] py-[15px] mt-[22px]">
        <div className="t-titre-carte text-ink">Ce que cela signifie</div>
        <div className="text-[13px] text-muted-3 leading-[1.5] mt-[6px]" style={{ textWrap: "pretty" }}>
          Tu peux probablement porter une large gamme de couleurs. Capsela privilégiera les teintes qui fonctionnent le mieux
          avec tes préférences et ton dressing.
        </div>
      </Card>
    </div>
  );
}

/* ───────── 5. Le résultat ───────── */

/**
 * Un groupe de couleurs de la palette : pastilles ET noms, pastille par pastille
 * (une pastille sans nom n'écrit rien). `grande` : les couleurs signature, le
 * cœur de la page ; les autres groupes sont plus petits (refonte du 01/10/2026).
 * Les noms ne se coupent jamais en deux (espaces insécables).
 */
function Nuancier({ titre, hexes, grande = false }: { titre: string; hexes: string[]; grande?: boolean }) {
  if (!hexes.length) return null;
  const taille = grande ? 46 : 32;
  // Six pastilles : deux rangées de trois, jamais une pastille seule sur la seconde ligne.
  const colonnes = hexes.length === SIGNATURE_AFFICHEE_MAX ? 3 : 5;
  return (
    <div className="mt-[22px] first:mt-0">
      <div className="t-label text-terracotta">{titre}</div>
      {/* Les couleurs signature (six au plus) se partagent la largeur : jamais une pastille seule sur une deuxième ligne, même à 360 px. */}
      <ul
        className={grande ? "grid gap-x-[6px] gap-y-[12px] mt-[11px]" : "flex flex-wrap gap-x-[10px] gap-y-[12px] mt-[11px]"}
        style={grande ? { gridTemplateColumns: `repeat(${colonnes}, minmax(0, 1fr))` } : undefined}
      >
        {hexes.map((h) => {
          const nom = paletteColorName(h)?.replace(/ /g, "\u00a0");
          return (
            <li key={h} className="flex flex-col items-center text-center" style={grande ? undefined : { width: 56 }}>
              <span aria-hidden="true" className="rounded-full block" style={{ width: taille, height: taille, background: h, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.10)" }} />
              {nom && <span className={"mt-[6px] leading-[1.25] " + (grande ? "text-[11.5px] text-ink" : "text-[11px] text-muted")}>{nom}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Le titre (« Automne chaleureux ») et sa phrase sont l'en-tête de l'étape ;
 * ici, dans l'ordre : le visuel de la saison, la palette, « Pourquoi cette
 * palette ? » quand les réponses sont connues, « Ton approche couleur » quand
 * l'intensité est choisie, et le repère. Refonte du 01/10/2026 : la palette
 * devient le contenu principal, le visuel passe d'une vignette à un vrai
 * moment éditorial.
 */
export function ResultatColorimetrie({ colorimetrie, intensite }: { colorimetrie: Colorimetrie; intensite?: Intensite | null }) {
  if (!colorimetrieUtilisable(colorimetrie)) return null;
  const c = colorimetrie;
  const saison = estSaison(c.saison) ? SAISONS[c.saison] : null;
  const explications = explicationsDesReponses(c.reponses);
  const approche = intensite ? INTENSITE_VISUELS[intensite] : null;
  return (
    <div className="mt-[20px]">
      {saison?.visuel && (
        // Le cadre des visuels éditoriaux de l'app (Capsule : arrondi 20, filet léger),
        // en 4/3 : le visuel est portrait (450 × 919), le centre — étoffes et feuille —
        // reste visible ; la largeur d'un smartphone suffit sans l'agrandir au-delà.
        <div className="rounded-carte overflow-hidden border border-border bg-warm-bg" style={{ aspectRatio: "4 / 3" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={saison.visuel} alt="" width={450} height={338} decoding="async" className="w-full h-full object-cover block" style={{ objectPosition: "center 52%" }} />
        </div>
      )}

      <div className={saison?.visuel ? "mt-[26px]" : ""}>
        <Nuancier titre="Couleurs signature" hexes={(c.signature ?? []).slice(0, SIGNATURE_AFFICHEE_MAX)} grande />
        <Nuancier titre="Neutres" hexes={c.neutres ?? []} />
        {/* « À doser selon tes envies », jamais « à éviter » ni « à porter avec
            modération » : un repère, pas une interdiction. Le moteur les éloigne
            du visage sans les retirer des tenues (colorimetrieMoteur.ts). */}
        <Nuancier titre="À doser selon tes envies" hexes={c.moderation ?? []} />
      </div>

      {explications.length > 0 && (
        <section className="mt-[34px]">
          <h2 className="t-titre-section text-ink">Pourquoi cette palette ?</h2>
          <p className="text-[13px] text-muted leading-[1.5] mt-[6px]" style={{ textWrap: "pretty" }}>
            Capsela croise tes réponses pour trouver les nuances qui s&apos;harmonisent avec toi.
          </p>
          <ul className="mt-[8px]">
            {explications.map((e) => (
              <li key={e.titre} className="py-[12px] border-b border-border last:border-b-0">
                <span className="block text-[13.5px] font-semibold text-ink">{e.titre}</span>
                <span className="block text-[13px] text-muted-3 leading-[1.45] mt-[2px]" style={{ textWrap: "pretty" }}>
                  {e.texte}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* La préférence d'intensité (étape « Quelle intensité de couleurs… ») : un
          goût de style, indépendant de la saison — elle ne sert pas au calcul de la
          colorimétrie, seulement au choix des pièces proposées (intensiteConflict,
          capsule.ts). Absente : rien n'est affiché. */}
      {approche && intensite && (
        <section className="mt-[30px]">
          <div className="t-label text-terracotta">Ton approche couleur</div>
          <div className="flex items-center justify-between gap-[12px] mt-[8px]">
            <div className="font-serif text-[19px] leading-[1.2] text-ink">{approche.libelleRecap ?? intensite}</div>
            <div className="flex gap-[5px] flex-shrink-0" aria-hidden="true">
              {approche.pastilles.map((h) => (
                <span key={h} className="w-[16px] h-[16px] rounded-full" style={{ background: h, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.10)" }} />
              ))}
            </div>
          </div>
          <p className="text-[13px] text-muted-3 leading-[1.5] mt-[6px]" style={{ textWrap: "pretty" }}>
            {approche.description} Ce choix de style complète ta palette sans la modifier.
          </p>
        </section>
      )}

      <Card className="px-[16px] py-[15px] mt-[30px] flex gap-[12px] items-start">
        <Pictogramme nom="repere" taille={22} />
        <div className="min-w-0">
          <div className="font-serif text-[17px] leading-[1.25] text-ink">Ta palette est un repère, pas une règle.</div>
          <div className="text-[13px] text-muted-3 leading-[1.5] mt-[6px]" style={{ textWrap: "pretty" }}>
            Tu peux porter toutes les couleurs que tu aimes. Capsela utilise simplement cette palette pour privilégier les
            associations qui te mettent naturellement en valeur.
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ───────── 6. Et maintenant ? ───────── */

/**
 * TROIS BÉNÉFICES, CHACUN VRAI DANS LE CODE (colorimetrieMoteur.ts). Le
 * deuxième du brief (« les recommandations tiennent compte des couleurs
 * entre elles ») décrivait l'harmonie des couleurs, qui existe mais ne dépend
 * pas de la palette : sa phrase dit ici ce que la palette change réellement.
 */
export function SuiteColorimetrie() {
  const benefices: [Picto, string, string][] = [
    ["tenue", "Des tenues plus personnalisées", "Capsela privilégie les couleurs de ta palette pour les pièces portées près du visage."],
    ["harmonie", "Des associations plus harmonieuses", "Les couleurs à doser selon tes envies passent plutôt en bas, en chaussures ou en sac."],
    ["cintre", "Un dressing plus cohérent", "Ta colorimétrie est prise en compte dans tes futures recommandations."],
  ];
  return (
    <ul className="mt-[24px] flex flex-col gap-[10px]">
      {benefices.map(([p, titre, texte]) => (
        <Card as="li" key={titre} rayon="tuile" className="px-[14px] py-[12px] flex gap-[12px] items-start">
          <span className="w-[34px] h-[34px] rounded-full bg-warm-bg flex items-center justify-center flex-shrink-0">
            <Pictogramme nom={p} taille={18} />
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold text-ink">{titre}</span>
            <span className="block text-[13px] text-muted-3 leading-[1.45] mt-[3px]" style={{ textWrap: "pretty" }}>
              {texte}
            </span>
          </span>
        </Card>
      ))}
    </ul>
  );
}
