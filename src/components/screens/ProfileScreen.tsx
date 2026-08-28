"use client";

import { useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import { useAuth } from "@/lib/auth";
import { buildDataExport, downloadJson, exportFileName } from "@/lib/dataExport";
import { useCapsela } from "@/lib/store";
import { GENDER_DEPENDENT_FIELDS, fieldNeedsRevalidation, genderLabel, morphologyLabel, styleLabel } from "@/lib/profile";
import { APP_VERSION } from "@/lib/data";

export default function ProfileScreen() {
  const { profile, email, userId, demoMode, signOut, deleteAccount, error, clearError } = useAuth();
  const { state, actions } = useCapsela();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const initial = (profile.displayName || email || "C").trim().charAt(0).toUpperCase() || "C";
  const tailleValue =
    [
      profile.tailleHaut && "Haut " + profile.tailleHaut,
      profile.tailleBas && "Bas " + profile.tailleBas,
      profile.pointure && "Chaussures " + profile.pointure,
    ]
      .filter(Boolean)
      .join(" · ") || "—";
  const morphoSet = Boolean(profile.morphology);
  const genreLabel = genderLabel(profile.gender);
  const styleValue = styleLabel(profile.styles[0], profile.gender);
  // `renseigne` distingue une vraie valeur d'un marqueur d'absence. Les deux
  // s'affichaient jusqu'ici dans la même couleur d'encre, si bien qu'un
  // « Non renseignée » se lisait comme une réponse : un coup d'œil ne
  // suffisait pas à repérer ce qui manque. Les absences passent en
  // text-placeholder, le ton déjà employé partout pour le texte tertiaire.
  const rows = [
    { label: "Genre", value: genreLabel || "—", renseigne: Boolean(genreLabel) },
    { label: "Tailles", value: tailleValue, renseigne: tailleValue !== "—" },
    {
      label: "Style",
      value: styleValue || "—",
      renseigne: Boolean(styleValue),
      onClick: () => actions.goProfileSetup("style", true),
    },
    {
      label: "Morphologie",
      value: morphoSet ? morphologyLabel(profile.morphology) : "Non renseignée",
      renseigne: morphoSet,
      // Cliquable uniquement tant que non renseignée (recette 25/08/2026) —
      // invite à la compléter ; une fois renseignée, comportement inchangé
      // (simple valeur, comme avant).
      onClick: morphoSet ? undefined : () => actions.goProfileSetup("morpho", true),
    },
  ];

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
    // pb-safe-nav plutôt qu'un pb-[100px] arbitraire : l'utilitaire est la
    // source unique de vérité pour le dégagement sous la navigation fixe
    // (cf. globals.css) et tient compte de la zone système. Sur un écran à
    // encoche, les 100px laissaient le dernier élément trop près du bord.
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      <div className="flex items-center gap-[14px]">
        <button
          onClick={() => actions.go(state.profileReturn)}
          aria-label="Retour"
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div className="font-serif text-[24px] text-ink">Ton profil</div>
      </div>

      <div className="bg-ink rounded-[20px] p-5 mt-5 flex items-center gap-[14px]">
        <div className="w-[56px] h-[56px] rounded-full bg-terracotta flex items-center justify-center flex-shrink-0">
          <span className="font-serif text-[22px] text-cream">{initial}</span>
        </div>
        <div className="min-w-0">
          {/* Même règle que dans la liste ci-dessous : une absence ne se
              présente pas avec l'assurance d'une valeur. « Ton nom » est une
              invite, pas un nom. */}
          <div
            className={
              "font-serif text-[19px] truncate " + (profile.displayName ? "text-cream" : "text-cream-dark-muted")
            }
          >
            {profile.displayName || "Ton nom"}
          </div>
          <div className="text-[12.5px] text-cream-dark-muted mt-[3px] truncate">{email ?? "non renseignée"}</div>
          {demoMode && (
            <div className="text-[11.5px] text-gold mt-[5px]">Mode démo — les données restent sur cet appareil</div>
          )}
        </div>
      </div>

      {toRevalidate && (
        <button
          onClick={actions.goProfileEdit}
          className="w-full text-left bg-[#F6EBE2] border border-terracotta rounded-2xl p-4 mt-5 cursor-pointer"
        >
          <div className="text-[11px] tracking-[.16em] uppercase text-terracotta">À compléter</div>
          <div className="text-[13.5px] text-ink mt-[6px]">{toRevalidate.fieldLabel} est à mettre à jour.</div>
        </button>
      )}

      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-[10px]">Tes infos</div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {rows.map((r) => {
          const Tag = r.onClick ? "button" : "div";
          return (
            <Tag
              key={r.label}
              onClick={r.onClick}
              className={
                "flex items-center justify-between px-4 py-[15px] border-b border-border last:border-b-0 gap-4 w-full text-left " +
                (r.onClick ? "cursor-pointer" : "")
              }
            >
              <span className="text-[13px] text-muted flex-shrink-0">{r.label}</span>
              <span className="flex items-center gap-[6px]">
                <span
                  className={
                    "text-[13.5px] text-right leading-[1.4] " + (r.renseigne ? "text-ink" : "text-placeholder")
                  }
                >
                  {r.value}
                </span>
                {r.onClick && <span className="text-placeholder">›</span>}
              </span>
            </Tag>
          );
        })}
        {/* Palette (recette 25/08/2026) — remplace le résumé texte "Couleurs :
            X, Y, Z" par des pastilles reprenant les teintes réellement
            enregistrées (profile.paletteCouleurs, déjà des hex) ; cliquable
            comme Style/Morphologie-non-renseignée, vers l'étape palette du
            questionnaire profil. */}
        <button
          onClick={() => actions.goProfileSetup("pal_couleurs", true)}
          className="flex items-center justify-between px-4 py-[15px] border-b border-border last:border-b-0 gap-4 w-full text-left cursor-pointer"
        >
          <span className="text-[13px] text-muted flex-shrink-0">Palette</span>
          <span className="flex items-center gap-[6px]">
            {profile.paletteCouleurs.length ? (
              <span className="flex items-center gap-[5px]">
                {profile.paletteCouleurs.map((hex, i) => (
                  <span
                    key={i}
                    className="w-[16px] h-[16px] rounded-full flex-shrink-0"
                    style={{ background: hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.12)" }}
                  />
                ))}
              </span>
            ) : (
              <span className="text-[13.5px] text-placeholder">Non renseignée</span>
            )}
            <span className="text-placeholder">›</span>
          </span>
        </button>
      </div>

      <button
        onClick={actions.goProfileEdit}
        className="mt-[22px] w-full bg-ink text-cream text-center rounded-full py-4 text-[12.5px] tracking-[.12em] uppercase cursor-pointer"
      >
        Modifier mon profil
      </button>

      {/* Section Compte (recette 25/08/2026) — regroupe ce qui vivait avant
          en boutons séparés (Informations légales) plus Confidentialité et
          données, qui pointe vers le même écran : sa section "Politique de
          confidentialité" couvre déjà ce sujet, jamais un second écran
          dupliqué.
          Suppression et téléchargement sont désormais tous deux branchés
          (le commentaire d'origine décrivait la suppression comme un simple
          repère visuel — ce n'est plus vrai depuis delete-account, et
          l'export article 20 l'a rejointe le 28/08/2026). */}
      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-[10px]">Compte</div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <button
          onClick={actions.goLegal}
          className="flex items-center justify-between px-4 py-[15px] border-b border-border last:border-b-0 gap-4 w-full text-left cursor-pointer"
        >
          <span className="text-[13.5px] text-ink">Informations légales</span>
          <span className="text-placeholder">›</span>
        </button>
        <button
          onClick={actions.goLegal}
          className="flex items-center justify-between px-4 py-[15px] border-b border-border last:border-b-0 gap-4 w-full text-left cursor-pointer"
        >
          <span className="text-[13.5px] text-ink">Confidentialité et données</span>
          <span className="text-placeholder">›</span>
        </button>
        {/* Portabilité (article 20 du RGPD) — placée juste avant la
            suppression : ce sont les deux gestes d'un départ, et récupérer
            ses données avant d'effacer son compte est l'ordre naturel.
            Masquée en mode démo, où rien n'a quitté l'appareil. */}
        {!demoMode && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center justify-between px-4 py-[15px] border-b border-border last:border-b-0 gap-4 w-full text-left cursor-pointer disabled:opacity-60"
          >
            <span className="text-[13.5px] text-ink">
              {exporting ? "Préparation du fichier…" : "Télécharger mes données"}
            </span>
            <span className="text-placeholder">›</span>
          </button>
        )}
        <button
          onClick={openDeleteConfirm}
          className="flex items-center justify-between px-4 py-[15px] border-b border-border last:border-b-0 gap-4 w-full text-left cursor-pointer"
        >
          <span className="text-[13.5px] text-rust">Supprimer mon compte</span>
          <span className="text-rust">›</span>
        </button>
      </div>

      {exportError && <div className="mt-[10px] text-[12.5px] text-rust leading-[1.5]">{exportError}</div>}

      {/* Déconnexion avant la signature de version, et non après : une action
          ne se place pas sous la ligne qui clôt l'écran. py-3 lui donne au
          passage une cible tactile confortable — le bouton n'avait aucune
          hauteur propre, seulement celle de son texte. */}
      <button
        onClick={handleSignOut}
        className="mt-[22px] w-full text-center text-[12.5px] text-terracotta cursor-pointer py-3"
      >
        Se déconnecter
      </button>
      <div className="text-center text-[11px] text-placeholder mt-[6px]">L&apos;édit Capsela · v{APP_VERSION}</div>

      <BottomSheet title="Supprimer mon compte" open={confirmDelete} onClose={closeDeleteConfirm}>
        <div className="text-[13px] text-ink leading-[1.55]">
          Cette action est <span className="text-rust">définitive et irréversible</span>. Ton dressing, tes tenues
          enregistrées, tes looks et les informations de ton profil seront supprimés — il ne sera plus possible de
          les récupérer.
        </div>
        {error && <div className="mt-[14px] text-[12.5px] text-rust leading-[1.5]">{error}</div>}
        <button
          onClick={handleDeleteAccount}
          disabled={deleting}
          className={
            "mt-[22px] w-full text-center rounded-full py-[14px] text-[12.5px] tracking-[.1em] uppercase " +
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
