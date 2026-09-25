"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import BottomSheet from "@/components/BottomSheet";
import { useAuth } from "@/lib/auth";
import { DEFAULT_PREFS, WORK_DAYS, type ProfilePrefs } from "@/lib/profile";
import { useCapsela } from "@/lib/store";

/*
 * PRÉFÉRENCES CAPSELA (architecture du profil, 25/09/2026) : « comment je
 * veux que Capsela fonctionne pour moi ». Ces réglages vivaient dans l'écran
 * d'édition du profil, mêlés à l'identité et aux goûts ; ils en sont sortis
 * tels quels — mêmes champs (profile.prefs), même enregistrement immédiat à
 * chaque changement. Rien n'est une navigation ici, sauf la réinitialisation,
 * qui demande confirmation.
 */

export function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="w-11 h-[26px] rounded-full cursor-pointer relative flex-shrink-0 transition-colors"
      style={{ background: on ? "#A66950" : "#E6DCCB" }}
    >
      <span className="absolute top-[3px] w-5 h-5 rounded-full bg-cream transition-all" style={{ left: on ? 21 : 3 }} />
    </button>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <>
      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-7 mb-[10px]">{titre}</div>
      <div className="bg-card border border-border rounded-[20px] overflow-hidden">{children}</div>
    </>
  );
}

