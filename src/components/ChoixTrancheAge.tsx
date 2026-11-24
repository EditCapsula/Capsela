"use client";

import { t } from "@/lib/langue";
import { libelleTranche, TRANCHES_AGE, estTrancheAge, type TrancheAge } from "@/lib/ageMinimum";
import { Select } from "@/components/Input";

/**
 * LA TRANCHE D'ÂGE (24/11/2026, ageMinimum.ts) : inscription par e-mail, écran après la connexion Google ou Apple, profil.
 * Une LISTE, comme les autres champs du formulaire (24/11/2026, demandé : « l'affichage des tranches d'âge en onglet prend trop de
 * place ») : huit puces prenaient trois lignes sous le mot de passe ; la liste native tient sur une, et s'ouvre en sélecteur du système
 * sur le téléphone. Question NEUTRE d'un contrôle d'âge : aucune tranche présélectionnée — « Ta tranche d'âge » tant que rien n'est
 * choisi —, toutes au même rang, « Moins de 15 ans » compris.
 */
export default function ChoixTrancheAge({ valeur, onChange, className = "", sansMoinsDe15 = false }: { valeur: TrancheAge | null; onChange: (tr: TrancheAge) => void; className?: string; /** Le profil d'un compte existant : l'âge minimum est déjà vérifié. */ sansMoinsDe15?: boolean }) {
  return (
    <Select
      aria-label={t("Ta tranche d'âge")}
      className={(valeur ? "" : "text-placeholder ") + className}
      value={valeur ?? ""}
      onChange={(e) => estTrancheAge(e.target.value) && onChange(e.target.value)}
    >
      <option value="" disabled>
        {t("Ta tranche d'âge")}
      </option>
      {TRANCHES_AGE.filter((tr) => !sansMoinsDe15 || tr !== "moins_15").map((tr) => (
        <option key={tr} value={tr} className="text-ink">
          {libelleTranche(tr)}
        </option>
      ))}
    </Select>
  );
}
