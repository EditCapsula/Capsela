"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import BoutonRetour from "@/components/BoutonRetour";
import { emailPlausible } from "@/lib/motDePasse";

const INPUT_CLS =
  "capin bg-card border border-border rounded-[14px] px-[17px] py-[15px] text-[14px] text-ink font-sans w-full";

export default function LoginScreen() {
  const { actions } = useCapsela();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [pwVisible, setPwVisible] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotErreur, setForgotErreur] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    await auth.signInEmail(email.trim(), password);
    setBusy(false);
    // Navigation post-connexion centralisée dans App.tsx (réagit à signedIn/profileCompleted) :
    // lire auth.profile ici serait lire une valeur pas encore mise à jour (state React asynchrone).
  };

  // Écran Se connecter (correctif 24/08/2026, signalé : un compte créé via
  // Google ne pouvait pas se reconnecter par ce biais, seul e-mail/mot de
  // passe était proposé ici). Jamais markSignupIntent ici, à la différence
  // d'AuthScreen (Créer un compte) : cet écran suppose un compte déjà
  // existant, il ne doit jamais être traité comme une nouvelle inscription.
  const submitGoogle = async () => {
    if (busy) return;
    setBusy(true);
    await auth.signInGoogle();
    setBusy(false);
  };

  /**
   * MOT DE PASSE OUBLIÉ (recette du 26/09/2026). Jusqu'ici le bouton ne
   * faisait qu'afficher « Lien envoyé » ; il appelle désormais
   * `resetPasswordForEmail` (Supabase Auth). La confirmation ne dit jamais si
   * l'adresse a un compte : même phrase dans les deux cas.
   */
  const envoyerLien = async () => {
    if (forgotBusy) return;
    if (!emailPlausible(email)) return setForgotErreur("Cette adresse e-mail ne semble pas complète.");
    setForgotErreur(null);
    setForgotBusy(true);
    const issue = await auth.demanderLienReinitialisation(email);
    setForgotBusy(false);
    if (issue === "envoye") setForgotSent(true);
    else if (issue === "demo") setForgotErreur("Mode démo : aucun e-mail ne peut être envoyé.");
    else if (issue === "trop_de_tentatives") setForgotErreur("Trop de demandes — réessaie dans quelques minutes.");
    else setForgotErreur("Connexion impossible. Vérifie ton réseau et réessaie.");
  };
  const fermerOubli = () => {
    setForgotOpen(false);
    setForgotSent(false);
    setForgotErreur(null);
  };

  if (forgotOpen) {
    return (
      <div className="scrollarea absolute inset-0 overflow-y-auto flex flex-col px-7 pt-[14px] pb-[30px]">
        <BoutonRetour onClick={fermerOubli} label="Revenir à la connexion" />

        {forgotSent ? (
          <div className="mt-[30px] flex flex-col items-center text-center px-[10px] py-5">
            <span className="w-[52px] h-[52px] rounded-full bg-warm-bg text-terracotta flex items-center justify-center text-[22px] mb-4">
              ✉
            </span>
            <div className="t-titre-carte text-ink">Vérifie ta boîte mail</div>
            <div className="text-[13px] text-muted mt-2 leading-[1.5] max-w-[280px]">
              Si un compte correspond à cette adresse, tu recevras un e-mail pour réinitialiser ton mot de passe.
            </div>
            <button
              onClick={fermerOubli}
              className="mt-[22px] w-full bg-terracotta-deep active:bg-terracotta-hover text-cream text-center rounded-full py-4 t-bouton cursor-pointer"
            >
              Retour à la connexion
            </button>
          </div>
        ) : (
          <>
            <div className="mt-[30px]">
              <div className="t-titre-ecran text-ink">
                Réinitialiser mon <span className="italic text-terracotta">mot de passe</span>
              </div>
              <div className="t-chapeau text-muted mt-[10px]">
                Entre ton adresse e-mail et nous t&apos;enverrons un lien pour créer un nouveau mot de passe.
              </div>
            </div>
            <label className="mt-[26px] flex flex-col gap-[6px]">
              <span className="t-label text-muted">E-mail</span>
              <input
                type="email"
                autoComplete="email"
                className={INPUT_CLS}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Adresse e-mail"
              />
            </label>
            {forgotErreur && (
              <div role="alert" className="mt-3 text-[12px] text-rust leading-[1.5]">
                {forgotErreur}
              </div>
            )}
            <button
              onClick={envoyerLien}
              disabled={forgotBusy}
              className="mt-5 text-center rounded-full py-4 t-bouton cursor-pointer text-cream bg-terracotta-deep active:bg-terracotta-hover disabled:opacity-60"
            >
              {forgotBusy ? "Un instant…" : "Recevoir le lien"}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto flex flex-col px-7 pt-[14px] pb-[30px]">
      <div className="flex items-center justify-between">
        <BoutonRetour onClick={actions.goAuth} label="Revenir à la création de compte" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-full.svg" alt="L'édit Capsela" className="h-9 w-auto" />
        <div className="w-[38px] flex-shrink-0" />
      </div>

      <div className="mt-[30px]">
        <div className="t-titre-ecran text-ink">
          Content de te <span className="italic text-terracotta">revoir</span>
        </div>
        <div className="t-chapeau text-muted mt-[10px]">
          Connecte-toi pour retrouver ton dressing et ta tenue du jour.
        </div>
      </div>

      <button
        onClick={submitGoogle}
        className="flex items-center justify-center gap-[10px] bg-card border border-border text-ink rounded-full py-[15px] text-[14px] cursor-pointer mt-7"
      >
        <span className="font-serif font-semibold">G</span>Continuer avec Google
      </button>

      <div className="flex items-center gap-[11px] my-[22px]">
        <div className="flex-1 h-px bg-border" />
        <span className="t-label text-placeholder">ou par e-mail</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="flex flex-col gap-3">
        <input
          type="email"
          className={INPUT_CLS}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Adresse e-mail"
        />
        <div className="relative">
          <input
            type={pwVisible ? "text" : "password"}
            className={INPUT_CLS + " pr-[46px]"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
          />
          <button
            type="button"
            onClick={() => setPwVisible((v) => !v)}
            aria-label={pwVisible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-muted cursor-pointer"
          >
            {pwVisible ? "⊘" : "◉"}
          </button>
        </div>
      </div>

      <button
        onClick={() => setForgotOpen(true)}
        className="mt-3 self-end text-[12px] text-terracotta cursor-pointer"
      >
        Mot de passe oublié ?
      </button>

      {auth.error && (
        <div className="mt-4 bg-[#f4e2da] border border-[#dcb2a0] rounded-xl px-4 py-3 text-[12px] text-rust leading-[1.45]">
          {auth.error}
        </div>
      )}

      <button
        onClick={submit}
        className={
          "mt-5 text-center rounded-full py-4 t-bouton cursor-pointer text-cream " +
          (busy ? "bg-[#bd8a75]" : "bg-terracotta active:bg-terracotta-hover")
        }
      >
        {busy ? "Un instant…" : "Se connecter"}
      </button>

      <div className="flex-1" />
      <div className="text-center pt-4 pb-[6px] text-[13px] text-muted">
        Pas encore de compte ·{" "}
        <button onClick={actions.goAuth} className="text-terracotta cursor-pointer">
          Créer un compte
        </button>
      </div>
    </div>
  );
}
