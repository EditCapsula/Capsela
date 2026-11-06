"use client";

import Rangee from "@/components/Rangee";
import { useEffect, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import BottomSheet from "@/components/BottomSheet";
import {
  FeuilleVille,
  I_BOUCLIER,
  I_BULLE,
  I_CALENDRIER,
  I_CLOCHE,
  I_COMPTE,
  I_GLOBE,
  I_LIVRE,
  I_QUESTION,
  I_REGLAGES,
  I_REPERE,
  I_SORTIE,
  I_THERMOMETRE,
  I_ETINCELLE,
  I_REPRENDRE,
  Icone,
  LigneProfil,
  Surtitre,
} from "@/components/ProfilUI";
import { VueCompte, VueDonnees } from "@/components/ReglagesCompte";
import { useAuth } from "@/lib/auth";
import { CENTRE_AIDE, CENTRE_AIDE_VALIDE } from "@/lib/centreAide";
import { DEFAULT_PREFS, WORK_DAYS, type ProfilePrefs } from "@/lib/profile";
import { ajouterPeriode, jourLocal, libellePeriode, periodesAVenir, periodesDe, periodeValide, retirerPeriode } from "@/lib/conges";
import Input from "@/components/Input";
import { notificationsDisponiblesIci, synchroniserNotifications, type EtatNotifications } from "@/lib/notifications";
import { useCapsela } from "@/lib/store";
import type { VueReglages } from "@/lib/types";
import Button from "@/components/Button";
import Card from "@/components/Card";
import OptionRow from "@/components/OptionRow";
import { aTraduire, anglaisOuvert, choisirLangue, langue, t, type Langue } from "@/lib/langue";
import { demanderVisite } from "@/lib/memoireVisites";
import { oublierContexte } from "@/lib/memoireEcrans";
import { VISITES, type Visite } from "@/lib/visites";
import { VERSION_APP } from "@/lib/versionApp";

/*
 * RÉGLAGES CAPSELA (05/11/2026, maquette « Réglages Capsela », docs/reglages.md). Ouverte par l'engrenage du Profil. Elle
 * centralise le fonctionnement de l'app, le compte et l'assistance ; le Profil garde ce qui caractérise la personne (identité,
 * profil stylistique, tailles) et l'abonnement. Quatre sections :
 *
 *   Mon expérience               Notifications, Mon quotidien, Météo et localisation (sous-pages)
 *   Préférences de l'application Langue, Unités (feuilles), Réinitialiser les préférences
 *   Mon compte                   Compte et sécurité, Confidentialité et données (sous-pages, ReglagesCompte.tsx)
 *   Aide & Support               Tutoriel, Centre d'aide (une fois validé, centreAide.ts), Contacter Capsela
 *
 * Puis « Se déconnecter ». Les réglages eux-mêmes n'ont pas changé : mêmes champs (profile.prefs), même enregistrement
 * immédiat à chaque changement, même reprogrammation des notifications. Ils vivaient sur une seule page « Préférences
 * Capsela » (25/09/2026) et dans « Gérer mon compte » ; ils y sont repris tels quels. « Affichage » (thème, taille du texte) de
 * la maquette n'existe pas dans l'app : pas de ligne. La sous-page ouverte est dans le store (preferencesSection) : le Retour
 * d'Android, qui touche le bouton Retour visible, ramène d'une sous-page à Réglages.
 */

/** L'adresse de « Contacter Capsela » (05/11/2026, donnée par la propriétaire). */
export const EMAIL_SUPPORT = "capsela.app@gmail.com";

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

function Section({ titre, icone, children }: { titre: string; icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      {/* Le surtitre à pictogramme de Mon profil (27/09/2026) : les deux écrans se lisent comme un seul espace. */}
      <Surtitre icone={icone}>{titre}</Surtitre>
      <Card className="overflow-hidden">{children}</Card>
    </>
  );
}

function Ligne({ children }: { children: React.ReactNode }) {
  return <Rangee className="justify-between">{children}</Rangee>;
}

/** Le texte secondaire d'une ligne de Réglages, en gris comme sur la maquette. */
const Sous = ({ children }: { children: React.ReactNode }) => <span className="text-muted-3">{children}</span>;

const NOMS_LANGUES: Record<Langue, string> = { fr: aTraduire("Français"), en: aTraduire("Anglais") };

/** Titre (premier temps, second temps en italique) et chapeau de chaque sous-page. */
const SOUS_PAGES: Record<VueReglages, { titre: [string, string]; chapeau: string }> = {
  notifications: { titre: ["Mes ", "notifications"], chapeau: "Ta tenue du jour, à l'heure que tu choisis." },
  quotidien: { titre: ["Mon ", "quotidien"], chapeau: "Tes jours travaillés et tes congés orientent tes tenues." },
  localisation: { titre: ["Météo et ", "localisation"], chapeau: "D'où vient la météo de tes tenues." },
  compte: { titre: ["Compte et ", "sécurité"], chapeau: "Ton adresse e-mail et ton mot de passe." },
  donnees: { titre: ["Confidentialité et ", "données"], chapeau: "Tes consentements, tes données et ton compte." },
  centreAide: { titre: ["Centre ", "d'aide"], chapeau: "Les réponses aux questions fréquentes." },
};

export default function PreferencesScreen() {
  const { profile, saveProfile, email, demoMode, signOut } = useAuth();
  const { state, actions } = useCapsela();
  const vue = state.preferencesSection;
  // Chaque page s'ouvre en haut : la page Réglages et ses sous-pages partagent le même conteneur de défilement.
  const zoneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    zoneRef.current?.scrollTo({ top: 0 });
  }, [vue]);
  const prefs = profile.prefs;
  const [confirmerReinit, setConfirmerReinit] = useState(false);
  const [villeOuverte, setVilleOuverte] = useState(false);
  const [langueOuverte, setLangueOuverte] = useState(false);
  const [unitesOuvertes, setUnitesOuvertes] = useState(false);
  const [tutorielOuvert, setTutorielOuvert] = useState(false);
  const [contactOuvert, setContactOuvert] = useState(false);
  const [adresseCopiee, setAdresseCopiee] = useState(false);
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
  // sans tenir compte de leur ordre de saisie. Les visites guidées vues ne sont pas une préférence (05/11/2026).
  const parDefaut = (Object.keys(DEFAULT_PREFS) as (keyof ProfilePrefs)[]).every((k) =>
    k === "workDays"
      ? [...prefs.workDays].sort().join() === [...DEFAULT_PREFS.workDays].sort().join()
      : k === "conges"
        ? periodesDe(prefs.conges).length === 0
        : prefs[k] === DEFAULT_PREFS[k]
  );
  // La pastille sélectionnée canonique de l'app (terracotta, cf. les filtres du Dressing et des idées de tenues).
  const pastille = (on: boolean) => (on ? "bg-terracotta text-cream border-terracotta" : "bg-card text-muted-3 border-border");

  // Lu sur l'appareil, jamais stocké : l'app n'a pas de réglage de fuseau.
  const fuseau = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Revoir une visite : elle est demandée, puis son écran s'ouvre (VisiteGuidee la lance là-bas).
  const revoir = (v: Visite) => {
    setTutorielOuvert(false);
    demanderVisite(v.id);
    // L'écran s'ouvre à neuf, comme depuis la barre du bas (06/11/2026) : repris sur un autre onglet (Capsule → Explorer), il
    // n'aurait pas les cibles de la visite, et ses étapes seraient sautées.
    oublierContexte(v.ecran);
    if (v.ecran === "home") actions.goHome();
    else if (v.ecran === "wardrobe") actions.goWardrobe();
    else if (v.ecran === "capsule") actions.goCapsule();
  };

  const copierAdresse = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL_SUPPORT);
      setAdresseCopiee(true);
    } catch {
      setAdresseCopiee(false);
    }
  };

  const seDeconnecter = async () => {
    await signOut();
    actions.goLogin();
  };

  // Les résumés des lignes de la page Réglages : ce que dit vraiment chaque réglage.
  const joursTravailles = prefs.workDays.length;
  const resumeQuotidien = [
    `${joursTravailles} ${joursTravailles > 1 ? "jours travaillés" : "jour travaillé"}`,
    prefs.onVacation ? "en congés" : congesAVenir.length > 0 ? "congés prévus" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const resumeMeteo = [profile.city || "Ville non renseignée", prefs.geoConsent && prefs.weatherFromGeo ? "météo de ta position" : null]
    .filter(Boolean)
    .join(" · ");

  const titre = vue ? SOUS_PAGES[vue] : null;
  const retourLabel = vue && !state.preferencesDirect ? "Revenir aux réglages" : state.preferencesReturn === "profile" ? "Revenir au profil" : "Revenir à l'écran précédent";

  return (
    <div ref={zoneRef} className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      <AppHeader showAvatar={false} onBack={actions.closePreferences} backLabel={retourLabel} />
      <div className="t-surtitre text-muted mt-[18px]">{vue ? "Réglages" : "Profil"}</div>
      <h1 className="t-titre-ecran text-ink mt-[6px]">
        {titre ? titre.titre[0] : "Réglages "}
        <span className="italic text-terracotta">{titre ? titre.titre[1] : "Capsela"}</span>
      </h1>
      <div className="t-chapeau text-muted-3 mt-[8px]">{titre ? titre.chapeau : "Personnalise ton expérience et gère ton compte."}</div>

      {!vue && (
        <>
          <Section titre="Mon expérience" icone={I_ETINCELLE}>
            <LigneProfil
              icone={I_CLOCHE}
              titre="Notifications"
              valeur={<Sous>{prefs.notifEnabled ? `Tenue du jour à ${prefs.notifTime}` : "Tenue du jour désactivée"}</Sous>}
              renseigne
              onClick={() => actions.goPreferences("notifications")}
            />
            <LigneProfil
              icone={I_CALENDRIER}
              titre="Mon quotidien"
              valeur={<Sous>{resumeQuotidien}</Sous>}
              renseigne
              onClick={() => actions.goPreferences("quotidien")}
            />
            <LigneProfil
              icone={I_REPERE}
              titre="Météo et localisation"
              valeur={<Sous>{resumeMeteo}</Sous>}
              renseigne
              onClick={() => actions.goPreferences("localisation")}
            />
          </Section>

          {/* La langue se choisit une fois l'anglais ouvert (05/11/2026, langue.ts) ; avant, elle est affichée seulement — un
              chevron promettrait un choix qui n'existe pas. */}
          <Section titre="Préférences de l'application" icone={I_REGLAGES}>
            <LigneProfil
              icone={I_GLOBE}
              titre={t("Langue")}
              valeur={<Sous>{t(NOMS_LANGUES[langue()])}</Sous>}
              renseigne
              onClick={anglaisOuvert() ? () => setLangueOuverte(true) : undefined}
            />
            <LigneProfil
              icone={I_THERMOMETRE}
              titre="Unités"
              valeur={<Sous>{prefs.unitSystem === "imperial" ? "Température en °F" : "Température en °C"}</Sous>}
              renseigne
              onClick={() => setUnitesOuvertes(true)}
            />
            <LigneProfil
              icone={I_REPRENDRE}
              titre="Réinitialiser les préférences"
              valeur={
                <Sous>
                  {parDefaut
                    ? reinitFaite
                      ? "C'est fait : tes préférences sont revenues à leurs réglages d'origine."
                      : "Tes préférences sont déjà à leurs réglages d'origine."
                    : "Notifications, météo, unités, jours travaillés et congés."}
                </Sous>
              }
              renseigne
              onClick={parDefaut ? undefined : () => setConfirmerReinit(true)}
            />
          </Section>

          {/* L'abonnement n'a pas de ligne ici : son emplacement de référence est la carte « Mon abonnement » du Profil. */}
          <Section titre="Mon compte" icone={I_COMPTE}>
            <LigneProfil
              icone={I_COMPTE}
              titre="Compte et sécurité"
              valeur={<Sous>{demoMode ? "Mode démo" : email ?? "E-mail, mot de passe"}</Sous>}
              renseigne
              onClick={() => actions.goPreferences("compte")}
            />
            <LigneProfil
              icone={I_BOUCLIER}
              titre="Confidentialité et données"
              valeur={<Sous>Tes données, informations légales, suppression du compte.</Sous>}
              renseigne
              onClick={() => actions.goPreferences("donnees")}
            />
          </Section>

          <Section titre={t("Aide & Support")} icone={I_QUESTION}>
            <LigneProfil
              icone={I_LIVRE}
              titre={t("Tutoriel")}
              valeur={<Sous>{t("Revoir les visites guidées de l'application.")}</Sous>}
              renseigne
              onClick={() => setTutorielOuvert(true)}
            />
            {CENTRE_AIDE_VALIDE && (
              <LigneProfil
                icone={I_QUESTION}
                titre={t("Centre d'aide")}
                valeur={<Sous>{t("Les réponses aux questions fréquentes.")}</Sous>}
                renseigne
                onClick={() => actions.goPreferences("centreAide")}
              />
            )}
            <LigneProfil
              icone={I_BULLE}
              titre={t("Contacter Capsela")}
              valeur={<Sous>{EMAIL_SUPPORT}</Sous>}
              renseigne
              onClick={() => {
                setAdresseCopiee(false);
                setContactOuvert(true);
              }}
            />
          </Section>

          {/* La déconnexion existante (auth.signOut, puis l'écran de connexion), sans confirmation : il n'y en avait pas. */}
          <Button variante="contour" className="mt-8" onClick={seDeconnecter}>
            <Icone taille={17}>{I_SORTIE}</Icone>
            Se déconnecter
          </Button>
          <div className="text-center text-[11px] text-placeholder mt-[12px]">Capsela · version {VERSION_APP}</div>
        </>
      )}

      {vue === "notifications" && (
        <Card className="overflow-hidden mt-6">
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
          {/* La phrase « Les notifications arrivent dans l'application Capsela sur Android. Le site n'en envoie pas. », affichée
              sur le site, a été retirée le 05/11/2026 (demandé : « cette phrase ne sert à rien »). */}
          {prefs.notifEnabled && etatNotif === "refusee" && (
            <div className="px-4 py-[12px] text-[11px] text-rust leading-[1.45]" role="alert">
              Ton téléphone bloque les notifications de Capsela. Autorise-les dans ses réglages (Applications, Capsela, Notifications).
            </div>
          )}
        </Card>
      )}

      {vue === "quotidien" && (
        <Card className="overflow-hidden mt-6">
          <div className="px-4 py-[14px] border-b border-border">
            <div className="text-[13px] text-ink">Jours travaillés</div>
            <div className="text-[11px] text-muted mt-[2px] leading-[1.35]">Utilisés pour adapter tes recommandations (tenues de travail vs week-end).</div>
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
                      <span aria-hidden="true" className="text-[16px] leading-none">
                        ×
                      </span>
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
        </Card>
      )}

      {/* LA SEULE PAGE DE CONFIGURATION DE LA MÉTÉO : la ligne météo de l'Accueil et de Tenue et « Mon lieu et ma météo » du
          Profil y mènent. Le fuseau est AFFICHÉ, pas réglable : il est lu sur l'appareil. */}
      {vue === "localisation" && (
        <Card className="overflow-hidden mt-6">
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
          {/* LA VILLE (27/09/2026) : réglée ici, avec la géolocalisation dont elle est le relais. */}
          <Rangee onClick={() => setVilleOuverte(true)} className="justify-between">
            <span className="text-[13px] text-ink">Ville</span>
            <span className="flex items-center gap-[10px] min-w-0">
              <span className={"text-[13px] truncate " + (profile.city ? "text-muted-3" : "text-placeholder")}>{profile.city || "Non renseignée"}</span>
              <span aria-hidden="true" className="text-placeholder text-[15px] flex-shrink-0">
                ›
              </span>
            </span>
          </Rangee>
          <Ligne>
            <span className="text-[13px] text-ink">Fuseau horaire</span>
            <span className="text-[13px] text-muted-3 truncate">{fuseau}</span>
          </Ligne>
        </Card>
      )}

      {vue === "compte" && <VueCompte />}
      {vue === "donnees" && <VueDonnees />}

      {vue === "centreAide" &&
        CENTRE_AIDE.map((theme) => (
          <div key={theme.id}>
            <div className="t-surtitre text-muted mt-7 mb-[10px]">{theme.titre}</div>
            <Card className="overflow-hidden">
              {theme.questions.map((q) => (
                <details key={q.question} className="group border-b border-border last:border-b-0">
                  <summary className="flex items-center justify-between gap-3 px-4 py-[14px] cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <span className="t-titre-ligne text-ink">{q.question}</span>
                    <span aria-hidden="true" className="text-placeholder text-[15px] flex-shrink-0 transition-transform group-open:rotate-90">
                      ›
                    </span>
                  </summary>
                  <div className="px-4 pb-[14px] -mt-[4px] text-[13px] text-muted-3 leading-[1.5]">{q.reponse}</div>
                </details>
              ))}
            </Card>
          </div>
        ))}

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

      {/* UNITÉS (05/11/2026, unites.ts) : l'affichage des températures. Rien d'autre ne se mesure dans l'app (les tailles sont des
          tailles) : la feuille ne propose que ce qui change vraiment. */}
      <BottomSheet title="Unités" open={unitesOuvertes} onClose={() => setUnitesOuvertes(false)}>
        <div className="text-[12px] text-muted mb-[12px] leading-[1.45]">L&apos;unité des températures affichées dans l&apos;app.</div>
        <div className="flex flex-col gap-[8px]">
          {(
            [
              ["metric", "Degrés Celsius (°C)"],
              ["imperial", "Degrés Fahrenheit (°F)"],
            ] as const
          ).map(([cle, libelle]) => (
            <OptionRow
              key={cle}
              label={libelle}
              on={prefs.unitSystem === cle}
              accent
              onClick={() => {
                setUnitesOuvertes(false);
                if (prefs.unitSystem !== cle) setPrefs({ unitSystem: cle });
              }}
            />
          ))}
        </div>
      </BottomSheet>

      {/* TUTORIEL (05/11/2026) : les visites guidées (lib/visites.ts). La visite choisie est demandée, puis son écran s'ouvre et
          elle s'y joue, même déjà vue. */}
      <BottomSheet title={t("Tutoriel")} open={tutorielOuvert} onClose={() => setTutorielOuvert(false)}>
        <div className="text-[12px] text-muted mb-[12px] leading-[1.45]">{t("Choisis une visite : son écran s'ouvre et elle recommence.")}</div>
        <Card className="overflow-hidden">
          {VISITES.map((v) => (
            <Rangee key={v.id} onClick={() => revoir(v)} className="justify-between">
              <span className="text-[13px] text-ink">{t(v.nom)}</span>
              <span aria-hidden="true" className="text-placeholder text-[15px]">
                ›
              </span>
            </Rangee>
          ))}
        </Card>
      </BottomSheet>

      {/* CONTACTER CAPSELA : la messagerie s'ouvre vers l'adresse du support ; l'adresse est affichée et se copie, au cas où
          aucune messagerie ne s'ouvre sur l'appareil. Aucun délai de réponse n'est promis. */}
      <BottomSheet title={t("Contacter Capsela")} open={contactOuvert} onClose={() => setContactOuvert(false)}>
        <div className="text-[13px] text-ink leading-[1.55]">{t("Une question, une remarque ? Écris-nous :")}</div>
        <div className="text-[15px] text-ink font-medium mt-[6px] [overflow-wrap:anywhere]">{EMAIL_SUPPORT}</div>
        <a
          href={`mailto:${EMAIL_SUPPORT}`}
          className="mt-[20px] rounded-full t-bouton min-h-[52px] px-5 flex w-full items-center justify-center bg-terracotta-deep active:bg-terracotta-hover text-cream"
        >
          {t("Écrire un e-mail")}
        </a>
        <Button variante="secondaire" className="mt-[10px]" onClick={copierAdresse}>
          {adresseCopiee ? t("Adresse copiée") : t("Copier l'adresse")}
        </Button>
      </BottomSheet>

      <BottomSheet title="Réinitialiser les préférences" open={confirmerReinit} onClose={() => setConfirmerReinit(false)}>
        <div className="text-[13px] text-ink leading-[1.55]">
          Notifications, météo, unités, jours travaillés et congés reviennent à leurs réglages d&apos;origine. Ton profil, ton dressing
          et tes looks ne changent pas.
        </div>
        <Button
          variante="sombre"
          className="mt-[22px]"
          onClick={() => {
            setConfirmerReinit(false);
            setReinitFaite(true);
            // Les visites guidées vues ne sont pas une préférence : la réinitialisation ne les fait pas revenir (05/11/2026).
            saveProfile({ ...profile, prefs: { ...DEFAULT_PREFS, ...(prefs.visitesVues ? { visitesVues: prefs.visitesVues } : {}) } });
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
