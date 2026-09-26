"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { useCapsela } from "@/lib/store";
import { GENERATIONS_GRATUITES_PAR_JOUR, LIMITE_DRESSING_GRATUIT } from "@/lib/premium";

/**
 * Capsela Premium — maquette du 24/09/2026.
 *
 * VITRINE, PAS CAISSE, ET L'ÉCRAN LE DIT. Aucune infrastructure de paiement
 * n'existe dans l'app : ni SDK d'achat intégré, ni produit déclaré chez Apple
 * ou Google, ni vérification de reçu. La maquette prévoyait un « S'abonner »
 * suivi d'un toast « Ouverture du paiement sécurisé… » — c'est très
 * exactement la phrase qu'on ne peut pas écrire tant que rien ne s'ouvre.
 * Le bouton annonce donc ce qui va se passer : on note l'intérêt, on
 * préviendra à l'ouverture.
 *
 * « Restaurer mon achat » est retiré pour la même raison : il n'y a aucun
 * achat à restaurer, et le proposer ferait croire qu'il y en a eu.
 *
 * DISPONIBLE OU BIENTÔT, JAMAIS L'UN POUR L'AUTRE. Un avantage sans
 * `bientot` fonctionne aujourd'hui ; un avantage `bientot` n'existe pas
 * encore et le dit — vendre quatre choses quand deux existent est le genre de
 * détail qui se remarque une fois payé.
 *
 * « Tenues sans limite » est DISPONIBLE depuis la recette du 26/09/2026 : le
 * quota gratuit (2 alternatives « Autre tenue » par jour) est appliqué par la
 * base (`consommer_generation`, migrations 0032/0033), qui le lève pour un
 * compte Premium actif (`premium_access`). La mention « bientôt » était
 * restée d'avant le compteur.
 */

const T = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Glyphe({ children }: { children: React.ReactNode }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      {children}
    </svg>
  );
}

const G_CINTRE = (
  <>
    <path d="M12 6a2 2 0 1 1 2 2v1.4" {...T} />
    <path d="M14 9.4 3.9 16.2a1 1 0 0 0 .6 1.8h15a1 1 0 0 0 .6-1.8L14 9.4z" {...T} />
  </>
);
const G_CALENDRIER = (
  <>
    <rect x="4" y="6" width="16" height="14" rx="2" {...T} />
    <line x1="4" y1="10" x2="20" y2="10" {...T} />
    <line x1="8.5" y1="3.5" x2="8.5" y2="7" {...T} />
    <line x1="15.5" y1="3.5" x2="15.5" y2="7" {...T} />
  </>
);
const G_VALISE = (
  <>
    <rect x="5.5" y="7.5" width="13" height="12" rx="1.5" {...T} />
    <path d="M9.5 7.5V5h5v2.5" {...T} />
    <line x1="9" y1="19.5" x2="9" y2="20.5" {...T} />
    <line x1="15" y1="19.5" x2="15" y2="20.5" {...T} />
  </>
);

const G_REGARD = (
  <>
    <rect x="3.5" y="7" width="17" height="12" rx="2.5" {...T} />
    <path d="M8.5 7l1.4-2.2h4.2L15.5 7" {...T} />
    <circle cx="12" cy="13" r="3.2" {...T} />
  </>
);

const G_ETINCELLE = (
  <>
    <path
      d="M12 3.2l1.9 4.9 4.9 1.9-4.9 1.9L12 16.8l-1.9-4.9L5.2 10l4.9-1.9L12 3.2z"
      fill="currentColor"
    />
    <path d="M18.4 15.2l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8.8-2.1z" fill="currentColor" />
  </>
);

const AVANTAGES: { glyphe: React.ReactNode; titre: string; desc: string; bientot?: boolean }[] = [
  {
    glyphe: G_CINTRE,
    titre: "Dressing illimité",
    desc: `Au-delà de ${LIMITE_DRESSING_GRATUIT} pièces, ajoute tout ce que tu possèdes sans compter.`,
  },
  {
    glyphe: G_CALENDRIER,
    titre: "Planifier une tenue",
    desc: "Prépare tes looks à l'avance selon la date et le lieu, avec la météo prévue sur place.",
  },
  {
    glyphe: G_ETINCELLE,
    titre: "Tenues sans limite",
    desc: `Génère autant de tenues que tu veux. Sans abonnement, ${GENERATIONS_GRATUITES_PAR_JOUR} par jour.`,
  },
  // Disponible (recette du 26/09/2026) : l'Avis de styliste fonctionne déjà,
  // il n'est donc jamais « bientôt ». Même promesse que la carte de l'accueil.
  {
    glyphe: G_REGARD,
    titre: "Avis de styliste",
    desc: "Montre ta tenue à Capsela : ce qui fonctionne, ce que tu peux ajuster.",
  },
  {
    glyphe: G_VALISE,
    titre: "Préparer une valise",
    desc: "Indique ta destination et la durée, Capsela compose tes tenues.",
    bientot: true,
  },
];

