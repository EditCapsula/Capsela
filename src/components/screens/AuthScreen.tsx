"use client";

import { t } from "@/lib/langue";
import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { markSignupIntent, useAuth } from "@/lib/auth";
import { messageAge, verifierAge } from "@/lib/ageMinimum";
import { useCapsela } from "@/lib/store";
import Button from "@/components/Button";
import Input, { ChampMotDePasse } from "@/components/Input";
import ConnexionSociale from "@/components/ConnexionSociale";

export default function AuthScreen() {
  const { state, actions } = useCapsela();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);

  const [erreurAge, setErreurAge] = useState<string | null>(null);

  const submitEmail = async () => {
    if (busy) return;
    // Âge minimum (01/10/2026) : la date de naissance est obligatoire, et
    // l'inscription refusée sous AGE_MINIMUM ans. Le contrôle se fait ici,
    // avant toute création de compte.
    const age = verifierAge(birthdate);
    if (!age.ok) {
      setErreurAge(messageAge(age.raison));
      return;
    }
    setErreurAge(null);
    setBusy(true);
    const res = await auth.signUpEmail(state.authName.trim(), email.trim(), password, birthdate);
    setBusy(false);
    if (res === "ok") actions.goProfileSetup("genre");
    else if (res === "confirm_email") setConfirmPending(true);
  };

  // Apple (05/11/2026) : même chemin que Google, l'intention d'inscription comprise.
  const submitApple = async () => {
    if (busy) return;
    setBusy(true);
    markSignupIntent();
    await auth.signInApple();
    setBusy(false);
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
        <div className="t-titre-ecran text-ink">
          {t("Crée ton")} <span className="italic text-terracotta">{t("compte")}</span>
        </div>
        <div className="t-chapeau text-muted mt-[10px]">
          {t("Pour recevoir ta tenue du jour et sauvegarder ton dressing, où que tu sois.")}
        </div>
      </div>

      <ConnexionSociale onApple={submitApple} onGoogle={submitGoogle} occupe={busy} />

      <div className="flex flex-col gap-[10px]">
        <Input
          value={state.authName}
          onChange={(e) => actions.setAuthName(e.target.value)}
          placeholder={t("Prénom")}
        />
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("Adresse e-mail")}
        />
        <ChampMotDePasse
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("Mot de passe")}
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
          <Input
            type="date"
            style={{ colorScheme: "light", color: birthdate ? undefined : "transparent" }}
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            aria-label={t("Date de naissance")}
          />
          {!birthdate && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-[17px] top-1/2 -translate-y-1/2 text-[14px] text-placeholder font-sans"
            >
              {t("Date de naissance")}
            </span>
          )}
        </div>
      </div>

      {erreurAge && (
        <div role="alert" className="mt-4 bg-error-bg border border-error-border rounded-champ px-4 py-3 text-[12px] text-rust leading-[1.45]">
          {erreurAge}
        </div>
      )}
      {auth.error && (
        <div className="mt-4 bg-error-bg border border-error-border rounded-champ px-4 py-3 text-[12px] text-rust leading-[1.45]">
          {auth.error}
        </div>
      )}
      {confirmPending && (
        <div className="mt-4 bg-warm-bg border border-warm-border rounded-champ px-4 py-3 text-[12px] text-warm-text-2 leading-[1.5]">
          <span className="font-semibold">{t("Vérifie ta boîte mail.")}</span>{" "}
          {t("On t'a envoyé un lien de confirmation à {email}. Clique dessus, puis reviens te connecter.", { email: email.trim() })}
        </div>
      )}

      <Button pleine={false} className="mt-5" onClick={submitEmail} disabled={busy}>
        {busy ? t("Un instant…") : t("Créer mon compte")}
      </Button>

      <div className="text-[11px] text-placeholder text-center mt-4 leading-[1.5]">
        {t("En continuant, tu acceptes nos")}{" "}
        <button type="button" onClick={() => actions.openLegalDoc("cgu")} className="text-muted underline cursor-pointer">
          {t("Conditions")}
        </button>{" "}
        {t("et notre")}{" "}
        <button type="button" onClick={() => actions.openLegalDoc("confidentialite")} className="text-muted underline cursor-pointer">
          {t("Politique de confidentialité")}
        </button>
        .
      </div>

      {auth.demoMode && (
        <div className="text-[11px] text-muted text-center mt-3 leading-[1.5]">
          {t("Mode démo : aucun serveur configuré, ton compte reste sur cet appareil.")}
        </div>
      )}

      <div className="flex-1" />
      <div className="text-center pt-4 pb-[6px] text-[13px] text-muted">
        {t("Déjà un compte")} ·{" "}
        <button onClick={actions.goLogin} className="text-terracotta cursor-pointer">
          {t("Se connecter")}
        </button>
      </div>
    </div>
  );
}
