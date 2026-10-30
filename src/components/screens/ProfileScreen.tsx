"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import {
  GenderModal,
  I_CINTRE,
  I_COURONNE,
  I_ETINCELLE,
  I_GENRE,
  I_GRAPHIQUE,
  I_METRE,
  I_PALETTE,
  I_REGLAGES,
  I_REPERE,
  I_SILHOUETTE,
  Icone,
  LigneInfo,
  LigneProfil,
  PastillesPalette,
  RevalidationSheet,
  Surtitre,
} from "@/components/ProfilUI";
import { libelleMembreDepuis } from "@/lib/membreDepuis";
import { useAuth } from "@/lib/auth";
import { morphologieOrienteLaSelection } from "@/lib/capsule";
import {
  GENDER_DEPENDENT_FIELDS,
  applyGenderChange,
  champsProfilStyle,
  completudeProfil,
  prochaineActionProfil,
  VISUELS_ETAPE_STYLE_FEMME,
  styleConfigFor,
  type StyleId,
  fieldNeedsRevalidation,
  genderLabel,
  morphologyLabel,
  libelleStyles,
  type ChampProfilStyle,
  type Gender,
  type GenderDependentField,
} from "@/lib/profile";
import { useCapsela } from "@/lib/store";
import Button from "@/components/Button";
import Card from "@/components/Card";

/*
 * MON PROFIL — « qu'est-ce que Capsela doit savoir sur moi pour mieux me
 * conseiller ? » (recette du 26/09/2026). Il fond l'ancien couple « Ton
 * profil » (consultation) + « Personnaliser mon profil » (édition), qui
 * affichaient les mêmes informations deux fois : chaque ligne s'édite ici,
 * directement.
 *
 *   Ton style        Genre (feuille), Style, Morphologie, Palette (étapes du
 *                    questionnaire, retour ici)
 *   Mes tailles      Haut, Bas, Chaussures (étape « taille », retour ici)
 *   Ta météo         la ville et ce qu'elle fait (→ Préférences)
 *   (Mon abonnement, sous l'identité ; « Ma capsule » retirée le 27/09/2026)
 *   Préférences      réglages de fonctionnement de l'app
 *
 * L'ADMINISTRATIF VIT DANS MON COMPTE (« Gérer mon compte ») : e-mail, mot de
 * passe, prénom, date de naissance, données, légal, suppression, déconnexion.
 *
 * CHAQUE PHRASE « À QUOI ÇA SERT » A ÉTÉ VÉRIFIÉE DANS LE CODE (refonte du
 * 25/09) : la morphologie n'oriente la sélection que pour deux silhouettes
 * (morphologieOrienteLaSelection) ; les tailles ne filtrent aucune
 * suggestion, elles pré-remplissent l'ajout d'une pièce.
 */