interface Formule {
  id: "annuel" | "mensuel";
  label: string;
  prix: string;
  sous: string;
  economie?: string;
}

/**
 * Les deux formules. Les montants sont écrits en dur : ils viendront des
 * stores le jour où l'achat existera, chacun affichant le prix localisé de
 * son produit. En attendant, une seule source ici plutôt que deux
 * formulations à recoller.
 *
 * TARIFS ARBITRÉS LE 24/09/2026 : 4,99 € / mois, 54,99 € / an.
 *
 * Les deux chiffres dérivés ne sont pas écrits à l'estime, ils se recalculent
 * depuis ces deux-là :
 *
 *   mensualisé annuel  54,99 / 12          = 4,5825   -> « 4,58 € / mois »
 *   douze mensualités  4,99 x 12           = 59,88 €
 *   économie           59,88 - 54,99       = 4,89 €
 *   part économisée    4,89 / 59,88        = 8,166 %  -> « 8 % »
 *
 * ARRONDI VERS LE BAS, jamais vers le haut : 8,166 % s'affiche 8 % et non 9 %.
 * Un pourcentage d'économie est une promesse chiffrée ; l'arrondir dans le
 * sens qui arrange est le genre de détail qui se vérifie en trente secondes
 * avec une calculatrice.
 *
 * Pour mémoire, les tarifs précédents (3,99 / 29,99) donnaient 37 %. Le
 * nouveau couple ramène l'écart à 8 % — c'est un arbitrage de prix, pas une
 * erreur de calcul, et l'écran l'affiche tel quel.
 */
const FORMULES: Formule[] = [
  { id: "annuel", label: "Premium annuel", prix: "54,99 € / an", sous: "4,58 € / mois", economie: "Économisez 8 %" },
  { id: "mensuel", label: "Premium mensuel", prix: "4,99 € / mois", sous: "Sans engagement" },
];

