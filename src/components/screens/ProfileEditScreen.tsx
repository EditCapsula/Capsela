"use client";

import { useEffect, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import BottomSheet from "@/components/BottomSheet";
import { I_CINTRE, I_ETINCELLE, I_GENRE, I_INTENSITE, I_METRE, I_PALETTE, I_SILHOUETTE, LigneProfil, PastillesPalette, Surtitre, resumeTailles } from "@/components/ProfilUI";
import { useAuth } from "@/lib/auth";
import { CITIES } from "@/lib/data";
import { jourLocal } from "@/lib/outfitFeedback";
import { fetchVilles, libelleVille, type VilleSuggeree } from "@/lib/weather";
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

  // VILLE ET DATE DE NAISSANCE (demandé le 25/09/2026 : elles n'avaient
  // aucun écran de modification). Deux feuilles, comme le genre.
  //
  // LA VILLE : N'IMPORTE LAQUELLE, TROUVÉE PAR LA RECHERCHE (correctif
  // météo du 25/09/2026). Sa météo réelle est désormais demandée par son nom
  // (fetchWeatherByCity) : elle n'a plus à figurer dans CITIES. La recherche
  // passe par l'autocomplétion de Planifier (fetchVilles, même service), et
  // on n'enregistre qu'une ville PROPOSÉE — jamais une saisie libre, qu'une
  // faute de frappe rendrait introuvable sans que rien ne le dise. CITIES
  // reste en raccourcis quand la recherche est vide.
  const [villeOuverte, setVilleOuverte] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [suggestions, setSuggestions] = useState<VilleSuggeree[] | null>([]);
  useEffect(() => {
    const q = recherche.trim();
    if (!villeOuverte || q.length < 2) return;
    let annule = false;
    const t = setTimeout(() => {
      fetchVilles(q)
        .then((v) => {
          if (!annule) setSuggestions(v);
        })
        .catch(() => {
          if (!annule) setSuggestions(null);
        });
    }, 280);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [recherche, villeOuverte]);
  const enRecherche = recherche.trim().length >= 2;
  const choisirVille = (nom: string) => {
    setVilleOuverte(false);
    setRecherche("");
    if (nom !== profile.city) saveProfile({ ...profile, city: nom });
  };
  const [dateOuverte, setDateOuverte] = useState(false);
  const [dateBrouillon, setDateBrouillon] = useState(profile.birthdate ?? "");
  // Bornes de la date : jamais dans le futur, jamais avant 1900. Calculées à
  // l'ouverture de la feuille (un clic), pas pendant le rendu.
  const [aujourdhui, setAujourdhui] = useState("");
  const ouvrirDate = () => {
    setDateBrouillon(profile.birthdate ?? "");
    setAujourdhui(jourLocal());
    setDateOuverte(true);
  };
  const dateValide = /^\d{4}-\d{2}-\d{2}$/.test(dateBrouillon) && dateBrouillon >= "1900-01-01" && dateBrouillon <= aujourdhui;

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

      {/* MON IDENTITÉ. Chaque ligne ouvre son éditeur : étape « prenom » du
          questionnaire, feuilles pour le genre, la ville et la date. */}
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
        <LigneInfo label="Ville" valeur={profile.city} renseigne onClick={() => setVilleOuverte(true)} />
        <LigneInfo label="Genre" valeur={genderLabel(profile.gender) || "Non renseigné"} renseigne={Boolean(profile.gender)} onClick={() => setGenderModalOpen(true)} />
        <LigneInfo label="Date de naissance" valeur={birthdateText || "Non renseignée"} renseigne={Boolean(birthdateText)} onClick={ouvrirDate} />
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

      <BottomSheet title="Ta ville" open={villeOuverte} onClose={() => setVilleOuverte(false)}>
        <div className="text-[12px] text-muted leading-[1.45] mb-3">
          Utilisée pour la météo quand la géolocalisation n&apos;est pas disponible.
        </div>
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher une ville"
          aria-label="Rechercher une ville"
          autoComplete="off"
          autoCapitalize="words"
          className="w-full bg-card border border-border rounded-[14px] px-4 min-h-[48px] text-[14px] text-ink font-sans"
        />
        <div className="flex flex-col max-h-[46vh] overflow-y-auto -mx-1 px-1 mt-2" role="radiogroup" aria-label="Ville">
          {enRecherche ? (
            suggestions === null ? (
              <div className="text-[12px] text-muted py-3 px-1">Recherche indisponible pour l&apos;instant — efface pour choisir dans la liste.</div>
            ) : suggestions.length === 0 ? (
              <div className="text-[12px] text-muted py-3 px-1">Aucune ville trouvée.</div>
            ) : (
              suggestions.map((v) => (
                <button
                  key={`${v.lat},${v.lon}`}
                  role="radio"
                  aria-checked={profile.city === v.name}
                  onClick={() => choisirVille(v.name)}
                  className="flex items-center gap-3 min-h-[48px] px-1 border-b border-border last:border-b-0 text-left cursor-pointer"
                >
                  <span className="text-[13px] text-ink truncate">{libelleVille(v)}</span>
                </button>
              ))
            )
          ) : (
            CITIES.map((c) => {
              const actif = profile.city === c.city;
              return (
                <button
                  key={c.city}
                  role="radio"
                  aria-checked={actif}
                  onClick={() => choisirVille(c.city)}
                  className="flex items-center justify-between gap-3 min-h-[48px] px-1 border-b border-border last:border-b-0 text-left cursor-pointer"
                >
                  <span className={"text-[13px] " + (actif ? "text-terracotta" : "text-ink")}>
                    {c.city} <span className="text-muted">· {c.country}</span>
                  </span>
                  {actif && (
                    <span aria-hidden="true" className="text-terracotta text-[14px]">
                      ✓
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </BottomSheet>

      <BottomSheet title="Ta date de naissance" open={dateOuverte} onClose={() => setDateOuverte(false)}>
        <label htmlFor="date-naissance" className="block text-[12px] text-muted leading-[1.45] mb-2">
          Elle reste privée et n&apos;est jamais affichée ailleurs que sur ton profil.
        </label>
        <input
          id="date-naissance"
          type="date"
          value={dateBrouillon}
          min="1900-01-01"
          max={aujourdhui || undefined}
          onChange={(e) => setDateBrouillon(e.target.value)}
          className="w-full bg-card border border-border rounded-[14px] px-4 min-h-[48px] text-[14px] text-ink font-sans"
          style={{ colorScheme: "light" }}
        />
        {dateBrouillon && !dateValide && (
          <div className="text-[12px] text-rust mt-2" role="alert">
            Choisis une date passée, après 1900.
          </div>
        )}
        <button
          disabled={!dateValide}
          onClick={() => {
            setDateOuverte(false);
            saveProfile({ ...profile, birthdate: dateBrouillon });
          }}
          className="mt-4 w-full rounded-full bg-terracotta text-cream text-[12px] tracking-[.1em] uppercase cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ minHeight: 48 }}
        >
          Enregistrer
        </button>
        {profile.birthdate && (
          <button
            onClick={() => {
              setDateOuverte(false);
              saveProfile({ ...profile, birthdate: null });
            }}
            className="mt-2 w-full text-center text-[12px] text-muted min-h-[44px] cursor-pointer"
          >
            Retirer ma date de naissance
          </button>
        )}
      </BottomSheet>

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
