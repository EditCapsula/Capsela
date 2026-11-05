"use client";

import Rangee from "@/components/Rangee";
import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import BottomSheet from "@/components/BottomSheet";
import { FeuilleVille, I_CALENDRIER, I_CLOCHE, I_GRAPHIQUE, I_REPERE, Surtitre } from "@/components/ProfilUI";
import { useAuth } from "@/lib/auth";
import { DEFAULT_PREFS, WORK_DAYS, type ProfilePrefs } from "@/lib/profile";
import { ajouterPeriode, jourLocal, libellePeriode, periodesAVenir, periodesDe, periodeValide, retirerPeriode } from "@/lib/conges";
import Input from "@/components/Input";
import { notificationsDisponiblesIci, synchroniserNotifications, type EtatNotifications } from "@/lib/notifications";
import { useCapsela } from "@/lib/store";
import Button from "@/components/Button";
import Card from "@/components/Card";
import OptionRow from "@/components/OptionRow";
import { aTraduire, anglaisOuvert, choisirLangue, langue, t, type Langue } from "@/lib/langue";

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
      style={{ background: on ? "var(--color-terracotta)" : "var(--color-border)" }}
    >
      <span className="absolute top-[3px] w-5 h-5 rounded-full bg-cream transition-all" style={{ left: on ? 21 : 3 }} />
    </button>
  );
}

function Section({ titre, icone, id, children }: { titre: string; icone: React.ReactNode; id?: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-4">
      {/* Le surtitre à pictogramme de Mon profil (27/09/2026) : les deux
          écrans se lisent comme un seul espace. */}
      <Surtitre icone={icone}>{titre}</Surtitre>
      <Card className="overflow-hidden">{children}</Card>
    </div>
  );
}

function Ligne({ children }: { children: React.ReactNode }) {
  return <Rangee className="justify-between">{children}</Rangee>;
}

const NOMS_LANGUES: Record<Langue, string> = { fr: aTraduire("Français"), en: aTraduire("Anglais") };

