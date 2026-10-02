import type { ReactNode } from "react";
import Card from "@/components/Card";

/**
 * L'ÉTAT VIDE (02/10/2026, audit design system : « 13 écrans implémentent leur propre état vide »). Sobre,
 * typographique, sans illustration : un état vide est une invitation, pas un constat. Trois formes :
 *
 *   ligne         une phrase discrète (« Aucun look dans cette catégorie pour l'instant. ») — le défaut
 *   carte         un titre, une phrase et, si besoin, une action en lien : « Ton dressing est vide »
 *   invitation    comme la carte, en cadre pointillé : le premier pas d'un écran encore vierge
 *
 * Le texte vient de l'appelant : il dit ce qui est vrai ICI, jamais un message générique.
 * Marges et alignement particuliers en `className`.
 */
export default function EmptyState({
  forme = "ligne",
  titre,
  action,
  className = "",
  children,
}: {
  forme?: "ligne" | "carte" | "invitation";
  titre?: string;
  action?: { libelle: string; onClick: () => void };
  className?: string;
  children: ReactNode;
}) {
  if (forme === "ligne") {
    return <div className={`text-[13px] text-muted-3 leading-[1.5]${className ? " " + className : ""}`}>{children}</div>;
  }
  const contenu = (
    <>
      {titre && <div className="t-titre-carte text-ink">{titre}</div>}
      <div className={`text-[13px] text-muted-3 leading-[1.5]${titre ? " mt-2" : ""}`} style={{ textWrap: "pretty" }}>
        {children}
      </div>
      {action && (
        <button type="button" onClick={action.onClick} className="mt-3 text-[12px] text-terracotta cursor-pointer">
          {action.libelle}
        </button>
      )}
    </>
  );
  if (forme === "invitation") {
    return (
      <div className={`rounded-carte px-5 py-[30px] text-center${className ? " " + className : ""}`} style={{ border: "1px dashed var(--color-sand-border)" }}>
        {contenu}
      </div>
    );
  }
  return <Card className={`px-5 py-[26px] text-center${className ? " " + className : ""}`}>{contenu}</Card>;
}
