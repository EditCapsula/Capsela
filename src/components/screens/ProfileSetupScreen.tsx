"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import BoutonRetour from "@/components/BoutonRetour";
import { EtapeColorimetrie, ResultatColorimetrie } from "@/components/EtapesColorimetrie";
import { colorimetrieUtilisable, COLORIMETRIE_VIDE, paletteCapsela, type Colorimetrie } from "@/lib/colorimetrie";
import FilEtapes from "@/components/FilEtapes";
import {
  GENDERS,
  INTENSITE_OPTIONS,
  MAX_PALETTE_COULEURS,
  MIN_PALETTE_COULEURS,
  MORPHOLOGIES,
  MORPHOLOGY_LABELS,
  MORPHO_HINTS,
  PAL_COULEURS,
  TAILLES_HAUT,
  exposedStyleIds,
  paletteColorName,
  styleConfigFor,
  tailleBasLabelFor,
  taillesBasFor,
  type Intensite,
  type Profile,
} from "@/lib/profile";

/**
 * Étape Morphologie exclue pour les profils Homme (Tâche 4, arbitrages du
 * 20/08/2026 : taxonomie homme non activée en P0) — filtrée à l'usage dans
 * le composant, jamais ce tableau brut, pour que STEPS reflète toujours le
 * parcours réellement servi.
 */
const ALL_STEPS = [
  { key: "prenom", kicker: "Toi", title: "Comment tu t'appelles ?", subtitle: "Pour personnaliser ton expérience Capsela." },
  { key: "genre", kicker: "Genre", title: "Comment tu te définis ?", subtitle: "Pour des suggestions plus justes, jamais pour t’enfermer dans une case." },
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
  { key: "pal_couleurs", kicker: "Tes couleurs", title: "Quelles couleurs aimes-tu porter ?", subtitle: "Choisis 1 à 6 couleurs que tu portes ou aimerais porter souvent." },
  { key: "pal_intensite", kicker: "Ton style", title: "Quelle intensité portes-tu volontiers ?", subtitle: "Cela nous aide à créer des looks dans ton style." },
  { key: "colorimetrie", kicker: "Ta colorimétrie", title: "Et si on trouvait les couleurs qui te mettent naturellement en valeur ?", subtitle: "Une photo suffit. Capsela étudie les tonalités de ta peau, de tes cheveux et de tes yeux pour personnaliser tes recommandations." },
  { key: "colorimetrie_resultat", kicker: "Ta colorimétrie", title: "Voilà ce que dit ton analyse", subtitle: "Un repère pour t'inspirer, pas une règle : tu peux porter toutes les couleurs que tu aimes." },
  { key: "pal_recap", kicker: "Voilà ta palette Capsela", title: "Ce que tu aimes × ce qui te met en valeur", subtitle: "Capsela combine tes préférences et ta colorimétrie pour des recommandations qui te ressemblent." },
  { key: "taille", kicker: "Taille", title: "Quelles sont tes tailles habituelles ?", subtitle: "Ça nous aide à te proposer des tenues qui tombent bien." },
  { key: "style", kicker: "Style", title: "Quel style te ressemble le plus ?", subtitle: "Choisis celui qui correspond le mieux à ta façon de t'habiller." },
  { key: "morpho", kicker: "Morphologie", title: "Et ta silhouette ?", subtitle: "Pour affiner nos recommandations de coupes." },
] as const;

