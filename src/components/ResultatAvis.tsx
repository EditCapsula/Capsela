"use client";

import type { AvisStyliste, PieceSuggeree } from "@/lib/avisStylisteClient";
import { resolveItemImage } from "@/lib/catalogImages";
import type { Item } from "@/lib/types";

/*
 * Le contenu d'un avis de styliste (docs/avis-de-styliste.md, écrans 6 à 10),
 * partagé par le résultat d'une analyse (AvisStylisteScreen) et par un avis
 * rouvert depuis le Journal (AvisEnregistreScreen) : une seule mise en page,
 * pour qu'un avis enregistré se relise exactement comme il a été lu.
 *
 * Écran unique qui défile — À ARBITRER: écran unique ou écrans séparés
 * (point 12) ; l'écran unique est le plus réversible. L'avis global est
 * toujours lu en premier, les points forts avant le conseil [§6].
 */

const TITRES = {
  ceQuiFonctionne: "Ce qui fonctionne", // décision produit n° 9
  monConseil: "Mon conseil", // décision produit n° 9
  aTester: "À tester", // décision produit n° 9
  avecTonDressing: "Avec ton dressing", // décision produit n° 9
};

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="mt-[26px]">
      <div className="t-surtitre text-muted mb-[10px]">{titre}</div>
      {children}
    </section>
  );
}

function Points({ points }: { points: string[] }) {
  return (
    <ul className="flex flex-col gap-[10px]">
      {points.map((p, i) => (
        <li key={i} className="flex items-start gap-[10px] text-[14px] text-ink leading-[1.5]">
          <span aria-hidden="true" className="text-terracotta text-[11px] mt-[4px] flex-shrink-0">
            ✦
          </span>
          {p}
        </li>
      ))}
    </ul>
  );
}

/** Carte d'une pièce du dressing : visuel et nom (§6, écran 10), toute la carte est le bouton. */
function CartePieceDressing({ item, onClick }: { item: Item; onClick: () => void }) {
  const image = resolveItemImage(item);
  return (
    <button type="button" onClick={onClick} className="min-w-0 text-left cursor-pointer">
      <div className="w-full rounded-[14px] border border-border overflow-hidden" style={{ aspectRatio: "4/5", background: image.url ? "#F3EDE1" : item.hex }}>
        {image.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt="" loading="lazy" className="w-full h-full object-contain block" style={{ padding: 6, boxSizing: "border-box" }} />
        )}
      </div>
      <div className="text-[12px] text-ink leading-[16px] min-h-[32px] line-clamp-2 mt-[8px]">{item.name}</div>
    </button>
  );
}

export default function ResultatAvis({
  avis,
  pieces,
  items,
  onOuvrirPiece,
}: {
  avis: AvisStyliste;
  pieces: PieceSuggeree[];
  /** Le dressing actuel : une pièce suggérée qui n'y est plus n'est pas affichée (arbitré). */
  items: Item[];
  onOuvrirPiece: (id: number) => void;
}) {
  // « Avec ton dressing » (§12, option A) : pièces choisies par le serveur
  // dans le dressing de l'utilisatrice, et encore présentes au moment de
  // l'affichage. Aucune : section masquée (point 4). Clic : fiche de la pièce
  // (point 17).
  const piecesPresentes = pieces.map((p) => items.find((i) => i.id === p.id)).filter((i): i is Item => Boolean(i));
  return (
    <>
      <div className="mt-[20px] font-serif text-[19px] leading-[1.35] text-ink">{avis.overallAssessment}</div>
      <Section titre={TITRES.ceQuiFonctionne}>
        <Points points={avis.strengths} />
      </Section>
      <Section titre={TITRES.monConseil}>
        <div className="bg-warm-bg border border-warm-border rounded-[18px] px-4 py-[14px] text-[14px] text-ink leading-[1.5]">{avis.mainAdvice}</div>
      </Section>
      <Section titre={TITRES.aTester}>
        <Points points={avis.suggestions} />
      </Section>
      {piecesPresentes.length > 0 && (
        <Section titre={TITRES.avecTonDressing}>
          <div className="grid grid-cols-3 gap-[10px]">
            {piecesPresentes.map((it) => (
              <CartePieceDressing key={it.id} item={it} onClick={() => onOuvrirPiece(it.id)} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
