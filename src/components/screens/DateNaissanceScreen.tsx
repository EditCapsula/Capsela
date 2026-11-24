"use client";

import { t } from "@/lib/langue";
import { useState } from "react";
import { messageTranche, verifierTranche, AGE_MINIMUM, type TrancheAge } from "@/lib/ageMinimum";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import Button from "@/components/Button";
import ChoixTrancheAge from "@/components/ChoixTrancheAge";

/**
 * LA TRANCHE D'ÂGE (24/11/2026, à la place de la date de naissance, ageMinimum.ts), après la connexion Google ou Apple.
 *
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
  const [tranche, setTranche] = useState<TrancheAge | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const continuer = async () => {
    if (envoi) return;
    const age = verifierTranche(tranche);
    if (!age.ok && age.raison !== "trop_jeune") return setErreur(messageTranche(age.raison));
    setErreur(null);
    setEnvoi(true);
    if (!age.ok) {
      // Trop jeune : le message d'abord (il survit à la déconnexion), puis la suppression.
      onRefus(messageTranche(age.raison));
      await auth.deleteAccount();
      setEnvoi(false);
      return;
    }
    await auth.saveProfile({ ...auth.profile, trancheAge: tranche });
    setEnvoi(false);
  };

  if (refus) {
    return (
      <div className="scrollarea absolute inset-0 overflow-y-auto flex flex-col px-7 pt-[44px] pb-[30px]">
        <div className="t-titre-ecran text-ink">
          {t("On ne peut pas créer ton")} <span className="italic text-terracotta">{t("compte")}</span>
        </div>
        <div className="t-chapeau text-muted mt-[10px]">{refus} {t("Le compte qui venait d'être créé a été supprimé.")}</div>
        <Button variante="principal" pleine={false} className="mt-7" onClick={onQuitter}>
          {t("Revenir à l'accueil")}
        </Button>
      </div>
    );
  }

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto flex flex-col px-7 pt-[44px] pb-[30px]">
      <div className="t-titre-ecran text-ink">
        {t("Une dernière")} <span className="italic text-terracotta">{t("chose")}</span>
      </div>
      <div className="t-chapeau text-muted mt-[10px]">
        {t("Pour créer ton compte, indique ta tranche d'âge. Il faut avoir au moins {n} ans.", { n: AGE_MINIMUM })}
      </div>
      <ChoixTrancheAge
        className="mt-7"
        valeur={tranche}
        onChange={(tr) => {
          setTranche(tr);
          setErreur(null);
        }}
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
        {envoi ? t("Un instant…") : t("Continuer")}
      </Button>
      <div className="text-[11px] text-placeholder text-center mt-4 leading-[1.5]">
        {t("Pourquoi ? Voir notre")}{" "}
        <button type="button" onClick={() => actions.openLegalDoc("confidentialite")} className="text-muted underline cursor-pointer">
          {t("Politique de confidentialité")}
        </button>
        .
      </div>
      <div className="flex-1" />
      <button onClick={() => void auth.signOut()} className="text-center pt-4 text-[13px] text-muted cursor-pointer">
        {t("Se déconnecter")}
      </button>
    </div>
  );
}
