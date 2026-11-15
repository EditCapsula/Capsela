"use client";

import type { CSSProperties, ReactNode } from "react";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import { SAISONS, SIGNATURE_AFFICHEE_MAX, colorimetrieUtilisable, estSaison } from "@/lib/colorimetrie";
import { libelleCoupes, libelleMiseEnValeur, miseEnValeurPosee } from "@/lib/preferencesSilhouette";
import {
  INTENSITE_VISUELS,
  MORPHOLOGY_LABELS,
  VISUELS_SILHOUETTE,
  genderLabel,
  paletteColorName,
  styleConfigFor,
  stylesDuGenre,
  visuelEtapeStyle,
  type Profile,
  type StyleId,
} from "@/lib/profile";
import { phraseCapsule, phraseSilhouette } from "@/lib/syntheseProfil";
import type { CapsuleSeason } from "@/lib/types";

/*
 * LA SYNTHÈSE DU PROFIL, ÉTAPE 6/7 DE L'ONBOARDING (15/11/2026, brief « Refonte UX/UI – Étape 6/7 : Synthèse du profil »). Le tableau
 * de paramètres (une ligne par réglage) devient cinq blocs : l'univers stylistique, la silhouette, la colorimétrie, les préférences,
 * puis la première capsule, qui fait la transition vers « Créer mon dressing ». Écran consultatif : chaque « Modifier » rouvre l'étape
 * concernée puis ramène ici (le mécanisme du récapitulatif, retourRecap dans ProfileSetupScreen, inchangé).
 *
 * Rien d'inventé : chaque bloc lit le brouillon du profil ; une donnée absente le dit (« à préciser ») ou ne s'affiche pas. LA SAISON
 * COLORIMÉTRIQUE (le questionnaire, `colorimetrie`) et LES COULEURS PRÉFÉRÉES (`paletteCouleurs`) restent dans deux blocs distincts,
 * avec leurs mots à elles ; « Ta palette » (le mélange des deux, paletteCapsela) n'est plus affichée ici pour ne pas les confondre. La
 * saison de la capsule est une saison VESTIMENTAIRE, celle de l'écran Capsule (`capsuleSeason || currentSeasonKey()`), reçue de l'écran.
 *
 * Briques existantes : Card, Badge, les miniatures de styles (visuelEtapeStyle, comme MesStylesSelectionnes), les visuels de
 * silhouette de l'étape 3, les pastilles d'intensité (INTENSITE_VISUELS). Animations : `capsule-apparition` et `coche-style`
 * (globals.css), en `motion-safe` seulement — un téléphone qui demande moins d'animations voit l'écran d'emblée.
 */

const ENTREE = "motion-safe:animate-[capsule-apparition_360ms_ease-out_both]";
const delai = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

