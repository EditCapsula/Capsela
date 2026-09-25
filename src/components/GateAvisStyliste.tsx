import BottomSheet from "@/components/BottomSheet";

/**
 * Premium Gate de l'Avis de styliste — libellés EXACTS de la section 5 de
 * docs/avis-de-styliste.md [DÉCIDÉ]. Un seul composant pour tous les endroits
 * qui le montrent (arbitrage : ne pas multiplier les Gates) : la carte de
 * l'accueil, et l'écran lui-même si le serveur refuse l'analyse (compte non
 * Premium). Forme arbitrée : feuille modale posée sur l'écran source ;
 * « Plus tard » la referme et laisse exactement où l'on était. Même
 * traitement visuel que le Gate du quota « Autre tenue » (TenuesScreen).
 * Aucune publicité récompensée.
 *
 * À ARBITRER: visuel du Gate (section 5) — aucun tant qu'il n'est pas fourni.
 */
export default function GateAvisStyliste({
  open,
  onClose,
  onDecouvrirPremium,
}: {
  open: boolean;
  onClose: () => void;
  onDecouvrirPremium: () => void;
}) {
  return (
    <BottomSheet title="Et si on regardait ta tenue ?" open={open} onClose={onClose}>
      <div className="text-[13px] text-ink leading-[1.55]">
        Envoie une photo de ton look et laisse Capsela te donner un avis personnalisé sur ce qui fonctionne et ce que tu
        pourrais ajuster.
      </div>
      <button
        onClick={onDecouvrirPremium}
        className="w-full rounded-full bg-terracotta-deep text-cream text-[13px] tracking-[.1em] uppercase cursor-pointer mt-5"
        style={{ minHeight: 52 }}
      >
        Découvrir Premium
      </button>
      <button onClick={onClose} className="w-full rounded-full text-[12px] text-muted-3 cursor-pointer mt-1" style={{ minHeight: 44 }}>
        Plus tard
      </button>
    </BottomSheet>
  );
}
