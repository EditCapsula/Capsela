"use client";

/*
 * LES TUILES DU PARCOURS « PLANIFIER » (07/10/2026, maquettes du parcours refait). Quatre étapes, un même motif : une
 * tuile à choisir, dont la sélection se lit par plus que la couleur (coche ou aplat plein). Photos : les visuels
 * éditoriaux d'occasion déjà dans l'app, sans personne ; glyphes : le trait du reste de l'interface (1.5, currentColor).
 */

export type IconePlanifier =
  | "restaurant" | "bar" | "culture" | "exterieur" | "maison"
  | "matin" | "apresmidi" | "soiree" | "journee" | "nuage" | "cintre"
  | "elegant" | "feminin" | "decontracte" | "audacieux" | "confortable" | "aucune";

const TRAIT = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const FORMES: Record<IconePlanifier, React.ReactNode> = {
  restaurant: <><path d="M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10" /><path d="M17 21V3c-2 1.5-3 4-3 7 0 2 1 3 3 3" /></>,
  bar: <><path d="M6 4h12l-6 8z" /><path d="M12 12v8M8 20h8" /></>,
  culture: <><path d="M3 9l9-5 9 5" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></>,
  exterieur: <><path d="M12 21v-7" /><path d="M12 14c-4 0-6-3-6-6a6 6 0 0112 0c0 3-2 6-6 6z" /></>,
  maison: <><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /><path d="M10 20v-5h4v5" /></>,
  matin: <><circle cx="12" cy="14" r="3.5" /><path d="M12 5v2.5M4.5 14H3M21 14h-1.5M6.5 8.5l1.2 1.2M17.5 8.5l-1.2 1.2" /></>,
  apresmidi: <><circle cx="12" cy="12" r="3.8" /><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M6 18l1.4-1.4M16.6 7.4L18 6" /></>,
  soiree: <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />,
  cintre: <path d="M10 6a2 2 0 112 2v1.5M12 9.5L3.4 16a1 1 0 00.6 1.8h16a1 1 0 00.6-1.8z" />,
  nuage: <path d="M7.5 18.5h9.5a3.8 3.8 0 00.4-7.6A5.8 5.8 0 006.3 12a3.3 3.3 0 001.2 6.5z" />,
  journee: <><rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M4 10h16M8.5 3.5v3M15.5 3.5v3" /></>,
  elegant: <><path d="M6 4h12l3 5-9 11L3 9z" /><path d="M3 9h18M9 4l3 5 3-5" /></>,
  feminin: <><circle cx="12" cy="12" r="2.2" /><path d="M12 9.8C12 6 14 4 16 4s3 2 1.5 4M14.2 12c3.8 0 5.8 2 5.8 4s-2 3-4.5 1.5M12 14.2c0 3.8-2 5.8-4 5.8s-3-2-1.5-4.5M9.8 12C6 12 4 10 4 8s2-3 4.5-1.5" /></>,
  decontracte: <path d="M3 15h4l2-3h6l2 3h4v3H3z" />,
  audacieux: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16v4M17 18h4" /></>,
  confortable: <path d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" />,
  aucune: <><circle cx="12" cy="12" r="8" /><path d="M7 17L17 7" /></>,
};

export function IconeTuile({ nom, taille = 22 }: { nom: IconePlanifier; taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }} {...TRAIT}>
      {FORMES[nom]}
    </svg>
  );
}

const COCHE = (
  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Une occasion : photo éditoriale, libellé, précision. La sélection : contour terracotta ET coche. */
export function TuileOccasion({
  src, label, desc, actif, onClick,
}: { src?: string; label: string; desc?: string; actif: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={actif} className="flex flex-col items-stretch justify-start text-left cursor-pointer min-w-0">
      <span
        className="relative block w-full overflow-hidden rounded-tuile bg-warm-bg"
        style={{ aspectRatio: "4 / 3", border: "2px solid " + (actif ? "var(--color-terracotta-deep)" : "transparent") }}
      >
        {src && (
          // eslint-disable-next-line @next/next/no-img-element -- export statique, images servies telles quelles
          <img src={src} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover block" />
        )}
        {actif && (
          <span aria-hidden="true" className="absolute top-[6px] right-[6px] w-5 h-5 rounded-full flex items-center justify-center bg-terracotta-deep text-cream">
            {COCHE}
          </span>
        )}
      </span>
      <span className={"block text-[12px] mt-[6px] leading-[1.25] " + (actif ? "text-terracotta-deep font-semibold" : "text-ink")}>{label}</span>
      {desc && <span className="block text-[11px] text-muted leading-[1.3] mt-[1px]">{desc}</span>}
    </button>
  );
}

/** Une tuile à icône (moment, type de lieu) : aplat terracotta plein à la sélection, texte clair. */
export function TuileIcone({
  icone, label, sousTitre, actif, onClick, hauteur = 72,
}: { icone: IconePlanifier; label: string; sousTitre?: string; actif: boolean; onClick: () => void; hauteur?: number }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={actif}
      className={
        "flex flex-col items-center justify-center gap-[6px] rounded-tuile px-2 py-3 text-center cursor-pointer border transition-colors " +
        (actif ? "bg-terracotta-deep border-terracotta-deep text-cream" : "bg-card border-border text-ink")
      }
      style={{ minHeight: hauteur }}
    >
      <span className={actif ? "text-cream" : "text-muted-3"}><IconeTuile nom={icone} /></span>
      <span className="text-[12px] leading-[1.2]">{label}</span>
      {sousTitre && <span className={"text-[11px] leading-[1.2] " + (actif ? "text-on-terracotta-soft" : "text-muted")}>{sousTitre}</span>}
    </button>
  );
}

