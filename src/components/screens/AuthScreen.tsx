"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";

const AUTH_PERKS = [
  "Ton dressing sauvegardé et synchronisé",
  "Ta capsule et tes stats en un coup d’œil",
  "Retrouve tout, même après un nouveau téléphone",
];

export default function AuthScreen() {
  const { state, actions } = useCapsela();
  const auth = useAuth();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const afterAuth = () => {
    actions.go(auth.profile.completed ? "tenues" : "profileSetup");
  };

  const submitEmail = async () => {
    if (busy) return;
    setBusy(true);
    const ok =
      mode === "signup"
        ? await auth.signUpEmail(state.authName.trim(), email.trim(), password)
        : await auth.signInEmail(email.trim(), password);
    setBusy(false);
    if (ok) afterAuth();
  };

  const submitGoogle = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await auth.signInGoogle();
    setBusy(false);
    // En mode réel, signInGoogle redirige vers Google : on ne navigue pas ici.
    if (ok) afterAuth();
  };

  const switchMode = (m: "signup" | "signin") => {
    setMode(m);
    auth.clearError();
  };

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto flex flex-col px-7 pt-2 pb-7">
      <button
        onClick={actions.goWelcome}
        className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
      >
        ←
      </button>

      <div className="mt-[22px]">
        <div className="font-serif text-[32px] leading-[1.05] text-ink">
          {mode === "signup" ? (
            <>
              Crée ton <span className="italic">compte</span>
            </>
          ) : (
            <>
              Re-<span className="italic">bienvenue</span>
            </>
          )}
        </div>
        <div className="text-[13px] text-muted-2 mt-[10px] leading-[1.5]">
          Pour sauvegarder ton dressing et ta capsule, et les retrouver sur tous tes écrans.
        </div>
      </div>

      {mode === "signup" && (
        <div className="mt-[22px] bg-card border border-border rounded-2xl px-[18px] py-4 flex flex-col gap-[13px]">
          {AUTH_PERKS.map((p) => (
            <div key={p} className="flex items-start gap-[11px]">
              <span className="w-5 h-5 rounded-full bg-terracotta text-cream flex items-center justify-center text-[11px] flex-shrink-0 mt-px">
                ✓
              </span>
              <span className="text-[13px] text-muted-4 leading-[1.4]">{p}</span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={submitGoogle}
        className="flex items-center justify-center gap-[10px] bg-card border border-border-soft text-ink rounded-full py-[15px] text-[14px] cursor-pointer mt-[22px]"
      >
        <span className="font-serif font-medium">G</span>&nbsp;Continuer avec Google
      </button>

      <div className="flex items-center gap-[11px] my-5">
        <div className="flex-1 h-px bg-border-soft" />
        <span className="text-[11px] tracking-[.14em] uppercase text-placeholder">ou par e-mail</span>
        <div className="flex-1 h-px bg-border-soft" />
      </div>

      <div className="flex flex-col gap-[10px]">
        {mode === "signup" && (
          <input
            className="capin bg-card border border-border rounded-xl px-4 py-[14px] text-[14px] text-ink font-sans"
            value={state.authName}
            onChange={(e) => actions.setAuthName(e.target.value)}
            placeholder="Prénom"
          />
        )}
        <input
          type="email"
          className="capin bg-card border border-border rounded-xl px-4 py-[14px] text-[14px] text-ink font-sans"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Adresse e-mail"
        />
        <input
          type="password"
          className="capin bg-card border border-border rounded-xl px-4 py-[14px] text-[14px] text-ink font-sans"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
        />
      </div>

      {auth.error && (
        <div className="mt-4 bg-[#f6e3dd] border border-[#e4b8a8] rounded-xl px-4 py-3 text-[12.5px] text-rust leading-[1.45]">
          {auth.error}
        </div>
      )}

      <button
        onClick={submitEmail}
        className={
          "mt-[18px] text-center rounded-full py-4 text-[13px] tracking-[.12em] uppercase cursor-pointer " +
          (busy ? "bg-[#c99680] text-cream" : "bg-terracotta text-cream")
        }
      >
        {busy ? "Un instant…" : mode === "signup" ? "Créer mon compte" : "Se connecter"}
      </button>

      <button
        onClick={() => switchMode(mode === "signup" ? "signin" : "signup")}
        className="text-center py-[14px] text-[13px] text-muted-2 cursor-pointer bg-transparent"
      >
        {mode === "signup" ? (
          <>
            J&apos;ai déjà un compte · <span className="text-terracotta">Se connecter</span>
          </>
        ) : (
          <>
            Pas encore de compte · <span className="text-terracotta">S&apos;inscrire</span>
          </>
        )}
      </button>

      {auth.demoMode && (
        <div className="text-[11px] text-muted text-center mt-1 leading-[1.5]">
          Mode démo : aucun serveur configuré, ton compte reste sur cet appareil.
        </div>
      )}
      <div className="text-[11px] text-muted text-center mt-2 leading-[1.5]">
        En continuant, tu acceptes nos Conditions et notre Politique de confidentialité.
      </div>
    </div>
  );
}
