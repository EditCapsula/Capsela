"use client";

import { useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { I_CINTRE, I_ETINCELLE, I_GENRE, I_INTENSITE, I_METRE, I_PALETTE, I_SILHOUETTE, LigneProfil, PastillesPalette, Surtitre, resumeTailles } from "@/components/ProfilUI";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import {
  GENDERS,
  applyGenderChange,
  champsProfilStyle,
  genderLabel,
  morphologyLabel,
  styleLabel,
  type Gender,
  type GenderDependentField,
} from "@/lib/profile";

export function GenderModal({
  current,
  onSelect,
  onClose,
}: {
  current: Gender | null;
  onSelect: (g: Gender) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(29,26,22,.45)" }}
      onClick={onClose}
    >
      <div className="w-full max-w-[440px] bg-cream rounded-t-[22px] px-6 pt-6 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="font-serif text-[18px] text-ink mb-[16px]">Modifier mon genre</div>
        <div className="flex flex-col gap-[10px]">
          {GENDERS.map((g) => (
            <button
              key={g.key}
              onClick={() => onSelect(g.key)}
              className={
                "text-left px-4 py-[15px] rounded-[14px] cursor-pointer text-[13px] border " +
                (current === g.key ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border")
              }
            >
              {g.label}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-[18px] w-full text-center text-[12px] text-muted cursor-pointer">
          Annuler
        </button>
      </div>
    </div>
  );
}

/**
 * Invitation immédiate après un changement de genre qui rend une donnée
 * "à revalider" (recette 20/08/2026, mécanique générique). Bottom sheet
 * dans le flux du profil — jamais un message technique, jamais le mot
 * "incompatible", jamais de redirection forcée vers le questionnaire
 * d'onboarding (seul un clic explicite sur le CTA ouvre l'étape dédiée).
 */
export function RevalidationSheet({ field, onDismiss, onEdit }: { field: GenderDependentField; onDismiss: () => void; onEdit: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(29,26,22,.45)" }}
      onClick={onDismiss}
    >
      <div className="w-full max-w-[440px] bg-cream rounded-t-[22px] px-6 pt-6 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="font-serif text-[18px] text-ink mb-[8px]">{field.fieldLabel} est à mettre à jour</div>
        <div className="text-[13px] text-muted leading-[1.5] mb-[20px]">
          Les propositions évoluent selon ton profil. Choisis celle qui te correspond le mieux aujourd&apos;hui.
        </div>
        <button
          onClick={onEdit}
          className="w-full bg-terracotta active:bg-terracotta-hover text-cream text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase cursor-pointer"
        >
          {field.ctaLabel}
        </button>
        <button onClick={onDismiss} className="mt-[14px] w-full text-center text-[12px] text-muted cursor-pointer">
          Plus tard
        </button>
      </div>
    </div>
  );
}

export default function ProfileEditScreen() {
  const { profile, email, saveProfile } = useAuth();
  const { actions } = useCapsela();

  const initial = (profile.displayName || email || "C").trim().charAt(0).toUpperCase() || "C";
  const [genderModalOpen, setGenderModalOpen] = useState(false);
  const [revalidateField, setRevalidateField] = useState<GenderDependentField | null>(null);
  // Mécanique générique de revalidation (recette 20/08/2026) : applyGenderChange
  // efface silencieusement les champs non applicables au nouveau genre et ne
  // renvoie un champ à revalider que s'il reste une vraie valeur incompatible.
  const changeGender = (g: Gender) => {
    setGenderModalOpen(false);
    if (g === profile.gender) return;
    const { patch, revalidate } = applyGenderChange(profile, g);
    saveProfile({ ...profile, ...patch });
    if (revalidate) setRevalidateField(revalidate);
  };

  // Photo : locale à l'appareil (blob:), comme avant — l'envoi vers le
  // stockage n'est pas branché pour l'avatar.
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPhotoUrl(URL.createObjectURL(file));
  };

  const birthdateText = profile.birthdate
    ? new Date(profile.birthdate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const champs = champsProfilStyle(profile);
  const renseigne = (cle: string) => champs.find((c) => c.cle === cle)?.renseigne ?? false;
  const tailles = resumeTailles(profile);

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      <AppHeader showAvatar={false} onBack={actions.goProfile} backLabel="Revenir au profil" />
      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-[18px]">Profil</div>
      <div className="font-serif text-[27px] leading-[1.12] text-ink mt-[6px]">
        Personnaliser <span className="italic text-terracotta">mon profil</span>
      </div>
      <div className="text-[13px] text-muted-3 leading-[1.5] mt-[8px]">
        Ces informations aident Capsela à te recommander des tenues qui te ressemblent.
      </div>

      {/* MON IDENTITÉ. Ville et date de naissance sont AFFICHÉES sans chevron :
          aucun écran ne permet de les modifier aujourd'hui (la date n'est
          saisie qu'à l'inscription). Un chevron promettrait un écran absent. */}
      <Surtitre icone={I_GENRE}>Mon identité</Surtitre>
      <div className="bg-card border border-border rounded-[20px] overflow-hidden">
        <input ref={photoInputRef} type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
        <button
          onClick={() => photoInputRef.current?.click()}
          className="w-full flex items-center gap-[13px] px-4 py-[12px] text-left cursor-pointer border-b border-border"
        >
          <span
            className="w-11 h-11 rounded-full bg-terracotta flex items-center justify-center flex-shrink-0 overflow-hidden bg-cover bg-center"
            style={photoUrl ? { backgroundImage: `url(${photoUrl})` } : undefined}
          >
            {!photoUrl && <span className="font-serif text-[18px] text-cream">{initial}</span>}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-serif text-[16px] text-ink">Photo de profil</span>
            <span className="block text-[12px] text-muted mt-[2px]">Optionnelle, jamais partagée.</span>
          </span>
          <span aria-hidden="true" className="text-placeholder text-[15px] flex-shrink-0">›</span>
        </button>
        <LigneInfo label="Prénom" valeur={profile.displayName || "Non renseigné"} renseigne={Boolean(profile.displayName)} onClick={() => actions.goProfileSetup("prenom", true)} />
        <LigneInfo label="Ville" valeur={profile.city} renseigne />
        <LigneInfo label="Genre" valeur={genderLabel(profile.gender) || "Non renseigné"} renseigne={Boolean(profile.gender)} onClick={() => setGenderModalOpen(true)} />
        <LigneInfo label="Date de naissance" valeur={birthdateText || "Non renseignée"} renseigne={Boolean(birthdateText)} />
      </div>

      <Surtitre icone={I_SILHOUETTE}>Ma silhouette</Surtitre>
      <div className="bg-card border border-border rounded-[20px] overflow-hidden">
        {champs.some((c) => c.cle === "morphologie") && (
          <LigneProfil
            icone={I_SILHOUETTE}
            titre="Morphologie"
            valeur={renseigne("morphologie") ? morphologyLabel(profile.morphology) : "Non renseignée"}
            renseigne={renseigne("morphologie")}
            onClick={() => actions.goProfileSetup("morpho", true)}
          />
        )}
        <LigneProfil
          icone={I_METRE}
          titre="Tailles"
          valeur={tailles.length ? tailles.join(" · ") : "Non renseignées"}
          renseigne={tailles.length > 0}
          onClick={() => actions.goProfileSetup("taille", true)}
        />
      </div>

      {/* MES GOÛTS. « Préférences vestimentaires » : seule l'intensité des
          couleurs existe dans le modèle aujourd'hui — pas de matières, coupes
          ni occasions favorites à inventer. La ligne ouvre son étape. */}
      <Surtitre icone={I_ETINCELLE}>Mes goûts</Surtitre>
      <div className="bg-card border border-border rounded-[20px] overflow-hidden">
        <LigneProfil
          icone={I_PALETTE}
          titre="Palette"
          valeur={<PastillesPalette couleurs={profile.paletteCouleurs} />}
          renseigne={profile.paletteCouleurs.length > 0}
          onClick={() => actions.goProfileSetup("pal_couleurs", true)}
        />
        <LigneProfil
          icone={I_CINTRE}
          titre="Style"
          valeur={styleLabel(profile.styles[0], profile.gender) || "Non renseigné"}
          renseigne={Boolean(styleLabel(profile.styles[0], profile.gender))}
          onClick={() => actions.goProfileSetup("style", true)}
        />
        <LigneProfil
          icone={I_INTENSITE}
          titre="Préférences vestimentaires"
          valeur={profile.paletteIntensite ? `Intensité : ${profile.paletteIntensite}` : "Non renseignées"}
          renseigne={Boolean(profile.paletteIntensite)}
          explication="Intensité des couleurs que tu portes volontiers."
          onClick={() => actions.goProfileSetup("pal_intensite", true)}
        />
      </div>

      {/* Chaque modification est enregistrée dès qu'elle est faite (comme
          avant) : ce bouton ramène au profil, où tout est déjà à jour. */}
      <button
        onClick={actions.goProfile}
        className="mt-7 w-full bg-terracotta active:bg-terracotta-hover text-cream text-center rounded-full text-[13px] tracking-[.1em] uppercase cursor-pointer"
        style={{ minHeight: 52 }}
      >
        Enregistrer mes modifications
      </button>

      {genderModalOpen && <GenderModal current={profile.gender} onSelect={changeGender} onClose={() => setGenderModalOpen(false)} />}
      {revalidateField && (
        <RevalidationSheet
          field={revalidateField}
          onDismiss={() => setRevalidateField(null)}
          onEdit={() => {
            setRevalidateField(null);
            actions.goProfileSetup(revalidateField.key === "morphology" ? "morpho" : "style", true);
          }}
        />
      )}
    </div>
  );
}

/** Ligne libellé / valeur de « Mon identité ». Sans onClick : affichée, pas modifiable, et sans chevron. */
function LigneInfo({ label, valeur, renseigne, onClick }: { label: string; valeur: string; renseigne: boolean; onClick?: () => void }) {
  const contenu = (
    <>
      <span className="text-[13px] text-muted w-[118px] flex-shrink-0">{label}</span>
      <span className={"flex-1 min-w-0 text-[13px] break-words " + (renseigne ? "text-ink" : "text-placeholder")}>{valeur}</span>
      {onClick && (
        <span aria-hidden="true" className="text-placeholder text-[15px] flex-shrink-0">
          ›
        </span>
      )}
    </>
  );
  const cls = "w-full flex items-center gap-3 px-4 py-[14px] text-left border-b border-border last:border-b-0";
  return onClick ? (
    <button onClick={onClick} className={cls + " cursor-pointer"}>
      {contenu}
    </button>
  ) : (
    <div className={cls}>{contenu}</div>
  );
}
