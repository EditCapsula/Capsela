"use client";

import { useState } from "react";
import { messageAge, verifierAge, AGE_MINIMUM } from "@/lib/ageMinimum";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import Button from "@/components/Button";
import Input from "@/components/Input";

/**
 * « DATE DE NAISSANCE » après la connexion Google (01/10/2026). La création de
 * compte par e-mail la demande déjà (AuthScreen) ; Google n'en transmet aucune.
 * App.tsx affiche cet écran à la place de tout autre tant qu'un compte connecté
 * n'a ni date de naissance ni profil terminé (doitDemanderNaissance).
 *
 * Sous l'âge minimum, le compte qui vient d'être créé est SUPPRIMÉ aussitôt
 * (delete-account) : on ne garde pas un compte qui ne devait pas exister. Le
 * refus reste affiché après la déconnexion, `onRefus` le garde au niveau
 * d'App.tsx, d'où l'écran ne disparaît pas avec la session.
 */
export default function DateNaissanceScreen({
  refus,
  onRefus,
  onQuitter,
}: {
  refus: string | null;
  onRefus: (message: string) => void;
  onQuitter: () => void;
}) {
  const auth = useAuth();
  const { actions } = useCapsela();
  const [naissance, setNaissance] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const continuer = async () => {
    if (envoi) return;
    const age = verifierAge(naissance);
    if (!age.ok && age.raison !== "trop_jeune") return setErreur(messageAge(age.raison));
    setErreur(null);
    setEnvoi(true);
    if (!age.ok) {
      // Trop jeune : le message d'abord (il survit à la déconnexion), puis la suppression.
      onRefus(messageAge(age.raison));
      await auth.deleteAccount();
      setEnvoi(false);
      return;
    }
    await auth.saveProfile({ ...auth.profile, birthdate: naissance });
    setEnvoi(false);
  };

  if (refus) {
    return (
      <div className="scrollarea absolute inset-0 overflow-y-auto flex flex-col px-7 pt-[44px] pb-[30px]">
        <div className="t-titre-ecran text-ink">
          On ne peut pas créer ton <span className="italic text-terracotta">compte</span>
        </div>
        <div className="t-chapeau text-muted mt-[10px]">{refus} Le compte qui venait d&apos;être créé a été supprimé.</div>
        <Button variante="principal" pleine={false} className="mt-7" onClick={onQuitter}>
          Revenir à l&apos;accueil
        </Button>
      </div>
    );
  }

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto flex flex-col px-7 pt-[44px] pb-[30px]">
      <div className="t-titre-ecran text-ink">
        Une dernière <span className="italic text-terracotta">chose</span>
      </div>
      <div className="t-chapeau text-muted mt-[10px]">
        Pour créer ton compte, indique ta date de naissance. Il faut avoir au moins {AGE_MINIMUM} ans.
      </div>
      <Input
        type="date"
        className="mt-7"
        style={{ colorScheme: "light" }}
        value={naissance}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(e) => setNaissance(e.target.value)}
        aria-label="Date de naissance"
      />
      {erreur && (
        <div role="alert" className="mt-4 bg-error-bg border border-error-border rounded-champ px-4 py-3 text-[12px] text-rust leading-[1.45]">
          {erreur}
        </div>
      )}
      {auth.error && (
        <div role="alert" className="mt-4 bg-error-bg border border-error-border rounded-champ px-4 py-3 text-[12px] text-rust leading-[1.45]">
          {auth.error}
        </div>
      )}
      <Button pleine={false} className="mt-5" onClick={continuer} disabled={envoi}>
        {envoi ? "Un instant…" : "Continuer"}
      </Button>
      <div className="text-[11px] text-placeholder text-center mt-4 leading-[1.5]">
        Pourquoi ? Voir notre{" "}
        <button type="button" onClick={() => actions.openLegalDoc("confidentialite")} className="text-muted underline cursor-pointer">
          Politique de confidentialité
        </button>
        .
      </div>
      <div className="flex-1" />
      <button onClick={() => void auth.signOut()} className="text-center pt-4 text-[13px] text-muted cursor-pointer">
        Se déconnecter
      </button>
    </div>
  );
}