export default function PreferencesScreen() {
  const { profile, saveProfile } = useAuth();
  const { state, actions } = useCapsela();
  // Ouverture ciblée (27/09/2026) : la ligne météo (Accueil, Tenue) et « Ta
  // météo » du Profil amènent directement « Localisation & météo » dans la vue.
  useEffect(() => {
    if (state.preferencesSection !== "localisation") return;
    document.getElementById("prefs-localisation")?.scrollIntoView({ block: "start" });
    actions.oublierSectionPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.preferencesSection]);
  const prefs = profile.prefs;
  const [confirmerReinit, setConfirmerReinit] = useState(false);
  const [villeOuverte, setVilleOuverte] = useState(false);
  const [langueOuverte, setLangueOuverte] = useState(false);
  const [reinitFaite, setReinitFaite] = useState(false);
  // La notification suit le réglage (04/11/2026, notifications.ts) : chaque changement de l'interrupteur ou de l'heure la
  // reprogramme. `etatNotif` dit ce que le téléphone a répondu — autorisation refusée, ou web, où rien n'est envoyé.
  const [etatNotif, setEtatNotif] = useState<EtatNotifications | null>(null);
  const [debutConges, setDebutConges] = useState("");
  const [finConges, setFinConges] = useState("");
  const aujourdhuiIso = jourLocal(new Date());
  const congesAVenir = periodesAVenir(prefs.conges);
  const setPrefs = (p: Partial<ProfilePrefs>) => {
    setReinitFaite(false);
    const suivantes = { ...prefs, ...p };
    saveProfile({ ...profile, prefs: suivantes });
    if ("notifEnabled" in p || "notifTime" in p || "conges" in p) {
      void synchroniserNotifications(suivantes, true).then(setEtatNotif);
    }
  };
  // Signalé le 15/10/2026 : « Réinitialiser ne fait rien ». Elle agissait, mais sur des réglages déjà d'origine, et sans rien dire.
  // La ligne le dit désormais : réglages déjà d'origine (rien à réinitialiser), ou réinitialisation faite. Les jours se comparent
  // sans tenir compte de leur ordre de saisie.
  const parDefaut =
    (Object.keys(DEFAULT_PREFS) as (keyof ProfilePrefs)[]).every((k) =>
      k === "workDays"
        ? [...prefs.workDays].sort().join() === [...DEFAULT_PREFS.workDays].sort().join()
        : k === "conges"
          ? periodesDe(prefs.conges).length === 0
          : prefs[k] === DEFAULT_PREFS[k]
    );
  // La pastille sélectionnée canonique de l'app (terracotta, cf. les filtres
  // du Dressing et des idées de tenues) — elle était ici la seule en encre.
  const pastille = (on: boolean) => (on ? "bg-terracotta text-cream border-terracotta" : "bg-card text-muted-3 border-border");

  // Lu sur l'appareil, jamais stocké : l'app n'a pas de réglage de fuseau.
  const fuseau = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      <AppHeader
        showAvatar={false}
        onBack={actions.closePreferences}
        backLabel={state.preferencesReturn === "profile" ? "Revenir au profil" : "Revenir à l'écran précédent"}
      />
      <div className="t-surtitre text-muted mt-[18px]">Profil</div>
      <div className="t-titre-ecran text-ink mt-[6px]">
        Préférences <span className="italic text-terracotta">Capsela</span>
      </div>
      <div className="t-chapeau text-muted-3 mt-[8px]">
        Personnalise le fonctionnement de l&apos;application selon ton mode de vie.
      </div>

      <Section titre="Notifications" icone={I_CLOCHE}>
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
        {/* La phrase « Les notifications arrivent dans l'application Capsela sur Android. Le site n'en envoie pas. », affichée sur le
            site, a été retirée le 05/11/2026 (demandé : « cette phrase ne sert à rien »). */}
        {prefs.notifEnabled && etatNotif === "refusee" && (
          <div className="px-4 py-[12px] text-[11px] text-rust leading-[1.45]" role="alert">
            Ton téléphone bloque les notifications de Capsela. Autorise-les dans ses réglages (Applications, Capsela,
            Notifications).
          </div>
        )}
      </Section>

      <Section titre="Localisation & météo" icone={I_REPERE} id="prefs-localisation">
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
            <div className="text-[11px] text-muted mt-[2px] leading-[1.35]">Sinon, la météo de la ville renseignée est utilisée.</div>
          </div>
          <Toggle on={prefs.weatherFromGeo} onClick={() => setPrefs({ weatherFromGeo: !prefs.weatherFromGeo })} label="Utiliser la météo de ma position" />
        </Ligne>
        {/* LA VILLE (27/09/2026) : réglée ici, avec la géolocalisation dont
            elle est le relais — la ligne « Ta météo » de Mon profil y mène. */}
        <button
          onClick={() => setVilleOuverte(true)}
          className="w-full flex items-center justify-between gap-3 px-4 py-[14px] text-left cursor-pointer border-b border-border"
        >
          <span className="text-[13px] text-ink">Ville</span>
          <span className="flex items-center gap-[10px] min-w-0">
            <span className={"text-[13px] truncate " + (profile.city ? "text-muted-3" : "text-placeholder")}>{profile.city || "Non renseignée"}</span>
            <span aria-hidden="true" className="text-placeholder text-[15px] flex-shrink-0">›</span>
          </span>
        </button>
        <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-[14px]">
          <span className="text-[13px] text-ink">Unités</span>
          <span className="flex gap-2">
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
                className={"px-[14px] min-h-[40px] rounded-full text-[12px] cursor-pointer font-sans border " + pastille(on)}
              >
                {label}
              </button>
            );
          })}
          </span>
        </div>
      </Section>

      <Section titre="Mon rythme" icone={I_CALENDRIER}>
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
                  className={"flex-1 text-center min-h-[38px] px-1 rounded-full text-[12px] cursor-pointer font-sans border " + pastille(on)}
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
        {/* MES CONGÉS DATÉS (04/11/2026, conges.ts) : chaque jour d'une période compte comme « Je suis en congés », sans avoir à
            basculer l'interrupteur ; la veille de la reprise, une notification rappelle de préparer sa tenue (application). */}
        <div className="px-4 py-[14px] border-t border-border">
          <div className="text-[13px] text-ink">Mes congés</div>
          <div className="text-[11px] text-muted mt-[2px] leading-[1.35]">
            Pendant ces dates, plus de tenues de travail.
            {/* Le rappel n'existe que dans l'application (notifications.ts) : le site ne le promet pas. */}
            {notificationsDisponiblesIci() && " La veille de ta reprise, Capsela te le rappelle."}
          </div>
          {congesAVenir.length > 0 && (
            <ul className="mt-3 flex flex-col gap-[6px] list-none p-0">
              {congesAVenir.map((p) => (
                <li key={p.debut + p.fin} className="flex items-center justify-between gap-3 bg-warm-bg rounded-champ pl-[12px] pr-[4px] min-h-[40px]">
                  <span className="text-[13px] text-ink">{libellePeriode(p)}</span>
                  <button
                    type="button"
                    onClick={() => setPrefs({ conges: retirerPeriode(prefs.conges, p) })}
                    aria-label={`Retirer les congés du ${libellePeriode(p)}`}
                    className="w-[40px] h-[40px] flex items-center justify-center text-muted cursor-pointer"
                  >
                    <span aria-hidden="true" className="text-[16px] leading-none">×</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-end gap-[8px] mt-3">
            <label className="flex-1 min-w-0">
              <span className="block text-[11px] text-muted mb-[4px]">Du</span>
              <Input type="date" value={debutConges} min={aujourdhuiIso} onChange={(e) => setDebutConges(e.target.value)} style={{ colorScheme: "light" }} />
            </label>
            <label className="flex-1 min-w-0">
              <span className="block text-[11px] text-muted mb-[4px]">Au</span>
              <Input type="date" value={finConges} min={debutConges || aujourdhuiIso} onChange={(e) => setFinConges(e.target.value)} style={{ colorScheme: "light" }} />
            </label>
          </div>
          <Button
            variante="contour"
            className="mt-3"
            disabled={!periodeValide({ debut: debutConges, fin: finConges })}
            onClick={() => {
              setPrefs({ conges: ajouterPeriode(prefs.conges, { debut: debutConges, fin: finConges }) });
              setDebutConges("");
              setFinConges("");
            }}
          >
            Ajouter ces congés
          </Button>
        </div>
      </Section>

      {/* AUTRES. Le fuseau est AFFICHÉ, pas réglable : il est lu sur l'appareil. La langue se choisit une fois l'anglais ouvert
          (05/11/2026, langue.ts) ; avant, elle est affichée seulement — un chevron promettrait un choix qui n'existe pas. */}
      <Section titre="Autres" icone={I_GRAPHIQUE}>
        {anglaisOuvert() ? (
          <button onClick={() => setLangueOuverte(true)} className="w-full flex items-center justify-between gap-3 px-4 py-[14px] text-left cursor-pointer">
            <span className="text-[13px] text-ink">{t("Langue")}</span>
            <span className="flex items-center gap-[8px] text-[13px] text-muted-3">
              {t(NOMS_LANGUES[langue()])}
              <span aria-hidden="true" className="text-placeholder text-[15px]">›</span>
            </span>
          </button>
        ) : (
          <Ligne>
            <span className="text-[13px] text-ink">Langue</span>
            <span className="text-[13px] text-muted-3">Français</span>
          </Ligne>
        )}
        <Ligne>
          <span className="text-[13px] text-ink">Fuseau horaire</span>
          <span className="text-[13px] text-muted-3 truncate">{fuseau}</span>
        </Ligne>
        {parDefaut ? (
          <div className="px-4 py-[14px]" role="status">
            <div className="text-[13px] text-muted-3">Réinitialiser les préférences</div>
            <div className="text-[11px] text-muted mt-[2px] leading-[1.35]">
              {reinitFaite ? "C'est fait : tes préférences sont revenues à leurs réglages d'origine." : "Tes préférences sont déjà à leurs réglages d'origine."}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmerReinit(true)}
            className="w-full flex items-center justify-between gap-3 px-4 py-[14px] text-left cursor-pointer"
          >
            <span className="text-[13px] text-ink">Réinitialiser les préférences</span>
            <span aria-hidden="true" className="text-placeholder text-[15px]">›</span>
          </button>
        )}
      </Section>

      <FeuilleVille open={villeOuverte} onClose={() => setVilleOuverte(false)} />

      <BottomSheet title={t("Choisir la langue")} open={langueOuverte} onClose={() => setLangueOuverte(false)}>
        <div className="text-[12px] text-muted mb-[12px]">{t("L'app redémarre dans la langue choisie.")}</div>
        <div className="flex flex-col gap-[8px]">
          {(["fr", "en"] as Langue[]).map((l) => (
            <OptionRow
              key={l}
              label={t(NOMS_LANGUES[l])}
              on={langue() === l}
              accent
              onClick={() => {
                setLangueOuverte(false);
                if (l !== langue()) choisirLangue(l);
              }}
            />
          ))}
        </div>
      </BottomSheet>

      <BottomSheet title="Réinitialiser les préférences" open={confirmerReinit} onClose={() => setConfirmerReinit(false)}>
        <div className="text-[13px] text-ink leading-[1.55]">
          Notifications, météo, unités, jours travaillés et congés reviennent à leurs réglages d&apos;origine. Ton profil,
          ton dressing et tes looks ne changent pas.
        </div>
        <Button variante="sombre" className="mt-[22px]"
          onClick={() => {
            setConfirmerReinit(false);
            setReinitFaite(true);
            saveProfile({ ...profile, prefs: DEFAULT_PREFS });
            void synchroniserNotifications(DEFAULT_PREFS, false).then(setEtatNotif);
          }}
        >
          Réinitialiser
        </Button>
        <button onClick={() => setConfirmerReinit(false)} className="mt-[10px] w-full text-center text-[13px] text-muted py-[10px] cursor-pointer">
          Annuler
        </button>
      </BottomSheet>
    </div>
  );
}
