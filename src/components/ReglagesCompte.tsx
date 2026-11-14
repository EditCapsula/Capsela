"use client";

import { useState, useSyncExternalStore } from "react";
import BottomSheet from "@/components/BottomSheet";
import Rangee from "@/components/Rangee";
import { Toggle } from "@/components/screens/PreferencesScreen";
import { useAuth } from "@/lib/auth";
import { readConsent, setConsent, subscribeConsent, type ConsentState } from "@/lib/consent";
import { choixPublicitairesDisponibles, etatPublicite, ouvrirChoixPublicitaires, publiciteDisponibleIci, reessayerVideo, suivreChoixPublicitaires, suivreEtatPublicite, type EtatPublicite } from "@/lib/publicite";
import { buildDataExport, downloadJson, exportFileName } from "@/lib/dataExport";
import { useCapsela } from "@/lib/store";
import Button from "@/components/Button";
import Card from "@/components/Card";

/*
 * MON COMPTE DANS RÉGLAGES CAPSELA (05/11/2026, maquette « Réglages Capsela »). L'ancien écran « Gérer mon compte »
 * (architecture du profil, 25/09/2026) est réparti, sans rien perdre :
 *
 *   Compte et sécurité          e-mail, mot de passe (lien de réinitialisation)
 *   Confidentialité et données  statistiques d'usage, choix publicitaires, téléchargement des données, informations légales,
 *                               suppression du compte
 *   Ailleurs                    l'abonnement reste sur la carte du Profil (un seul emplacement de référence) ; prénom, date de
 *                               naissance et photo vont au Profil (arbitré le 05/11/2026) ; l'aide, le contact et la
 *                               déconnexion sont sur la page Réglages.
 *
 * « CONFIDENTIALITÉ ET DONNÉES » RESTE UNE PAGE DE GESTES RÉELS. L'écran « Informations légales » ne contient que des intitulés :
 * un seul lien y mène, depuis cette page.
 */

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <>
      <div className="t-surtitre text-muted mt-7 mb-[10px]">{titre}</div>
      <Card className="overflow-hidden">{children}</Card>
    </>
  );
}

const Chevron = () => (
  <span aria-hidden="true" className="text-placeholder text-[15px] flex-shrink-0">
    ›
  </span>
);

/** Compte et sécurité : l'adresse du compte et le mot de passe. */
export function VueCompte() {
  const { email, demoMode, demanderLienReinitialisation } = useAuth();
  /**
   * MOT DE PASSE (recette du 26/09/2026, option B du brief) : un lien de réinitialisation envoyé à l'adresse du compte, le même
   * parcours sécurisé que « Mot de passe oublié ». Pas de changement direct ici : selon les réglages du projet, Supabase peut
   * exiger une réauthentification pour un changement de mot de passe en session, que l'app ne sait pas encore mener.
   */
  const [lienMotDePasse, setLienMotDePasse] = useState<"repos" | "envoi" | "envoye" | "erreur">("repos");
  const envoyerLienMotDePasse = async () => {
    if (!email || lienMotDePasse === "envoi") return;
    setLienMotDePasse("envoi");
    const issue = await demanderLienReinitialisation(email);
    setLienMotDePasse(issue === "envoye" ? "envoye" : "erreur");
  };

  return (
    <Bloc titre="Identifiants">
      <Rangee className="justify-between">
        <span className="text-[13px] text-muted flex-shrink-0">E-mail</span>
        <span className="text-[13px] text-ink text-right [overflow-wrap:anywhere]">{email ?? "Non renseigné"}</span>
      </Rangee>
      {demoMode || !email ? (
        <Rangee className="justify-between">
          <span className="text-[13px] text-muted flex-shrink-0">Modifier mon mot de passe</span>
          <span className="text-[12px] text-placeholder text-right">Indisponible en mode démo</span>
        </Rangee>
      ) : (
        <Rangee
          onClick={envoyerLienMotDePasse}
          disabled={lienMotDePasse === "envoi" || lienMotDePasse === "envoye"}
          className="justify-between disabled:cursor-default"
        >
          <span className="text-[13px] text-muted flex-shrink-0">Modifier mon mot de passe</span>
          <span className="text-[12px] text-right" aria-live="polite">
            {lienMotDePasse === "envoye" ? (
              <span className="text-muted-3">Lien envoyé à ton adresse e-mail</span>
            ) : lienMotDePasse === "erreur" ? (
              <span className="text-rust">Envoi impossible — réessayer</span>
            ) : lienMotDePasse === "envoi" ? (
              <span className="text-muted-3">Envoi…</span>
            ) : (
              <span className="text-terracotta">Recevoir un lien ›</span>
            )}
          </span>
        </Rangee>
      )}
    </Bloc>
  );
}