function chipCls(on: boolean): string {
  return (
    "px-4 py-[11px] rounded-full text-[13px] cursor-pointer font-sans border " +
    (on ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border")
  );
}

function OptionRow({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center gap-3 px-4 py-[15px] rounded-[14px] cursor-pointer text-[13px] leading-[1.4] text-left border " +
        (on ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border")
      }
    >
      <span className="flex-1">{label}</span>
      <span
        className={
          "w-5 h-5 rounded-full flex-shrink-0 text-[11px] flex items-center justify-center " +
          (on ? "bg-terracotta text-cream border border-terracotta" : "border-[1.5px] border-dots text-transparent")
        }
      >
        {on ? "✓" : ""}
      </span>
    </button>
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
 * Grille de pastilles de la palette personnelle — sélection multiple
 * jusqu'à MAX_PALETTE_COULEURS (cf. toggleCouleur, bloquant au-delà, pas
 * d'éviction). Contour unique terracotta + coche à la sélection (remplace
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
        const checkColor = isLightColor(hex) ? "#A66950" : "#FFFFFF";
        return (
          <button key={hex} onClick={() => onSelect(hex)} className="flex flex-col items-center gap-[8px] cursor-pointer">
            <span
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{
                background: hex,
                boxShadow: on ? "0 0 0 2px #A66950" : "inset 0 0 0 1px #E6DCCB",
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

export default function ProfileSetupScreen() {
  const { profile, saveProfile } = useAuth();
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
      (s.key !== "prenom" || !profile.displayName.trim()) &&
      (s.key !== "colorimetrie_resultat" || colorimetrieUtilisable(draft.colorimetrie))
  );
  const [step, setStep] = useState(() =>
    Math.max(0, STEPS.findIndex((s) => s.key === (state.profileSetupStep || "genre")))
  );
  const [guideOpen, setGuideOpen] = useState(false);

  const patch = (p: Partial<Profile>) => setDraft((d) => ({ ...d, ...p }));

  // Bloque la 7e sélection plutôt que d'évincer la plus ancienne (brief UX
  // "Ta palette" du 24/08/2026) — au maximum, les couleurs non sélectionnées
  // sont désactivées (cf. PaletteDots), donc ce cas ne devrait plus être
  // déclenché depuis l'UI ; gardé en défense en profondeur.
  const toggleCouleur = (hex: string) => {
    const cur = draft.paletteCouleurs;
    if (cur.includes(hex)) return patch({ paletteCouleurs: cur.filter((x) => x !== hex) });
    if (cur.length >= MAX_PALETTE_COULEURS) return;
    patch({ paletteCouleurs: [...cur, hex] });
  };
  // Sélection unique (Tâche 7, arbitrages du 20/08/2026 — reconduit après
  // un essai de multi-sélection le même jour) : un seul id stocké, la carte
  // précédente se désélectionne automatiquement.
  const selectStyle = (id: string) => patch({ styles: [id] });

  // Édition ciblée d'une seule étape (recette 22/08/2026, signalé : "si je
  // change mon style je ne devrai pas avoir à chaque fois l'écran
  // morphologie") — en mode édition (fromEdit), "Continuer" termine et
  // revient dès la fin de l'étape d'entrée, sans enchaîner sur les étapes
  // suivantes qui n'ont rien à voir (ex. style → morpho, pur hasard de
  // l'ordre de ALL_STEPS). Seul le groupe palette (pal_couleurs → pal_ressenti
  // → pal_recap) reste multi-étapes même en édition : ces trois étapes
  // forment un seul geste ("Mes goûts"), jamais séparables.
  const PALETTE_GROUP = ["pal_couleurs", "pal_intensite", "colorimetrie", "colorimetrie_resultat", "pal_recap"];
  const entryStepKey = state.profileSetupStep || "genre";
  const editGroupEndKey = PALETTE_GROUP.includes(entryStepKey) ? "pal_recap" : entryStepKey;
  const editGroupEndIndex = STEPS.findIndex((s) => s.key === editGroupEndKey);
  const isLast = step >= STEPS.length - 1 || (state.profileSetupFromEdit && step >= editGroupEndIndex);

  const finish = async () => {
    await saveProfile({ ...draft, completed: true });
    if (state.profileSetupFromEdit) actions.go(state.profileSetupReturn);
    else actions.goHome();
  };

  const next = () => (isLast ? finish() : setStep(step + 1));
  const back = () => {
    if (step > 0) setStep(step - 1);
    else if (state.profileSetupFromEdit || profile.completed) actions.goProfile();
  };
  const showBack = step > 0 || state.profileSetupFromEdit || profile.completed;

  const meta = STEPS[step];
  const taillesBas = taillesBasFor(draft.gender);
  // Seules les étapes style et palette exigent une sélection non vide
  // (styles : recette 20/08/2026 ; palette : Tâche 8, min 1 couleur) — les
  // autres étapes gardent leur comportement existant, jamais bloquant.
  const canContinue =
    (meta.key !== "prenom" || draft.displayName.trim().length > 0) &&
    (meta.key !== "style" || draft.styles.length > 0) &&
    (meta.key !== "pal_couleurs" || draft.paletteCouleurs.length >= MIN_PALETTE_COULEURS);

  const recapRows = [
    {
      label: "Couleurs",
      value: draft.paletteCouleurs.map(paletteColorName).filter(Boolean).join(", ") || "à choisir",
      swatches: draft.paletteCouleurs,
    },
    { label: "Intensité", value: draft.paletteIntensite || "non précisée", swatches: [] as string[] },
    {
      label: "Analyse",
      // « Pas encore analysée » et non « aucune » : l'analyse est à venir,
      // pas refusée.
      value: colorimetrieUtilisable(draft.colorimetrie)
        ? draft.colorimetrie.libelle || "Analysée"
        : "Pas encore analysée",
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
          <div className="w-[38px]" />
        )}
        <FilEtapes total={STEPS.length} courante={step} />
        <div className="w-[38px]" />
      </div>

      <div className="mt-[26px]">
        <div className="text-[11px] tracking-[.16em] uppercase text-terracotta">{meta.kicker}</div>
        <div className="font-serif text-[27px] leading-[1.15] text-ink mt-3">{meta.title}</div>
        <div className="text-[13px] text-muted mt-[10px] leading-[1.5]">{meta.subtitle}</div>
        {meta.key === "pal_couleurs" && draft.paletteCouleurs.length > 0 && (
          <div className="text-[12px] text-muted mt-[6px]">
            {draft.paletteCouleurs.length} / {MAX_PALETTE_COULEURS} sélectionnée
            {draft.paletteCouleurs.length > 1 ? "s" : ""}
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
          <input
            className="capin bg-card border border-border rounded-[14px] px-[17px] py-[15px] text-[14px] text-ink font-sans w-full"
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

      {meta.key === "pal_couleurs" && (
        <PaletteDots options={PAL_COULEURS} selected={draft.paletteCouleurs} onSelect={toggleCouleur} />
      )}

      {/* L'intensité seule, en cartes radio pleine largeur plutôt qu'en chips
          (maquette du 25/09) : quatre libellés longs en chips produisaient
          deux rangs irréguliers. `OptionRow` est le composant déjà utilisé
          par l'étape Genre — même marque de sélection, même hauteur. */}
      {meta.key === "pal_intensite" && (
        <div className="flex flex-col gap-[10px] mt-[26px]">
          {INTENSITE_OPTIONS.map((it: Intensite) => (
            <OptionRow
              key={it}
              label={it}
              on={draft.paletteIntensite === it}
              onClick={() => patch({ paletteIntensite: it })}
            />
          ))}
        </div>
      )}

      {meta.key === "colorimetrie" && (
        <EtapeColorimetrie
          colorimetrie={draft.colorimetrie}
          /* L'ÉTAPE AVANCE ELLE-MÊME, parce que le bouton générique est
             masqué ici : c'est elle qui porte ses sorties.
             Une analyse réussie enchaîne sur son résultat ; une erreur
             reste sur place, où l'écran propose de reprendre ou de passer —
             jamais d'avancer vers un résultat qui n'existe pas. */
          onResultat={(c: Colorimetrie) => {
            patch({ colorimetrie: c });
            if (colorimetrieUtilisable(c)) setStep(step + 1);
          }}
          onPasser={() => {
            patch({ colorimetrie: COLORIMETRIE_VIDE });
            setStep(step + 1);
          }}
        />
      )}

      {meta.key === "colorimetrie_resultat" && (
        <ResultatColorimetrie
          colorimetrie={draft.colorimetrie}
          onRefaire={() => {
            patch({ colorimetrie: COLORIMETRIE_VIDE });
            setStep(Math.max(0, step - 1));
          }}
        />
      )}

      {meta.key === "pal_recap" && (
        <div className="mt-6 bg-card border border-border rounded-[18px] p-[18px]">
          {recapRows.map((r) => (
            <div key={r.label} className="flex items-center gap-3 py-[11px] border-b border-border last:border-b-0">
              <span className="w-[70px] flex-shrink-0 text-[11px] tracking-[.16em] uppercase text-muted">{r.label}</span>
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
            </div>
          ))}
        </div>
      )}

      {meta.key === "taille" && (
        <div className="mt-[26px]">
          <div className="text-[11px] tracking-[.16em] uppercase text-muted mb-[11px]">Taille de haut</div>
          <div className="flex gap-2 flex-wrap">
            {TAILLES_HAUT.map((t) => (
              <button key={t} onClick={() => patch({ tailleHaut: t })} className={chipCls(draft.tailleHaut === t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-[22px] mb-[11px]">
            {tailleBasLabelFor(draft.gender)}
          </div>
          <div className="flex gap-2 flex-wrap">
            {taillesBas.map((t) => (
              <button key={t} onClick={() => patch({ tailleBas: t })} className={chipCls(draft.tailleBas === t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-[22px] mb-[11px]">Pointure</div>
          <input
            inputMode="numeric"
            className="capin bg-card border border-border rounded-[14px] px-[17px] py-[13px] text-[14px] text-ink font-sans w-[120px]"
            placeholder="Ex. 39"
            value={draft.pointure ?? ""}
            onChange={(e) => patch({ pointure: e.target.value.replace(/[^0-9]/g, "").slice(0, 2) || null })}
          />
        </div>
      )}

      {meta.key === "style" && (
        <div className="grid grid-cols-2 gap-[11px] mt-[26px]">
          {exposedStyleIds(draft.gender).map((id) => {
            const cfg = styleConfigFor(draft.gender)[id];
            const on = draft.styles[0] === id;
            return (
              <button
                key={id}
                onClick={() => selectStyle(id)}
                className={
                  // Épaisseur de bordure fixe (jamais 1px ↔ 2px) : seule la
                  // couleur change à la sélection, jamais la largeur, pour
                  // qu'aucune card ne bouge d'un pixel au clic (indépendant
                  // de box-sizing, garanti par construction).
                  "relative text-left rounded-[16px] overflow-hidden border-[1.5px] cursor-pointer flex flex-col " +
                  (on ? "border-terracotta" : "border-border")
                }
                style={{ background: on ? "#F6EBE2" : "#FBF8F3" }}
              >
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
                    backgroundColor: "#E6DCCB",
                    ...(cfg.asset ? { backgroundImage: `url(${cfg.asset})` } : {}),
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                />
                <span
                  className="absolute top-[9px] right-[9px] w-[21px] h-[21px] rounded-full flex items-center justify-center border-[1.5px]"
                  style={{ background: on ? "#A66950" : "#FFFFFF", borderColor: on ? "#A66950" : "#B08968" }}
                >
                  {on && (
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                      <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <div className="px-[13px] py-[11px]">
                  <div className="font-serif text-[15px] text-ink leading-[1.2]">{cfg.label}</div>
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
            <div className="bg-card border border-border rounded-[14px] px-4 py-[14px] mt-[10px] flex flex-col gap-[11px]">
              {MORPHOLOGIES.map((m) => (
                <div key={m}>
                  <div className="text-[12px] text-ink font-semibold">{MORPHOLOGY_LABELS[m]}</div>
                  <div className="text-[12px] text-muted mt-[2px] leading-[1.4]">{MORPHO_HINTS[m]}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {meta.key !== "pal_couleurs" && <div className="flex-1" />}
    </>
  );

  /**
   * L'ÉTAPE COLORIMÉTRIE PORTE SES PROPRES ACTIONS — « Prendre une photo »,
   * « Choisir une photo », « Passer pour l'instant », ou « Reprendre » selon
   * son état. Un « Continuer » générique en dessous serait une troisième
   * sortie, et la seule qui ne dirait pas ce qu'elle fait.
   */
  const continueButton = meta.key === "colorimetrie" ? null : (
    <button
      onClick={canContinue ? next : undefined}
      disabled={!canContinue}
      className={
        "mt-[22px] text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase " +
        (canContinue ? "cursor-pointer bg-terracotta active:bg-terracotta-hover text-cream" : "cursor-not-allowed bg-[#dccfbc] text-[#8a7c68]")
      }
    >
      {isLast
        ? state.profileSetupFromEdit
          ? "Enregistrer les modifications"
          : // « Commencer l'expérience » plutôt que « Terminer mon profil »
            // (maquette du 25/09) : ce qui compte à cet instant n'est pas ce
            // qu'on achève, c'est ce qui s'ouvre.
            "Commencer l'expérience"
        : "Continuer"}
    </button>
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
  if (meta.key === "pal_couleurs") {
    return (
      <div className="absolute inset-0 flex flex-col">
        <div className="scrollarea flex-1 overflow-y-auto px-7 pt-2 pb-6">{pageBody}</div>
        <div
          className="flex-shrink-0 px-7 bg-cream border-t border-border flex flex-col"
          style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
        >
          {continueButton}
        </div>
      </div>
    );
  }

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto flex flex-col px-7 pt-2 pb-7">
      {pageBody}
      {continueButton}
    </div>
  );
}
