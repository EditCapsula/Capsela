"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";

const INPUT_CLS =
  "capin bg-card border border-border rounded-[14px] px-[17px] py-[15px] text-[14px] text-ink font-sans w-full";

export default function LoginScreen() {
  const { actions } = useCapsela();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await auth.signInEmail(email.trim(), password);
    setBusy(false);
    if (ok) {
      if (auth.profile.completed) actions.goTenues();
      else actions.goProfileSetup(0);
    }
  };

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto flex flex-col px-7 pt-[14px] pb-[30px]">
      <button
        onClick={actions.goAuth}
        className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
      >
        ←
      </button>

      <div className="mt-[30px]">
        <div className="font-serif text-[30px] leading-[1.12] text-ink">
          Content de te <span className="italic text-terracotta">revoir</span>
        </div>
        <div className="text-[13.5px] text-muted mt-[10px] leading-[1.5]">
          Connecte-toi pour retrouver ton dressing et ta tenue du jour.
        </div>
      </div>

      <div className="mt-[26px] flex flex-col gap-3">
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
      </div>

      {auth.error && (
        <div className="mt-4 bg-[#f4e2da] border border-[#dcb2a0] rounded-xl px-4 py-3 text-[12.5px] text-rust leading-[1.45]">
          {auth.error}
        </div>
      )}

      <button
        onClick={submit}
        className={
          "mt-5 text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase cursor-pointer text-cream " +
          (busy ? "bg-[#bd8a75]" : "bg-terracotta")
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