function Ligne({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 px-4 py-[14px] border-b border-border last:border-b-0">{children}</div>;
}

export default function PreferencesScreen() {
  const { profile, saveProfile } = useAuth();
  const { actions } = useCapsela();
  const prefs = profile.prefs;
  const setPrefs = (p: Partial<ProfilePrefs>) => saveProfile({ ...profile, prefs: { ...prefs, ...p } });
  const [confirmerReinit, setConfirmerReinit] = useState(false);

  // Lu sur l'appareil, jamais stocké : l'app n'a pas de réglage de fuseau.
  const fuseau = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      <AppHeader showAvatar={false} onBack={actions.goProfile} backLabel="Revenir au profil" />
      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-[18px]">Profil</div>
      <div className="font-serif text-[27px] leading-[1.12] text-ink mt-[6px]">
        Préférences <span className="italic text-terracotta">Capsela</span>
      </div>
      <div className="text-[13px] text-muted-3 leading-[1.5] mt-[8px]">
        Personnalise le fonctionnement de l&apos;application selon ton mode de vie.
      </div>

      <Section titre="Notifications">
        <Ligne>
          <span className="text-[13px] text-ink">Recevoir ma tenue du jour</span>
          <Toggle on={prefs.notifEnabled} onClick={() => setPrefs({ notifEnabled: !prefs.notifEnabled })} label="Recevoir ma tenue du jour" />
        </Ligne>
        <Ligne>
          <label htmlFor="heure-reception" className="text-[13px] text-ink">
            Heure de réception
          </label>
          <input
            id="heure-reception"
            type="time"
            value={prefs.notifTime}
            onChange={(e) => setPrefs({ notifTime: e.target.value })}
            className="border-none bg-transparent text-[13px] text-ink font-sans outline-none min-h-[32px]"
          />
        </Ligne>
      </Section>

      <Section titre="Localisation & météo">
        <Ligne>
          <div className="flex-1 min-w-0 pr-2">
            <div className="text-[13px] text-ink">Autoriser la géolocalisation</div>
            <div className="text-[11px] text-muted mt-[2px] leading-[1.35]">Pour situer ta ville et adapter tes tenues.</div>
          </div>
          <Toggle on={prefs.geoConsent} onClick={() => setPrefs({ geoConsent: !prefs.geoConsent })} label="Autoriser la géolocalisation" />
        </Ligne>
        <Ligne>
          <div className="flex-1 min-w-0 pr-2">
            <div className="text-[13px] text-ink">Utiliser la météo de ma position</div>
            <div className="text-[11px] text-muted mt-[2px] leading-[1.35]">Sinon, la météo de ta ville renseignée est utilisée.</div>
          </div>
          <Toggle on={prefs.weatherFromGeo} onClick={() => setPrefs({ weatherFromGeo: !prefs.weatherFromGeo })} label="Utiliser la météo de ma position" />
        </Ligne>
        <div className="flex gap-2 px-4 py-[14px]">
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
                aria-pressed={on}
                className={
                  "px-[14px] min-h-[40px] rounded-full text-[12px] cursor-pointer font-sans border " +
                  (on ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border")
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section titre="Mon rythme">
        <div className="px-4 py-[14px] border-b border-border">
          <div className="text-[13px] text-ink">Jours travaillés</div>
          <div className="text-[11px] text-muted mt-[2px] leading-[1.35]">
            Utilisés pour adapter tes recommandations (tenues de travail vs week-end).
          </div>
          <div className="flex gap-[6px] mt-3">
            {WORK_DAYS.map((d) => {
              const on = prefs.workDays.includes(d);
              return (
                <button
                  key={d}
                  onClick={() => setPrefs({ workDays: on ? prefs.workDays.filter((x) => x !== d) : [...prefs.workDays, d] })}
                  aria-pressed={on}
                  className={
                    "flex-1 text-center min-h-[38px] px-1 rounded-full text-[12px] cursor-pointer font-sans border " +
                    (on ? "bg-ink text-cream border-ink" : "bg-card text-muted border-border")
                  }
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
        <Ligne>
          <div className="flex-1 min-w-0 pr-2">
            <div className="text-[13px] text-ink">Je suis en congés</div>
            <div className="text-[11px] text-muted mt-[2px] leading-[1.35]">Met en pause les recommandations liées au travail.</div>
          </div>
          <Toggle on={prefs.onVacation} onClick={() => setPrefs({ onVacation: !prefs.onVacation })} label="Je suis en congés" />
        </Ligne>
      </Section>

      {/* AUTRES. Langue et fuseau sont AFFICHÉS, pas réglables : l'app n'existe
          qu'en français et n'a aucun réglage de fuseau (celui-ci est lu sur
          l'appareil). Un chevron promettrait un écran qui n'existe pas. */}
      <Section titre="Autres">
        <Ligne>
          <span className="text-[13px] text-ink">Langue</span>
          <span className="text-[13px] text-muted-3">Français</span>
        </Ligne>
        <Ligne>
          <span className="text-[13px] text-ink">Fuseau horaire</span>
          <span className="text-[13px] text-muted-3 truncate">{fuseau}</span>
        </Ligne>
        <button
          onClick={() => setConfirmerReinit(true)}
          className="w-full flex items-center justify-between gap-3 px-4 py-[14px] text-left cursor-pointer"
        >
          <span className="text-[13px] text-ink">Réinitialiser les préférences</span>
          <span aria-hidden="true" className="text-placeholder text-[15px]">›</span>
        </button>
      </Section>

      <BottomSheet title="Réinitialiser les préférences" open={confirmerReinit} onClose={() => setConfirmerReinit(false)}>
        <div className="text-[13px] text-ink leading-[1.55]">
          Notifications, météo, unités, jours travaillés et congés reviennent à leurs réglages d&apos;origine. Ton profil,
          ton dressing et tes looks ne changent pas.
        </div>
        <button
          onClick={() => {
            setConfirmerReinit(false);
            saveProfile({ ...profile, prefs: DEFAULT_PREFS });
          }}
          className="mt-[22px] w-full text-center rounded-full py-[14px] text-[12px] tracking-[.1em] uppercase bg-ink text-cream cursor-pointer"
        >
          Réinitialiser
        </button>
        <button onClick={() => setConfirmerReinit(false)} className="mt-[10px] w-full text-center text-[13px] text-muted py-[10px] cursor-pointer">
          Annuler
        </button>
      </BottomSheet>
    </div>
  );
}
