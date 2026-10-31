"use client";

import { avecTraitsDUnion } from "@/components/TraitsDUnion";
import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import BoutonRetour from "@/components/BoutonRetour";
import {
  AnalyseColorimetrie,
  IndecisColorimetrie,
  IntroColorimetrie,
  QuestionColorimetrieCartes,
  ResultatColorimetrie,
  SuiteColorimetrie,
} from "@/components/EtapesColorimetrie";
import {
  colorimetrieDeSaison,
  colorimetrieUtilisable,
  COLORIMETRIE_VIDE,
  estSaison,
  paletteCapsela,
  QUESTIONS_COLORIMETRIE,
  reponsesEnListe,
  reponsesParQuestion,
  SAISONS,
} from "@/lib/colorimetrie";
import {
  NB_QUESTIONS,
  choisir,
  commencer,
  conclure,
  continuer,
  derniereQuestion,
  parcoursInitial,
  peutContinuer,
  recommencer,
  retour as retourColorimetrie,
  type ParcoursColorimetrie,
} from "@/lib/colorimetrieParcours";
import FilEtapes, { ProgressionQuestions } from "@/components/FilEtapes";
import OptionRow from "@/components/OptionRow";
import {
  genderLabel,
  GENDERS,
  INTENSITE_OPTIONS,
  INTENSITE_VISUELS,
  MIN_PALETTE_COULEURS,
  MORPHOLOGIES,
  MORPHOLOGY_LABELS,
  MORPHO_HINTS,
  PAL_COULEURS,
  TAILLES_HAUT,
  basculerStyle,
  MAX_STYLES,
  libelleStyles,
  exposedStyleIds,
  stylesDuGenre,
  paletteColorName,
  styleConfigFor,
  VISUELS_ETAPE_STYLE_FEMME,
  tailleBasLabelFor,
  taillesBasFor,
  type Intensite,
  type Profile,
} from "@/lib/profile";
import Button from "@/components/Button";
import {
  basculerOption,
  COUPES_PREFEREES,
  libelleCoupes,
  libelleMiseEnValeur,
  LIBELLE_SANS_COUPE,
  LIBELLE_SANS_MISE_EN_VALEUR,
  LIBELLES_COUPES,
  LIBELLES_MISE_EN_VALEUR,
  miseEnValeurDuGenre,
  miseEnValeurPosee,
  misesEnValeurProposees,
  VISUEL_NEUTRE,
  visuelCoupe,
  visuelMiseEnValeur,
  type PreferencesSilhouette,
} from "@/lib/preferencesSilhouette";
import Card from "@/components/Card";
import Input from "@/components/Input";

/**
 * Étape Morphologie exclue pour les profils Homme (Tâche 4, arbitrages du
 * 20/08/2026 : taxonomie homme non activée en P0) — filtrée à l'usage dans
 * le composant, jamais ce tableau brut, pour que STEPS reflète toujours le
 * parcours réellement servi.
 */
const ALL_STEPS = [
  { key: "prenom", kicker: "Toi", title: "Comment tu t'appelles ?", subtitle: "Pour personnaliser ton expérience Capsela." },
  { key: "genre", kicker: "Genre", title: "Comment tu te définis ?", subtitle: "Pour des suggestions plus justes, jamais pour t’enfermer dans une case." },
  { key: "taille", kicker: "Taille", title: "Quelles sont tes tailles habituelles ?", subtitle: "Ça nous aide à te proposer des tenues qui tombent bien." },
  { key: "style", kicker: "Ton style", title: "Quel style te ressemble le plus ?", subtitle: "Choisis 1 ou 2 styles maximum." },
  { key: "morpho", kicker: "Ta silhouette", title: "Quelle est ta silhouette ?", subtitle: "Elle nous aide à te proposer des coupes et des proportions qui te mettent en valeur." },
  /*
   * MISE EN VALEUR ET COUPES (31/10/2026, brief « Évolution de l'onboarding », preferencesSilhouette.ts). Ce que la personne AIME,
   * à côté de ce que sa silhouette suggère. Le sous-titre du brief (« Capsela adapte ses recommandations à tes envies… ») attend
   * le branchement moteur (lot 4, après audit) : tant que ces réponses ne changent aucune recommandation, l'écran ne le dit pas.
   */
  { key: "mise_en_valeur", kicker: "Ta silhouette", title: "Qu'aimes-tu particulièrement mettre en valeur ?", subtitle: "Plusieurs choix possibles, ou aucune préférence." },
  { key: "coupes", kicker: "Ta silhouette", title: "Dans quelles coupes te sens-tu le mieux ?", subtitle: "Plusieurs choix possibles." },
  /*
   * ORDRE DU PARCOURS (07/10/2026, brief « Optimisation de l'onboarding ») : style, silhouette, couleurs, colorimétrie,
   * profil — les goûts d'abord, la couleur ensuite, le récapitulatif en dernier (et il mène au dressing). Les tailles,
   * simple donnée pratique, passent avant ces cinq sections et n'en font pas partie : le fil « n / N · Section » ne les
   * compte pas.
   */
  /**
   * LES CINQ ÉTAPES COULEUR (25/09/2026, maquette « Onboarding Couleurs »).
   *
   * Le parcours précédent en comptait TROIS, pas quatre comme le brief le
   * supposait : `pal_couleurs` → `pal_ressenti` → `pal_recap`, l'affinité et
   * l'intensité étant déjà fusionnées dans « Deux précisions rapides ».
   * Il n'y avait donc pas d'étape affinité à supprimer, mais une étape à
   * scinder.
   *
   * L'AFFINITÉ DISPARAÎT, ET C'EST LE FOND DU CHANGEMENT. Demander « tes
   * couleurs penchent plutôt vers le chaud ou le froid ? » à côté d'une vraie
   * analyse colorimétrique entretenait la confusion entre ce qu'on aime et ce
   * qui nous va. Le champ reste en base, lu, mais plus rien ne l'écrit.
   *
   * Aucun titre ne dit « palette » ni « colorimétrie » avant l'étape qui en
   * parle : le surtitre de la première est « Tes couleurs », pas « Ta
   * palette ».
   */
  { key: "pal_couleurs", kicker: "Tes couleurs", title: "Quelles couleurs aimes-tu porter ?", subtitle: "Choisis les couleurs que tu aimes porter ou aimerais porter souvent." },
  // L'intensité n'est plus une étape (31/10/2026, arbitrage 7) : elle est posée sous les couleurs, sur le même écran.
  /*
   * LE PARCOURS COLORIMÉTRIE (refonte UX/UI du 30/09/2026) : présentation,
   * quatre questions, analyse, résultat, « Et maintenant ? ». Les sous-écrans
   * de l'étape « colorimetrie » ont leur propre en-tête (enTeteColorimetrie
   * plus bas) ; ces textes-ci sont ceux de la présentation. Le titre du
   * résultat est la saison trouvée.
   */
  { key: "colorimetrie", kicker: "Quatre questions rapides", title: "Ta colorimétrie", subtitle: "Découvrons les couleurs qui mettent naturellement ton teint en valeur." },
  { key: "colorimetrie_resultat", kicker: "Ta palette", title: "Ta palette", subtitle: "" },
  // « Et maintenant ? » n'est plus une étape (31/10/2026, arbitrage 7) : ses trois bénéfices s'affichent sous « Ta palette ».
  { key: "pal_recap", kicker: "Ton profil", title: "Ton profil Capsela est prêt", subtitle: "Capsela combine tes goûts et ta colorimétrie pour des recommandations qui te ressemblent." },
] as const;

