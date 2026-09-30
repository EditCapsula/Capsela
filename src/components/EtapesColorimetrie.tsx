"use client";

import { useRef, useState } from "react";
import OptionRow from "@/components/OptionRow";
import {
  colorimetrieDeSaison,
  colorimetrieDisponible,
  colorimetrieMockActive,
  colorimetrieUtilisable,
  estSaison,
  QUESTIONS_COLORIMETRIE,
  SAISONS,
  saisonDuQuestionnaire,
  type Colorimetrie,
  type MotifPhoto,
} from "@/lib/colorimetrie";
import { analyserColorimetrie, messageEchecPhoto } from "@/lib/colorimetrieClient";
import { paletteColorName } from "@/lib/profile";

/**
 * LES DEUX ÉCRANS DE COLORIMÉTRIE (25/09/2026 ; questionnaire et photo réelle
 * le 30/09/2026, docs/colorimetrie.md).
 *
 * Sortis de ProfileSetupScreen parce qu'ils portent leur propre machine à
 * états — choix, questions, photo, analyse, échec — là où toutes les autres
 * étapes sont un choix et rien de plus.
 *
 * DEUX CHEMINS, UN SEUL RÉSULTAT. Le questionnaire est toujours proposé ; la
 * photo seulement si `colorimetrieDisponible()` (interrupteur posé après la
 * revue juridique). Sans lui, aucun bouton photo n'apparaît : demander le
 * visage de quelqu'un pour une analyse qui n'aura pas lieu serait la version
 * la plus coûteuse de la promesse qu'on ne peut pas tenir.
 *
 * `onResultat` ne reçoit QUE des résultats exploitables : un échec reste dans
 * cet écran, qui propose de reprendre une photo, de répondre aux questions
 * ou de passer. Rien d'un échec n'est donc enregistré dans le profil.
 */

const T = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Puce({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[9px]">
      <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-terracotta" style={{ display: "block" }}>
        <path d="M5 12.5l4.5 4.5L19 7.5" {...T} strokeWidth={1.8} />
      </svg>
      <span className="text-[13px] text-muted-3 leading-[1.4]">{children}</span>
    </div>
  );
}