function Pastille({ hex, taille, delaiMs }: { hex: string; taille: number; delaiMs: number }) {
  return (
    <span
      aria-hidden="true"
      className="block rounded-full flex-shrink-0 motion-safe:animate-[coche-style_260ms_ease-out_both]"
      style={{ width: taille, height: taille, background: hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.10)", ...delai(delaiMs) }}
    />
  );
}

/** L'en-tête d'un bloc : son surtitre, et « Modifier » à droite quand l'étape existe dans le parcours. */
function Bloc({
  titre,
  modifier,
  libelleAction = "Modifier",
  aria,
  delaiMs,
  className = "",
  children,
}: {
  titre: string;
  modifier?: () => void;
  libelleAction?: string;
  aria: string;
  delaiMs: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card as="section" aria-label={titre} className={`mt-3 px-[18px] pt-[6px] pb-[18px] ${ENTREE} ${className}`} style={delai(delaiMs)}>
      <div className="flex items-center justify-between gap-3 min-h-[44px]">
        <h2 className="t-surtitre text-terracotta">{titre}</h2>
        {modifier && (
          <button type="button" onClick={modifier} aria-label={aria} className="min-h-[44px] -mr-2 px-2 text-[12.5px] font-semibold text-terracotta cursor-pointer">
            {libelleAction}
          </button>
        )}
      </div>
      {children}
    </Card>
  );
}

export default function SyntheseProfil({
  profil,
  saisonCapsule,
  modifiable,
  onModifier,
  onVoirCapsule,
}: {
  profil: Profile;
  /** La saison vestimentaire de la première capsule, déterminée par l'écran (règle de l'écran Capsule). */
  saisonCapsule: CapsuleSeason;
  /** L'étape existe dans le parcours de ce profil (la silhouette n'est posée qu'aux profils femme, etc.). */
  modifiable: (etape: string) => boolean;
  onModifier: (etape: string) => void;
  /** Termine le parcours et ouvre l'écran Capsule (absent en modification depuis Mon profil). */
  onVoirCapsule?: () => void;
}) {
  const g = profil.gender;
  const modif = (etape: string) => (modifiable(etape) ? () => onModifier(etape) : undefined);
  const config = styleConfigFor(g);
  const styles = stylesDuGenre(profil.styles, g) as StyleId[];
  const silhouettePosee = g === "femme";
  const c = profil.colorimetrie;
  const coloFaite = colorimetrieUtilisable(c);
  const saison = coloFaite && estSaison(c.saison) ? SAISONS[c.saison] : null;
  const signature = coloFaite ? (c.signature ?? []).slice(0, SIGNATURE_AFFICHEE_MAX) : [];
  const neutres = coloFaite ? (c.neutres ?? []) : [];
  const intensite = profil.paletteIntensite ? INTENSITE_VISUELS[profil.paletteIntensite] : null;
  const miseEnValeur = miseEnValeurPosee(g) ? libelleMiseEnValeur(profil.preferencesSilhouette.miseEnValeur, g) : null;
  const coupes = libelleCoupes(profil.preferencesSilhouette.coupes);
  const tailles = [genderLabel(g), profil.tailleHaut, profil.tailleBas, profil.pointure].filter(Boolean).join(" · ");
  const meteo = profil.prefs.geoConsent && profil.prefs.weatherFromGeo ? "Ta position" : profil.city || null;

  // Les blocs entrent l'un après l'autre, 70 ms d'écart : tout est en place en moins d'une demi-seconde.
  let k = 0;
  const suivant = () => (k++) * 70;

  /** Une préférence : une tuile compacte, toute entière le bouton de modification de son étape. */
  const tuile = (cle: string, libelle: string, valeur: ReactNode, etape: string, large = false) => {
    const action = modif(etape);
    const contenu = (
      <>
        <span className="block t-surtitre text-muted">{libelle}</span>
        <span className="block mt-[5px] text-[12.5px] leading-[1.35] text-ink">{valeur}</span>
      </>
    );
    const cls = `rounded-bloc bg-warm-bg px-[12px] py-[10px] text-left ${large ? "col-span-2" : ""}`;
    return action ? (
      <button key={cle} type="button" onClick={action} aria-label={`Modifier : ${libelle}`} className={cls + " cursor-pointer active:opacity-80"}>
        {contenu}
      </button>
    ) : (
      <div key={cle} className={cls}>
        {contenu}
      </div>
    );
  };

  return (
    <div className="mt-4">
      {/* 1. L'UNIVERS STYLISTIQUE : les styles choisis, dans l'ordre du choix, en pastilles à miniature (celles de « Mes styles
          sélectionnés »), qui entrent l'une après l'autre. */}
      <Bloc titre="Ton univers stylistique" modifier={modif("style")} aria="Modifier mes styles" delaiMs={suivant()}>
        {styles.length ? (
          <ul className="flex flex-wrap gap-[8px] list-none p-0 m-0">
            {styles.map((s, i) => {
              const mini = visuelEtapeStyle(g, s);
              return (
                <li
                  key={s}
                  className="inline-flex items-center gap-[7px] min-h-[40px] pl-[4px] pr-[13px] rounded-full border border-border bg-cream text-[13px] text-ink motion-safe:animate-[coche-style_260ms_ease-out_both]"
                  style={delai(120 + i * 90)}
                >
                  <span className="w-[30px] h-[30px] rounded-full overflow-hidden bg-border flex-shrink-0">
                    {mini && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mini} alt="" width={30} height={40} decoding="async" className="w-full h-full object-cover block" />
                    )}
                  </span>
                  {config[s]?.label ?? s}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">À choisir.</p>
        )}
      </Bloc>

      {/* 2. LA SILHOUETTE, mise en valeur : son visuel de l'étape 3 (contour au trait, le même pour toutes), son nom, ce qu'elle change.
          Profils femme seulement, comme l'étape : ailleurs elle n'est pas posée. */}
      {silhouettePosee && (
        <Bloc titre="Ta silhouette" modifier={modif("morpho")} aria="Modifier ma silhouette" delaiMs={suivant()}>
          {profil.morphology ? (
            <div className="flex items-center gap-4">
              {VISUELS_SILHOUETTE[profil.morphology] && (
                <div className="w-[84px] flex-none rounded-tuile overflow-hidden bg-photo-bg" style={{ aspectRatio: "3 / 4" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={VISUELS_SILHOUETTE[profil.morphology]} alt="" width={300} height={400} decoding="async" className="w-full h-full object-cover block" />
                </div>
              )}
              <div className="min-w-0">
                <div className="t-titre-carte text-ink">{MORPHOLOGY_LABELS[profil.morphology]}</div>
                <p className="text-[12.5px] text-muted leading-[1.45] mt-[6px]">{phraseSilhouette(profil.morphology)}</p>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-muted">À préciser.</p>
          )}
        </Bloc>
      )}

      {/* 3. LA COLORIMÉTRIE : la saison calculée par le questionnaire, son intitulé exact, ses couleurs signature et ses neutres.
          Pas faite : on le dit, avec l'accès au test — jamais une saison supposée. */}
      <Bloc titre="Ta colorimétrie" modifier={modif("colorimetrie")} libelleAction={coloFaite ? "Modifier" : "Faire le test"} aria={coloFaite ? "Modifier ma colorimétrie" : "Faire le test de colorimétrie"} delaiMs={suivant()}>
        {coloFaite ? (
          <>
            <div className="t-titre-carte text-ink">{c.libelle || saison?.libelle}</div>
            {signature.length > 0 && (
              <div className="flex flex-wrap gap-[8px] mt-[12px]" role="img" aria-label={`Couleurs signature : ${signature.map(paletteColorName).filter(Boolean).join(", ")}`}>
                {signature.map((h, i) => (
                  <Pastille key={h} hex={h} taille={34} delaiMs={220 + i * 60} />
                ))}
              </div>
            )}
            {neutres.length > 0 && (
              <div className="flex items-center gap-[6px] mt-[10px]" role="img" aria-label={`Neutres : ${neutres.map(paletteColorName).filter(Boolean).join(", ")}`}>
                <span className="text-[11.5px] text-muted mr-[2px]">Neutres</span>
                {neutres.map((h, i) => (
                  <Pastille key={h} hex={h} taille={18} delaiMs={220 + (signature.length + i) * 60} />
                ))}
              </div>
            )}
            <p className="text-[12.5px] text-muted leading-[1.45] mt-[12px]">Ta colorimétrie guide le choix des couleurs qui valorisent ton teint dans tes tenues.</p>
          </>
        ) : (
          <p className="text-[13px] text-muted leading-[1.45]">Pas encore définie. Quelques questions, sans photo, suffisent pour connaître les couleurs qui te mettent en valeur.</p>
        )}
      </Bloc>

      {/* 4. LES PRÉFÉRENCES : des tuiles compactes, chacune ouvrant son étape — les couleurs préférées ici, déclarées, distinctes de la
          saison au-dessus. */}
      <Bloc titre="Tes préférences" aria="" delaiMs={suivant()}>
        <div className="grid grid-cols-2 gap-[8px]">
          {miseEnValeurPosee(g) && tuile("mev", "Mise en valeur", miseEnValeur ?? "Non précisée", "mise_en_valeur")}
          {tuile("coupes", "Coupes", coupes ?? "À choisir", "coupes", !miseEnValeurPosee(g))}
          {tuile(
            "couleurs",
            "Couleurs préférées",
            profil.paletteCouleurs.length ? (
              <span className="flex flex-wrap gap-[5px] mt-[2px]" role="img" aria-label={profil.paletteCouleurs.map(paletteColorName).filter(Boolean).join(", ")}>
                {profil.paletteCouleurs.map((h, i) => (
                  <Pastille key={h} hex={h} taille={18} delaiMs={360 + i * 50} />
                ))}
              </span>
            ) : (
              "À choisir"
            ),
            "pal_couleurs"
          )}
          {tuile("intensite", "Intensité", intensite?.libelleRecap ?? profil.paletteIntensite ?? "Non précisée", "pal_couleurs")}
          {tuile("genre", "Genre et tailles", tailles || "À préciser", "genre")}
          {tuile("meteo", "Météo", meteo ?? "Ville non renseignée", "meteo")}
        </div>
      </Bloc>

      {/* 5. LA PREMIÈRE CAPSULE : le bloc éditorial de la transition, sur le fond des cartes de look (hero), qui entre en dernier.
          La saison est vestimentaire — jamais la saison colorimétrique. */}
      <section
        aria-label="Ta première capsule"
        className={`mt-3 rounded-carte px-[18px] py-[18px] ${ENTREE}`}
        style={{ background: "var(--color-hero-background)", ...delai(suivant() + 60) }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="t-surtitre text-terracotta-deep">Ta première capsule</h2>
          <Badge tone="plein">{saisonCapsule}</Badge>
        </div>
        <p className="t-titre-carte text-ink mt-[10px]">Ta première capsule sera celle de la saison en cours.</p>
        <p className="text-[12.5px] text-ink-soft leading-[1.5] mt-[6px]">{phraseCapsule({ morphology: silhouettePosee ? profil.morphology : null, nbCouleurs: profil.paletteCouleurs.length })}</p>
        {/* LE LIEN VERS LA CAPSULE (15/11/2026, demandé) : la capsule de cette saison, sur l'écran Capsule — le parcours se termine
            d'abord (profil enregistré), comme « Créer mon dressing ». */}
        {onVoirCapsule && (
          <button type="button" onClick={onVoirCapsule} className="mt-[6px] -ml-1 px-1 min-h-[44px] text-[13px] font-semibold text-terracotta-deep cursor-pointer">
            Voir ma capsule →
          </button>
        )}
      </section>
    </div>
  );
}
