"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { WORK_DAYS, genderLabel, paletteSummary, type ProfilePrefs } from "@/lib/profile";

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-11 h-[26px] rounded-full cursor-pointer relative flex-shrink-0 transition-colors"
      style={{ background: on ? "#A66950" : "#E6DCCB" }}
    >
      <span
        className="absolute top-[3px] w-5 h-5 rounded-full bg-cream transition-all"
        style={{ left: on ? 21 : 3 }}
      />
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-[26px] mb-[11px]">{children}</div>;
}

export default function ProfileEditScreen() {
  const { profile, email, signOut, saveProfile } = useAuth();
  const { state, actions } = useCapsela();

  const initial = (profile.displayName || email || "C").trim().charAt(0).toUpperCase() || "C";
  const prefs = profile.prefs;
  const setPrefs = (p: Partial<ProfilePrefs>) => saveProfile({ ...profile, prefs: { ...prefs, ...p } });

  const [nameDraft, setNameDraft] = useState(profile.displayName);
  // Le profil se charge de façon asynchrone (Supabase) après le montage —
  // resynchronise le brouillon si la vraie valeur arrive/change entre-temps
  // (ajustement pendant le rendu, jamais dans un effet, pour ne jamais
  // écraser une saisie en cours après le premier chargement).
  const [lastSeenName, setLastSeenName] = useState(profile.displayName);
  if (profile.displayName !== lastSeenName) {
    setLastSeenName(profile.displayName);
    setNameDraft(profile.displayName);
  }
  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed !== profile.displayName) saveProfile({ ...profile, displayName: trimmed });
  };

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPhotoUrl(URL.createObjectURL(file));
  };

  const birthdateText = profile.birthdate
    ? new Date(profile.birthdate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const handleSignOut = async () => {
    await signOut();
    actions.goWelcome();
  };

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-[100px]">
      <button
        onClick={actions.goProfile}
        className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
      >
        ←
      </button>

      <div className="flex flex-col items-center text-center mt-[6px]">
        <div
          className="w-24 h-24 rounded-full bg-terracotta flex items-center justify-center overflow-hidden bg-cover bg-center"
          style={photoUrl ? { backgroundImage: `url(${photoUrl})` } : undefined}
        >
          {!photoUrl && <span className="font-serif italic text-[40px] text-cream">{initial}</span>}
        </div>
        <input ref={photoInputRef} type="file" accept="image/*" onChange={onPhotoChange} className="hidden" />
        <button onClick={() => photoInputRef.current?.click()} className="text-[12px] text-terracotta mt-[10px] cursor-pointer">
          Modifier ma photo
        </button>
        <div className="text-[11px] text-muted mt-[6px] leading-[1.5] max-w-[270px]">
          Optionnelle. Sans photo, ton avatar reste l&apos;initiale de ton prénom. Elle sert uniquement à
          personnaliser ton profil — jamais partagée, jamais vendue.
        </div>
        <input
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitName}
          placeholder="Ton nom"
          className="font-serif text-[30px] text-ink mt-4 text-center bg-transparent border-none outline-none w-full placeholder:text-placeholder"
        />
        <div className="text-[13px] text-muted mt-[6px]">{profile.city}</div>
        {profile.gender && (
          <div className="text-[12px] text-terracotta bg-[#f0e5d6] rounded-full px-[13px] py-[5px] mt-2">
            {genderLabel(profile.gender)}
          </div>
        )}
        {birthdateText && <div className="text-[13px] text-muted mt-1">🎂 {birthdateText}</div>}
      </div>

      <div className="flex gap-3 mt-[26px]">
        <button onClick={actions.goWardrobe} className="flex-1 bg-card border border-border rounded-2xl p-[18px] text-center cursor-pointer">
          <div className="font-serif text-[30px] text-ink">{state.items.length}</div>
          <div className="text-[12px] text-muted mt-1">pièces ›</div>
        </button>
        <button onClick={actions.goHistory} className="flex-1 bg-card border border-border rounded-2xl p-[18px] text-center cursor-pointer">
          <div className="font-serif text-[30px] text-ink">{state.lookCount}</div>
          <div className="text-[12px] text-muted mt-1">looks portés ›</div>
        </button>
      </div>

      <div className="flex items-center justify-between mt-[26px] mb-[11px]">
        <span className="text-[11px] tracking-[.16em] uppercase text-muted">Ma silhouette</span>
        <button onClick={() => actions.goProfileSetup(4, true)} className="text-[12.5px] text-terracotta cursor-pointer">
          Modifier
        </button>
      </div>
      <div className="flex gap-[10px]">
        {[
          ["Haut", profile.tailleHaut],
          ["Bas", profile.tailleBas],
          ["Pointure", profile.pointure],
        ].map(([label, value]) => (
          <div key={label} className="flex-1 bg-card border border-border rounded-2xl p-4 text-center">
            <div className="text-[11.5px] text-muted">{label}</div>
            <div className="font-serif text-[22px] text-ink mt-[6px]">{value || "—"}</div>
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-2xl p-4 mt-[10px]">
        <div className="text-[11.5px] text-muted">Morphologie</div>
        <div className="text-[13.5px] text-ink mt-[6px]">{profile.morphology || "—"}</div>
      </div>

      <div className="flex items-center justify-between mt-[26px] mb-[11px]">
        <span className="text-[11px] tracking-[.16em] uppercase text-muted">Mes goûts</span>
        <button onClick={() => actions.goProfileSetup(1, true)} className="text-[12.5px] text-terracotta cursor-pointer">
          Modifier
        </button>
      </div>
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="text-[11.5px] text-muted">Palette</div>
        <div className="text-[13.5px] text-ink mt-[6px] leading-[1.4]">{paletteSummary(profile)}</div>
        <div className="h-px bg-border my-[14px]" />
        <div className="text-[11.5px] text-muted">Style</div>
        <div className="text-[13.5px] text-ink mt-[6px]">{profile.styles.join(", ") || "—"}</div>
      </div>

      <SectionLabel>Compte</SectionLabel>
      <div className="flex flex-col gap-[10px]">
        <div className="flex items-center justify-between bg-card border border-border rounded-[14px] px-4 py-[14px]">
          <span className="text-[13px] text-muted">E-mail</span>
          <span className="text-[13px] text-ink">{email ?? "non renseignée"}</span>
        </div>
        <div className="flex items-center justify-between bg-card border border-border rounded-[14px] px-4 py-[14px] cursor-pointer">
          <span className="text-[13px] text-ink">Gérer mon mot de passe</span>
          <span className="text-placeholder">›</span>
        </div>
      </div>
      <button onClick={handleSignOut} className="mt-3 w-full text-center text-[13px] text-terracotta cursor-pointer">
        Se déconnecter
      </button>

      <SectionLabel>Notifications</SectionLabel>
      <div className="flex items-center justify-between bg-card border border-border rounded-[14px] px-4 py-[14px]">
        <span className="text-[13px] text-ink">Recevoir ma tenue du jour</span>
        <Toggle on={prefs.notifEnabled} onClick={() => setPrefs({ notifEnabled: !prefs.notifEnabled })} />
      </div>
      <div className="flex items-center justify-between bg-card border border-border rounded-[14px] px-4 py-[14px] mt-[9px]">
        <span className="text-[13px] text-ink">Heure de réception</span>
        <input
          type="time"
          value={prefs.notifTime}
          onChange={(e) => setPrefs({ notifTime: e.target.value })}
          className="border-none bg-transparent text-[13px] text-ink font-sans outline-none"
        />
      </div>

      <SectionLabel>Localisation &amp; météo</SectionLabel>
      <div className="flex items-center justify-between bg-card border border-border rounded-[14px] px-4 py-[14px]">
        <div className="flex-1 pr-3">
          <span className="text-[13px] text-ink">Autoriser la géolocalisation</span>
          <div className="text-[11.5px] text-muted mt-[2px] leading-[1.35]">Pour situer ta ville et adapter tes tenues.</div>
        </div>
        <Toggle on={prefs.geoConsent} onClick={() => setPrefs({ geoConsent: !prefs.geoConsent })} />
      </div>
      <div className="flex items-center justify-between bg-card border border-border rounded-[14px] px-4 py-[14px] mt-[9px]">
        <div className="flex-1 pr-3">
          <span className="text-[13px] text-ink">Utiliser la météo de ma position</span>
          <div className="text-[11.5px] text-muted mt-[2px] leading-[1.35]">
            Sinon, la météo de ta ville renseignée est utilisée.
          </div>
        </div>
        <Toggle on={prefs.weatherFromGeo} onClick={() => setPrefs({ weatherFromGeo: !prefs.weatherFromGeo })} />
      </div>
      <div className="flex gap-2 mt-[9px]">
        {(
          [
            ["metric", "Métrique (°C, cm)"],
            ["imperial", "Impérial (°F, in)"],
          ] as const
        ).map(([key, label]) => {
          const on = prefs.unitSystem === key;
          return (
            <button
              key={key}
              onClick={() => setPrefs({ unitSystem: key })}
              className={
                "px-[14px] py-[11px] rounded-full text-[12.5px] cursor-pointer font-sans border " +
                (on ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border")
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      <SectionLabel>Jours travaillés</SectionLabel>
      <div className="text-[12px] text-muted mb-[11px] leading-[1.4] -mt-1">
        Utilisés pour adapter tes recommandations (tenues de travail vs week-end).
      </div>
      <div className="flex gap-[6px]">
        {WORK_DAYS.map((d) => {
          const on = prefs.workDays.includes(d);
          return (
            <button
              key={d}
              onClick={() =>
                setPrefs({ workDays: on ? prefs.workDays.filter((x) => x !== d) : [...prefs.workDays, d] })
              }
              className={
                "flex-1 text-center py-[10px] px-1 rounded-full text-[12px] cursor-pointer font-sans border " +
                (on ? "bg-ink text-cream border-ink" : "bg-card text-muted border-border")
              }
            >
              {d}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between bg-card border border-border rounded-[14px] px-4 py-[14px] mt-[22px]">
        <div>
          <div className="text-[13px] text-ink">Je suis en congés</div>
          <div className="text-[11.5px] text-muted mt-[2px]">Met en pause les recommandations liées au travail.</div>
        </div>
        <Toggle on={prefs.onVacation} onClick={() => setPrefs({ onVacation: !prefs.onVacation })} />
      </div>

      <button
        onClick={actions.goProfile}
        className="mt-7 w-full bg-terracotta text-cream text-center rounded-full py-4 text-[13px] tracking-[.14em] uppercase cursor-pointer"
      >
        Enregistrer
      </button>
    </div>
  );
}