// Les tailles prennent la même marque de sélection que les cartes (31/10/2026, revue de cohérence) : bordure terracotta et fond
// teinté, plus l'encre pleine. Bordure d'épaisseur fixe : la puce ne bouge pas au toucher.
function chipCls(on: boolean): string {
  return (
    "px-4 py-[11px] rounded-full text-[13px] cursor-pointer font-sans text-ink border-[1.5px] transition-colors duration-150 " +
    (on ? "border-terracotta bg-selected-bg" : "bg-card border-border")
  );
}

/**
 * Luminance perçue d'une teinte hex — décide si la coche de sélection doit
 * être blanche (pastille foncée) ou terracotta (pastille très claire, brief
 * UX "Ta palette" du 24/08/2026, point 3 : jamais de coche blanche
 * illisible sur Blanc/Crème/Sable...). Seuil 0,6, cohérent avec les 5
 * teintes explicitement citées comme "très claires" dans le brief.
 */
function isLightColor(hex: string): boolean {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

/**
 * Grille de pastilles de la palette personnelle — sélection multiple, sans
 * maximum depuis le 30/10/2026 (six auparavant). Contour unique terracotta + coche à la sélection (remplace
 * le double anneau décoratif crème/terracotta) ; bordure neutre du Design
 * System (--color-border) hors sélection, y compris pour les teintes très
 * claires qui s'y fondaient auparavant. Correctif 24/08/2026 (2e retour) :
 * les pastilles non sélectionnées restent toujours au rendu normal, y
 * compris à 6/6 — plus d'atténuation opacity-40, le compteur "6 sur 6"
 * suffit à communiquer la limite ; toggleCouleur reste seul responsable
 * du blocage de la 7e sélection.
 */
function PaletteDots({
  options,
  selected,
  onSelect,
}: {
  options: [string, string][];
  selected: string[];
  onSelect: (hex: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-x-3 gap-y-5 mt-[26px]">
      {options.map(([name, hex]) => {
        const on = selected.includes(hex);
        const checkColor = isLightColor(hex) ? "var(--color-terracotta)" : "#FFFFFF";
        return (
          <button key={hex} onClick={() => onSelect(hex)} className="flex flex-col items-center gap-[8px] cursor-pointer">
            <span
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{
                background: hex,
                boxShadow: on ? "0 0 0 2px var(--color-terracotta)" : "inset 0 0 0 1px var(--color-border)",
              }}
            >
              {on && (
                <svg width="14" height="11" viewBox="0 0 11 9" fill="none">
                  <path d="M1 4.5L4 7.5L10 1" stroke={checkColor} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className={"text-[10px] text-center leading-[1.3] " + (on ? "text-ink" : "text-muted")}>{name}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Carte d'une option à visuel (mise en valeur, coupes — 31/10/2026). Même langage que les cartes de style : bordure fixe dont
 * seule la couleur change, anneau de 1 px et coche terracotta à la sélection, visuel 3:4 sans rognage. Sans visuel (côté homme,
 * visuels à produire), la carte garde son libellé seul — jamais une image d'un autre genre.
 */
function CarteChoix({ libelle, visuel, on, onClick }: { libelle: string; visuel: string | null; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={
        "relative text-left rounded-tuile overflow-hidden border-[1.5px] cursor-pointer flex flex-col transition-[border-color,box-shadow,background-color] duration-[180ms] ease-out motion-reduce:transition-none " +
        (on ? "border-terracotta" : "border-border")
      }
      style={{ background: on ? "var(--color-selected-bg)" : "var(--color-card)", boxShadow: on ? "0 0 0 1px var(--color-terracotta)" : "none" }}
    >
      {visuel && (
        <div className="w-full flex-shrink-0 bg-border" style={{ aspectRatio: "3/4" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={visuel} alt="" width={300} height={400} loading="lazy" decoding="async" className="w-full h-full object-cover block" />
        </div>
      )}
      <span
        className="absolute top-[9px] right-[9px] w-[21px] h-[21px] rounded-full flex items-center justify-center border-[1.5px] transition-colors duration-[180ms] motion-reduce:transition-none"
        style={{ background: on ? "var(--color-terracotta)" : "#FFFFFF", borderColor: on ? "var(--color-terracotta)" : "#B08968" }}
      >
        {on && (
          <svg width="11" height="9" viewBox="0 0 11 9" fill="none" className="coche-style">
            <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <div className={"px-[13px] " + (visuel ? "py-[11px]" : "py-[18px] pr-[40px]")}>
        <div className="t-titre-vignette text-ink">{libelle}</div>
      </div>
    </button>
  );
}

export default function ProfileSetupScreen() {
  const { profile, saveProfile, saveColorimetrie } = useAuth();
  const { state, actions } = useCapsela();
  const [draft, setDraft] = useState<Profile>(profile);
  // Étape "prenom" masquée dès qu'un prénom est déjà connu (saisi à
  // l'inscription par e-mail, ou repris des métadonnées Google) — jamais
  // redemandé pour rien (correctif 24/08/2026).
  /**
   * L'ÉTAPE RÉSULTAT N'EXISTE QUE S'IL Y A UN RÉSULTAT. Passer l'analyse, ou
   * la voir échouer, mène directement au récapitulatif — le brief le demande,
   * et un écran de résultat vide serait de toute façon absurde.
   *
   * Un filtre plutôt qu'un saut d'index : la progression reste DÉRIVÉE de la
   * liste d'étapes. Elle annonce donc 4 tant qu'aucune analyse n'a abouti, 5
   * dès qu'une a réussi — elle ne promet jamais un écran qui ne viendra pas.
   */
  const STEPS = ALL_STEPS.filter(
    (s) =>
      (s.key !== "morpho" || draft.gender === "femme") &&
      (s.key !== "mise_en_valeur" || miseEnValeurPosee(draft.gender)) &&
      // L'étape prénom n'est posée qu'à qui n'en a pas — sauf quand on vient
      // explicitement la modifier (Mon compte → Prénom, 26/09/2026) : sans
      // cette exception, l'édition ouvrait l'étape « genre ».
      (s.key !== "prenom" || !profile.displayName.trim() || (state.profileSetupFromEdit && state.profileSetupStep === "prenom")) &&
      (s.key !== "colorimetrie_resultat" || colorimetrieUtilisable(draft.colorimetrie)) &&
      // GENRE ET TAILLES SUR UN ÉCRAN (31/10/2026, brief) : les tailles sont posées sous le genre. L'étape « taille » seule ne sert
      // plus qu'à les modifier depuis Mon profil.
      (s.key !== "taille" || (state.profileSetupFromEdit && state.profileSetupStep === "taille"))
  );
  // UNE COLORIMÉTRIE DÉJÀ FAITE SE RETROUVE, ELLE NE SE REFAIT PAS (14/10/2026, demandé : « si l'utilisateur a déjà fait le test et revient
  // à cette étape, le résultat déjà obtenu doit s'afficher, avec la possibilité de refaire le test »). Arriver sur l'étape colorimétrie —
  // par l'avant, par l'arrière ou depuis le profil — avec un résultat exploitable ouvre directement « Ta palette », qui porte le lien
  // « Refaire le test ». La présentation et le questionnaire ne s'ouvrent que pour une première fois, ou sur ce lien.
  const dejaFaite = colorimetrieUtilisable(draft.colorimetrie);
  const sansPresentationDejaFaite = (i: number) => (dejaFaite && STEPS[i]?.key === "colorimetrie" ? i + 1 : i);
  const [step, setStep] = useState(() =>
    sansPresentationDejaFaite(Math.max(0, STEPS.findIndex((s) => s.key === (state.profileSetupStep || "genre"))))
  );
  const [guideOpen, setGuideOpen] = useState(false);
  // Le parcours colorimétrie (colorimetrieParcours.ts). Repris avec les
  // réponses déjà enregistrées : revenir sur l'étape montre ce qu'on avait choisi.
  const [colo, setColo] = useState<ParcoursColorimetrie>(() => parcoursInitial(reponsesEnListe(profile.colorimetrie?.reponses)));

  const patch = (p: Partial<Profile>) => setDraft((d) => ({ ...d, ...p }));
  const patchSilhouette = (p: Partial<PreferencesSilhouette>) =>
    setDraft((d) => ({ ...d, preferencesSilhouette: { ...d.preferencesSilhouette, ...p } }));
  // LE RÉCAPITULATIF SE MODIFIE SECTION PAR SECTION (31/10/2026, brief) : toucher une ligne ouvre son étape, et « Continuer »
  // y ramène directement, sans rejouer les étapes intermédiaires.
  const [retourRecap, setRetourRecap] = useState(false);

  // Autant de couleurs qu'on veut depuis le 30/10/2026 (demandé) ; six au plus auparavant (brief UX « Ta palette » du 24/08/2026).
  const toggleCouleur = (hex: string) => {
    const cur = draft.paletteCouleurs;
    if (cur.includes(hex)) return patch({ paletteCouleurs: cur.filter((x) => x !== hex) });
    patch({ paletteCouleurs: [...cur, hex] });
  };
  // Un ou deux styles (05/10/2026 ; avant : sélection unique, arbitrage du 20/08/2026 reconduit après un essai de
  // multi-sélection le même jour) : basculerStyle, le premier choisi est le principal.
  // Un troisième style est BLOQUÉ, pas substitué (07/10/2026) : le remplacer en silence changeait un choix sans le dire.
  // Seuls comptent les styles que le genre propose (stylesDuGenre) : un style resté d'un autre genre (Glamour après un passage à Homme) ne
  // doit ni occuper une des deux places ni rester dans le profil.
  const nbStyles = stylesDuGenre(draft.styles, draft.gender).length;
  const selectStyle = (id: string) => {
    const valides = stylesDuGenre(draft.styles, draft.gender);
    if (!valides.includes(id) && valides.length >= MAX_STYLES) {
      // Un false puis true : un second refus pendant que le message est affiché relance son délai.
      setStyleBloque(false);
      setTimeout(() => setStyleBloque(true), 0);
      return;
    }
    setStyleBloque(false);
    patch({ styles: basculerStyle(valides, id) });
  };

  // Édition ciblée d'une seule étape (recette 22/08/2026, signalé : "si je
  // change mon style je ne devrai pas avoir à chaque fois l'écran
  // morphologie") — en mode édition (fromEdit), "Continuer" termine et
  // revient dès la fin de l'étape d'entrée, sans enchaîner sur les étapes
  // suivantes qui n'ont rien à voir (ex. style → morpho, pur hasard de
  // l'ordre de ALL_STEPS). Seul le groupe palette (pal_couleurs → pal_ressenti
  // → pal_recap) reste multi-étapes même en édition : ces trois étapes
  // forment un seul geste ("Mes goûts"), jamais séparables.
  const PALETTE_GROUP = ["pal_couleurs", "colorimetrie", "colorimetrie_resultat", "pal_recap"];
  const entryStepKey = state.profileSetupStep || "genre";
  const editGroupEndKey = PALETTE_GROUP.includes(entryStepKey) ? "pal_recap" : entryStepKey;
  const editGroupEndIndex = STEPS.findIndex((s) => s.key === editGroupEndKey);
  const isLast = step >= STEPS.length - 1 || (state.profileSetupFromEdit && step >= editGroupEndIndex);

  const finish = async () => {
    await saveProfile({ ...draft, completed: true });
    if (state.profileSetupFromEdit) actions.go(state.profileSetupReturn);
    // Le parcours mène au dressing (07/10/2026) : « Créer mon dressing » ouvre l'ajout d'une pièce.
    else actions.openAdd();
  };

  const indexRecap = STEPS.findIndex((s) => s.key === "pal_recap");
  const next = () => {
    if (retourRecap && indexRecap >= 0 && STEPS[step]?.key !== "pal_recap") {
      setRetourRecap(false);
      return setStep(indexRecap);
    }
    if (isLast) return finish();
    // En arrivant sur la colorimétrie PAR L'AVANT, on commence par sa
    // présentation — même si le questionnaire avait déjà été parcouru.
    if (STEPS[step + 1]?.key === "colorimetrie") setColo((p) => ({ ...p, vue: "presentation", question: 0 }));
    setStep(sansPresentationDejaFaite(step + 1));
  };
  // EN MODIFICATION, LE RETOUR RAMÈNE À L'ÉCRAN D'APPEL (25/09/2026). Avant,
  // ouvrir « Style » depuis le profil puis toucher le chevron remontait les
  // étapes précédentes de l'onboarding (Tailles, Palette…) au lieu de rendre
  // la main. On ne recule plus qu'à l'intérieur du groupe édité (la palette
  // et ses étapes), puis on revient d'où l'on venait : Mon profil ou
  // Mon compte.
  const entryIndex = Math.max(0, STEPS.findIndex((s) => s.key === entryStepKey));
  const back = () => {
    // Dans le parcours colorimétrie, le retour remonte d'abord d'une question
    // (le brief retire « Question précédente » : c'est ce bouton qui le fait).
    if (STEPS[step]?.key === "colorimetrie") {
      const precedent = retourColorimetrie(colo);
      if (precedent) return setColo(precedent);
    }
    if (retourRecap && indexRecap >= 0) {
      setRetourRecap(false);
      return setStep(indexRecap);
    }
    // En reculant depuis « Ta palette », la présentation d'une colorimétrie déjà faite est sautée (cf. sansPresentationDejaFaite).
    const precedente = dejaFaite && STEPS[step - 1]?.key === "colorimetrie" && STEPS[step]?.key === "colorimetrie_resultat" ? step - 2 : step - 1;
    if (state.profileSetupFromEdit) {
      if (precedente >= entryIndex && step > entryIndex) setStep(precedente);
      else actions.go(state.profileSetupReturn);
      return;
    }
    if (precedente >= 0) setStep(precedente);
    else if (profile.completed) actions.goProfile();
  };
  const meta = STEPS[step];
  const enQuestion = meta.key === "colorimetrie" && colo.vue === "question";
  const enAnalyse = meta.key === "colorimetrie" && colo.vue === "analyse";
  // Aucun retour pendant l'analyse : elle dure moins de deux secondes.
  const showBack = !enAnalyse && (step > 0 || state.profileSetupFromEdit || profile.completed || (meta.key === "colorimetrie" && colo.vue !== "presentation"));
  const indexColorimetrie = STEPS.findIndex((s) => s.key === "colorimetrie");

  /** Fin de l'analyse : le résultat (étape suivante), ou « Pas de saison nette » sur place. */
  const finAnalyse = () => {
    const { parcours, saison } = conclure(colo);
    setColo(parcours);
    if (!saison) return;
    const resultat = colorimetrieDeSaison(saison, "questionnaire", reponsesParQuestion(colo.reponses));
    patch({ colorimetrie: resultat });
    // Enregistré dès que le résultat s'affiche (01/10/2026, demandé) : fermer l'app avant la fin
    // du parcours ne le perd plus. Seule la colorimétrie est écrite, pas le profil entier.
    void saveColorimetrie(resultat);
    setStep(step + 1);
  };
  const passerColorimetrie = () => {
    patch({ colorimetrie: COLORIMETRIE_VIDE });
    setStep(step + 1);
  };

  /** L'en-tête de chaque écran : celui de l'étape, sauf dans le parcours colorimétrie où il suit le sous-écran. */
  const saisonResultat = estSaison(draft.colorimetrie?.saison) ? SAISONS[draft.colorimetrie.saison] : null;
  const enTete: { kicker: string | null; title: string; subtitle: string | null } =
    meta.key === "colorimetrie" && colo.vue === "question"
      ? { kicker: "Ta colorimétrie", title: QUESTIONS_COLORIMETRIE[colo.question].question, subtitle: null }
      : meta.key === "colorimetrie" && colo.vue === "analyse"
        ? { kicker: "Analyse en cours", title: "Capsela analyse tes réponses…", subtitle: null }
        : meta.key === "colorimetrie" && colo.vue === "indecis"
          ? {
              kicker: "Ta colorimétrie",
              title: "Pas de saison nette",
              subtitle:
                "Tes réponses ne penchent pas clairement vers une saison chaude ou froide. Plutôt que de choisir au hasard, Capsela conserve tes préférences de couleurs pour personnaliser tes recommandations.",
            }
          : meta.key === "colorimetrie_resultat"
            ? { kicker: meta.kicker, title: draft.colorimetrie?.libelle || meta.title, subtitle: saisonResultat?.description ?? null }
            : { kicker: meta.kicker, title: meta.title, subtitle: meta.subtitle || null };
  const taillesBas = taillesBasFor(draft.gender);
  // Le fil d'Ariane discret (07/10/2026) : « 3 / 6 · Tes couleurs ». « Ton dressing » est la dernière section, ouverte
  // par le récapitulatif ; la silhouette n'existe pas pour tous les profils (cf. STEPS), le compte suit donc le parcours servi.
  const SECTIONS: { label: string; cles: string[] }[] = [
    { label: "Ton style", cles: ["style"] },
    { label: "Ta silhouette", cles: ["morpho", "mise_en_valeur", "coupes"] },
    { label: "Tes couleurs", cles: ["pal_couleurs"] },
    { label: "Ta colorimétrie", cles: ["colorimetrie", "colorimetrie_resultat"] },
    { label: "Ton profil", cles: ["pal_recap"] },
    { label: "Ton dressing", cles: [] },
  ];
  const sectionCourante = SECTIONS.findIndex((x) => x.cles.includes(meta.key));
  const filDArianne =
    !state.profileSetupFromEdit && !profile.completed && sectionCourante >= 0
      ? `${sectionCourante + 1} / ${SECTIONS.length} · ${SECTIONS[sectionCourante].label}`
      : null;
  const [styleBloque, setStyleBloque] = useState(false);
  // Le refus d'un troisième style se dit un instant, puis s'efface (31/10/2026, brief « Ajustement UX – sélection des styles ») : jamais
  // un message permanent. Un nouveau refus relance le délai.
  useEffect(() => {
    if (!styleBloque) return;
    const t = setTimeout(() => setStyleBloque(false), 3500);
    return () => clearTimeout(t);
  }, [styleBloque]);
  // Seules les étapes style et palette exigent une sélection non vide
  // (styles : recette 20/08/2026 ; palette : Tâche 8, min 1 couleur) — les
  // autres étapes gardent leur comportement existant, jamais bloquant.
  const canContinue =
    (meta.key !== "prenom" || draft.displayName.trim().length > 0) &&
    (meta.key !== "style" || draft.styles.length > 0) &&
    (meta.key !== "pal_couleurs" || draft.paletteCouleurs.length >= MIN_PALETTE_COULEURS) &&
    // Les coupes demandent une réponse (« Cela dépend du vêtement » en est une) ; la mise en valeur est facultative.
    (meta.key !== "coupes" || draft.preferencesSilhouette.coupes !== null);

  const recapRows: { label: string; value: string; swatches: string[]; etape?: string }[] = [
    {
      label: "Genre",
      value: [genderLabel(draft.gender), draft.tailleHaut, draft.tailleBas, draft.pointure].filter(Boolean).join(" · ") || "à préciser",
      swatches: [],
      etape: "genre",
    },
    { label: "Style", value: libelleStyles(draft.styles, draft.gender) || "à choisir", swatches: [] as string[], etape: "style" },
    ...(draft.gender === "femme" && draft.morphology
      ? [{ label: "Silhouette", value: MORPHOLOGY_LABELS[draft.morphology], swatches: [] as string[], etape: "morpho" }]
      : []),
    ...(miseEnValeurPosee(draft.gender)
      ? [
          {
            label: "Mise en valeur",
            value: libelleMiseEnValeur(draft.preferencesSilhouette.miseEnValeur, draft.gender) ?? "non précisée",
            swatches: [] as string[],
            etape: "mise_en_valeur",
          },
        ]
      : []),
    { label: "Coupes", value: libelleCoupes(draft.preferencesSilhouette.coupes) ?? "à choisir", swatches: [], etape: "coupes" },
    {
      etape: "pal_couleurs",
      label: "Couleurs",
      value: draft.paletteCouleurs.map(paletteColorName).filter(Boolean).join(", ") || "à choisir",
      swatches: draft.paletteCouleurs,
    },
    {
      etape: "pal_couleurs",
      label: "Intensité",
      value: draft.paletteIntensite
        ? (INTENSITE_VISUELS[draft.paletteIntensite]?.libelleRecap ?? draft.paletteIntensite)
        : "non précisée",
      // Les pastilles de l'étape Intensité (30/09/2026, demandé) : on retrouve
      // ici la famille choisie telle qu'on l'a vue. Illustration seulement,
      // comme sur l'étape — ce ne sont pas des couleurs choisies.
      // Une valeur venue d'une version antérieure et absente de la table n'affiche rien plutôt que de planter.
      swatches: (draft.paletteIntensite && INTENSITE_VISUELS[draft.paletteIntensite]?.pastilles) || ([] as string[]),
    },
    {
      // « Saison » depuis le questionnaire (30/09/2026) : ce n'est plus une
      // analyse. « Pas encore définie » et non « aucune » : elle est à venir,
      // pas refusée.
      etape: "colorimetrie",
      label: "Saison",
      value: colorimetrieUtilisable(draft.colorimetrie)
        ? draft.colorimetrie.libelle || "Définie"
        : "Pas encore définie",
      swatches: [] as string[],
    },
    {
      // CALCULÉE, JAMAIS STOCKÉE (brief §2). Sans colorimétrie elle vaut les
      // préférences seules — ce qui est juste, pas un repli.
      label: "Ta palette",
      value: "",
      swatches: paletteCapsela(draft.paletteCouleurs, draft.colorimetrie),
    },
  ];

  // Contenu de l'écran, identique quelle que soit l'étape — extrait dans
  // une variable (correctif 24/08/2026, 2e retour) pour pouvoir l'insérer
  // soit dans le conteneur scrollable unique historique (toutes les étapes
  // sauf pal_couleurs, structure inchangée), soit dans la zone scrollable
  // d'un layout à deux zones distinctes pour pal_couleurs (cf. plus bas) —
  // jamais un second rendu divergent du même contenu.
  const blocTailles = (
        <div className="mt-[26px]">
          <div className="t-surtitre text-muted mb-[11px]">Taille de haut</div>
          <div className="flex gap-2 flex-wrap">
            {TAILLES_HAUT.map((t) => (
              <button key={t} onClick={() => patch({ tailleHaut: t })} className={chipCls(draft.tailleHaut === t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="t-surtitre text-muted mt-[22px] mb-[11px]">
            {tailleBasLabelFor(draft.gender)}
          </div>
          <div className="flex gap-2 flex-wrap">
            {taillesBas.map((t) => (
              <button key={t} onClick={() => patch({ tailleBas: t })} className={chipCls(draft.tailleBas === t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="t-surtitre text-muted mt-[22px] mb-[11px]">Pointure</div>
          <Input
            inputMode="numeric"
            className="w-[120px]"
            placeholder="Ex. 39"
            value={draft.pointure ?? ""}
            onChange={(e) => patch({ pointure: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) || null })}
          />
        </div>
  );

  const pageBody = (
    <>
      <AppHeader showAvatar={false} />

      {/* Les deux gouttières valent 38 px et non plus 36 : le bouton de
          retour est passé au composant commun, dont le cercle fait 38 (cf.
          BoutonRetour). Des cales restées à 36 décentreraient le fil d'un
          pixel — invisible isolément, mais c'est la raison d'être de ces
          deux div. */}
      <div className="flex items-center justify-between">
        {showBack ? (
          <BoutonRetour onClick={back} label="Revenir à l'étape précédente" />
        ) : (
          // 38 × 38 : la rangée garde sa hauteur sans bouton (analyse) — sinon
          // tout l'écran remontait d'un cran entre la dernière question et l'analyse.
          <div className="w-[38px] h-[38px]" />
        )}
        {/* UN SEUL LANGAGE DE PROGRESSION (brief colorimétrie) : pendant les
            questions, « 1 / 4 » remplace le fil de l'onboarding ; pendant
            l'analyse, aucun compteur. */}
        {enQuestion ? (
          <ProgressionQuestions courante={colo.question} total={NB_QUESTIONS} />
        ) : enAnalyse ? (
          <div />
        ) : (
          <FilEtapes total={STEPS.length} courante={step} />
        )}
        <div className="w-[38px]" />
      </div>
      {/* Hauteur réservée même sans fil (Genre et tailles, modification) : le titre tombe au même endroit sur toutes les étapes. */}
      <div className="text-center text-[11px] text-muted mt-2 h-[16px] leading-[16px]" aria-live="polite">
        {filDArianne}
      </div>

      <div className="mt-[26px]">
        {enTete.kicker && <div className="t-surtitre text-terracotta">{enTete.kicker}</div>}
        <div className="t-titre-ecran text-ink mt-3" style={{ textWrap: "balance" }}>{avecTraitsDUnion(enTete.title)}</div>
        {enTete.subtitle && <div className="t-chapeau text-muted mt-[10px]">{enTete.subtitle}</div>}
        {meta.key === "pal_couleurs" && draft.paletteCouleurs.length > 0 && (
          <div className="text-[12px] text-muted mt-[6px]">
            {draft.paletteCouleurs.length} {draft.paletteCouleurs.length > 1 ? "couleurs sélectionnées" : "couleur sélectionnée"}
          </div>
        )}
        {/* LA PHRASE QUI ÉVITE LE MALENTENDU CENTRAL de ce parcours : aimer
            une couleur et être mise en valeur par elle sont deux choses, et
            l'app en fait deux étapes distinctes. Sans cette mention, la
            première étape se lit comme une colorimétrie déclarative. */}
        {meta.key === "pal_couleurs" && (
          <div className="text-[12px] text-muted-3 mt-[10px] leading-[1.45]" style={{ textWrap: "pretty" }}>
            Tes préférences sont indépendantes de ta colorimétrie.
          </div>
        )}
      </div>

      {meta.key === "prenom" && (
        <div className="mt-[26px]">
          <Input
            placeholder="Prénom"
            value={draft.displayName}
            onChange={(e) => patch({ displayName: e.target.value })}
            autoFocus
          />
        </div>
      )}

      {meta.key === "genre" && (
        <div className="flex flex-col gap-[10px] mt-[26px]">
          {GENDERS.map((g) => (
            <OptionRow
              key={g.key}
              label={g.label}
              on={draft.gender === g.key}
              onClick={() => patch({ gender: g.key })}
            />
          ))}
        </div>
      )}
      {/* Les tailles sous le genre (31/10/2026) : elles n'apparaissent qu'une fois le genre choisi, dont dépend la liste des tailles
          de bas. En modification depuis Mon profil, chaque information garde son propre écran. */}
      {meta.key === "genre" && !state.profileSetupFromEdit && draft.gender && (
        <>
          <div className="t-surtitre text-muted mt-[30px]">Tes tailles habituelles</div>
          <div className="text-[12px] text-muted mt-[6px]">Pré-remplies quand tu ajoutes une pièce.</div>
          {blocTailles}
        </>
      )}

      {meta.key === "pal_couleurs" && (
        <PaletteDots options={PAL_COULEURS} selected={draft.paletteCouleurs} onSelect={toggleCouleur} />
      )}
      {meta.key === "pal_couleurs" && (
        // Même construction que « Tes tailles habituelles » sous le genre : une section secondaire d'un écran se signale par un
        // surtitre et une ligne d'aide, jamais par un second titre.
        <>
          <div className="t-surtitre text-muted mt-[30px]">Ton intensité de couleurs</div>
          <div className="text-[12px] text-muted mt-[6px]">Celle que tu portes volontiers. Facultatif.</div>
        </>
      )}

      {/* L'intensité seule, en cartes radio pleine largeur plutôt qu'en chips
          (maquette du 25/09) : quatre libellés longs en chips produisaient
          deux rangs irréguliers. `OptionRow` est le composant déjà utilisé
          par l'étape Genre — même marque de sélection. Depuis le 30/09/2026,
          chaque carte montre aussi cinq pastilles de sa famille de couleurs
          et une phrase (INTENSITE_VISUELS) : on compare les quatre d'un coup
          d'œil, sans que le choix enregistré change. */}
      {meta.key === "pal_couleurs" && (
        <div className="flex flex-col gap-[10px] mt-[14px]">
          {INTENSITE_OPTIONS.map((it: Intensite) => (
            <OptionRow
              key={it}
              label={it}
              description={INTENSITE_VISUELS[it].description}
              pastilles={INTENSITE_VISUELS[it].pastilles}
              on={draft.paletteIntensite === it}
              onClick={() => patch({ paletteIntensite: it })}
            />
          ))}
        </div>
      )}

      {/* Le corps du parcours colorimétrie ; son bouton principal et son lien
          secondaire sont dans le pied d'écran (piedColorimetrie). */}
      {meta.key === "colorimetrie" && colo.vue === "presentation" && <IntroColorimetrie />}
      {meta.key === "colorimetrie" && colo.vue === "question" && (
        <QuestionColorimetrieCartes
          question={QUESTIONS_COLORIMETRIE[colo.question]}
          choisie={colo.reponses[colo.question]}
          onChoisir={(i) => setColo((p) => choisir(p, i))}
        />
      )}
      {meta.key === "colorimetrie" && colo.vue === "analyse" && <AnalyseColorimetrie onFini={finAnalyse} />}
      {meta.key === "colorimetrie" && colo.vue === "indecis" && <IndecisColorimetrie />}
      {meta.key === "colorimetrie_resultat" && <ResultatColorimetrie colorimetrie={draft.colorimetrie} intensite={draft.paletteIntensite} />}
      {meta.key === "colorimetrie_resultat" && <SuiteColorimetrie />}

      {meta.key === "pal_recap" && (
        <Card className="mt-6 p-[18px]">
          {recapRows.map((r) => {
            const cible = r.etape ? STEPS.findIndex((x) => x.key === r.etape) : -1;
            const ligne = (
            <>
              <span className="w-[92px] flex-shrink-0 t-surtitre text-muted">{r.label}</span>
              <div className="flex items-center gap-[6px] flex-wrap flex-1 min-w-0">
                {r.swatches.map((hex) => (
                  <span
                    key={hex}
                    className="w-[15px] h-[15px] rounded-full flex-shrink-0"
                    style={{ background: hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.10)" }}
                  />
                ))}
                <span className="text-[12px] text-ink">{r.value}</span>
              </div>
            </>
            );
            const cls = "w-full flex items-center gap-3 py-[11px] border-b border-border last:border-b-0 text-left";
            return cible >= 0 ? (
              <button
                key={r.label}
                className={cls + " cursor-pointer"}
                aria-label={`Modifier : ${r.label}`}
                onClick={() => {
                  setRetourRecap(true);
                  setStep(sansPresentationDejaFaite(cible));
                }}
              >
                {ligne}
                <span aria-hidden="true" className="text-[12px] text-terracotta flex-shrink-0">Modifier</span>
              </button>
            ) : (
              <div key={r.label} className={cls}>
                {ligne}
              </div>
            );
          })}
        </Card>
      )}

      {meta.key === "taille" && blocTailles}

      {/* OÙ EN EST LA SÉLECTION (31/10/2026, brief « Ajustement UX – sélection des styles ») : rien avant le premier choix (le sous-titre
          dit déjà « 1 ou 2 styles maximum »), puis 1/2, puis 2/2. Hauteur réservée : la grille ne saute pas quand le compteur apparaît. */}
      {meta.key === "style" && (
        <p role="status" aria-live="polite" className="h-[18px] mt-[6px] text-[12px] text-muted leading-[18px]">
          {nbStyles === 1 ? "1/2 style sélectionné" : nbStyles >= MAX_STYLES ? `${MAX_STYLES}/${MAX_STYLES} styles sélectionnés` : ""}
        </p>
      )}
      {meta.key === "style" && (
        <div className="grid grid-cols-2 gap-[11px] mt-[8px]">
          {exposedStyleIds(draft.gender).map((id) => {
            const cfg = styleConfigFor(draft.gender)[id];
            const on = draft.styles.includes(id);
            // Les flat lays en portrait 3:4 : côté femme (et genre non
            // renseigné, qui affiche la grille femme) ceux du 25/09 ; côté
            // homme, ceux fournis le 30/10/2026 (STYLE_CONFIG), au même
            // format — les deux grilles sont identiques.
            const visuel = draft.gender === "homme" ? cfg.asset || null : VISUELS_ETAPE_STYLE_FEMME[id];
            return (
              <button
                key={id}
                onClick={() => selectStyle(id)}
                className={
                  // Épaisseur de bordure fixe (jamais 1px ↔ 2px) : seule la
                  // couleur change à la sélection, jamais la largeur, pour
                  // qu'aucune card ne bouge d'un pixel au clic (indépendant
                  // de box-sizing, garanti par construction).
                  // Sélectionnée (31/10/2026) : la bordure se marque d'un anneau de 1 px en plus (box-shadow, hors du flux : aucune card ne
                  // bouge), le fond s'éclaire ; transition de 180 ms, coupée si le téléphone demande moins d'animations.
                  "relative text-left rounded-tuile overflow-hidden border-[1.5px] cursor-pointer flex flex-col transition-[border-color,box-shadow,background-color] duration-[180ms] ease-out motion-reduce:transition-none " +
                  (on ? "border-terracotta" : "border-border")
                }
                aria-pressed={on}
                style={{ background: on ? "var(--color-selected-bg)" : "var(--color-card)", boxShadow: on ? "0 0 0 1px var(--color-terracotta)" : "none" }}
              >
                {visuel ? (
                  /* LE FORMAT EXACT DU VISUEL (3:4), et non le 5:4 des
                     anciennes cartes : dans un cadre paysage, un flat lay
                     portrait perdait ~40 % de sa hauteur. Ici rien n'est
                     rogné ni déformé — `cover` sur un cadre au même ratio que
                     l'image. Dimensions déclarées : la place est réservée
                     avant le chargement. Aucun élément par-dessus, hormis le
                     contrôle de sélection existant. */
                  <div className="w-full flex-shrink-0 bg-border" style={{ aspectRatio: "3/4" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={visuel}
                      alt=""
                      width={900}
                      height={1200}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover block"
                    />
                  </div>
                ) : (
                <div
                  className="w-full flex-shrink-0"
                  style={{
                    // ~60/40 image/texte (recette 20/08/2026) : 5/4 est plus
                    // dominant que le 4/3 précédent sans agrandir la card de
                    // façon perceptible.
                    aspectRatio: "5/4",
                    // Aplat beige toujours en fond : si l'URL Storage est vide, indisponible
                    // ou en échec de chargement, background-image ne dessine simplement rien
                    // par-dessus — jamais une icône d'image cassée (repli déjà natif, pas de JS).
                    backgroundColor: "var(--color-border)",
                    ...(cfg.asset ? { backgroundImage: `url(${cfg.asset})` } : {}),
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                />
                )}
                <span
                  className="absolute top-[9px] right-[9px] w-[21px] h-[21px] rounded-full flex items-center justify-center border-[1.5px] transition-colors duration-[180ms] motion-reduce:transition-none"
                  style={{ background: on ? "var(--color-terracotta)" : "#FFFFFF", borderColor: on ? "var(--color-terracotta)" : "#B08968" }}
                >
                  {on && (
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none" className="coche-style">
                      <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <div className="px-[13px] py-[11px]">
                  <div className="t-titre-vignette text-ink">{cfg.label}</div>
                  <div className="text-[11px] text-muted mt-[4px] leading-[1.35]">{cfg.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {meta.key === "morpho" && (
        <>
          <div className="flex flex-col gap-[10px] mt-[26px]">
            {MORPHOLOGIES.map((m) => (
              <OptionRow
                key={m}
                label={MORPHOLOGY_LABELS[m]}
                on={draft.morphology === m}
                onClick={() => patch({ morphology: m })}
              />
            ))}
          </div>
          <button onClick={() => setGuideOpen(!guideOpen)} className="flex items-center gap-[7px] mt-[18px] cursor-pointer">
            <span className="text-[12px] text-terracotta">Comment savoir quelle est ma morphologie ?</span>
          </button>
          {guideOpen && (
            <Card rayon="bloc" className="px-4 py-[14px] mt-[10px] flex flex-col gap-[11px]">
              {MORPHOLOGIES.map((m) => (
                <div key={m}>
                  <div className="text-[12px] text-ink font-semibold">{MORPHOLOGY_LABELS[m]}</div>
                  <div className="text-[12px] text-muted mt-[2px] leading-[1.4]">{MORPHO_HINTS[m]}</div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {meta.key === "mise_en_valeur" && (
        <>
          <div className="grid grid-cols-2 gap-[11px] mt-[22px]">
            {misesEnValeurProposees(draft.gender).map((v) => (
              <CarteChoix
                key={v}
                libelle={LIBELLES_MISE_EN_VALEUR[v]}
                visuel={visuelMiseEnValeur(v)}
                on={(draft.preferencesSilhouette.miseEnValeur ?? []).includes(v)}
                onClick={() => patchSilhouette({ miseEnValeur: basculerOption(miseEnValeurDuGenre(draft.preferencesSilhouette.miseEnValeur, draft.gender), v) })}
              />
            ))}
          </div>
          {/* La réponse neutre est exclusive : la choisir efface les options, choisir une option l'efface. */}
          <div className="mt-[11px]">
            <OptionRow
              accent
              vignette={VISUEL_NEUTRE}
              label={LIBELLE_SANS_MISE_EN_VALEUR}
              on={Array.isArray(draft.preferencesSilhouette.miseEnValeur) && draft.preferencesSilhouette.miseEnValeur.length === 0}
              onClick={() => patchSilhouette({ miseEnValeur: [] })}
            />
          </div>
        </>
      )}

      {meta.key === "coupes" && (
        <>
          <div className="grid grid-cols-2 gap-[11px] mt-[22px]">
            {COUPES_PREFEREES.map((c) => (
              <CarteChoix
                key={c}
                libelle={LIBELLES_COUPES[c]}
                visuel={visuelCoupe(c, draft.gender)}
                on={(draft.preferencesSilhouette.coupes ?? []).includes(c)}
                onClick={() => patchSilhouette({ coupes: basculerOption(draft.preferencesSilhouette.coupes, c) })}
              />
            ))}
          </div>
          <div className="mt-[11px]">
            <OptionRow
              accent
              vignette={VISUEL_NEUTRE}
              label={LIBELLE_SANS_COUPE}
              on={Array.isArray(draft.preferencesSilhouette.coupes) && draft.preferencesSilhouette.coupes.length === 0}
              onClick={() => patchSilhouette({ coupes: [] })}
            />
          </div>
          <div className="text-[12px] text-muted mt-[12px]">Tu pourras les modifier à tout moment dans ton profil.</div>
        </>
      )}

    </>
  );

  /**
   * LE PIED D'ÉCRAN : un bouton principal, et au plus un lien discret. Le
   * parcours colorimétrie y met ses propres libellés (« Commencer »,
   * « Continuer », « Voir mon résultat », « Continuer mon profil ») ; pendant
   * l'analyse, il n'y a rien à toucher.
   */
  type Pied = { libelle: string; onClick: () => void; actif: boolean; lien?: { libelle: string; onClick: () => void } } | null;
  const piedColorimetrie = (): Pied | undefined => {
    if (meta.key === "colorimetrie") {
      switch (colo.vue) {
        case "presentation":
          return { libelle: "Commencer l'analyse", onClick: () => setColo(commencer), actif: true, lien: { libelle: "Passer pour l'instant", onClick: passerColorimetrie } };
        case "question":
          return { libelle: derniereQuestion(colo) ? "Voir mon résultat" : "Continuer", onClick: () => setColo(continuer), actif: peutContinuer(colo) };
        case "analyse":
          return null;
        case "indecis":
          return { libelle: "Continuer", onClick: passerColorimetrie, actif: true, lien: { libelle: "Refaire le questionnaire", onClick: () => setColo(recommencer()) } };
      }
    }
    if (meta.key === "colorimetrie_resultat") {
      return {
        libelle: isLast ? (state.profileSetupFromEdit ? "Enregistrer les modifications" : "Créer mon dressing") : "Continuer",
        onClick: next,
        actif: true,
        // Refaire le test : le questionnaire depuis le début, réponses effacées. Le résultat actuel reste tant qu'un nouveau n'est pas trouvé.
        lien: {
          libelle: "Refaire le test",
          onClick: () => {
            setColo(recommencer());
            setStep(Math.max(0, indexColorimetrie));
          },
        },
      };
    }
    return undefined;
  };
  const piedSpecifique = piedColorimetrie();
  const pied: Pied =
    piedSpecifique !== undefined
      ? piedSpecifique
      : {
          libelle: isLast
            ? state.profileSetupFromEdit
              ? "Enregistrer les modifications"
              : // « Créer mon dressing » (07/10/2026, brief d'optimisation) : ce qui s'ouvre
                // est l'ajout d'une première pièce, plus l'accueil.
                "Créer mon dressing"
            : "Continuer",
          onClick: next,
          actif: canContinue,
        };

  const continueButton = pied && (
    <>
      <Button className="mt-[22px]" onClick={pied.actif ? pied.onClick : undefined} disabled={!pied.actif}>
        {pied.libelle}
      </Button>
      {pied.lien && (
        <button onClick={pied.lien.onClick} className="w-full text-[13px] text-muted cursor-pointer mt-1" style={{ minHeight: 44 }}>
          {pied.lien.libelle}
        </button>
      )}
    </>
  );

  // pal_couleurs : layout à deux zones distinctes (correctif 24/08/2026,
  // 2e retour — le sticky+padding ne garantissait pas l'absence de
  // recouvrement, seule une vraie séparation structurelle le fait). La
  // zone scrollable (flex-1 overflow-y-auto) et la zone d'action (le
  // footer, hauteur naturelle) sont deux frères dans un conteneur non
  // scrollable : le footer ne peut plus jamais recouvrir le contenu,
  // quelle que soit sa hauteur réelle ou la valeur du safe-area — aucun
  // padding à deviner. border-t border-border : même traitement de
  // séparation que TabBar.tsx, seul autre élément fixe du Design System.
  // Toutes les autres étapes gardent la structure historique à zone
  // scrollable unique, strictement inchangée.
  // Le parcours colorimétrie prend la même structure (30/09/2026) : son
  // bouton reste accessible sans défiler, même quand le résultat est long.
  // L'étape Style aussi (31/10/2026, brief « Ajustement UX – sélection des styles ») : son bouton reste accessible pendant le défilement,
  // sans jamais recouvrir les dernières cartes.
  // TOUTES LES ÉTAPES EN DEUX ZONES (31/10/2026, demandé : « bouton sticky ? ») : depuis que Genre et tailles partagent un écran, le
  // bouton d'une étape courte pouvait passer sous le pli. Un seul gabarit pour tout le parcours : le bouton reste visible, et ne
  // recouvre jamais le contenu.
  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="relative flex-1 min-h-0 flex flex-col">
        {/* `key` : chaque étape (et chaque sous-écran de la colorimétrie) s'ouvre en haut, jamais au défilement de la précédente. */}
        <div key={`${meta.key}-${colo.vue}-${colo.question}`} className="scrollarea flex-1 overflow-y-auto px-7 pt-2 pb-6">
          {pageBody}
        </div>
        {/* Le refus d'un troisième style : une bulle discrète au-dessus du bouton, quelques secondes (pas dans la page : sur deux lignes,
            elle aurait fait sauter la grille à chaque apparition). */}
        {meta.key === "style" && styleBloque && (
          <div role="status" className="detail-part absolute inset-x-0 bottom-3 mx-auto max-w-[480px] px-7 pointer-events-none">
            <div className="bg-ink rounded-feuille px-4 py-[10px] text-[12px] text-cream leading-[1.4] text-center shadow-lg">
              Tu as déjà choisi deux styles. Retire-en un pour en sélectionner un autre.
            </div>
          </div>
        )}
      </div>
      {continueButton && (
        <div
          className="flex-shrink-0 px-7 bg-cream border-t border-border flex flex-col"
          style={{ paddingBottom: pied?.lien ? "calc(4px + env(safe-area-inset-bottom))" : "calc(16px + env(safe-area-inset-bottom))" }}
        >
          {continueButton}
        </div>
      )}
    </div>
  );
}
