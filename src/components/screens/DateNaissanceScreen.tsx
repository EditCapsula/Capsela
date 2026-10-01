"use client";

import { useState } from "react";
import { messageAge, verifierAge, AGE_MINIMUM } from "@/lib/ageMinimum";
import { useAuth } from "@/lib/auth";
import { urlLegale } from "@/lib/legal/documents";

const INPUT_CLS =
  "capin bg-card border border-border rounded-[14px] px-[17px] py-[15px] text-[14px] text-ink font-sans w-full";

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
        <button onClick={onQuitter} className="mt-7 text-center rounded-full py-4 t-bouton cursor-pointer text-cream bg-terracotta active:bg-terracotta-hover">
          Revenir à l&apos;accueil
        </button>
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
      <input
        type="date"
        className={INPUT_CLS + " mt-7"}
        style={{ colorScheme: "light" }}
        value={naissance}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(e) => setNaissance(e.target.value)}
        aria-label="Date de naissance"
      />
      {erreur && (
        <div role="alert" className="mt-4 bg-[#f4e2da] border border-[#dcb2a0] rounded-xl px-4 py-3 text-[12px] text-rust leading-[1.45]">
          {erreur}
        </div>
      )}
      {auth.error && (
        <div role="alert" className="mt-4 bg-[#f4e2da] border border-[#dcb2a0] rounded-xl px-4 py-3 text-[12px] text-rust leading-[1.45]">
          {auth.error}
        </div>
      )}
      <button
        onClick={continuer}
        className={"mt-5 text-center rounded-full py-4 t-bouton cursor-pointer text-cream " + (envoi ? "bg-[#bd8a75]" : "bg-terracotta active:bg-terracotta-hover")}
      >
        {envoi ? "Un instant…" : "Continuer"}
      </button>
      <div className="text-[11px] text-placeholder text-center mt-4 leading-[1.5]">
        Pourquoi ? Voir notre{" "}
        <a href={urlLegale("confidentialite")} target="_blank" rel="noopener noreferrer" className="text-muted underline">
          Politique de confidentialité
        </a>
        .
      </div>
      <div className="flex-1" />
      <button onClick={() => void auth.signOut()} className="text-center pt-4 text-[13px] text-muted cursor-pointer">
        Se déconnecter
      </button>
    </div>
  );
}
