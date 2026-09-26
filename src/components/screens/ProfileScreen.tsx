"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import {
  FeuilleVille,
  GenderModal,
  I_CINTRE,
  I_ETINCELLE,
  I_GENRE,
  I_GRAPHIQUE,
  I_METRE,
  I_PALETTE,
  I_SILHOUETTE,
  Icone,
  LigneInfo,
  LigneProfil,
  PastillesPalette,
  RevalidationSheet,
  Surtitre,
} from "@/components/ProfilUI";
import { useAuth } from "@/lib/auth";
import { morphologieOrienteLaSelection } from "@/lib/capsule";
import {
  GENDER_DEPENDENT_FIELDS,
  applyGenderChange,
  champsProfilStyle,
  completudeProfil,
  fieldNeedsRevalidation,
  genderLabel,
  morphologyLabel,
  styleLabel,
  type ChampProfilStyle,
  type Gender,
  type GenderDependentField,
} from "@/lib/profile";
import { journalEntries } from "@/lib/selectors";
import { useCapsela } from "@/lib/store";

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
 *   Ma capsule       pièces → Dressing ; looks portés → Journal
 *   Ta météo         la ville (feuille), qui sert à la météo
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

/** « ton genre, ta palette et tes tailles » — les champs manquants, dits en toutes lettres. */
const ARTICLE: Record<ChampProfilStyle, string> = {
  genre: "ton genre",
  style: "ton style",
  morphologie: "ta silhouette",
  palette: "ta palette",
  tailles: "tes tailles",
};
function enumerer(mots: string[]): string {
  return mots.length <= 1 ? mots.join("") : mots.slice(0, -1).join(", ") + " et " + mots[mots.length - 1];
}

