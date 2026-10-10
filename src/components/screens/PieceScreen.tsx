"use client";

import { useEffect, useState } from "react";
import { CATLABEL, OCC_LABELS, wornAgo } from "@/lib/data";
import { bestStyleFor } from "@/lib/capsule";
import { isCoupeApplicable, isSizeApplicable, suggestName } from "@/lib/attributes";
import { daysSinceWorn, inactivityInfo } from "@/lib/selectors";
import { aDesManches, libelleManches } from "@/lib/manches";
import { champsManquants, phraseQuandPorter, titreEnDeuxTemps } from "@/lib/pieceFiche";
import { libelleSaisons, saisonsDe } from "@/lib/saisons";
import { participePorte, participePorteMaj } from "@/lib/logic";
import { useCapsela } from "@/lib/store";
import { fondPhotoPiece, resolveItemImage } from "@/lib/catalogImages";
import { dressingPhotoPath, estPhotoMiseAPlat, type CodeMiseAPlat } from "@/lib/dressing";
import { isSupabaseConfigured } from "@/lib/supabase";
import BottomSheet from "@/components/BottomSheet";
import BoutonRetour from "@/components/BoutonRetour";
import Button from "@/components/Button";
import Card from "@/components/Card";

/** Ce que la fonction répond quand la mise à plat échoue : la cause, dite simplement (10/10/2026). */
const MESSAGE_ECHEC_MISE_A_PLAT: Record<CodeMiseAPlat, string> = {
  quota_atteint: "Tu as atteint la limite de mises à plat du jour : reviens demain.",
  non_configure: "Le service de mise à plat n'est pas relié pour le moment.",
  credits_epuises: "Le service de mise à plat n'a plus de crédit pour le moment.",
  photo_refusee: "Le service n'a pas pu traiter cette photo.",
  photo_invalide: "Cette photo ne peut pas être mise à plat.",
  indisponible: "La mise à plat n'a pas abouti : le service n'a pas répondu.",
};

const LENGTH_SUBTYPES = new Set(["Mini", "Midi", "Longue", "Courte"]);

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="t-surtitre text-placeholder flex-shrink-0">{label}</span>
      <span className="text-[13px] text-ink text-right">{value}</span>
    </div>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20l.9-4L16.5 4.4a1.4 1.4 0 0 1 2 0l1.1 1.1a1.4 1.4 0 0 1 0 2L8 19 4 20z" />
      <path d="M14.5 6.4l3 3" />
    </svg>
  );
}
function CameraIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.4" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 .8 12.1A2 2 0 0 0 7.8 21h8.4a2 2 0 0 0 2-1.9L19 7" />
    </svg>
  );
}
function FlatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 4 4 7l2 3 2-1v11h8V9l2 1 2-3-4-3c-.6 1.3-2 2-4 2s-3.4-.7-4-2z" />
    </svg>
  );
}
function BulbIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6M10 21h4M8 14.5A5.5 5.5 0 1 1 16 14.5c-.7.8-1.3 1.6-1.4 2.5H9.4c-.1-.9-.7-1.7-1.4-2.5z" />
    </svg>
  );
}

