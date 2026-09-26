"use client";

import { trierAvisRecents, verdictCourt, type AvisEnregistre } from "@/lib/avisJournal";

/*
 * « MES AVIS DE STYLISTE » DANS LE JOURNAL — la mémoire visuelle des avis
 * (refonte du 26/09/2026). Pas l'analyse entière : PHOTO → VERDICT → EXTRAIT
 * → accès à l'avis complet, pour qu'un avis se relise d'un coup d'œil.
 *
 * Deux avis au plus dans le Journal, du plus récent au plus ancien ; au-delà,
 * « Voir tout → » ouvre la liste complète (AvisTousScreen), qui réutilise la
 * même carte. Aucun avis : un état vide invite à en demander un.
 *
 * RIEN N'EST INVENTÉ. L'avis enregistré ne porte ni verdict structuré ni tags :
 *   - le verdict est la formule d'ouverture de l'avis global (verdictCourt),
 *     ou, à défaut, l'avis global lui-même, tronqué ;
 *   - l'extrait est le premier point de « Ce qui fonctionne » — pourquoi la
 *     tenue fonctionnait ;
 *   - pas de tags : aucune donnée ne les porte.
 */

const TITRE = "Mes avis de styliste"; // arbitré le 25/09/2026
export const AVIS_DANS_LE_JOURNAL = 2;

const formatDate = (t: number) => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** Une carte d'avis : toute la carte est le bouton qui rouvre l'avis complet enregistré (le bon avis, la bonne photo). */
export function CarteAvis({ avis, onOuvrir }: { avis: AvisEnregistre; onOuvrir: (id: string) => void }) {
  const verdict = verdictCourt(avis.avis.overallAssessment);
  const extrait = avis.avis.strengths[0];
  const date = formatDate(avis.creeLe);
  return (
    <button
      type="button"
      onClick={() => onOuvrir(avis.id)}
      aria-label={`Avis de styliste du ${date} : ${verdict ?? avis.avis.overallAssessment}. Voir l'avis complet`}
      className="w-full flex gap-[14px] bg-card border border-border rounded-[20px] p-[10px] text-left cursor-pointer transition-colors active:bg-warm-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
    >
      {/* La photo d'abord : assez grande pour reconnaître la tenue, entière
          (portrait 4:5, cadrée en haut — là où se lit la tenue). */}
      <span className="block self-start flex-shrink-0 w-[40%] max-w-[150px] rounded-[14px] overflow-hidden bg-warm-bg" style={{ aspectRatio: "4/5" }}>
        {avis.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avis.photoUrl} alt={`Tenue analysée le ${date}`} loading="lazy" decoding="async" className="w-full h-full object-cover object-top block" />
        ) : (
          // Sans photo (enregistrée sans, ou lien expiré) : le monogramme de
          // la marque sur le beige, plutôt qu'un vide.
          <span aria-hidden="true" className="w-full h-full flex items-center justify-center font-serif italic text-[28px] text-terracotta/60">
            ✦
          </span>
        )}
      </span>
      <span className="flex-1 min-w-0 flex flex-col py-[4px] pr-[4px]">
        <span className="block text-[11px] text-muted">{date} · Avis de styliste</span>
        <span className="t-titre-carte text-ink mt-[8px] line-clamp-3">
          <span aria-hidden="true" className="text-terracotta text-[13px] mr-[5px]">
            ✦
          </span>
          {verdict ?? avis.avis.overallAssessment}
        </span>
        {extrait && <span className="text-[12px] text-muted-3 leading-[1.45] mt-[6px] line-clamp-2">{extrait}</span>}
        <span className="block t-lien text-terracotta mt-auto pt-[10px]">Voir l&apos;avis complet →</span>
      </span>
    </button>
  );
}

export default function AvisEnregistresJournal({
  avis,
  onOuvrir,
  onVoirTout,
  onAnalyser,
}: {
  /** null tant que la liste n'est pas chargée : rien ne s'affiche (pas d'état vide qui clignote). */
  avis: AvisEnregistre[] | null;
  onOuvrir: (id: string) => void;
  onVoirTout: () => void;
  onAnalyser: () => void;
}) {
  if (avis === null) return null;
  const recents = trierAvisRecents(avis).slice(0, AVIS_DANS_LE_JOURNAL);
  return (
    <section className="mt-[30px]" aria-labelledby="journal-avis-styliste">
      <div className="flex items-baseline justify-between gap-3">
        <div id="journal-avis-styliste" className="t-surtitre text-muted">
          {TITRE}
        </div>
        {avis.length > AVIS_DANS_LE_JOURNAL && (
          <button type="button" onClick={onVoirTout} className="t-lien text-terracotta cursor-pointer min-h-[44px] -my-[12px] flex-shrink-0">
            Voir tout →
          </button>
        )}
      </div>
      {recents.length > 0 ? (
        <>
          <div className="text-[12px] text-muted mt-[4px]">Tes derniers conseils personnalisés</div>
          <div className="flex flex-col gap-[10px] mt-[12px]">
            {recents.map((a) => (
              <CarteAvis key={a.id} avis={a} onOuvrir={onOuvrir} />
            ))}
          </div>
        </>
      ) : (
        // ÉTAT VIDE : une invitation, jamais de fausse carte.
        <div className="mt-[12px] bg-card border border-border rounded-[20px] px-4 py-[16px]">
          <div className="t-titre-carte text-ink">
            Tes futurs avis de styliste <span className="italic text-terracotta">seront ici</span>
          </div>
          <div className="text-[12px] text-muted-3 leading-[1.45] mt-[6px]">
            Analyse une tenue et retrouve tous tes conseils personnalisés dans ton Journal.
          </div>
          <button type="button" onClick={onAnalyser} className="mt-[10px] t-lien text-terracotta cursor-pointer min-h-[44px]">
            Analyser une tenue →
          </button>
        </div>
      )}
    </section>
  );
}