export default function ProfileScreen() {
  const { profile, email, demoMode, saveProfile } = useAuth();
  const { state, actions, vestiairePool } = useCapsela();
  const [genreOuvert, setGenreOuvert] = useState(false);
  const [aRevalider, setARevalider] = useState<GenderDependentField | null>(null);
  const [villeOuverte, setVilleOuverte] = useState(false);

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

  // TON CAPSELA — les mêmes comptes que les écrans qui les détaillent : le
  // dressing réel pour les pièces, les tenues portées du Journal (entrées
  // dont les pièces se résolvent) pour les looks.
  const nbPieces = state.items.length;
  const nbLooks = journalEntries(state.history, [...state.items, ...vestiairePool]).length;

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
      <div className="bg-card border border-border rounded-[20px] p-4 mt-5 flex items-center gap-[14px]">
        <div className="w-[52px] h-[52px] rounded-full bg-terracotta flex items-center justify-center flex-shrink-0">
          <span className="font-serif text-[21px] text-cream">{initial}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className={"t-titre-carte break-words " + (profile.displayName ? "text-ink" : "text-placeholder")}>
            {profile.displayName || "Ton nom"}
          </div>
          <div className="text-[12px] text-muted mt-[2px]">{demoMode ? "Mode démo — les données restent sur cet appareil" : "Compte personnel"}</div>
          <div className="text-[12px] text-muted-3 mt-[1px] [overflow-wrap:anywhere]">{email ?? "E-mail non renseigné"}</div>
          <button
            onClick={actions.goAccount}
            className="mt-[8px] rounded-full border border-terracotta text-terracotta text-[12px] px-[14px] cursor-pointer"
            style={{ minHeight: 32 }}
          >
            Gérer mon compte ›
          </button>
        </div>
      </div>

      {toRevalidate && (
        <button
          onClick={() => ouvrirChamp("morphologie")}
          className="w-full text-left bg-[#F6EBE2] border border-terracotta rounded-2xl p-4 mt-5 cursor-pointer"
        >
          <div className="t-surtitre text-terracotta">À compléter</div>
          <div className="text-[13px] text-ink mt-[6px]">{toRevalidate.fieldLabel} est à mettre à jour.</div>
        </button>
      )}

      <Surtitre icone={I_ETINCELLE}>Ton style</Surtitre>
      <div className="bg-card border border-border rounded-[20px] overflow-hidden">
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
          valeur={styleLabel(profile.styles[0], profile.gender) || "Non renseigné"}
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
      </div>

      {/* MES TAILLES — une ligne par taille, toutes ouvrent l'étape « taille »
          du questionnaire (les trois s'y règlent ensemble). */}
      <Surtitre icone={I_METRE}>Mes tailles</Surtitre>
      <div className="bg-card border border-border rounded-[20px] overflow-hidden">
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
      </div>
      <div className="text-[12px] text-muted leading-[1.45] mt-[8px] px-1">Pré-remplies quand tu ajoutes une pièce.</div>

      {/* COMPLÉTUDE — seulement quand il manque quelque chose (le pourcentage
          est calculé : champs applicables renseignés / applicables). Le
          bouton ouvre directement le premier champ manquant : il n'y a plus
          d'écran d'édition intermédiaire (recette du 26/09/2026). */}
      {completude.manquants.length > 0 ? (
        <div className="mt-4 bg-warm-bg border border-warm-border rounded-[20px] p-4">
          <div className="flex items-start gap-[12px]">
            <span className="w-9 h-9 flex-shrink-0 rounded-full bg-card text-terracotta flex items-center justify-center">
              <Icone taille={17}>{I_GRAPHIQUE}</Icone>
            </span>
            <div className="min-w-0 flex-1">
              <div className="t-titre-carte text-ink">
                Ton profil est <span className="italic text-terracotta">presque prêt</span>
              </div>
              <div className="text-[12px] text-warm-text-2 leading-[1.45] mt-[4px]">
                Il manque {enumerer(completude.manquants.map((m) => ARTICLE[m.cle]))} pour que ton profil soit complet.
              </div>
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
          <button
            onClick={() => ouvrirChamp(completude.manquants[0].cle)}
            className="mt-[14px] w-full rounded-full bg-terracotta-deep text-cream t-bouton cursor-pointer"
            style={{ minHeight: 44 }}
          >
            Compléter mon profil
          </button>
        </div>
      ) : null}

      {/* TON CAPSELA — consultatif. Les pièces mènent au Dressing ; les looks
          au Journal seulement s'il y a un historique à y lire. */}
      <Surtitre icone={I_CINTRE}>Ma capsule</Surtitre>
      <div className="grid grid-cols-2 gap-[10px]">
        <button onClick={actions.goWardrobe} className="bg-card border border-border rounded-[20px] p-4 text-center cursor-pointer">
          <div className="t-chiffre text-ink">{nbPieces}</div>
          <div className="text-[12px] text-muted mt-[6px]">{nbPieces <= 1 ? "pièce dans ton dressing" : "pièces dans ton dressing"}</div>
        </button>
        {nbLooks > 0 ? (
          <button onClick={actions.goHistory} className="bg-card border border-border rounded-[20px] p-4 text-center cursor-pointer">
            <div className="t-chiffre text-ink">{nbLooks}</div>
            <div className="text-[12px] text-muted mt-[6px]">{nbLooks <= 1 ? "look porté" : "looks portés"}</div>
          </button>
        ) : (
          <div className="bg-card border border-border rounded-[20px] p-4 text-center">
            <div className="t-chiffre text-ink">0</div>
            <div className="text-[12px] text-muted mt-[6px]">look porté</div>
          </div>
        )}
      </div>
      <button
        onClick={actions.goWardrobe}
        className="mt-[10px] w-full bg-card border border-border rounded-[20px] min-h-[46px] text-[12px] text-terracotta cursor-pointer"
      >
        Compléter mon dressing ›
      </button>

      {/* TA MÉTÉO — la ville sert à la météo quand la position n'est pas
          disponible : elle agit sur les recommandations, elle est donc ici. */}
      <Surtitre icone={I_GRAPHIQUE}>Ta météo</Surtitre>
      <div className="bg-card border border-border rounded-[20px] overflow-hidden">
        <LigneInfo label="Ville" valeur={profile.city || "Non renseignée"} renseigne={Boolean(profile.city)} onClick={() => setVilleOuverte(true)} />
      </div>

      {/* PRÉFÉRENCES CAPSELA — le fonctionnement de l'app, pas l'identité :
          elles ont leur propre écran. */}
      <Surtitre icone={I_GRAPHIQUE}>Préférences Capsela</Surtitre>
      <button
        onClick={actions.goPreferences}
        className="w-full flex items-center gap-[13px] bg-card border border-border rounded-[20px] px-4 py-[14px] text-left cursor-pointer"
      >
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] text-ink">Réglages de l&apos;application</span>
          <span className="block text-[12px] text-muted leading-[1.4] mt-[2px]">Notifications, météo, localisation et habitudes</span>
        </span>
        <span aria-hidden="true" className="text-placeholder text-[15px] flex-shrink-0">›</span>
      </button>

      <FeuilleVille open={villeOuverte} onClose={() => setVilleOuverte(false)} />
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