/** Une ligne de préférence : icône, libellé, coche à droite quand elle est choisie. */
export function LigneIcone({
  icone, label, actif, onClick,
}: { icone: IconePlanifier; label: string; actif: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={actif}
      className={
        "flex items-center gap-3 w-full text-left rounded-bloc px-[14px] cursor-pointer border transition-colors " +
        (actif ? "bg-warm-bg border-sand-border" : "bg-card border-border")
      }
      style={{ minHeight: 52 }}
    >
      <span className={actif ? "text-terracotta-deep" : "text-muted-3"}><IconeTuile nom={icone} /></span>
      <span className="flex-1 text-[13px] font-medium text-ink">{label}</span>
      {actif && <span aria-hidden="true" className="text-terracotta-deep">{COCHE}</span>}
    </button>
  );
}

/**
 * La progression du parcours (maquette Planifier V3, 07/10/2026) : les noms des étapes séparés par un trait fin, sans barre.
 * L'étape active en terracotta et en gras, les passées en gris foncé, les futures en gris clair.
 */
export function ProgressionLibelles({ libelles, courante }: { libelles: readonly string[]; courante: number }) {
  return (
    <ol
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={libelles.length}
      aria-valuenow={courante + 1}
      aria-label={`Étape ${courante + 1} sur ${libelles.length} : ${libelles[courante]}`}
      className="flex items-center justify-center gap-[10px]"
    >
      {libelles.map((l, i) => (
        <li key={l} className="flex items-center gap-[10px]" aria-hidden="true">
          {i > 0 && <span className="block w-[14px] h-px bg-border" />}
          <span
            className="t-pastille"
            style={{
              color: i === courante ? "var(--color-terracotta)" : i < courante ? "var(--color-muted-3)" : "var(--color-muted)",
              fontWeight: i === courante ? 700 : 500,
            }}
          >
            {l}
          </span>
        </li>
      ))}
    </ol>
  );
}

const JOURS_COURTS = ["L", "M", "M", "J", "V", "S", "D"];
const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/**
 * Le calendrier mensuel de l'étape « Quand » : navigation de mois, jours de 44 px, aujourd'hui cerclé, sélection pleine,
 * dates non proposées désactivées. Pur affichage : `premier` est le premier jour proposé, `choisi` la date choisie.
 */
export function CalendrierMois({
  mois, onMois, aujourdhui, premier, choisi, onChoisir,
}: {
  mois: Date;
  onMois: (d: Date) => void;
  aujourdhui: Date;
  premier: Date;
  choisi: Date | null;
  onChoisir: (d: Date) => void;
}) {
  const annee = mois.getFullYear();
  const m = mois.getMonth();
  const decalage = (new Date(annee, m, 1).getDay() + 6) % 7;
  const nb = new Date(annee, m + 1, 0).getDate();
  const cases: (Date | null)[] = [...Array(decalage).fill(null), ...Array.from({ length: nb }, (_, i) => new Date(annee, m, i + 1, 12))];
  while (cases.length % 7) cases.push(null);
  const meme = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const debut = new Date(premier.getFullYear(), premier.getMonth(), 1);
  const peutReculer = new Date(annee, m, 1) > debut;
  const fleche = (sens: -1 | 1, actif: boolean) => (
    <button
      onClick={() => actif && onMois(new Date(annee, m + sens, 1))}
      aria-label={sens < 0 ? "Mois précédent" : "Mois suivant"}
      aria-disabled={!actif}
      className="w-[44px] h-[44px] flex items-center justify-center text-ink cursor-pointer"
      style={{ opacity: actif ? 1 : 0.3 }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={sens < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    </button>
  );
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <h2 className="t-titre-carte text-ink" aria-live="polite">{MOIS_LONGS[m].charAt(0).toUpperCase() + MOIS_LONGS[m].slice(1)} {annee}</h2>
        <div className="flex">{fleche(-1, peutReculer)}{fleche(1, true)}</div>
      </div>
      <div className="grid grid-cols-7 mt-1" aria-hidden="true">
        {JOURS_COURTS.map((j, i) => <span key={i} className="text-center t-pastille text-muted">{j}</span>)}
      </div>
      <div className="grid grid-cols-7">
        {cases.map((d, i) => {
          if (!d) return <span key={i} />;
          const permis = d >= premier;
          const sel = !!choisi && meme(d, choisi);
          const auj = meme(d, aujourdhui);
          return (
            <button
              key={i}
              onClick={() => permis && onChoisir(d)}
              aria-pressed={sel}
              aria-disabled={!permis}
              aria-label={`${d.getDate()} ${MOIS_LONGS[m]}${auj ? ", aujourd'hui" : ""}${permis ? "" : ", non proposé"}`}
              className="flex items-center justify-center cursor-pointer"
              style={{ minHeight: 44 }}
            >
              <span
                className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-[14px] tabular-nums"
                style={{
                  background: sel ? "var(--color-terracotta-deep)" : "transparent",
                  color: sel ? "var(--color-cream)" : permis ? "var(--color-ink)" : "var(--color-sand-border)",
                  border: auj && !sel ? "1.5px solid var(--color-terracotta)" : "1.5px solid transparent",
                  fontWeight: sel || auj ? 600 : 400,
                }}
              >
                {d.getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