function Groupe({ titre, sous, hexes }: { titre: string; sous?: string; hexes: string[] }) {
  return (
    <div className="mt-5">
      <div className="t-label text-terracotta">{titre}</div>
      {sous && <div className="text-[12px] text-muted mt-[3px]">{sous}</div>}
      <div className="flex flex-wrap gap-[10px] mt-[10px]">
        {hexes.map((h) => (
          <div key={h} className="flex flex-col items-center" style={{ width: 62 }}>
            <span
              className="w-[38px] h-[38px] rounded-full"
              style={{ background: h, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.10)" }}
            />
            <span className="text-[10px] text-muted mt-[5px] text-center leading-[1.2]">{paletteColorName(h) ?? ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Une voie d'analyse : toute la carte est le bouton. */
function CarteChoix({ titre, texte, onClick }: { titre: string; texte: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border border-border rounded-[20px] px-[16px] py-[15px] flex items-center gap-3 cursor-pointer"
    >
      <span className="flex-1 min-w-0">
        <span className="block t-titre-carte text-ink">{titre}</span>
        <span className="block text-[12.5px] text-muted leading-[1.45] mt-[4px]" style={{ textWrap: "pretty" }}>
          {texte}
        </span>
      </span>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-terracotta">
        <path d="M9 5l7 7-7 7" {...T} />
      </svg>
    </button>
  );
}

const BOUTON_PRINCIPAL = "w-full rounded-full bg-terracotta-deep text-cream t-bouton cursor-pointer mt-4";
const LIEN = "w-full text-[13px] text-terracotta cursor-pointer mt-1";
const LIEN_DISCRET = "w-full text-[12px] text-muted cursor-pointer mt-2";

type Mode = "choix" | "questions" | "indecis" | "photo";

export function EtapeColorimetrie({
  onResultat,
  onPasser,
}: {
  onResultat: (c: Colorimetrie) => void;
  onPasser: () => void;
}) {
  const photoPossible = colorimetrieDisponible();
  const [mode, setMode] = useState<Mode>("choix");
  const [reponses, setReponses] = useState<(number | null)[]>(() => QUESTIONS_COLORIMETRIE.map(() => null));
  const [question, setQuestion] = useState(0);
  const [apercu, setApercu] = useState<{ url: string; fichier: File; source: "camera" | "galerie" } | null>(null);
  const [consentement, setConsentement] = useState(false);
  const [encours, setEncours] = useState(false);
  const [echec, setEchec] = useState<{ motif?: MotifPhoto } | null>(null);
  const camera = useRef<HTMLInputElement | null>(null);
  const galerie = useRef<HTMLInputElement | null>(null);

  const passer = (
    <button onClick={onPasser} className={LIEN_DISCRET} style={{ minHeight: 44 }}>
      Passer pour l&apos;instant
    </button>
  );

  const commencerQuestions = () => {
    setReponses(QUESTIONS_COLORIMETRIE.map(() => null));
    setQuestion(0);
    setMode("questions");
  };

  const repondre = (indice: number) => {
    const suite = reponses.map((r, i) => (i === question ? indice : r));
    setReponses(suite);
    if (question < QUESTIONS_COLORIMETRIE.length - 1) {
      setQuestion(question + 1);
      return;
    }
    const saison = saisonDuQuestionnaire(suite);
    if (saison) onResultat(colorimetrieDeSaison(saison, "questionnaire"));
    else setMode("indecis");
  };

  const oublierPhoto = () => {
    if (apercu) URL.revokeObjectURL(apercu.url);
    setApercu(null);
    setConsentement(false);
  };

  const choisir = (source: "camera" | "galerie") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setEchec(null);
    setConsentement(false);
    setApercu({ url: URL.createObjectURL(f), fichier: f, source });
  };

  const lancer = async () => {
    if (!apercu || !consentement || encours) return;
    setEncours(true);
    const c = await analyserColorimetrie(apercu.fichier, apercu.source, consentement);
    setEncours(false);
    // La photo ne survit pas à l'analyse : ni stockée, ni téléversée ailleurs
    // que vers l'analyse. L'URL locale est révoquée dans la foulée, et un
    // nouvel essai redemande le consentement.
    oublierPhoto();
    if (colorimetrieUtilisable(c)) onResultat(c);
    else setEchec({ motif: c.motif });
  };

  // ── Questionnaire ────────────────────────────────────────────────────────
  if (mode === "questions") {
    const q = QUESTIONS_COLORIMETRIE[question];
    return (
      <div className="mt-[26px]">
        <div className="t-label text-terracotta">
          Question {question + 1} sur {QUESTIONS_COLORIMETRIE.length}
        </div>
        <div className="t-titre-carte text-ink mt-[8px]" style={{ textWrap: "pretty" }}>
          {q.question}
        </div>
        <div className="flex flex-col gap-[10px] mt-4" role="group" aria-label={q.question}>
          {q.reponses.map((r, i) => (
            <OptionRow key={r.libelle} label={r.libelle} on={reponses[question] === i} onClick={() => repondre(i)} />
          ))}
        </div>
        <button
          onClick={() => (question > 0 ? setQuestion(question - 1) : setMode("choix"))}
          className={LIEN + " mt-3"}
          style={{ minHeight: 44 }}
        >
          {question > 0 ? "Question précédente" : "Revenir au choix"}
        </button>
      </div>
    );
  }

  // ── Réponses qui ne tranchent pas : on le dit, on n'invente pas ──────────
  if (mode === "indecis") {
    return (
      <div className="mt-[26px]">
        <div className="bg-card border border-border rounded-[20px] px-[16px] py-[15px]">
          <div className="t-titre-carte text-ink">Pas de saison nette</div>
          <div className="text-[13px] text-muted leading-[1.5] mt-[6px]" style={{ textWrap: "pretty" }}>
            Tes réponses ne penchent ni vers les tons chauds, ni vers les tons froids. Plutôt que de choisir au hasard,
            Capsela garde tes couleurs préférées.
          </div>
        </div>
        <button onClick={commencerQuestions} className={BOUTON_PRINCIPAL} style={{ minHeight: 52 }}>
          Reprendre les questions
        </button>
        {photoPossible && (
          <button onClick={() => setMode("photo")} className={LIEN} style={{ minHeight: 44 }}>
            Essayer avec une photo
          </button>
        )}
        {passer}
      </div>
    );
  }

  // ── Photo ────────────────────────────────────────────────────────────────
  if (mode === "photo" && photoPossible) {
    if (encours) {
      return (
        <div className="mt-[26px] bg-card border border-border rounded-[20px] px-[16px] py-[18px]" aria-live="polite">
          <div className="t-titre-carte text-ink">Analyse en cours…</div>
          <div className="flex flex-col gap-[9px] mt-[14px]">
            <Puce>Tonalités du visage</Puce>
            <Puce>Couleur des cheveux</Puce>
            <Puce>Couleur des yeux</Puce>
          </div>
        </div>
      );
    }

    if (apercu) {
      return (
        <div className="mt-[26px]">
          {/* Vignette à côté de sa consigne : en pleine largeur, l'aperçu 3:4
              repoussait le consentement et le bouton sous le pli à 360 px
              (mesuré : 862 px pour 800 en portrait centré, encore trop). */}
          <div className="flex items-center gap-[14px]">
            <div className="rounded-[16px] overflow-hidden bg-warm-bg flex-shrink-0" style={{ width: 96, aspectRatio: "3 / 4" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={apercu.url} alt="Ta photo" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
            <div className="text-[13px] text-muted leading-[1.5]" style={{ textWrap: "pretty" }}>
              Vérifie qu&apos;on voit bien ton visage et tes cheveux, sans filtre.
            </div>
          </div>
          {/* LE CONSENTEMENT EST UN GESTE, jamais une case pré-cochée : sans
              lui, le bouton reste inactif et rien ne part (le serveur le
              vérifie aussi). Il vaut pour CETTE photo : un nouvel essai le
              redemande. TEXTE À FAIRE VALIDER à la revue juridique. */}
          <button
            role="checkbox"
            aria-checked={consentement}
            onClick={() => setConsentement(!consentement)}
            className="w-full flex items-start gap-3 text-left bg-card border border-border rounded-[16px] px-[14px] py-[13px] mt-4 cursor-pointer"
          >
            <span
              aria-hidden="true"
              className={
                "w-5 h-5 rounded-[6px] flex-shrink-0 flex items-center justify-center text-[11px] mt-[1px] " +
                (consentement ? "bg-terracotta text-cream" : "border-[1.5px] border-dots text-transparent")
              }
            >
              ✓
            </span>
            <span className="text-[12.5px] text-muted-3 leading-[1.5]" style={{ textWrap: "pretty" }}>
              J&apos;accepte que cette photo de mon visage soit transmise à OpenAI, le prestataire d&apos;analyse de
              Capsela, uniquement pour déterminer ma colorimétrie. Capsela ne la conserve pas.
            </span>
          </button>
          <button
            onClick={lancer}
            disabled={!consentement}
            className={BOUTON_PRINCIPAL + " disabled:opacity-40 disabled:cursor-default"}
            style={{ minHeight: 52 }}
          >
            Analyser ma colorimétrie
          </button>
          <button onClick={oublierPhoto} className={LIEN} style={{ minHeight: 44 }}>
            Changer de photo
          </button>
        </div>
      );
    }

    return (
      <div className="mt-[26px]">
        {colorimetrieMockActive() && (
          <div className="bg-warm-bg rounded-[14px] px-[14px] py-[10px] text-[12px] text-terracotta mb-4">
            Résultat de démonstration — le service d&apos;analyse n&apos;est pas branché.
          </div>
        )}
        {echec ? (
          <div className="bg-card border border-border rounded-[20px] px-[16px] py-[15px]" aria-live="polite">
            <div className="text-[13px] text-muted-3 leading-[1.5]" style={{ textWrap: "pretty" }}>
              {messageEchecPhoto(echec.motif)}
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-[20px] px-[16px] py-[15px]">
            <div className="t-label text-terracotta">Pour une analyse fiable</div>
            <div className="flex flex-col gap-[9px] mt-[11px]">
              <Puce>Lumière naturelle</Puce>
              <Puce>Visage de face</Puce>
              <Puce>Sans filtre</Puce>
              <Puce>Cheveux visibles</Puce>
            </div>
          </div>
        )}
        <div className="text-[12px] text-muted leading-[1.45] mt-3" style={{ textWrap: "pretty" }}>
          Ta photo sert uniquement à l&apos;analyse. Capsela ne la conserve pas, ne la publie pas et ne la partage
          pas.
        </div>
        {/* `capture="user"` demande la caméra FRONTALE — même motif que
            AddScreen, qui demande l'arrière avec `capture="environment"`. Le
            second champ, sans `capture`, laisse le système ouvrir la galerie. */}
        <input ref={camera} type="file" accept="image/*" capture="user" onChange={choisir("camera")} className="hidden" />
        <input ref={galerie} type="file" accept="image/*" onChange={choisir("galerie")} className="hidden" />
        <button onClick={() => camera.current?.click()} className={BOUTON_PRINCIPAL} style={{ minHeight: 52 }}>
          {echec ? "Reprendre une photo" : "Prendre une photo"}
        </button>
        <button onClick={() => galerie.current?.click()} className={LIEN} style={{ minHeight: 44 }}>
          Choisir une photo
        </button>
        <button onClick={commencerQuestions} className={LIEN} style={{ minHeight: 44 }}>
          Répondre aux questions plutôt
        </button>
        {passer}
      </div>
    );
  }

  // ── Choix de la voie ─────────────────────────────────────────────────────
  // Sans photo, une seule voie : l'écran la présente et la lance, sans faire
  // choisir entre une option et rien.
  if (!photoPossible) {
    return (
      <div className="mt-[26px]">
        <div className="bg-card border border-border rounded-[20px] px-[16px] py-[15px]">
          <div className="t-titre-carte text-ink">Cinq questions rapides</div>
          <div className="text-[13px] text-muted leading-[1.5] mt-[6px]" style={{ textWrap: "pretty" }}>
            Sur tes bijoux, ton blanc préféré, tes cheveux, tes yeux et les couleurs qu&apos;on te complimente.
          </div>
        </div>
        <button onClick={commencerQuestions} className={BOUTON_PRINCIPAL} style={{ minHeight: 52 }}>
          Commencer
        </button>
        {passer}
      </div>
    );
  }

  return (
    <div className="mt-[26px] flex flex-col gap-[10px]">
      <CarteChoix
        titre="Répondre à cinq questions"
        texte="Sans photo : tes bijoux, tes cheveux, tes yeux et les couleurs qu'on te complimente."
        onClick={commencerQuestions}
      />
      <CarteChoix
        titre="Analyser une photo"
        texte="Un portrait de face, en lumière naturelle. Ta photo n'est pas conservée."
        onClick={() => {
          setEchec(null);
          setMode("photo");
        }}
      />
      {passer}
    </div>
  );
}

export function ResultatColorimetrie({
  colorimetrie,
  onRefaire,
}: {
  colorimetrie: Colorimetrie;
  onRefaire: () => void;
}) {
  if (!colorimetrieUtilisable(colorimetrie)) return null;
  const c = colorimetrie;
  const saison = estSaison(c.saison) ? SAISONS[c.saison] : null;
  const origine =
    c.source === "questionnaire" ? "D'après tes réponses" : c.source === "camera" || c.source === "galerie" ? "D'après ta photo" : null;
  return (
    <div className="mt-[26px]">
      {/* Le badge dépend de la PRÉSENCE d'un score, jamais d'un seuil deviné :
          un service qui n'en rend pas ne doit pas faire afficher « fiable ».
          Ni le questionnaire ni l'analyse photo n'en rendent (30/09/2026). */}
      {c.confiance !== undefined && (
        <span className="inline-block t-label text-terracotta bg-warm-bg rounded-full px-[10px] py-[4px] mr-2">
          Analyse fiable
        </span>
      )}
      {origine && <div className="t-label text-terracotta">{origine}</div>}
      {c.libelle && <div className="t-titre-section text-ink mt-[10px]">{c.libelle}</div>}
      {saison && (
        <div className="text-[13px] text-muted leading-[1.5] mt-[6px]" style={{ textWrap: "pretty" }}>
          {saison.description}
        </div>
      )}

      <Groupe titre="Couleurs signature" hexes={c.signature ?? []} />
      {!!c.neutres?.length && <Groupe titre="Neutres" hexes={c.neutres} />}
      {/* « Avec modération » n'apparaît QUE si le résultat le porte, et ne dit
          jamais « à éviter » : le sous-titre nomme un placement, pas une
          interdiction. Aucune de ces couleurs n'est retirée du moteur. */}
      {!!c.moderation?.length && (
        <Groupe titre="Avec modération" sous="Plutôt loin du visage" hexes={c.moderation} />
      )}

      <button onClick={onRefaire} className="w-full text-[13px] text-terracotta cursor-pointer mt-5" style={{ minHeight: 44 }}>
        Refaire l&apos;analyse
      </button>
    </div>
  );
}
