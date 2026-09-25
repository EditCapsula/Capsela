"use client";

import { useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import { GenderModal, RevalidationSheet } from "@/components/screens/ProfileEditScreen";
import { useAuth } from "@/lib/auth";
import { morphologieOrienteLaSelection } from "@/lib/capsule";
import { buildDataExport, downloadJson, exportFileName } from "@/lib/dataExport";
import { useCapsela } from "@/lib/store";
import {
  GENDER_DEPENDENT_FIELDS,
  WORK_DAYS,
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
import { APP_VERSION } from "@/lib/data";
import AppHeader from "@/components/AppHeader";

/*
 * TON PROFIL — refonte du 25/09/2026 (brief « Refonte UX/UI du profil » et
 * sa maquette). Le profil devient le centre de personnalisation : ce que
 * Capsela sait de toi, et à quoi ça sert. Ordre : identité (allégée), profil
 * style, complétude, préférences, compte.
 *
 * CHAQUE PHRASE « À QUOI ÇA SERT » A ÉTÉ VÉRIFIÉE DANS LE CODE, pas reprise
 * de la maquette :
 * - Genre : univers de pièces, styles proposés, taxonomie de silhouette.
 * - Style : sélection de la capsule (computeDefaultCapsule).
 * - Morphologie : n'oriente la sélection QUE pour deux silhouettes
 *   (morphologieOrienteLaSelection) ; pour les autres, la phrase ne promet
 *   rien.
 * - Palette : préférence de couleur de la capsule et de la génération.
 * - Tailles : ne filtrent AUCUNE suggestion — elles pré-remplissent l'ajout
 *   d'une pièce (AddScreen). « Aide à te proposer des pièces adaptées »
 *   aurait été faux.
 * - Intensité : filtre de la capsule (intensiteConflict).
 * - Jours travaillés / congés : occasion proposée par défaut chaque jour.
 */

const T = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
function Icone({ children, taille = 19 }: { children: React.ReactNode; taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
      {children}
    </svg>
  );
}
const I_GENRE = (
  <>
    <circle cx="12" cy="8" r="3.5" {...T} />
    <path d="M5.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5" {...T} />
  </>
);
const I_CINTRE = (
  <>
    <path d="M12 4.2a1.6 1.6 0 1 1 1.4 2.4L12 7.8" {...T} />
    <path d="M12 7.8l8.6 6.1a1.3 1.3 0 0 1-.8 2.3H4.2a1.3 1.3 0 0 1-.8-2.3L12 7.8z" {...T} />
  </>
);
const I_SILHOUETTE = (
  <>
    <path d="M9 3.5h6M9.5 3.5c0 3 1.2 4.3 1.2 6.2S8 13.4 8 16.2c0 1.9 1.7 3.3 4 3.3s4-1.4 4-3.3c0-2.8-2.7-4.6-2.7-6.5s1.2-3.2 1.2-6.2" {...T} />
    <path d="M12 19.5V21" {...T} />
  </>
);
const I_PALETTE = (
  <>
    <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.1-1.6-1.1-2.7 0-1 .8-1.6 1.8-1.6h2.2a3.8 3.8 0 0 0 3.8-3.8c0-4-3.8-7.2-8.5-7.2z" {...T} />
    <circle cx="7.8" cy="11" r="1" {...T} />
    <circle cx="10.5" cy="7.3" r="1" {...T} />
    <circle cx="15" cy="7.8" r="1" {...T} />
  </>
);
const I_METRE = (
  <>
    <rect x="3.5" y="8" width="17" height="8" rx="1.5" {...T} />
    <path d="M7.5 8v3M11 8v2M14.5 8v3M18 8v2" {...T} />
  </>
);
const I_INTENSITE = (
  <>
    <circle cx="12" cy="12" r="8" {...T} />
    <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
  </>
);
const I_CALENDRIER = (
  <>
    <rect x="4" y="6" width="16" height="14" rx="2" {...T} />
    <path d="M4 10h16M8.5 3.5V7M15.5 3.5V7" {...T} />
  </>
);
const I_DOC = <path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20V3.5zM14 3.5V8h4M9.5 12h5M9.5 15.5h5" {...T} />;
const I_BOUCLIER = <path d="M12 3.5l7 2.8v5.2c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6.3l7-2.8z" {...T} />;
const I_TELECHARGER = <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" {...T} />;
const I_ETINCELLE = <path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3z" {...T} />;
const I_TSHIRT = <path d="M8 4L4 7.2l2.4 2.6L8 8.4V20h8V8.4l1.6 1.4 2.4-2.6L16 4l-4 1.8L8 4z" {...T} />;
const I_COMPTE = (
  <>
    <circle cx="12" cy="8.5" r="3.5" {...T} />
    <path d="M5 20c1-3.3 3.6-5 7-5s6 1.7 7 5" {...T} />
  </>
);
const I_GRAPHIQUE = <path d="M5 19.5h14M8 16v-4M12 16V8M16 16v-6" {...T} />;

function Surtitre({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[8px] text-terracotta mt-7 mb-[10px]">
      <Icone taille={16}>{icone}</Icone>
      <span className="text-[11px] tracking-[.16em] uppercase text-muted">{children}</span>
    </div>
  );
}

/** Une ligne du profil : toute la ligne est le bouton qui ouvre l'écran de modification correspondant. */
function LigneProfil({
  icone,
  titre,
  valeur,
  renseigne,
  explication,
  onClick,
}: {
  icone: React.ReactNode;
  titre: string;
  valeur: React.ReactNode;
  renseigne: boolean;
  explication?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-[13px] px-4 py-[14px] text-left cursor-pointer border-b border-border last:border-b-0"
    >
      <span className="w-11 h-11 flex-shrink-0 rounded-full bg-warm-bg text-terracotta-deep flex items-center justify-center">
        <Icone>{icone}</Icone>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-serif text-[16px] leading-[1.25] text-ink">{titre}</span>
        <span className={"block text-[13px] leading-[1.4] mt-[2px] " + (renseigne ? "text-ink" : "text-placeholder")}>{valeur}</span>
        {renseigne && explication && <span className="block text-[12px] text-muted leading-[1.4] mt-[3px]">{explication}</span>}
      </span>
      <span aria-hidden="true" className="text-placeholder text-[15px] flex-shrink-0">›</span>
    </button>
  );
}

/** « le genre, la palette et les tailles » — les champs manquants, dits en toutes lettres. */
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

/** Jours travaillés, dans l'ordre de la semaine ; « Lun – Ven » pour une suite continue. */
function resumeJours(jours: string[]): string {
  const idx = WORK_DAYS.map((d, i) => (jours.includes(d) ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return "Aucun jour travaillé";
  const continu = idx.every((v, k) => k === 0 || v === idx[k - 1] + 1);
  return continu && idx.length > 2 ? `${WORK_DAYS[idx[0]]} – ${WORK_DAYS[idx[idx.length - 1]]}` : idx.map((i) => WORK_DAYS[i]).join(", ");
}

export default function ProfileScreen() {
  const { profile, email, userId, demoMode, signOut, deleteAccount, error, clearError, saveProfile } = useAuth();
  const { state, actions } = useCapsela();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [genreOuvert, setGenreOuvert] = useState(false);
  const [aRevalider, setARevalider] = useState<GenderDependentField | null>(null);

  const initial = (profile.displayName || email || "C").trim().charAt(0).toUpperCase() || "C";

  /* LE GENRE SE MODIFIE PAR LE MÉCANISME EXISTANT, pas par un second : la
     feuille et la revalidation de l'écran d'édition (applyGenderChange),
     qui effacent ce qui ne s'applique plus au nouveau genre et invitent à
     revalider le reste. L'étape « genre » de l'onboarding, elle, ne le fait
     pas — y renvoyer aurait pu laisser une morphologie invalide. */
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

  const ouvrirChamp = (cle: ChampProfilStyle) => {
    if (cle === "genre") setGenreOuvert(true);
    else if (cle === "style") actions.goProfileSetup("style", true);
    else if (cle === "morphologie") actions.goProfileSetup("morpho", true);
    else if (cle === "palette") actions.goProfileSetup("pal_couleurs", true);
    else actions.goProfileSetup("taille", true);
  };

  const tailles = [
    profile.tailleHaut && "Haut " + profile.tailleHaut,
    profile.tailleBas && "Bas " + profile.tailleBas,
    profile.pointure && "Chaussures " + profile.pointure,
  ].filter(Boolean) as string[];

  const handleSignOut = async () => {
    await signOut();
    actions.goWelcome();
  };

  const handleExport = async () => {
    if (!userId) return;
    setExporting(true);
    setExportError(null);
    try {
      const donnees = await buildDataExport(userId, email);
      downloadJson(donnees, exportFileName());
    } catch (err) {
      // Message affiché tel quel : un export partiel serait trompeur au
      // regard de l'article 20, mieux vaut dire que rien n'a été produit.
      setExportError(err instanceof Error ? err.message : "Export impossible pour le moment.");
    } finally {
      setExporting(false);
    }
  };

  const openDeleteConfirm = () => {
    clearError();
    setConfirmDelete(true);
  };
  const closeDeleteConfirm = () => {
    if (deleting) return;
    clearError();
    setConfirmDelete(false);
  };
  const handleDeleteAccount = async () => {
    setDeleting(true);
    const ok = await deleteAccount();
    setDeleting(false);
    if (ok) {
      setConfirmDelete(false);
      actions.goWelcome();
    }
    // En cas d'échec : la sheet reste ouverte, error (useAuth) affiche le
    // message — jamais de déconnexion locale silencieuse si la suppression
    // serveur a échoué (cf. deleteAccount, auth.tsx).
  };

  // Bloc "à compléter" (recette 20/08/2026, mécanique générique de
  // revalidation) : état calculé à chaque rendu, jamais une alerte au
  // lancement de l'app — persiste tant qu'aucune valeur valide n'a été
  // ré-enregistrée pour ce champ.
  const toRevalidate = GENDER_DEPENDENT_FIELDS.find((f) => fieldNeedsRevalidation(f, profile));

  return (
    // pb-safe-nav : dégagement sous la navigation fixe, zone système comprise.
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      {/* LE BANDEAU DE TOUTES LES PAGES (signalé le 25/09 : « pas raccord
          avec les autres pages au niveau du header, des marges »). Le profil
          posait son propre en-tête — retour et titre sur une ligne, sans
          logo — quand Dressing, Capsule, Journal ou Planifier ouvrent sur
          AppHeader, puis surtitre et titre 27 px. Même structure ici ; le
          retour occupe la gouttière gauche du bandeau, et l'avatar n'y est
          pas : on est déjà sur le profil. */}
      <AppHeader showAvatar={false} onBack={() => actions.go(state.profileReturn)} backLabel="Revenir à l'écran précédent" />
      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-[18px]">Profil</div>
      <div className="font-serif text-[27px] leading-[1.12] text-ink mt-[6px]">
        Ton <span className="italic text-terracotta">profil</span>
      </div>
      <div className="text-[13px] text-muted-3 leading-[1.5] mt-[8px]">Tout ce qui aide Capsela à mieux te conseiller.</div>

      {/* IDENTITÉ, ALLÉGÉE : la carte noire dominait la page. Elle garde
          l'initiale, le nom, l'e-mail — et « Modifier » ouvre l'écran
          d'édition existant (nom, photo, réglages). */}
      <div className="bg-card border border-border rounded-[20px] p-4 mt-5 flex items-center gap-[14px]">
        <div className="w-[52px] h-[52px] rounded-full bg-terracotta flex items-center justify-center flex-shrink-0">
          <span className="font-serif text-[21px] text-cream">{initial}</span>
        </div>
        <div className="min-w-0 flex-1">
          {/* Jamais tronqués (brief §15 : aucune information coupée). Le
              bouton « Modifier » est SOUS l'identité et non à sa droite :
              mesuré à 320 px avec un nom long, il ne laissait que ~95 px à la
              colonne et coupait le nom en plein mot. */}
          <div className={"font-serif text-[18px] leading-[1.2] break-words " + (profile.displayName ? "text-ink" : "text-placeholder")}>
            {profile.displayName || "Ton nom"}
          </div>
          <div className="text-[12px] text-muted mt-[2px]">
            {demoMode ? "Mode démo — les données restent sur cet appareil" : "Compte personnel"}
          </div>
          <div className="text-[12px] text-muted-3 mt-[1px] [overflow-wrap:anywhere]">{email ?? "E-mail non renseigné"}</div>
          <button
            onClick={actions.goProfileEdit}
            className="mt-[8px] rounded-full border border-terracotta text-terracotta text-[12px] px-[14px] cursor-pointer"
            style={{ minHeight: 32 }}
          >
            Modifier
          </button>
        </div>
      </div>

      {toRevalidate && (
        <button
          onClick={() => ouvrirChamp("morphologie")}
          className="w-full text-left bg-[#F6EBE2] border border-terracotta rounded-2xl p-4 mt-5 cursor-pointer"
        >
          <div className="text-[11px] tracking-[.16em] uppercase text-terracotta">À compléter</div>
          <div className="text-[13px] text-ink mt-[6px]">{toRevalidate.fieldLabel} est à mettre à jour.</div>
        </button>
      )}

      {/* TON PROFIL STYLE — le cœur de la page. Ordre du brief : Genre,
          Style, Morphologie, Palette, Tailles. Chaque ligne ouvre SON écran
          de modification (les étapes du questionnaire, en mode édition, qui
          ramènent ici) ; l'ancien bouton unique « Modifier mon profil » n'est
          plus nécessaire. */}
      <Surtitre icone={I_ETINCELLE}>Ton profil style</Surtitre>
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
        {/* Côté Homme, la taxonomie de silhouette n'est pas activée : la
            ligne n'existe pas, plutôt qu'un « Non renseignée » qu'aucun
            écran ne permettrait de remplir (Tâche 4). */}
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
          valeur={
            profile.paletteCouleurs.length ? (
              /* Les teintes réellement enregistrées, puis des emplacements
                 vides jusqu'au maximum de 6 : la palette se lit comme un
                 nuancier en cours, pas comme une liste. */
              <span className="flex items-center gap-[6px] py-[2px]" aria-label={`${profile.paletteCouleurs.length} couleurs`}>
                {Array.from({ length: Math.max(6, profile.paletteCouleurs.length) }, (_, i) => profile.paletteCouleurs[i]).map((hex, i) =>
                  hex ? (
                    <span
                      key={i}
                      className="w-[20px] h-[20px] rounded-full flex-shrink-0"
                      style={{ background: hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.12)" }}
                    />
                  ) : (
                    <span key={i} className="w-[20px] h-[20px] rounded-full flex-shrink-0 border border-border-soft" />
                  )
                )}
              </span>
            ) : (
              "Non renseignée"
            )
          }
          renseigne={renseigne("palette")}
          explication="Oriente les couleurs de ta capsule et de tes tenues."
          onClick={() => ouvrirChamp("palette")}
        />
        <LigneProfil
          icone={I_METRE}
          titre="Tailles"
          valeur={
            tailles.length ? (
              <>
                {tailles.join(" · ")}
                {!renseigne("tailles") && <span className="text-placeholder"> · à compléter</span>}
              </>
            ) : (
              "Non renseignées"
            )
          }
          renseigne={tailles.length > 0}
          explication="Pré-remplies quand tu ajoutes une pièce."
          onClick={() => ouvrirChamp("tailles")}
        />
      </div>

      {/* COMPLÉTUDE — seulement s'il manque quelque chose. Le pourcentage est
          calculé (completudeProfil : champs applicables renseignés / champs
          applicables), jamais écrit en dur ; la phrase nomme ce qui manque
          au lieu de promettre un gain que certains champs n'apportent pas
          (les tailles n'affinent aucune recommandation). */}
      {completude.manquants.length > 0 && (
        <div className="mt-4 bg-warm-bg border border-warm-border rounded-[20px] p-4">
          <div className="flex items-start gap-[12px]">
            <span className="w-9 h-9 flex-shrink-0 rounded-full bg-card text-terracotta flex items-center justify-center">
              <Icone taille={17}>{I_GRAPHIQUE}</Icone>
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-serif text-[18px] leading-[1.25] text-ink">
                {completude.manquants.length === 1 ? (
                  <>
                    Encore <span className="italic text-terracotta">un détail</span>…
                  </>
                ) : (
                  <>
                    Encore <span className="italic text-terracotta">quelques détails</span>…
                  </>
                )}
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
            className="mt-[14px] w-full rounded-full bg-terracotta text-cream text-[12px] tracking-[.1em] uppercase cursor-pointer"
            style={{ minHeight: 44 }}
          >
            Compléter mon profil
          </button>
        </div>
      )}

      {/* TES PRÉFÉRENCES — seulement ce qui existe dans le modèle et sert
          vraiment. « Matières, coupes, occasions favorites » (maquette)
          n'existent pas encore : elles ne sont pas inventées ici. */}
      <Surtitre icone={I_TSHIRT}>Tes préférences</Surtitre>
      <div className="bg-card border border-border rounded-[20px] overflow-hidden">
        <LigneProfil
          icone={I_INTENSITE}
          titre="Intensité des couleurs"
          valeur={profile.paletteIntensite || "Non renseignée"}
          renseigne={Boolean(profile.paletteIntensite)}
          explication="Affine les teintes retenues pour ta capsule."
          onClick={() => actions.goProfileSetup("pal_intensite", true)}
        />
        <LigneProfil
          icone={I_CALENDRIER}
          titre="Ton quotidien"
          valeur={profile.prefs.onVacation ? "En congés" : resumeJours(profile.prefs.workDays)}
          renseigne
          explication="Choisit l'occasion proposée chaque matin."
          onClick={actions.goProfileEdit}
        />
      </div>

      {/* MON COMPTE — au second plan. Confidentialité et Informations
          légales pointent vers le même écran, dont la section « Politique de
          confidentialité » couvre déjà le sujet. */}
      <Surtitre icone={I_COMPTE}>Mon compte</Surtitre>
      <div className="bg-card border border-border rounded-[20px] overflow-hidden">
        {[
          { icone: I_DOC, label: "Confidentialité et données", onClick: actions.goLegal },
          { icone: I_BOUCLIER, label: "Informations légales", onClick: actions.goLegal },
          // Portabilité (article 20 du RGPD), masquée en mode démo où rien
          // n'a quitté l'appareil.
          ...(!demoMode
            ? [{ icone: I_TELECHARGER, label: exporting ? "Préparation du fichier…" : "Télécharger mes données", onClick: handleExport }]
            : []),
        ].map((l) => (
          <button
            key={l.label}
            onClick={l.onClick}
            disabled={exporting && l.icone === I_TELECHARGER}
            className="w-full flex items-center gap-[13px] px-4 py-[14px] text-left cursor-pointer border-b border-border last:border-b-0 disabled:opacity-60"
          >
            <span className="text-muted-3 flex-shrink-0">
              <Icone taille={18}>{l.icone}</Icone>
            </span>
            <span className="flex-1 text-[13px] text-ink">{l.label}</span>
            <span aria-hidden="true" className="text-placeholder text-[15px]">›</span>
          </button>
        ))}
      </div>

      {/* Suppression : accessible, séparée, sans fond teinté — elle ne doit
          pas peser plus que le profil lui-même. */}
      <button
        onClick={openDeleteConfirm}
        className="mt-3 w-full flex items-center justify-between px-4 py-[13px] rounded-[16px] border border-border text-left cursor-pointer"
      >
        <span className="text-[13px] text-rust">Supprimer mon compte</span>
        <span aria-hidden="true" className="text-rust text-[15px]">›</span>
      </button>

      {exportError && <div className="mt-[10px] text-[12px] text-rust leading-[1.5]">{exportError}</div>}

      {/* Déconnexion avant la signature de version, et non après : une action
          ne se place pas sous la ligne qui clôt l'écran. py-3 lui donne au
          passage une cible tactile confortable — le bouton n'avait aucune
          hauteur propre, seulement celle de son texte. */}
      <button
        onClick={handleSignOut}
        className="mt-[22px] w-full text-center text-[12px] text-terracotta cursor-pointer py-3"
      >
        Se déconnecter
      </button>
      <div className="text-center text-[11px] text-placeholder mt-[6px]">L&apos;édit Capsela · v{APP_VERSION}</div>

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

      <BottomSheet title="Supprimer mon compte" open={confirmDelete} onClose={closeDeleteConfirm}>
        <div className="text-[13px] text-ink leading-[1.55]">
          Cette action est <span className="text-rust">définitive et irréversible</span>. Ton dressing, tes tenues
          enregistrées, tes looks et les informations de ton profil seront supprimés — il ne sera plus possible de
          les récupérer.
        </div>
        {error && <div className="mt-[14px] text-[12px] text-rust leading-[1.5]">{error}</div>}
        <button
          onClick={handleDeleteAccount}
          disabled={deleting}
          className={
            "mt-[22px] w-full text-center rounded-full py-[14px] text-[12px] tracking-[.1em] uppercase " +
            (deleting ? "bg-[#dccfbc] text-[#8a7c68] cursor-not-allowed" : "bg-rust text-cream cursor-pointer")
          }
        >
          {deleting ? "Suppression en cours…" : "Supprimer définitivement"}
        </button>
        <button
          onClick={closeDeleteConfirm}
          disabled={deleting}
          className="mt-[10px] w-full text-center text-[13px] text-muted py-[10px] cursor-pointer"
        >
          Annuler
        </button>
      </BottomSheet>
    </div>
  );
}
