"use client";

import { useState } from "react";
import OptionRow from "@/components/OptionRow";
import {
  colorimetrieDeSaison,
  colorimetrieUtilisable,
  estSaison,
  QUESTIONS_COLORIMETRIE,
  SAISONS,
  saisonDuQuestionnaire,
  type Colorimetrie,
} from "@/lib/colorimetrie";
import { paletteColorName } from "@/lib/profile";

/**
 * LES DEUX ÉCRANS DE COLORIMÉTRIE (25/09/2026 ; questionnaire le 30/09/2026,
 * docs/colorimetrie.md).
 *
 * Sortis de ProfileSetupScreen parce qu'ils portent leur propre machine à
 * états — présentation, questions, réponses qui ne tranchent pas — là où
 * toutes les autres étapes sont un choix et rien de plus.
 *
 * LE QUESTIONNAIRE EST LA SEULE VOIE (arbitré le 30/09/2026 : « pas
 * d'analyse photo pour le moment »). Aucun bouton photo : l'écran ne demande
 * jamais le visage de personne.
 *
 * `onResultat` ne reçoit QUE des résultats exploitables : des réponses qui ne
 * tranchent pas restent dans cet écran, qui propose de reprendre ou de
 * passer. Rien d'indécis n'est donc enregistré dans le profil.
 */

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

const BOUTON_PRINCIPAL = "w-full rounded-full bg-terracotta-deep text-cream t-bouton cursor-pointer mt-4";
const LIEN = "w-full text-[13px] text-terracotta cursor-pointer mt-1";
const LIEN_DISCRET = "w-full text-[12px] text-muted cursor-pointer mt-2";

type Mode = "presentation" | "questions" | "indecis";

export function EtapeColorimetrie({
  onResultat,
  onPasser,
}: {
  onResultat: (c: Colorimetrie) => void;
  onPasser: () => void;
}) {
  const [mode, setMode] = useState<Mode>("presentation");
  const [reponses, setReponses] = useState<(number | null)[]>(() => QUESTIONS_COLORIMETRIE.map(() => null));
  const [question, setQuestion] = useState(0);

  const passer = (
    <button onClick={onPasser} className={LIEN_DISCRET} style={{ minHeight: 44 }}>
      Passer pour l&apos;instant
    </button>
  );

  const commencer = () => {
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
          onClick={() => (question > 0 ? setQuestion(question - 1) : setMode("presentation"))}
          className={LIEN + " mt-3"}
          style={{ minHeight: 44 }}
        >
          {question > 0 ? "Question précédente" : "Revenir à la présentation"}
        </button>
      </div>
    );
  }

  // Réponses qui ne tranchent pas : on le dit, on n'invente pas.
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
        <button onClick={commencer} className={BOUTON_PRINCIPAL} style={{ minHeight: 52 }}>
          Reprendre les questions
        </button>
        {passer}
      </div>
    );
  }

  return (
    <div className="mt-[26px]">
      <div className="bg-card border border-border rounded-[20px] px-[16px] py-[15px]">
        <div className="t-titre-carte text-ink">Cinq questions rapides</div>
        <div className="text-[13px] text-muted leading-[1.5] mt-[6px]" style={{ textWrap: "pretty" }}>
          Sur tes bijoux, ton blanc préféré, tes cheveux, tes yeux et les couleurs qu&apos;on te complimente.
        </div>
      </div>
      <button onClick={commencer} className={BOUTON_PRINCIPAL} style={{ minHeight: 52 }}>
        Commencer
      </button>
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
  // Seul le questionnaire écrit un résultat depuis le 30/09/2026 ; un profil
  // plus ancien, écrit par la démo photo, n'affiche simplement pas l'origine.
  const origine = c.source === "questionnaire" ? "D'après tes réponses" : null;
  return (
    <div className="mt-[26px]">
      {/* Le badge dépend de la PRÉSENCE d'un score, jamais d'un seuil deviné :
          un service qui n'en rend pas ne doit pas faire afficher « fiable ».
          Le questionnaire n'en rend pas (30/09/2026). */}
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
          interdiction. Le moteur les éloigne du visage sans les retirer des
          tenues (colorimetrieMoteur.ts). */}
      {!!c.moderation?.length && (
        <Groupe titre="Avec modération" sous="Plutôt loin du visage" hexes={c.moderation} />
      )}

      {/* VRAI DANS LE CODE (colorimetrieMoteur.ts) : les couleurs de la saison
          sont préférées pour les pièces portées près du visage, celles « avec
          modération » y sont évitées quand une autre pièce convient, et
          restent possibles partout ailleurs. */}
      <div className="text-[13px] text-muted-3 leading-[1.5] mt-5" style={{ textWrap: "pretty" }}>
        Capsela en tient compte dans tes tenues : tes couleurs signature et neutres près du visage, celles « avec
        modération » plutôt en bas, en chaussures ou en sac.
      </div>

      <button onClick={onRefaire} className="w-full text-[13px] text-terracotta cursor-pointer mt-3" style={{ minHeight: 44 }}>
        Refaire le questionnaire
      </button>
    </div>
  );
}
