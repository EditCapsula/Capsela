"use client";

import { useState, useSyncExternalStore } from "react";
import AppHeader from "@/components/AppHeader";
import BottomSheet from "@/components/BottomSheet";
import { Toggle } from "@/components/screens/PreferencesScreen";
import { useAuth } from "@/lib/auth";
import { readConsent, setConsent, subscribeConsent, type ConsentState } from "@/lib/consent";
import { APP_VERSION } from "@/lib/data";
import { buildDataExport, downloadJson, exportFileName } from "@/lib/dataExport";
import { useCapsela } from "@/lib/store";

/*
 * MON COMPTE (architecture du profil, 25/09/2026) : le compte et ses données,
 * séparés du profil stylistique. Tout ce qui s'y trouve existait déjà —
 * export (article 20), suppression (delete-account), déconnexion, retrait du
 * consentement de mesure d'audience — et a seulement changé d'écran.
 *
 * « CONFIDENTIALITÉ ET DONNÉES » EST UNE SECTION, PAS UN LIEN. L'écran
 * « Informations légales » ne contient que des intitulés, sans page derrière :
 * y envoyer deux liens différents (« Confidentialité » et « Légal ») aurait
 * fait arriver deux entrées sur le même écran vide. Les gestes réels sur ses
 * données — consentement, téléchargement — sont donc ici, et un seul lien
 * mène au légal.
 */

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <>
      <div className="t-surtitre text-muted mt-7 mb-[10px]">{titre}</div>
      <div className="bg-card border border-border rounded-[20px] overflow-hidden">{children}</div>
    </>
  );
}

export default function AccountScreen() {
  const { email, userId, demoMode, signOut, deleteAccount, error, clearError } = useAuth();
  const { actions } = useCapsela();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const consent = useSyncExternalStore(subscribeConsent, readConsent, () => "unknown" as ConsentState);
  const mesureConfiguree = Boolean(process.env.NEXT_PUBLIC_GA_ID);

  const handleExport = async () => {
    if (!userId) return;
    setExporting(true);
    setExportError(null);
    try {
      downloadJson(await buildDataExport(userId, email), exportFileName());
    } catch (err) {
      // Un export partiel serait trompeur au regard de l'article 20 : mieux
      // vaut dire que rien n'a été produit.
      setExportError(err instanceof Error ? err.message : "Export impossible pour le moment.");
    } finally {
      setExporting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    actions.goLogin();
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
    // Échec : la feuille reste ouverte et affiche l'erreur — jamais de
    // déconnexion locale silencieuse si la suppression serveur a échoué.
  };

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      <AppHeader showAvatar={false} onBack={actions.goProfile} backLabel="Revenir au profil" />
      <div className="t-surtitre text-muted mt-[18px]">Profil</div>
      <div className="t-titre-ecran text-ink mt-[6px]">
        Mon <span className="italic text-terracotta">compte</span>
      </div>
      <div className="t-chapeau text-muted-3 mt-[8px]">Ton compte, tes données, et ce que tu en fais.</div>

      <Section titre="Compte">
        <div className="flex items-center justify-between gap-3 px-4 py-[14px] border-b border-border">
          <span className="text-[13px] text-muted flex-shrink-0">E-mail</span>
          <span className="text-[13px] text-ink text-right [overflow-wrap:anywhere]">{email ?? "Non renseigné"}</span>
        </div>
        {/* Aucun parcours de mot de passe n'existe encore (« Mot de passe
            oublié », à la connexion, n'appelle aucun service). La ligne le
            dit plutôt que de promettre un écran. */}
        <div className="flex items-center justify-between gap-3 px-4 py-[14px]">
          <span className="text-[13px] text-muted flex-shrink-0">Mot de passe</span>
          <span className="text-[12px] text-placeholder text-right">Bientôt modifiable ici</span>
        </div>
      </Section>

      <Section titre="Confidentialité et données">
        {mesureConfiguree && (
          <div className="flex items-center justify-between gap-3 px-4 py-[14px] border-b border-border">
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
          </div>
        )}
        {/* Masqué en mode démo, où rien n'a quitté l'appareil. */}
        {!demoMode ? (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full flex items-center justify-between gap-3 px-4 py-[14px] text-left cursor-pointer disabled:opacity-60"
          >
            <span className="text-[13px] text-ink">{exporting ? "Préparation du fichier…" : "Télécharger mes données"}</span>
            <span aria-hidden="true" className="text-placeholder text-[15px]">›</span>
          </button>
        ) : (
          <div className="px-4 py-[14px] text-[12px] text-muted leading-[1.45]">Mode démo : tes données restent sur cet appareil.</div>
        )}
      </Section>
      {exportError && <div className="mt-[10px] text-[12px] text-rust leading-[1.5]">{exportError}</div>}

      <button
        onClick={actions.goLegal}
        className="mt-3 w-full flex items-center justify-between gap-3 px-4 py-[14px] bg-card border border-border rounded-[20px] text-left cursor-pointer"
      >
        <span className="text-[13px] text-ink">Informations légales</span>
        <span aria-hidden="true" className="text-placeholder text-[15px]">›</span>
      </button>

      <button
        onClick={() => {
          clearError();
          setConfirmDelete(true);
        }}
        className="mt-7 w-full flex items-center justify-between px-4 py-[13px] rounded-[16px] border border-border text-left cursor-pointer"
      >
        <span className="text-[13px] text-rust">Supprimer mon compte</span>
        <span aria-hidden="true" className="text-rust text-[15px]">›</span>
      </button>

      <button onClick={handleSignOut} className="mt-[18px] w-full text-center text-[12px] text-terracotta cursor-pointer py-3">
        Se déconnecter
      </button>
      <div className="text-center text-[11px] text-placeholder mt-[6px]">L&apos;édit Capsela · v{APP_VERSION}</div>

      <BottomSheet title="Supprimer mon compte" open={confirmDelete} onClose={closeDeleteConfirm}>
        <div className="text-[13px] text-ink leading-[1.55]">
          Cette action est <span className="text-rust">définitive et irréversible</span>. Ton dressing, tes tenues
          enregistrées, tes looks et les informations de ton profil seront supprimés — il ne sera plus possible de les
          récupérer.
        </div>
        {error && <div className="mt-[14px] text-[12px] text-rust leading-[1.5]">{error}</div>}
        <button
          onClick={handleDeleteAccount}
          disabled={deleting}
          className={
            "mt-[22px] w-full text-center rounded-full py-[14px] t-bouton " +
            (deleting ? "bg-[#dccfbc] text-[#8a7c68] cursor-not-allowed" : "bg-rust text-cream cursor-pointer")
          }
        >
          {deleting ? "Suppression en cours…" : "Supprimer définitivement"}
        </button>
        <button onClick={closeDeleteConfirm} disabled={deleting} className="mt-[10px] w-full text-center text-[13px] text-muted py-[10px] cursor-pointer">
          Annuler
        </button>
      </BottomSheet>
    </div>
  );
}
