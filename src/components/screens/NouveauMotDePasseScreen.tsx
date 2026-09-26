"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { LONGUEUR_MIN_MOT_DE_PASSE, validerNouveauMotDePasse } from "@/lib/motDePasse";
import { useCapsela } from "@/lib/store";

const INPUT_CLS =
  "capin bg-card border border-border rounded-[14px] px-[17px] py-[15px] text-[14px] text-ink font-sans w-full";

/**
 * « NOUVEAU MOT DE PASSE » — ouvert par le lien de réinitialisation reçu par
 * e-mail (recette du 26/09/2026, cf. motDePasse.ts). App.tsx l'affiche à la
 * place de tout autre écran tant que `auth.recuperation` n'est pas "aucune" :
 * la session de récupération ne doit mener nulle part ailleurs avant que le
 * mot de passe soit choisi.
 *
 * Trois états : le formulaire, la confirmation (« Se connecter » ferme la
 * session de récupération et ouvre l'écran de connexion), et le lien expiré
 * ou invalide.
 */
export default function NouveauMotDePasseScreen() {
  const auth = useAuth();
  const { actions } = useCapsela();
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState(false);

  const allerALaConnexion = async () => {
    await auth.terminerRecuperation(true);
    actions.goLogin();
  };

  const enregistrer = async () => {
    if (envoi) return;
    const invalide = validerNouveauMotDePasse(motDePasse, confirmation);
    if (invalide === "trop_court") return setErreur(`Choisis au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`);
    if (invalide === "differents") return setErreur("Les deux mots de passe ne sont pas identiques.");
    setErreur(null);
    setEnvoi(true);
    const refus = await auth.enregistrerNouveauMotDePasse(motDePasse);
    setEnvoi(false);
    if (refus) setErreur(refus);
    else setFait(true);
  };

  if (auth.recuperation === "lien_invalide") {
    return (
      <div className="scrollarea absolute inset-0 overflow-y-auto flex flex-col px-7 pt-[44px] pb-[30px]">
        <div className="t-titre-ecran text-ink">
          Ce lien n&apos;est plus <span className="italic text-terracotta">valide</span>
        </div>
        <div className="t-chapeau text-muted mt-[10px]">
          Il a expiré ou a déjà servi. Demande un nouveau lien depuis l&apos;écran de connexion, avec « Mot de passe
          oublié ? ».
        </div>
        <button
          onClick={allerALaConnexion}
          className="mt-7 text-center rounded-full py-4 t-bouton cursor-pointer text-cream bg-terracotta-deep active:bg-terracotta-hover"
        >
          Retour à la connexion
        </button>
      </div>
    );
  }

  if (fait) {
    return (
      <div className="scrollarea absolute inset-0 overflow-y-auto flex flex-col px-7 pt-[44px] pb-[30px]">
        <div className="t-titre-ecran text-ink">
          Ton mot de passe a été <span className="italic text-terracotta">mis à jour</span>
        </div>
        <div className="t-chapeau text-muted mt-[10px]">Tu peux maintenant te connecter avec ton nouveau mot de passe.</div>
        <button
          onClick={allerALaConnexion}
          className="mt-7 text-center rounded-full py-4 t-bouton cursor-pointer text-cream bg-terracotta-deep active:bg-terracotta-hover"
        >
          Se connecter
        </button>
      </div>
    );
  }

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto flex flex-col px-7 pt-[44px] pb-[30px]">
      <div className="t-titre-ecran text-ink">
        Nouveau <span className="italic text-terracotta">mot de passe</span>
      </div>
      <div className="t-chapeau text-muted mt-[10px]">
        Choisis ton nouveau mot de passe : au moins {LONGUEUR_MIN_MOT_DE_PASSE} caractères.
      </div>
      <form
        className="flex flex-col gap-3 mt-[26px]"
        onSubmit={(e) => {
          e.preventDefault();
          enregistrer();
        }}
      >
        <label className="flex flex-col gap-[6px]">
          <span className="t-label text-muted">Nouveau mot de passe</span>
          <input
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            className={INPUT_CLS}
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-[6px]">
          <span className="t-label text-muted">Confirmer le nouveau mot de passe</span>
          <input
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            className={INPUT_CLS}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
        <button type="button" onClick={() => setVisible((v) => !v)} className="self-start t-lien text-terracotta cursor-pointer min-h-[44px]">
          {visible ? "Masquer les mots de passe" : "Afficher les mots de passe"}
        </button>
        {erreur && (
          <div role="alert" className="text-[12px] text-rust leading-[1.5]">
            {erreur}
          </div>
        )}
        <button
          type="submit"
          disabled={envoi}
          className="mt-2 text-center rounded-full py-4 t-bouton cursor-pointer text-cream bg-terracotta-deep active:bg-terracotta-hover disabled:opacity-60"
        >
          {envoi ? "Un instant…" : "Enregistrer mon nouveau mot de passe"}
        </button>
      </form>
    </div>
  );
}