export default function PremiumScreen() {
  const { state, actions } = useCapsela();
  const [formule, setFormule] = useState<Formule["id"]>("annuel");
  const [note, setNote] = useState(false);
  const choisie = FORMULES.find((f) => f.id === formule) ?? FORMULES[0];

  return (
    <div className="absolute inset-0 flex flex-col bg-cream">
      <div className="flex-shrink-0 px-6 pt-[6px]">
        {/* Le bandeau commun, avec sa gouttière de retour : la maquette posait
            une croix, mais tout écran secondaire de l'app se ferme par le
            chevron depuis le 24/09. Deux gestes pour une même sortie
            n'apporteraient rien. */}
        <AppHeader showAvatar={false} onBack={() => actions.go(state.premiumReturn)} backLabel="Fermer" />
      </div>

      <div className="scrollarea flex-1 min-h-0 overflow-y-auto px-6 pt-2 pb-5">
        <div className="flex items-center gap-[10px]">
          <span aria-hidden="true" style={{ width: 22, height: 1, background: "var(--color-terracotta)" }} />
          <span className="t-surtitre text-muted">Capsela Premium</span>
        </div>

        <div className="t-titre-ecran text-ink mt-[10px]" style={{ textWrap: "balance" }}>
          Un peu plus de place, <span className="italic text-terracotta">un peu d&apos;avance</span>
        </div>
        <div className="t-chapeau text-muted-3 mt-2" style={{ textWrap: "pretty" }}>
          Des outils pour aller plus loin avec ta garde-robe.
        </div>

        {/* « CE QUE TU VOULAIS FAIRE » (maquette Premium Gates). Quelqu'un qui
            arrive ici après avoir touché « Préparer une valise » n'a pas la
            même question en tête que quelqu'un qui explore l'offre depuis la
            pastille ✦ : le rappel lui dit qu'on a compris sa demande, et que
            c'est bien elle qui est derrière l'abonnement.

            Rien ne s'affiche quand l'origine est inconnue — un encart qui
            annoncerait « ce que tu voulais faire » sans savoir quoi serait
            une phrase pour rien. */}
        {state.premiumOrigine === "valise" && (
          <div className="flex items-start gap-[11px] mt-[14px] bg-warm-bg rounded-[16px] px-[14px] py-[13px]">
            <span className="flex-shrink-0 text-terracotta-deep mt-[1px]">
              <Glyphe>{G_VALISE}</Glyphe>
            </span>
            <span className="min-w-0">
              <span className="block t-label text-terracotta">
                Ce que tu voulais faire
              </span>
              <span className="block text-[13px] text-ink leading-[1.4] mt-[3px]">Préparer une valise</span>
            </span>
          </div>
        )}

        <div className="mt-[18px]" style={{ borderTop: "1px solid var(--color-border)" }}>
          {AVANTAGES.map((a) => (
            <div key={a.titre} className="py-[14px]" style={{ borderBottom: "1px solid var(--color-border)" }}>
              <div className="flex items-center gap-[9px]">
                <span className="text-terracotta-deep">
                  <Glyphe>{a.glyphe}</Glyphe>
                </span>
                <div className="t-titre-carte text-ink">{a.titre}</div>
                {a.bientot && (
                  <span className="t-pastille text-muted bg-chip-soft-bg rounded-full px-[9px] py-[4px] whitespace-nowrap">
                    Bientôt
                  </span>
                )}
              </div>
              <div className="text-[12px] text-muted-3 leading-[1.5] mt-1" style={{ textWrap: "pretty" }}>
                {a.desc}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-[22px]">
          <span className="t-surtitre text-muted">Choisis ta formule</span>
        </div>

        <div role="radiogroup" aria-label="Formule d'abonnement" className="flex flex-col gap-2 mt-[10px]">
          {FORMULES.map((f) => {
            const on = f.id === formule;
            return (
              <button
                key={f.id}
                role="radio"
                aria-checked={on}
                onClick={() => setFormule(f.id)}
                className="w-full flex items-center gap-[13px] text-left rounded-[20px] px-4 py-3 cursor-pointer transition-colors"
                style={{
                  minHeight: 72,
                  background: on ? "var(--color-card)" : "rgba(251,248,243,.35)",
                  border: on ? "1.5px solid var(--color-terracotta-deep)" : "1px solid var(--color-border)",
                }}
              >
                <span
                  aria-hidden="true"
                  className="w-[22px] h-[22px] flex-shrink-0 rounded-full flex items-center justify-center"
                  style={{ border: `1.5px solid ${on ? "var(--color-terracotta-deep)" : "var(--color-cream-dark-soft)"}` }}
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: on ? "var(--color-terracotta-deep)" : "transparent" }}
                  />
                </span>
                <span className="flex-1 min-w-0">
                  <span
                    className="block t-label font-semibold"
                    style={{ color: on ? "var(--color-terracotta-deep)" : "var(--color-muted)" }}
                  >
                    {f.label}
                  </span>
                  <span
                    className="block t-chiffre mt-[3px] whitespace-nowrap"
                    style={{ color: on ? "var(--color-ink)" : "var(--color-muted-3)" }}
                  >
                    {f.prix}
                  </span>
                  <span className="block text-[11px] text-muted-3 mt-[2px]">{f.sous}</span>
                  {f.economie && (
                    <span className="inline-flex items-center gap-[5px] mt-[6px] text-[11px] font-semibold text-terracotta-deep bg-warm-bg border border-sand-border rounded-full px-[9px] py-[3px] whitespace-nowrap">
                      <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" style={{ display: "block" }}>
                        <path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" />
                      </svg>
                      {f.economie}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative flex-shrink-0 px-6 pt-[10px] pb-[18px] border-t border-border">
        {note && (
          <div
            className="absolute inset-x-6 z-30 pointer-events-none rounded-[15px] px-4 py-[13px] text-[12px]"
            style={{ bottom: "100%", marginBottom: 12, background: "var(--color-ink)", color: "var(--color-cream)" }}
            aria-live="polite"
          >
            C&apos;est noté — on te préviendra à l&apos;ouverture.
          </div>
        )}

        <div aria-live="polite">
          <div className="t-label text-muted">Offre sélectionnée</div>
          <div className="flex items-baseline flex-wrap gap-x-[10px] gap-y-[2px] mt-[2px]">
            <span className="t-chiffre text-ink whitespace-nowrap">{choisie.prix}</span>
            <span className="text-[11px] text-muted-3 whitespace-nowrap">
              {choisie.sous}
              {choisie.economie ? ` · ${choisie.economie}` : ""}
            </span>
          </div>
        </div>

        {/* Ce bouton ne prend pas d'argent, et son libellé ne le laisse pas
            croire. « S'abonner » sur un écran sans caisse est la promesse la
            plus coûteuse qu'on puisse faire ici. */}
        <button
          onClick={() => {
            setNote(true);
            setTimeout(() => setNote(false), 2600);
          }}
          className="w-full rounded-full mt-2 t-bouton cursor-pointer"
          style={{ minHeight: 52, background: "var(--color-ink)", color: "var(--color-cream)" }}
        >
          Me prévenir à l&apos;ouverture
        </button>

        <div className="text-[11px] text-muted leading-[1.45] mt-[10px] text-center" style={{ textWrap: "pretty" }}>
          L&apos;abonnement n&apos;est pas encore ouvert. Rien ne t&apos;est facturé.
        </div>

        <div className="flex items-center justify-center mt-[2px]">
          <button
            onClick={actions.goLegal}
            className="text-[11px] text-muted cursor-pointer px-[10px] flex items-center"
            style={{ minHeight: 44 }}
          >
            Conditions et confidentialité
          </button>
        </div>
      </div>
    </div>
  );
}
