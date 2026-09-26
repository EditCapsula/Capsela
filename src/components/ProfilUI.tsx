"use client";

import { useEffect, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import { useAuth } from "@/lib/auth";
import { CITIES } from "@/lib/data";
import { jourLocal } from "@/lib/outfitFeedback";
import { GENDERS, type Gender, type GenderDependentField } from "@/lib/profile";
import { fetchVilles, libelleVille, type VilleSuggeree } from "@/lib/weather";

/*
 * Éléments partagés par les écrans du profil (Mon profil, Mon compte) :
 * icônes au trait 1,6, surtitre de section, lignes cliquables, feuilles
 * d'édition (genre, ville, date de naissance). Sortis de ProfileScreen le
 * 25/09/2026, puis de « Personnaliser mon profil » le 26/09/2026 quand cet
 * écran, qui doublait Mon profil, a été fondu dedans.
 */

const T = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
export function Icone({ children, taille = 19 }: { children: React.ReactNode; taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
      {children}
    </svg>
  );
}
export const I_GENRE = (
  <>
    <circle cx="12" cy="8" r="3.5" {...T} />
    <path d="M5.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5" {...T} />
  </>
);
export const I_CINTRE = (
  <>
    <path d="M12 4.2a1.6 1.6 0 1 1 1.4 2.4L12 7.8" {...T} />
    <path d="M12 7.8l8.6 6.1a1.3 1.3 0 0 1-.8 2.3H4.2a1.3 1.3 0 0 1-.8-2.3L12 7.8z" {...T} />
  </>
);
export const I_SILHOUETTE = (
  <>
    <path d="M9 3.5h6M9.5 3.5c0 3 1.2 4.3 1.2 6.2S8 13.4 8 16.2c0 1.9 1.7 3.3 4 3.3s4-1.4 4-3.3c0-2.8-2.7-4.6-2.7-6.5s1.2-3.2 1.2-6.2" {...T} />
    <path d="M12 19.5V21" {...T} />
  </>
);
export const I_PALETTE = (
  <>
    <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.1-1.6-1.1-2.7 0-1 .8-1.6 1.8-1.6h2.2a3.8 3.8 0 0 0 3.8-3.8c0-4-3.8-7.2-8.5-7.2z" {...T} />
    <circle cx="7.8" cy="11" r="1" {...T} />
    <circle cx="10.5" cy="7.3" r="1" {...T} />
    <circle cx="15" cy="7.8" r="1" {...T} />
  </>
);
export const I_METRE = (
  <>
    <rect x="3.5" y="8" width="17" height="8" rx="1.5" {...T} />
    <path d="M7.5 8v3M11 8v2M14.5 8v3M18 8v2" {...T} />
  </>
);
export const I_INTENSITE = (
  <>
    <circle cx="12" cy="12" r="8" {...T} />
    <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
  </>
);
export const I_CALENDRIER = (
  <>
    <rect x="4" y="6" width="16" height="14" rx="2" {...T} />
    <path d="M4 10h16M8.5 3.5V7M15.5 3.5V7" {...T} />
  </>
);
export const I_DOC = <path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20V3.5zM14 3.5V8h4M9.5 12h5M9.5 15.5h5" {...T} />;
export const I_BOUCLIER = <path d="M12 3.5l7 2.8v5.2c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6.3l7-2.8z" {...T} />;
export const I_TELECHARGER = <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14" {...T} />;
export const I_ETINCELLE = <path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3z" {...T} />;
export const I_TSHIRT = <path d="M8 4L4 7.2l2.4 2.6L8 8.4V20h8V8.4l1.6 1.4 2.4-2.6L16 4l-4 1.8L8 4z" {...T} />;
export const I_COMPTE = (
  <>
    <circle cx="12" cy="8.5" r="3.5" {...T} />
    <path d="M5 20c1-3.3 3.6-5 7-5s6 1.7 7 5" {...T} />
  </>
);
export const I_GRAPHIQUE = <path d="M5 19.5h14M8 16v-4M12 16V8M16 16v-6" {...T} />;

export function Surtitre({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[8px] text-terracotta mt-7 mb-[10px]">
      <Icone taille={16}>{icone}</Icone>
      <span className="t-surtitre text-muted">{children}</span>
    </div>
  );
}

/** Une ligne du profil : toute la ligne est le bouton qui ouvre l'écran de modification correspondant. */
export function LigneProfil({
  icone,
  titre,
  valeur,
  renseigne,
  explication,
  onClick,
}: {
  icone: React.ReactNode;
  titre: string;
  valeur: React.ReactNode;
  renseigne: boolean;
  explication?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-[13px] px-4 py-[14px] text-left cursor-pointer border-b border-border last:border-b-0"
    >
      <span className="w-11 h-11 flex-shrink-0 rounded-full bg-warm-bg text-terracotta-deep flex items-center justify-center">
        <Icone>{icone}</Icone>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block t-titre-ligne text-ink">{titre}</span>
        <span className={"block text-[13px] leading-[1.4] mt-[2px] " + (renseigne ? "text-ink" : "text-placeholder")}>{valeur}</span>
        {renseigne && explication && <span className="block text-[12px] text-muted leading-[1.4] mt-[3px]">{explication}</span>}
      </span>
      <span aria-hidden="true" className="text-placeholder text-[15px] flex-shrink-0">›</span>
    </button>
  );
}


/**
 * La palette en nuancier : les teintes réellement enregistrées, puis des
 * emplacements vides jusqu'au maximum de 6 — une palette en cours, pas une
 * liste. « Non renseignée » quand il n'y a aucune couleur.
 */
export function PastillesPalette({ couleurs }: { couleurs: string[] }) {
  if (!couleurs.length) return <>Non renseignée</>;
  return (
    <span className="flex items-center gap-[6px] py-[2px]" aria-label={`${couleurs.length} couleurs`}>
      {Array.from({ length: Math.max(6, couleurs.length) }, (_, i) => couleurs[i]).map((hex, i) =>
        hex ? (
          <span key={i} className="w-[20px] h-[20px] rounded-full flex-shrink-0" style={{ background: hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.12)" }} />
        ) : (
          <span key={i} className="w-[20px] h-[20px] rounded-full flex-shrink-0 border border-border-soft" />
        )
      )}
    </span>
  );
}

/** Résumé des tailles renseignées : « Haut M · Bas 40 · Chaussures 39 ». */
export function resumeTailles(p: { tailleHaut: string | null; tailleBas: string | null; pointure: string | null }): string[] {
  return [p.tailleHaut && "Haut " + p.tailleHaut, p.tailleBas && "Bas " + p.tailleBas, p.pointure && "Chaussures " + p.pointure].filter(
    Boolean
  ) as string[];
}

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
        <div className="t-titre-carte text-ink mb-[16px]">Modifier mon genre</div>
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
        <div className="t-titre-carte text-ink mb-[8px]">{field.fieldLabel} est à mettre à jour</div>
        <div className="text-[13px] text-muted leading-[1.5] mb-[20px]">
          Les propositions évoluent selon ton profil. Choisis celle qui te correspond le mieux aujourd&apos;hui.
        </div>
        <button
          onClick={onEdit}
          className="w-full bg-terracotta active:bg-terracotta-hover text-cream text-center rounded-full py-4 t-bouton cursor-pointer"
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

/** Ligne libellé / valeur (identité, tailles, ville). Sans onClick : affichée, pas modifiable, et sans chevron. */
export function LigneInfo({ label, valeur, renseigne, onClick }: { label: string; valeur: string; renseigne: boolean; onClick?: () => void }) {
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

/**
 * LA VILLE (sortie de « Personnaliser mon profil » le 26/09/2026, quand cet
 * écran a été fondu dans Mon profil). N'importe quelle ville, trouvée par la
 * recherche (correctif météo du 25/09/2026) : sa météo réelle est demandée
 * par son nom (fetchWeatherByCity). On n'enregistre qu'une ville PROPOSÉE —
 * jamais une saisie libre, qu'une faute de frappe rendrait introuvable sans
 * que rien ne le dise. CITIES reste en raccourcis quand la recherche est vide.
 */
export function FeuilleVille({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, saveProfile } = useAuth();
  const villeOuverte = open;
  const setVilleOuverte = (v: boolean) => {
    if (!v) onClose();
  };
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

  return (
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
  );
}

/** LA DATE DE NAISSANCE — même origine que FeuilleVille ; privée, jamais affichée ailleurs que sur le compte. */
export function FeuilleDateNaissance({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, saveProfile } = useAuth();
  const dateOuverte = open;
  const setDateOuverte = (v: boolean) => {
    if (!v) onClose();
  };
  const [dateBrouillon, setDateBrouillon] = useState(profile.birthdate ?? "");
  // Bornes de la date : jamais dans le futur, jamais avant 1900 — relues à
  // chaque ouverture de la feuille.
  const [aujourdhui, setAujourdhui] = useState("");
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDateBrouillon(profile.birthdate ?? "");
    setAujourdhui(jourLocal());
  }, [open, profile.birthdate]);
  const dateValide = /^\d{4}-\d{2}-\d{2}$/.test(dateBrouillon) && dateBrouillon >= "1900-01-01" && dateBrouillon <= aujourdhui;
  return (
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
        className="mt-4 w-full rounded-full bg-terracotta text-cream t-bouton cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
  );
}