/** Confidentialité et données : consentements, téléchargement, légal, suppression du compte. */
export function VueDonnees() {
  const { email, userId, demoMode, deleteAccount, error, clearError } = useAuth();
  const { actions } = useCapsela();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const consent = useSyncExternalStore(subscribeConsent, readConsent, () => "unknown" as ConsentState);
  // Le choix donné dans le formulaire publicitaire de Google se change ici, aussi simplement qu'il s'est donné (RGPD).
  // La ligne n'existe que là où Google l'exige (Espace économique européen, Royaume-Uni), et seulement sur Android.
  const choixPub = useSyncExternalStore(suivreChoixPublicitaires, choixPublicitairesDisponibles, () => false);
  const mesureConfiguree = Boolean(process.env.NEXT_PUBLIC_GA_ID);

  const handleExport = async () => {
    if (!userId) return;
    setExporting(true);
    setExportError(null);
    try {
      downloadJson(await buildDataExport(userId, email), exportFileName());
    } catch (err) {
      // Un export partiel serait trompeur au regard de l'article 20 : mieux vaut dire que rien n'a été produit.
      setExportError(err instanceof Error ? err.message : "Export impossible pour le moment.");
    } finally {
      setExporting(false);
    }
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
    // Échec : la feuille reste ouverte et affiche l'erreur — jamais de déconnexion locale silencieuse si la suppression
    // serveur a échoué.
  };

  return (
    <>
      <Bloc titre="Mes données">
        {mesureConfiguree && (
          <Rangee className="justify-between">
            <div className="flex-1 min-w-0 pr-2">
              <div className="text-[13px] text-ink">Autoriser les statistiques d&apos;usage</div>
              <div className="text-[11px] text-muted mt-[2px] leading-[1.35]">
                Établies par Google Analytics, pour améliorer l&apos;application. Aucune incidence sur son fonctionnement.
              </div>
            </div>
            <Toggle
              on={consent === "granted"}
              onClick={() => setConsent(consent === "granted" ? "denied" : "granted")}
              label="Autoriser les statistiques d'usage"
            />
          </Rangee>
        )}
        {choixPub && (
          <Rangee onClick={() => void ouvrirChoixPublicitaires()} className="justify-between">
            <span className="flex-1 min-w-0 pr-2">
              <span className="block text-[13px] text-ink">Choix publicitaires</span>
              <span className="block text-[11px] text-muted mt-[2px] leading-[1.35]">
                Pour les vidéos que tu choisis de regarder contre une tenue de plus.
              </span>
            </span>
            <Chevron />
          </Rangee>
        )}
        <EtatVideos />
        {/* Masqué en mode démo, où rien n'a quitté l'appareil. */}
        {!demoMode ? (
          <Rangee onClick={handleExport} disabled={exporting} className="justify-between disabled:opacity-60">
            <span className="text-[13px] text-ink">{exporting ? "Préparation du fichier…" : "Télécharger mes données"}</span>
            <Chevron />
          </Rangee>
        ) : (
          <Rangee className="text-[12px] text-muted leading-[1.45]">Mode démo : tes données restent sur cet appareil.</Rangee>
        )}
        <Rangee onClick={actions.goLegal} className="justify-between">
          <span className="text-[13px] text-ink">Informations légales</span>
          <Chevron />
        </Rangee>
      </Bloc>
      {exportError && <div className="mt-[10px] text-[12px] text-rust leading-[1.5]">{exportError}</div>}

      <button
        onClick={() => {
          clearError();
          setConfirmDelete(true);
        }}
        className="mt-7 w-full flex items-center justify-between px-4 py-[13px] rounded-tuile border border-border text-left cursor-pointer"
      >
        <span className="text-[13px] text-rust">Supprimer mon compte</span>
        <span aria-hidden="true" className="text-rust text-[15px]">
          ›
        </span>
      </button>

      <BottomSheet title="Supprimer mon compte" open={confirmDelete} onClose={closeDeleteConfirm}>
        <div className="text-[13px] text-ink leading-[1.55]">
          Cette action est <span className="text-rust">définitive et irréversible</span>. Ton dressing, tes tenues enregistrées, tes
          looks et les informations de ton profil seront supprimés — il ne sera plus possible de les récupérer.
        </div>
        {error && <div className="mt-[14px] text-[12px] text-rust leading-[1.5]">{error}</div>}
        <Button variante="destructif" className="mt-[22px]" onClick={handleDeleteAccount} disabled={deleting}>
          {deleting ? "Suppression en cours…" : "Supprimer définitivement"}
        </Button>
        <button onClick={closeDeleteConfirm} disabled={deleting} className="mt-[10px] w-full text-center text-[13px] text-muted py-[10px] cursor-pointer">
          Annuler
        </button>
      </BottomSheet>
    </>
  );
}

/**
 * L'ÉTAT DES VIDÉOS RÉCOMPENSÉES (14/11/2026, demandé après « je n'ai toujours pas les publicités AdMob ») : ce que la publicité
 * sait vraiment (publicite.ts, etatPublicite), dit sans jargon, avec la réponse de Google quand elle refuse. Android seulement, là où
 * la publicité existe. « Réessayer » relance un chargement, jamais une boucle.
 */
const TEXTE_ETAT: Record<EtatPublicite["etape"], string> = {
  nonDemarree: "Pas démarrées : elles le sont pour un compte connecté, au profil complet, en offre Gratuit.",
  consentementRefuse: "Consentement non donné : Google ne sert aucune vidéo. Tu peux le changer dans Choix publicitaires.",
  chargement: "Chargement d'une vidéo…",
  prete: "Une vidéo est prête : elle te sera proposée quand tu atteindras la limite de tenues du jour, une fois par jour.",
  aucuneVideo: "Google n'a fourni aucune vidéo pour l'instant.",
  echec: "La publicité n'a pas pu démarrer.",
};

function EtatVideos() {
  const e = useSyncExternalStore(suivreEtatPublicite, etatPublicite, etatPublicite);
  if (!publiciteDisponibleIci()) return null;
  return (
    <Rangee className="justify-between">
      <span className="flex-1 min-w-0 pr-2">
        <span className="block text-[13px] text-ink">Vidéos récompensées</span>
        <span className="block text-[11px] text-muted mt-[2px] leading-[1.35]" role="status">
          {TEXTE_ETAT[e.etape]}
          {e.test && " Vidéos de test de Google."}
          {e.detail && ` (réponse : ${e.detail})`}
        </span>
      </span>
      {e.etape === "aucuneVideo" && (
        <button type="button" onClick={reessayerVideo} className="min-h-[44px] text-[12px] font-semibold text-terracotta-deep cursor-pointer flex-shrink-0">
          Réessayer
        </button>
      )}
    </Rangee>
  );
}
