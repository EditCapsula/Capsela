"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";

const INPUT_CLS =
  "capin bg-card border border-border rounded-[14px] px-[17px] py-[15px] text-[14px] text-ink font-sans w-full";

export default function AuthScreen() {
  const { state, actions } = useCapsela();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [busy, setBusy] = useState(false);

  const afterAuth = () => {
    if (auth.profile.completed) actions.goTenues();
    else actions.goProfileSetup(0);
  };

  const submitEmail = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await auth.signUpEmail(state.authName.trim(), email.trim(), password, birthdate);
    setBusy(false);
    if (ok) actions.goProfileSetup(0);
  };

  const submitGoogle = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await auth.signInGoogle();
    setBusy(false);
    // En mode réel, signInGoogle redirige vers Google : on ne navigue pas ici.
    if (ok) afterAuth();
  };

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto flex flex-col px-7 pt-[14px] pb-[30px]">
      <div className="mt-[6px]">
        <AppHeader showAvatar={false} />
      </div>

      <div className="mt-[22px]">
        <div className="font-serif text-[30px] leading-[1.12] text-ink">
          Crée ton <span className="italic text-terracotta">compte</span>
        </div>
        <div className="text-[13.5px] text-muted mt-[10px] leading-[1.5]">
          Pour recevoir ta tenue du jour et sauvegarder ton dressing, où que tu sois.
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
        <span className="text-[10.5px] tracking-[.16em] uppercase text-placeholder">ou par e-mail</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="flex flex-col gap-[10px]">
        <input
          className={INPUT_CLS}
          value={state.authName}
          onChange={(e) => actions.setAuthName(e.target.value)}
          placeholder="Prénom"
        />
        <input
          type="email"
          className={INPUT_CLS}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Adresse e-mail"
        />
        <input
          type="password"
          className={INPUT_CLS}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
        />
        <input
          type="date"
          className={INPUT_CLS}
          style={{ colorScheme: "light" }}
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          aria-label="Date de naissance"
        />
      </div>

      {auth.error && (
        <div className="mt-4 bg-[#f4e2da] border border-[#dcb2a0] rounded-xl px-4 py-3 text-[12.5px] text-rust leading-[1.45]">
          {auth.error}
        </div>
      )}

      <button
        onClick={submitEmail}
        className={
          "mt-5 text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase cursor-pointer text-cream " +
          (busy ? "bg-[#bd8a75]" : "bg-terracotta")
        }
      >
        {busy ? "Un instant…" : "Créer mon compte"}
      </button>

      <div className="text-[11px] text-placeholder text-center mt-4 leading-[1.5]">
        En continuant, tu acceptes nos <span className="text-muted">Conditions</span> et notre{" "}
        <span className="text-muted">Politique de confidentialité</span>.
      </div>

      {auth.demoMode && (
        <div className="text-[11px] text-muted text-center mt-3 leading-[1.5]">
          Mode démo : aucun serveur configuré, ton compte reste sur cet appareil.
        </div>
      )}

      <div className="flex-1" />
      <div className="text-center pt-4 pb-[6px] text-[13px] text-muted">
        Déjà un compte ·{" "}
        <button onClick={actions.goLogin} className="text-terracotta cursor-pointer">
          Se connecter
        </button>
      </div>
    </div>
  );
}