export default function ProfileScreen() {
  const { profile, email, inscritLe, demoMode, saveProfile, profileLoaded } = useAuth();
  const membreDepuis = libelleMembreDepuis(inscritLe);
  const { state, actions, etatPremium } = useCapsela();
  const [genreOuvert, setGenreOuvert] = useState(false);
  const [aRevalider, setARevalider] = useState<GenderDependentField | null>(null);

  const initial = (profile.displayName || email || "C").trim().charAt(0).toUpperCase() || "C";

  /* Le genre se modifie par le mécanisme existant — la feuille et la
     revalidation de l'écran d'édition (applyGenderChange) — et non par
     l'étape « genre » de l'onboarding, qui ne revalide rien. */
  const changerGenre = (g: Gender) => {
    setGenreOuvert(false);
    if (g === profile.gender) return;
    const { patch, revalidate } = applyGenderChange(profile, g);
    saveProfile({ ...profile, ...patch });
    if (revalidate) setARevalider(revalidate);
  };

  const champs = champsProfilStyle(profile);
  const renseigne = (cle: ChampProfilStyle) => champs.find((c) => c.cle === cle)?.renseigne ?? false;
  const completude = completudeProfil(profile);
  const prochaine = prochaineActionProfil(profile);
  const morphologieApplicable = champs.some((c) => c.cle === "morphologie");
  const toRevalidate = GENDER_DEPENDENT_FIELDS.find((f) => fieldNeedsRevalidation(f, profile));

  // Accès direct à UNE information : son éditeur, puis retour ici
  // (profileSetupReturn retient l'écran d'appel).
  const ouvrirChamp = (cle: ChampProfilStyle) => {
    if (cle === "genre") setGenreOuvert(true);
    else if (cle === "style") actions.goProfileSetup("style", true);
    else if (cle === "morphologie") actions.goProfileSetup("morpho", true);
    else if (cle === "palette") actions.goProfileSetup("pal_couleurs", true);
    else actions.goProfileSetup("taille", true);
  };

  // L'offre, telle que premium.ts la lit (27/09/2026) — « inconnu » n'est
  // jamais affiché comme « Gratuit » : on ne dit pas ce qu'on ne sait pas.
  const offre = etatPremium === "premium" ? "Premium" : etatPremium === "gratuit" ? "Gratuit" : null;
  // Ce que la ville fait réellement (store : choisirMeteo) — elle ne donne la
  // météo que si la position n'est pas utilisée ou pas disponible.
  const meteoDeLaPosition = profile.prefs.geoConsent && profile.prefs.weatherFromGeo;

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      <AppHeader showAvatar={false} onBack={() => actions.go(state.profileReturn)} backLabel="Revenir à l'écran précédent" />
      <div className="t-surtitre text-muted mt-[18px]">Profil</div>
      <div className="t-titre-ecran text-ink mt-[6px]">
        Mon <span className="italic text-terracotta">profil</span>
      </div>
      <div className="t-chapeau text-muted-3 mt-[8px]">Tout ce qui aide Capsela à mieux te conseiller.</div>

      {/* IDENTITÉ — « Gérer mon compte » mène au compte, jamais à l'édition du
          profil : ce sont deux espaces différents. */}
      <Card className="p-4 mt-5 flex items-center gap-[14px]">
        <div className="w-[52px] h-[52px] rounded-full bg-terracotta flex items-center justify-center flex-shrink-0">
          <span className="font-serif text-[21px] text-cream">{initial}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className={"t-titre-carte break-words " + (profile.displayName ? "text-ink" : "text-placeholder")}>
            {profile.displayName || "Ton nom"}
          </div>
          <div className="text-[12px] text-muted-3 mt-[2px] [overflow-wrap:anywhere]">{email ?? "E-mail non renseigné"}</div>
          {/* Ligne secondaire sous l'e-mail (15/10/2026, demandé). Sans date d'inscription connue, rien. */}
          {membreDepuis && <div className="text-[12px] text-muted mt-[1px]">{membreDepuis}</div>}
          {demoMode && <div className="text-[12px] text-muted mt-[1px]">Mode démo — les données restent sur cet appareil</div>}
          <button
            onClick={actions.goAccount}
            className="mt-[8px] rounded-full border border-terracotta text-terracotta text-[12px] px-[14px] cursor-pointer"
            style={{ minHeight: 32 }}
          >
            Gérer mon compte ›
          </button>
        </div>
      </Card>

      {/* MON ABONNEMENT (27/09/2026) — l'emplacement de la gestion de l'offre,
          sans prix ni relance : une ligne sobre sous l'identité, qui ouvre
          l'écran Premium existant. */}
      <Card className="overflow-hidden mt-3">
        <LigneProfil
          icone={I_COURONNE}
          titre="Mon abonnement"
          valeur={<span className="text-muted-3">{offre ? `Offre actuelle · ${offre}` : "Offre en cours de vérification"}</span>}
          renseigne
          onClick={() => actions.goPremium()}
        />
      </Card>

      {toRevalidate && (
        <button
          onClick={() => ouvrirChamp("morphologie")}
          className="w-full text-left bg-selected-bg border border-terracotta rounded-tuile p-4 mt-5 cursor-pointer"
        >
          <div className="t-surtitre text-terracotta">À compléter</div>
          <div className="text-[13px] text-ink mt-[6px]">{toRevalidate.fieldLabel} est à mettre à jour.</div>
        </button>
      )}

      <Surtitre icone={I_ETINCELLE}>Mon profil stylistique</Surtitre>
      {/* COMPLÉTUDE (12/10/2026) — la PROCHAINE information manquante, dite avec son intérêt, et un bouton qui ouvre directement son éditeur
          (prochaineActionProfil, profile.ts : mêmes champs et même pourcentage que completudeProfil, rien d'écrit en dur par état). Tant que
          le profil n'est pas chargé, rien : un pourcentage calculé sur un profil vide serait faux. Profil complet : une confirmation discrète.
          Remonté sous le surtitre « Mon profil stylistique », avant ses lignes, et titré « presque complet » au lieu de « presque prêt »
          (15/10/2026, demandé). */}
      {!profileLoaded ? null : prochaine ? (
        <div className="mb-3 bg-warm-bg border border-warm-border rounded-carte p-4">
          <div className="flex items-start gap-[12px]">
            <span className="w-9 h-9 flex-shrink-0 rounded-full bg-card text-terracotta flex items-center justify-center">
              <Icone taille={17}>{I_GRAPHIQUE}</Icone>
            </span>
            <div className="min-w-0 flex-1">
              {/* À 0 %, « presque complet » serait faux : « Complète ton profil » (15/10/2026, demandé). */}
              <div className="t-titre-carte text-ink">
                {completude.pourcentage === 0 ? (
                  <>
                    Complète ton <span className="italic text-terracotta">profil</span>
                  </>
                ) : (
                  <>
                    Ton profil est <span className="italic text-terracotta">presque complet</span>
                  </>
                )}
              </div>
              <div className="text-[13px] text-warm-text-2 leading-[1.45] mt-[4px]">{prochaine.message}</div>
              <div className="flex items-center gap-[10px] mt-[10px]">
                <div
                  className="flex-1 h-[6px] rounded-full bg-card overflow-hidden"
                  role="progressbar"
                  aria-valuenow={completude.pourcentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Complétude du profil"
                >
                  <div className="h-full rounded-full bg-terracotta" style={{ width: `${completude.pourcentage}%` }} />
                </div>
                <span className="text-[12px] text-terracotta flex-shrink-0">{completude.pourcentage} %</span>
              </div>
            </div>
          </div>
          <Button variante="principal" className="mt-[14px]" onClick={() => ouvrirChamp(prochaine.cle)}>
            {prochaine.cta}
          </Button>
        </div>
      ) : (
        <div className="mb-3 flex items-center gap-[10px] px-1 text-[12px] text-muted-3" role="status">
          <span aria-hidden="true" className="w-[18px] h-[18px] rounded-full bg-success-bg text-success flex items-center justify-center text-[11px]">✓</span>
          Ton profil est complet.
        </div>
      )}

      <Card className="overflow-hidden">
        <LigneProfil
          icone={I_GENRE}
          titre="Genre"
          valeur={genderLabel(profile.gender) || "Non renseigné"}
          renseigne={renseigne("genre")}
          explication="Nous adaptons les pièces et les styles proposés."
          onClick={() => ouvrirChamp("genre")}
        />
        <LigneProfil
          icone={I_CINTRE}
          titre="Style"
          valeur={
            <span className="flex items-center gap-[10px]">
              {/* Les visuels de l'étape « Style » : flat lays femme ; côté homme, ceux fournis le 30/10/2026 (STYLE_CONFIG). */}
              {profile.styles.slice(0, 2).map((id) => {
                const visuel =
                  profile.gender === "homme" ? styleConfigFor("homme")[id as StyleId]?.asset : VISUELS_ETAPE_STYLE_FEMME[id as keyof typeof VISUELS_ETAPE_STYLE_FEMME];
                return visuel ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={id} src={visuel} alt="" width={30} height={40} loading="lazy" className="w-[30px] h-[40px] rounded-[6px] object-cover flex-shrink-0" />
                ) : null;
              })}
              <span>{libelleStyles(profile.styles, profile.gender) || "Non renseigné"}</span>
            </span>
          }
          renseigne={renseigne("style")}
          explication="Définit l'univers de tes recommandations."
          onClick={() => ouvrirChamp("style")}
        />
        {/* Côté Homme, la taxonomie de silhouette n'est pas activée : pas de
            ligne, plutôt qu'un « Non renseignée » qu'aucun écran ne remplirait. */}
        {morphologieApplicable && (
          <LigneProfil
            icone={I_SILHOUETTE}
            titre="Morphologie"
            valeur={renseigne("morphologie") ? morphologyLabel(profile.morphology) : "Non renseignée"}
            renseigne={renseigne("morphologie")}
            explication={
              morphologieOrienteLaSelection(profile.morphology)
                ? "Oriente les coupes et proportions de ta capsule."
                : "Décrit ta silhouette, sans rien t'imposer."
            }
            onClick={() => ouvrirChamp("morphologie")}
          />
        )}
        <LigneProfil
          icone={I_PALETTE}
          titre="Palette"
          valeur={<PastillesPalette couleurs={profile.paletteCouleurs} />}
          renseigne={renseigne("palette")}
          explication="Oriente les couleurs de ta capsule et de tes tenues."
          onClick={() => ouvrirChamp("palette")}
        />
      </Card>

      {/* MES TAILLES — une ligne par taille, toutes ouvrent l'étape « taille »
          du questionnaire (les trois s'y règlent ensemble). */}
      <Surtitre icone={I_METRE}>Mes tailles</Surtitre>
      <Card className="overflow-hidden">
        <LigneInfo
          label="Haut"
          valeur={profile.tailleHaut || "Non renseignée"}
          renseigne={Boolean(profile.tailleHaut)}
          onClick={() => ouvrirChamp("tailles")}
        />
        <LigneInfo label="Bas" valeur={profile.tailleBas || "Non renseignée"} renseigne={Boolean(profile.tailleBas)} onClick={() => ouvrirChamp("tailles")} />
        <LigneInfo
          label="Chaussures"
          valeur={profile.pointure || "Non renseignée"}
          renseigne={Boolean(profile.pointure)}
          onClick={() => ouvrirChamp("tailles")}
        />
      </Card>
      <div className="text-[12px] text-muted leading-[1.45] mt-[8px] px-1">Pré-remplies quand tu ajoutes une pièce.</div>

      {/* « MA CAPSULE » RETIRÉE (27/09/2026) : pièces et looks portés ont leurs
          espaces (Dressing, Journal) ; le profil reste ce que Capsela sait de
          toi. Aucune donnée n'est supprimée, seul l'affichage quitte l'écran. */}

      {/* TA MÉTÉO — informative : la ville, et ce qu'elle fait vraiment ; les
          réglages (géolocalisation, météo de la position, ville) vivent dans
          Préférences Capsela, que la ligne ouvre. */}
      <Surtitre icone={I_GRAPHIQUE}>Mon lieu et ma météo</Surtitre>
      <Card className="overflow-hidden">
        <LigneProfil
          icone={I_REPERE}
          titre={profile.city || "Ville non renseignée"}
          valeur={
            <span className="text-muted-3">
              {meteoDeLaPosition
                ? "Relais de ta position quand elle n'est pas disponible."
                : "Météo utilisée pour tes recommandations."}
            </span>
          }
          renseigne
          onClick={() => actions.goPreferences("localisation")}
        />
      </Card>

      {/* PRÉFÉRENCES CAPSELA — le fonctionnement de l'app, pas l'identité :
          elles ont leur propre écran. */}
      <Surtitre icone={I_GRAPHIQUE}>Préférences Capsela</Surtitre>
      <Card className="overflow-hidden">
        <LigneProfil
          icone={I_REGLAGES}
          titre="Réglages de l'application"
          valeur={<span className="text-muted-3">Notifications, météo, localisation et habitudes.</span>}
          renseigne
          onClick={() => actions.goPreferences()}
        />
      </Card>

      {genreOuvert && <GenderModal current={profile.gender} onSelect={changerGenre} onClose={() => setGenreOuvert(false)} />}
      {aRevalider && (
        <RevalidationSheet
          field={aRevalider}
          onDismiss={() => setARevalider(null)}
          onEdit={() => {
            setARevalider(null);
            actions.goProfileSetup(aRevalider.key === "morphology" ? "morpho" : "style", true);
          }}
        />
      )}
    </div>
  );
}