export default function PieceScreen() {
  const { state, actions, vestiairePool } = useCapsela();
  const [suggestionInfoOpen, setSuggestionInfoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [lookSheetOpen, setLookSheetOpen] = useState(false);
  const [dormant, setDormant] = useState(false);
  // « Mettre à plat » une photo déjà importée : on propose, la personne compare, puis choisit (rien n'est remplacé avant son accord).
  const [plat, setPlat] = useState<{ etape: "ferme" | "repos" | "cours" | "propose" | "erreur"; url?: string; code?: CodeMiseAPlat }>({ etape: "ferme" });
  const active = state.activeSuggested
    ? vestiairePool.find((i) => i.id === state.activeId)
    : state.items.find((i) => i.id === state.activeId);

  useEffect(() => {
    if (!active || !state.activeSuggested) return;
    if (
      resolveItemImage(active).kind === "placeholder" &&
      active.imageStatus !== "generating" &&
      active.imageStatus !== "error" &&
      active.imageStatus !== "invalid"
    ) {
      actions.requestCatalogImage(active.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, state.activeSuggested]);

  // Module revente contextuel (recette 24/08/2026, point 7 du brief
  // PieceScreen ; règle d'inactivité tenant compte de la saison depuis le
  // 25/08/2026, cf. inactivityInfo/selectors.ts — même détection que
  // l'écran "Jamais portées", un seul repère dans toute l'app) — Date.now()
  // est impur, jamais lu directement pendant le rendu : calculé dans un
  // effet, pas de compte à rebours en direct nécessaire, une seule
  // évaluation après montage/changement de pièce suffit.
  useEffect(() => {
    const next = Boolean(active && !state.activeSuggested && inactivityInfo(active).inactive);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDormant(next);
  }, [active, state.activeSuggested]);

  if (!active) return null;

  const suggested = state.activeSuggested;
  const pNever = active.worn == null;
  // Jours réels depuis le dernier port, dérivés de l'historique plutôt que
  // du champ worn stocké (correctif 25/08/2026, même cause que "Mes
  // pièces" : worn est figé par la dernière action "porter" et ne vieillit
  // jamais tout seul — "Porté aujourd'hui" restait sinon affiché
  // indéfiniment). Non calculé pour une pièce suggérée, qui n'affiche pas
  // ce statut.
  const daysWorn = !suggested && !pNever ? daysSinceWorn(state.history, active.id) : null;
  const resolvedImage = resolveItemImage(active);

  // Statut de port accordé au genre du vêtement (recette 26/08/2026,
  // signalé : "Jamais porté" pour une robe) — même détection de genre que
  // le reste des descriptions de tenues (nounInfoOf, logic.ts), jamais un
  // second moteur d'accord. wornAgo() est toujours au masculin par défaut
  // ("Porté hier") ; seul son participe de tête est ré-accordé, le reste de
  // la phrase ne varie jamais avec le genre.
  // Nombre aussi depuis le 26/09/2026 (participePorte) : « Jamais portées »
  // pour des bottines, « Portés hier » pour des mocassins.
  const wornStatusLabel = pNever
    ? "Jamais " + participePorte(active)
    : wornAgo(daysWorn ?? active.worn).replace(/^Porté/, participePorteMaj(active));

  // Type unifié (chaussure/sac/bijou/accessoire/sous-type générique) — même
  // hiérarchie que typeOptionsFor/typeValue côté AddScreen, en lecture seule ici.
  const typeValue = active.shoeType || active.sacType || active.bijouType || active.accessoireType || active.subtype || null;
  const eyebrow = (typeValue || CATLABEL[active.cat]).toUpperCase();
  // Longueur vs Type (recette 26/08/2026, signalé : "TYPE → Midi", une
  // longueur affichée comme un type) — seuls jupe et robe ont des
  // sous-types qui sont des longueurs (Mini/Midi/Longue/Courte, cf.
  // SUBTYPES dans data.ts) ; ailleurs (chaussures, sac, bijou, accessoire,
  // veste, manteau...) le sous-type est un vrai type, jamais une longueur.
  // Ligne masquée quand vide plutôt que de retomber sur CATLABEL : la
  // catégorie ("Robe") est déjà donnée par la ligne de synthèse au-dessus,
  // inutile de la répéter.
  const isLength = Boolean(active.subtype && LENGTH_SUBTYPES.has(active.subtype));
  const displayName =
    active.name && active.name !== "Nouvelle pièce"
      ? active.name
      : suggestName(active.cat, active.subtype, active.matiere, active.color);
  const synthesis = [CATLABEL[active.cat], active.matiere, active.color].filter(Boolean).join(" · ");

  const sizeApplicable = isSizeApplicable(active.cat);
  const coupeApplicable = isCoupeApplicable(active.cat);
  const isShoe = active.cat === "chaussures";

  // Seulement une photo personnelle (pas le visuel du catalogue), pas déjà mise à plat, avec la base branchée.
  const peutMettreAPlat = !suggested && isSupabaseConfigured && Boolean(dressingPhotoPath(active.photoUrl)) && !estPhotoMiseAPlat(active.photoUrl);
  const lancerMiseAPlat = async () => {
    setPlat({ etape: "cours" });
    const r = await actions.proposerMiseAPlat(active.id);
    setPlat("url" in r ? { etape: "propose", url: r.url } : { etape: "erreur", code: r.code });
  };
  const fermerMiseAPlat = () => {
    // Fermer une version proposée sans la choisir la refuse : le fichier généré ne reste pas dans le stockage.
    if (plat.etape === "propose" && plat.url) actions.ecarterPhotoMiseAPlat(plat.url);
    setPlat({ etape: "ferme" });
  };

  const addableLooks = state.savedLooks.filter((l) => !l.pieceIds.includes(active.id));

  const manquants = champsManquants(active);
  const titre = titreEnDeuxTemps(displayName);
  const trio: { label: string; value: string; dot?: string; vide?: boolean }[] = [
    { label: "Couleur", value: active.color, dot: active.hex },
    ...(aDesManches(active.cat) ? [{ label: "Manches", value: active.manches ? libelleManches(active.manches).replace(/^Manches /, "").replace(/^./, (c) => c.toUpperCase()).replace("Sans manches", "Sans") : "À préciser", vide: !active.manches }] : []),
    ...(sizeApplicable ? [{ label: isShoe ? "Pointure" : "Taille", value: active.size || "À préciser", vide: !active.size }] : []),
  ];
  const details: { label: string; value: string }[] = [
    ...(active.brand ? [{ label: "Marque", value: active.brand }] : []),
    ...(active.matiere ? [{ label: "Matière", value: active.matiere }] : []),
    ...(coupeApplicable && active.coupe ? [{ label: "Coupe", value: active.coupe }] : []),
    ...(typeValue ? [{ label: isLength ? "Longueur" : "Modèle", value: typeValue }] : []),
  ];
  const quandPorter = phraseQuandPorter(saisonsDe(active), active.occasion);

  return (
    <div className="absolute inset-0">
      {suggested ? (
        // UNE SUGGESTION de la capsule (pas encore une pièce du dressing) : la mise en page d'origine, photo en 4/5.
        <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-[100px]">
          <div className="flex items-center justify-between">
            <BoutonRetour onClick={() => actions.go(state.pieceReturn)} label="Revenir à l'écran précédent" />
          </div>

          <div
            className="w-full rounded-carte border border-border overflow-hidden mt-[14px] relative"
            style={
              resolvedImage.kind === "generated"
                ? { aspectRatio: "4/5", background: "var(--color-photo-bg)" }
                : resolvedImage.url
                  ? { aspectRatio: "4/5", ...fondPhotoPiece(resolvedImage.url, resolvedImage.kind === "detouree") }
                  : { aspectRatio: "4/5", background: active.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }
            }
          >
            {resolvedImage.kind === "generated" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvedImage.url}
                alt={active.name}
                style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", padding: 18, boxSizing: "border-box" }}
              />
            )}
            {resolvedImage.kind === "placeholder" && active.imageStatus === "generating" && (
              <span className="absolute inset-0 animate-pulse" style={{ background: "rgba(243,238,229,.35)" }} />
            )}
          </div>

          <div>
            <button
              onClick={() => setSuggestionInfoOpen((v) => !v)}
              className="inline-flex items-center gap-[6px] mt-4 t-pastille text-terracotta bg-warm-bg rounded-full py-1 px-[10px] cursor-pointer"
            >
              Suggestion
              <span className="w-[13px] h-[13px] rounded-full border border-gold text-[9px] normal-case flex items-center justify-center">i</span>
            </button>
            {suggestionInfoOpen && (
              <div className="mt-[9px] bg-warm-bg rounded-champ px-3 py-[11px] text-[11px] text-ink-soft leading-[1.5]">
                Cette pièce vient de ta capsule de départ : tu n&apos;as pas encore ajouté de pièce de cette catégorie à
                ton dressing. Ajoute-la si tu l&apos;as déjà, ou remplace-la par une des tiennes.
              </div>
            )}
          </div>

          <div className="t-surtitre text-muted mt-[14px]">{eyebrow}</div>
          <div className="t-titre-ecran text-ink mt-1">{displayName}</div>
          {synthesis && <div className="text-[13px] text-warm-text mt-[6px]">{synthesis}</div>}

          <Card rayon="bloc" className="flex flex-col gap-[9px] mt-3 px-4 py-[14px]">
            {active.brand && <InfoRow label="Marque" value={active.brand} />}
            <InfoRow label="Taille" value={active.size || "—"} />
            <InfoRow label="Style" value={bestStyleFor(active)} />
            <InfoRow label="Occasion" value={active.occasion && active.occasion.length ? active.occasion.map((o) => OCC_LABELS[o]).join(", ") : "—"} />
            <InfoRow label="Saison" value={libelleSaisons(saisonsDe(active))} />
            {active.manches && <InfoRow label="Manches" value={libelleManches(active.manches)} />}
            {active.matiere && <InfoRow label="Matière" value={active.matiere} />}
            {active.coupe && <InfoRow label="Coupe" value={active.coupe} />}
            {active.sacType && <InfoRow label="Type de sac" value={active.sacType} />}
            {active.bijouType && <InfoRow label="Type de bijou" value={active.bijouType} />}
            {active.accessoireType && <InfoRow label="Type d'accessoire" value={active.accessoireType} />}
            {active.subtype && <InfoRow label={isLength ? "Longueur" : "Type"} value={active.subtype} />}
          </Card>

          <Button variante="principal" className="mt-[18px]" onClick={() => actions.startReplace(active)}>
            J&apos;ai déjà ça
          </Button>
          {active.affLink && (
            <a
              href={active.affLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-[10px] block w-full text-center border border-border text-terracotta rounded-full py-[13px] text-[12px] cursor-pointer"
            >
              Acheter
            </a>
          )}
        </div>
      ) : (
        <>
          <div className="scrollarea absolute inset-0 overflow-y-auto" style={{ paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 120px)" }}>
            {/* LA VITRINE : la photo en entier (jamais recadrée), le retour et le menu posés dessus. */}
            <div className="relative bg-card" style={{ height: 392 }}>
              <div
                role="img"
                aria-label={active.name}
                className="absolute"
                style={{
                  inset: "64px 28px 40px",
                  ...(resolvedImage.url
                    ? { backgroundImage: `url(${resolvedImage.url})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" }
                    : { background: active.hex, borderRadius: 18, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }),
                }}
              />
              {resolvedImage.kind === "placeholder" && active.imageStatus === "generating" && (
                <span className="absolute inset-0 animate-pulse" style={{ background: "rgba(243,238,229,.35)" }} />
              )}
              <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-[18px] pt-[14px]">
                <BoutonRetour onClick={() => actions.go(state.pieceReturn)} label="Revenir à l'écran précédent" />
                <div className="flex flex-col items-center gap-[6px]" aria-hidden="true">
                  <span className="font-serif font-medium text-[22px] leading-none text-ink" style={{ letterSpacing: ".2em", paddingLeft: ".2em" }}>CAPSELA</span>
                  <span className="w-[28px] h-[2px] rounded-[2px]" style={{ background: "var(--color-terracotta)" }} />
                </div>
                <button
                  onClick={() => setMenuOpen(true)}
                  aria-label="Options"
                  className="w-[44px] h-[44px] flex items-center justify-center cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" className="text-ink" aria-hidden="true">
                    <circle cx="12" cy="5.5" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="12" cy="18.5" r="1.5" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="relative bg-cream border-t border-border px-[18px] pt-[22px]" style={{ marginTop: -24, borderRadius: "24px 24px 0 0" }}>
              <div className="flex items-center justify-between gap-3">
                <div className="t-surtitre text-muted">{eyebrow}</div>
                <span className="h-[32px] px-3 rounded-full border border-border bg-card inline-flex items-center gap-[6px] text-[12px] font-medium text-warm-text">
                  <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: pNever ? "var(--color-terracotta)" : "var(--color-muted)" }} aria-hidden="true" />
                  {wornStatusLabel}
                </span>
              </div>
              <h1 className="t-titre-ecran text-ink mt-[6px]">
                {titre.debut}
                {titre.fin && (
                  <>
                    {" "}
                    <span className="italic text-terracotta-deep">{titre.fin}</span>
                  </>
                )}
              </h1>

              <div className="grid mt-[18px] border-y border-border" style={{ gridTemplateColumns: `repeat(${trio.length}, minmax(0, 1fr))` }}>
                {trio.map((t, i) => (
                  <div key={t.label} className={"pt-[12px] pb-[13px] " + (i ? "border-l border-border pl-[14px]" : "")}>
                    <div className="text-[12px] text-placeholder">{t.label}</div>
                    <div className={"flex items-center gap-[6px] font-serif text-[16px] mt-[4px] " + (t.vide ? "text-placeholder" : "text-ink")}>
                      {t.dot && <span className="w-[12px] h-[12px] rounded-full flex-shrink-0" style={{ background: t.dot, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.12)" }} aria-hidden="true" />}
                      {t.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="t-surtitre text-muted mt-[22px]">Quand la porter</div>
              <p className="font-serif text-[17px] leading-[1.45] text-ink mt-2" style={{ textWrap: "pretty" }}>
                {quandPorter}
              </p>

              {dormant && (
                <button
                  onClick={actions.goNeverWorn}
                  className="mt-[20px] w-full flex items-center gap-[12px] bg-warm-bg border border-warm-border rounded-tuile px-4 py-[13px] cursor-pointer text-left"
                >
                  <span className="w-[32px] h-[32px] rounded-full bg-terracotta text-cream flex items-center justify-center flex-shrink-0">
                    <BulbIcon />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-ink">Cette pièce dort dans ton dressing.</div>
                    <div className="text-[11px] text-terracotta mt-[3px]">Que faire avec ? →</div>
                  </div>
                  <span className="text-terracotta text-[16px] flex-shrink-0">›</span>
                </button>
              )}

              <div className="flex items-baseline justify-between gap-3 mt-[24px]">
                <div className="t-surtitre text-muted">Détails</div>
                <button
                  onClick={() => actions.startEditItem(active)}
                  className="min-h-[44px] inline-flex items-center gap-[5px] text-[12.5px] font-semibold text-terracotta-deep cursor-pointer"
                >
                  <EditIcon /> Modifier
                </button>
              </div>
              {details.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {details.map((d) => (
                    <span key={d.label} className="h-[32px] px-3 rounded-full bg-[#F0E5D6] inline-flex items-center gap-[6px] text-[12.5px]">
                      <span className="text-warm-text">{d.label}</span>
                      <span className="font-semibold text-ink">{d.value}</span>
                    </span>
                  ))}
                </div>
              )}
              {manquants.length > 0 && (
                <button
                  onClick={() => actions.startEditItem(active)}
                  className="min-h-[44px] mt-[6px] inline-flex items-center gap-[6px] text-[12.5px] font-semibold text-terracotta-deep cursor-pointer"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Ajouter {manquants.join(", ")}
                </button>
              )}
            </div>
          </div>

          {/* Les actions, fixées au-dessus de la navigation. */}
          <div
            className="absolute left-0 right-0 bg-cream border-t border-border px-[18px] pt-[10px] pb-[12px]"
            style={{ bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center gap-[10px]">
              <button
                type="button"
                onClick={() => actions.openItemOutfits(active.id, false)}
                className="flex-1 h-[52px] rounded-full bg-terracotta-deep text-[#FBF3EA] text-[13px] font-semibold uppercase tracking-[.08em] cursor-pointer"
              >
                Voir les tenues associées
              </button>
              <button
                type="button"
                onClick={() => setLookSheetOpen(true)}
                aria-label="Ajouter à un look"
                className="w-[52px] h-[52px] flex-shrink-0 rounded-full border border-terracotta-deep bg-card flex items-center justify-center cursor-pointer"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--color-terracotta-deep)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </div>
            <div className="text-center text-[11.5px] text-warm-text mt-[6px]">+ pour l&apos;ajouter à un look existant</div>
          </div>
        </>
      )}

      {!suggested && (
        <BottomSheet title="Cette pièce" open={menuOpen} onClose={() => setMenuOpen(false)}>
          <div className="flex flex-col">
            <button
              onClick={() => {
                setMenuOpen(false);
                actions.startEditItem(active);
              }}
              className="flex items-center gap-[13px] py-[15px] text-[14px] text-ink border-b border-border cursor-pointer text-left"
            >
              <EditIcon /> Modifier les informations
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                actions.startEditItem(active);
              }}
              className="flex items-center gap-[13px] py-[15px] text-[14px] text-ink border-b border-border cursor-pointer text-left"
            >
              <CameraIcon /> Changer la photo
            </button>
            {peutMettreAPlat && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setPlat({ etape: "repos" });
                }}
                className="flex items-center gap-[13px] py-[15px] text-[14px] text-ink border-b border-border cursor-pointer text-left"
              >
                <FlatIcon /> Mettre la photo à plat
              </button>
            )}
            <button
              onClick={() => {
                setMenuOpen(false);
                setConfirmRemove(true);
              }}
              className="flex items-center gap-[13px] py-[15px] text-[14px] text-rust cursor-pointer text-left"
            >
              <TrashIcon /> Retirer de mon dressing
            </button>
          </div>
        </BottomSheet>
      )}

      {/* MISE À PLAT d'une photo déjà importée (10/10/2026) : le résultat est généré par un service tiers (Photoroom) et peut différer de la
          pièce — on le montre à côté de la photo d'origine, et la personne choisit. */}
      {!suggested && (
        <BottomSheet title="Mettre la photo à plat" open={plat.etape !== "ferme"} onClose={fermerMiseAPlat}>
          {plat.etape === "repos" && (
            <>
              <div className="text-[13px] text-ink leading-[1.55]">
                Capsela remet ta pièce à plat, sur fond transparent, comme les visuels du catalogue. Le résultat est généré : vérifie qu&apos;il ressemble bien à ta
                pièce. Ta photo reste la tienne tant que tu ne choisis pas la nouvelle.
              </div>
              <div className="text-[12px] text-muted leading-[1.5] mt-[8px]">Chaque essai compte dans ton plafond du jour.</div>
              <Button variante="principal" className="mt-[22px]" onClick={lancerMiseAPlat}>
                Mettre à plat
              </Button>
            </>
          )}
          {plat.etape === "cours" && (
            <div className="py-[18px] text-center text-[13px] text-ink" role="status" aria-live="polite">
              Capsela met ta pièce à plat…
              <div className="text-[12px] text-muted mt-[6px]">Cela peut prendre une dizaine de secondes.</div>
            </div>
          )}
          {plat.etape === "propose" && plat.url && (
            <>
              <div className="grid grid-cols-2 gap-[10px]">
                <figure className="m-0">
                  <div className="rounded-tuile border border-border overflow-hidden" style={{ aspectRatio: "4/5", ...fondPhotoPiece(active.photoUrl ?? "", resolveItemImage(active).kind === "detouree") }} role="img" aria-label="Ta photo" />
                  <figcaption className="text-[11px] text-muted text-center mt-[6px]">Ta photo</figcaption>
                </figure>
                <figure className="m-0">
                  <div className="rounded-tuile border border-border overflow-hidden" style={{ aspectRatio: "4/5", ...fondPhotoPiece(plat.url, true) }} role="img" aria-label="Version mise à plat" />
                  <figcaption className="text-[11px] text-muted text-center mt-[6px]">Mise à plat</figcaption>
                </figure>
              </div>
              <Button
                variante="principal"
                className="mt-[20px]"
                onClick={() => {
                  actions.adopterPhotoMiseAPlat(active.id, plat.url!);
                  setPlat({ etape: "ferme" });
                }}
              >
                Garder la version à plat
              </Button>
              <Button variante="secondaire" className="mt-[10px]" onClick={fermerMiseAPlat}>
                Garder ma photo
              </Button>
            </>
          )}
          {plat.etape === "erreur" && (
            <>
              <div className="text-[13px] text-ink leading-[1.55]" role="status">
                {MESSAGE_ECHEC_MISE_A_PLAT[plat.code ?? "indisponible"]} Ta photo est inchangée.
              </div>
              <Button variante="secondaire" className="mt-[18px]" onClick={lancerMiseAPlat}>
                Réessayer
              </Button>
            </>
          )}
        </BottomSheet>
      )}

      {/* Confirmation ajoutée le 09/09/2026 : le retrait est définitif et
          partait jusqu'ici sur une seule touche, sans retour possible — dans
          un menu dont les deux autres entrées sont anodines. */}
      {!suggested && (
        <BottomSheet title="Retirer cette pièce" open={confirmRemove} onClose={() => setConfirmRemove(false)}>
          <div className="text-[13px] text-ink leading-[1.55]">
            Cette pièce quittera ton dressing et ne sera plus proposée dans tes tenues. Ton historique reste intact.{" "}
            <span className="text-rust">Cette action est définitive.</span>
          </div>
          <Button variante="destructif" className="mt-[22px]"
            onClick={() => {
              setConfirmRemove(false);
              actions.removeActive();
            }}
          >
            Retirer définitivement
          </Button>
          <button
            onClick={() => setConfirmRemove(false)}
            className="mt-[10px] w-full text-center text-[13px] text-muted py-[10px] cursor-pointer"
          >
            Annuler
          </button>
        </BottomSheet>
      )}

      {!suggested && (
        <BottomSheet title="Ajouter à un look" open={lookSheetOpen} onClose={() => setLookSheetOpen(false)}>
          <div className="flex flex-col gap-[8px]">
            {addableLooks.length === 0 && state.savedLooks.length > 0 && (
              <div className="text-[12px] text-muted mb-[6px]">Cette pièce fait déjà partie de tous tes looks enregistrés.</div>
            )}
            {addableLooks.map((look) => (
              <button
                key={look.id}
                onClick={() => {
                  actions.addPieceToLook(look.id, active.id);
                  setLookSheetOpen(false);
                }}
                className="flex items-center justify-between gap-3 bg-card border border-border rounded-bloc px-4 py-[13px] cursor-pointer text-left"
              >
                <div className="min-w-0">
                  <div className="text-[13px] text-ink truncate">{look.name}</div>
                  <div className="text-[11px] text-muted mt-[2px]">
                    {look.pieceIds.length} {look.pieceIds.length > 1 ? "pièces" : "pièce"}
                  </div>
                </div>
                <span className="text-terracotta text-[13px] flex-shrink-0">Ajouter</span>
              </button>
            ))}
          </div>
          <Button variante="principal" className="mt-[14px]"
            onClick={() => {
              setLookSheetOpen(false);
              actions.goCreateLook(active.id);
            }}
          >
            + Créer un nouveau look
          </Button>
        </BottomSheet>
      )}
    </div>
  );
}
