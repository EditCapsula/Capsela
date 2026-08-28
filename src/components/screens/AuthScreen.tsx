"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { markSignupIntent, useAuth } from "@/lib/auth";
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
  const [confirmPending, setConfirmPending] = useState(false);

  const submitEmail = async () => {
    if (busy) return;
    setBusy(true);
    const res = await auth.signUpEmail(state.authName.trim(), email.trim(), password, birthdate);
    setBusy(false);
    if (res === "ok") actions.goProfileSetup("genre");
    else if (res === "confirm_email") setConfirmPending(true);
  };

  const submitGoogle = async () => {
    if (busy) return;
    setBusy(true);
    markSignupIntent();
    await auth.signInGoogle();
    setBusy(false);
    // Navigation post-connexion centralisée dans App.tsx (réagit à signedIn/profileCompleted) :
    // lire auth.profile ici serait lire une valeur pas encore mise à jour (state React asynchrone).
    // En mode réel, signInGoogle redirige de toute façon vers Google.
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
        {/* Un <input type="date"> vide n'a pas de placeholder, et les
            navigateurs ne s'accordent pas sur ce qu'ils affichent à la place :
            Chrome bureau écrit « jj/mm/aaaa », Chrome Android ne montre
            RIEN — juste une case vide (signalé le 28/08/2026 sur Samsung).
            Le correctif du 24/08/2026 se contentait de recolorer le texte du
            navigateur, ce qui ne pouvait donc rien donner là où il n'y a pas
            de texte.
            On pose notre propre libellé par-dessus, avec le style exact des
            placeholders des trois champs au-dessus, et on rend transparent le
            texte natif tant qu'aucune date n'est choisie — sinon les deux se
            superposeraient sur bureau. `pointer-events-none` laisse le
            toucher atteindre le champ, qui reste un vrai sélecteur de date. */}
        <div className="relative">
          <input
            type="date"
            className={INPUT_CLS}
            style={{ colorScheme: "light", color: birthdate ? undefined : "transparent" }}
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            aria-label="Date de naissance"
          />
          {!birthdate && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-[17px] top-1/2 -translate-y-1/2 text-[14px] text-placeholder font-sans"
            >
              Date de naissance
            </span>
          )}
        </div>
      </div>

      {auth.error && (
        <div className="mt-4 bg-[#f4e2da] border border-[#dcb2a0] rounded-xl px-4 py-3 text-[12.5px] text-rust leading-[1.45]">
          {auth.error}
        </div>
      )}
      {confirmPending && (
        <div className="mt-4 bg-warm-bg border border-warm-border rounded-xl px-4 py-3 text-[12.5px] text-warm-text-2 leading-[1.5]">
          <span className="font-semibold">Vérifie ta boîte mail.</span> On t&apos;a envoyé un lien de
          confirmation à {email.trim()}. Clique dessus, puis reviens te connecter.
        </div>
      )}

      <button
        onClick={submitEmail}
        className={
          "mt-5 text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase cursor-pointer text-cream " +
          (busy ? "bg-[#bd8a75]" : "bg-terracotta active:bg-terracotta-hover")
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
