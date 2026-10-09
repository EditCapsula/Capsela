"use client";

import { useEffect, useRef, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import BoutonRetour from "@/components/BoutonRetour";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { CameraIcon, ChampSelect, chip, Coche, EYEBROW, luminance, NOMS_PASTILLES, SpinnerCintre } from "@/components/screens/AddScreen";
import { useAuth } from "@/lib/auth";
import { CATS, FAMILLES_COULEURS, PALETTE, PALETTE_BIJOU } from "@/lib/data";
import { deleteDressingPhotos, dressingPhotoPath, importerTenue, uploadDressingPhoto, type CodeImportTenue } from "@/lib/dressing";
import {
  aCreer,
  brouillonsDepuis,
  changerCategorie,
  depasseLesPlaces,
  libelleCategorie,
  limiterAuxPlaces,
  manquesDe,
  messageIncomplet,
  modelesDe,
  nPieces,
  peutCocher,
  phraseManque,
  pieceDepuis,
  type BrouillonPiece,
} from "@/lib/importTenue";
import { aDesManches, MANCHES } from "@/lib/manches";
import { placesRestantes } from "@/lib/premium";
import { QUATRE_SAISONS } from "@/lib/saisons";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useCapsela } from "@/lib/store";
import type { CapsuleSeason, CategoryKey } from "@/lib/types";

type Phase = "choix" | "analyse" | "resultat" | "ajout" | "termine" | "vide" | "echec";

/** Ce que dit l'écran quand la mise à plat n'aboutit pas : toujours « ta photo est inchangée », sans reproche. */
function messageEchec(code: CodeImportTenue | "photo"): { texte: string; reessayer: boolean } {
  if (code === "quota_atteint") return { texte: "Tu as atteint la limite du jour, reviens demain.", reessayer: false };
  if (code === "photo_refusee" || code === "photo_invalide") return { texte: "Cette photo n'a pas pu être traitée. Ta photo est inchangée : essaie-en une autre.", reessayer: false };
  return { texte: "La mise à plat n'a pas abouti. Ta photo est inchangée.", reessayer: true };
}

/**
 * IMPORTER UNE TENUE (10/10/2026, option B ; maquette « Importer une tenue », 14 états). Une photo de tenue → la fonction Edge
 * `importer-tenue` la met à plat et repère les objets → la personne coche, modifie, puis seulement alors une pièce est créée par
 * objet. Rien n'est affiché qui n'ait été lu : « Capsela a repéré N pièces » n'apparaît que si N objets sont revenus, et la couleur
 * n'est dite lue que si elle l'a été. Les fichiers non gardés (planche, objets décochés, photo d'origine) sont supprimés.
 * La logique pure est dans `lib/importTenue.ts` (testée).
 */
export default function ImporterTenueScreen() {
  const { state, actions, etatPremium } = useCapsela();
  const { userId } = useAuth();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galerieRef = useRef<HTMLInputElement>(null);
  const fichierRef = useRef<File | null>(null);
  const fin = useRef(false);
  const [aFichier, setAFichier] = useState(false);

  const [phase, setPhase] = useState<Phase>("choix");
  const [apercu, setApercu] = useState<string | null>(null);
  const [tenueUrl, setTenueUrl] = useState<string | null>(null);
  const [vue, setVue] = useState<"photo" | "plat">("plat");
  const [brouillons, setBrouillons] = useState<BrouillonPiece[]>([]);
  const [nbRepere, setNbRepere] = useState(0);
  const [ouverte, setOuverte] = useState<number | null>(null);
  const [code, setCode] = useState<CodeImportTenue | "photo">("indisponible");
  const [progression, setProgression] = useState({ fait: 0, total: 0 });
  const [ajoutees, setAjoutees] = useState<string[]>([]);
  const [erreurAjout, setErreurAjout] = useState<string | null>(null);
  const [envoyee, setEnvoyee] = useState(false);
  const [couleurPour, setCouleurPour] = useState<number | null>(null);
  // Chemins des fichiers créés pour cet import : à supprimer s'ils ne servent à aucune pièce.
  const fichiers = useRef<{ source: string | null; tenue: string | null; objets: Map<number, string> }>({ source: null, tenue: null, objets: new Map() });

  const places = placesRestantes(etatPremium, state.items.length);
  const seul = nbRepere === 1;

  const purger = (chemins: (string | null | undefined)[]) => {
    const liste = chemins.filter((c): c is string => Boolean(c));
    if (liste.length) deleteDressingPhotos(liste).catch(() => {});
  };
  const tout = () => [fichiers.current.source, fichiers.current.tenue, ...fichiers.current.objets.values()];
  // Quitter sans avoir validé : plus rien ne sert à personne.
  useEffect(() => () => {
    if (!fin.current) purger(tout());
  }, []);

  const lancer = async (file: File) => {
    fichierRef.current = file;
    setAFichier(true);
    purger(tout());
    fichiers.current = { source: null, tenue: null, objets: new Map() };
    setApercu(URL.createObjectURL(file));
    setVue("plat");
    setOuverte(null);
    setErreurAjout(null);
    setEnvoyee(false);
    setPhase("analyse");
    if (!isSupabaseConfigured || !userId) {
      setCode("indisponible");
      setPhase("echec");
      return;
    }
    let urlPhoto: string;
    try {
      urlPhoto = await uploadDressingPhoto(userId, file);
    } catch {
      setCode("photo");
      setPhase("echec");
      return;
    }
    fichiers.current.source = dressingPhotoPath(urlPhoto);
    setEnvoyee(true);
    const r = await importerTenue(urlPhoto);
    if ("code" in r) {
      purger(tout());
      fichiers.current = { source: null, tenue: null, objets: new Map() };
      setCode(r.code);
      setPhase("echec");
      return;
    }
    fichiers.current.tenue = dressingPhotoPath(r.tenueUrl);
    r.objets.forEach((o, i) => {
      const c = dressingPhotoPath(o.photo_url);
      if (c) fichiers.current.objets.set(i, c);
    });
    setTenueUrl(r.tenueUrl);
    if (r.objets.length === 0) {
      purger(tout());
      fichiers.current = { source: null, tenue: null, objets: new Map() };
      setPhase("vide");
      return;
    }
    setNbRepere(r.objets.length);
    setBrouillons(limiterAuxPlaces(brouillonsDepuis(r.objets), places));
    // Une seule pièce : sa carte est ouverte d'emblée.
    setOuverte(r.objets.length === 1 ? 0 : null);
    setPhase("resultat");
  };

  const onFichier = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) void lancer(f);
  };

  const modifier = (cle: number, patch: Partial<BrouillonPiece> | ((b: BrouillonPiece) => BrouillonPiece)) =>
    setBrouillons((bs) => bs.map((b) => (b.cle === cle ? (typeof patch === "function" ? patch(b) : { ...b, ...patch }) : b)));

  const retour = () => {
    if (phase === "ajout") return;
    if (phase !== "termine") purger(tout());
    fin.current = true;
    actions.go("add");
  };

  const valider = async () => {
    const pretes = aCreer(brouillons);
    if (!pretes.length || phase === "ajout") return;
    setErreurAjout(null);
    setProgression({ fait: 0, total: pretes.length });
    setPhase("ajout");
    const reussies: BrouillonPiece[] = [];
    for (const b of pretes) {
      const creee = await actions.ajouterPieceImportee(pieceDepuis(b));
      if (!creee) break;
      reussies.push(b);
      setProgression({ fait: reussies.length, total: pretes.length });
    }
    const gardees = new Set(reussies.map((b) => b.cle));
    if (reussies.length === pretes.length) {
      // Tout est entré : ne reste que ce qui sert aux pièces.
      purger([fichiers.current.source, fichiers.current.tenue, ...[...fichiers.current.objets].filter(([k]) => !gardees.has(k)).map(([, c]) => c)]);
      fin.current = true;
      setAjoutees(reussies.map((b) => b.photoUrl));
      setPhase("termine");
      return;
    }
    // Échec en route (réseau, limite gratuite) : les pièces entrées sortent de la liste, le reste est conservé.
    setAjoutees((a) => [...a, ...reussies.map((b) => b.photoUrl)]);
    setBrouillons((bs) => bs.filter((b) => !gardees.has(b.cle)));
    for (const k of gardees) fichiers.current.objets.delete(k);
    setErreurAjout(
      reussies.length
        ? `${nPieces(reussies.length)} ajoutée${reussies.length > 1 ? "s" : ""}. Les autres n'ont pas pu l'être : tes choix sont conservés, réessaie dans un instant.`
        : "Les pièces n'ont pas pu être ajoutées. Tes choix sont conservés : réessaie dans un instant."
    );
    setPhase("resultat");
  };

  const recommencer = () => {
    purger(tout());
    fichiers.current = { source: null, tenue: null, objets: new Map() };
    fin.current = false;
    setApercu(null);
    setTenueUrl(null);
    setBrouillons([]);
    setAjoutees([]);
    setErreurAjout(null);
    setPhase("choix");
  };

  const pretes = aCreer(brouillons);
  const incomplet = messageIncomplet(brouillons);
  const plein = depasseLesPlaces(nbRepere, places);
  const enCours = phase === "analyse";
  const enAjout = phase === "ajout";

  const etapes: { label: string; etat: "faite" | "cours" | "attente" }[] = [
    { label: "Envoi de ta photo", etat: envoyee ? "faite" : "cours" },
    { label: "Mise à plat et repérage des pièces", etat: envoyee ? "cours" : "attente" },
    { label: "Couleurs et catégories", etat: envoyee ? "cours" : "attente" },
  ];

  const montrePlat = vue === "plat" && tenueUrl && (phase === "resultat" || phase === "ajout");
  const imageZone = montrePlat ? tenueUrl : apercu;

  return (
    <div className="absolute inset-0 flex flex-col bg-cream">
      <div className="flex-shrink-0 grid grid-cols-[44px_1fr_44px] items-center gap-2 px-[14px] pt-[8px] pb-[6px]">
        <BoutonRetour onClick={retour} label="Revenir à l'écran précédent" />
        <div className="text-center font-serif font-medium text-[19px] text-ink">Importer une tenue</div>
        <span />
      </div>

      <div className="scrollarea flex-1 min-h-0 overflow-y-auto px-[18px] pt-[6px] pb-[160px]" aria-busy={enCours || enAjout}>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFichier} className="hidden" />
        <input ref={galerieRef} type="file" accept="image/*" onChange={onFichier} className="hidden" />

        {/* Zone image : même hauteur à tous les états (ratio 1,3). */}
        {phase === "choix" || phase === "echec" || phase === "vide" ? (
          <div className="rounded-[24px] bg-card border border-border aspect-[1.3] p-[18px] flex flex-col items-center justify-center text-center">
            <span className="text-terracotta-deep" aria-hidden="true">
              <CameraIcon />
            </span>
            <div className="font-serif font-medium text-[19px] text-ink mt-[10px]">Photographie ta tenue</div>
            <div className="text-[12.5px] text-[#5C5648] mt-1">Porte-la en pied, sur un fond simple, bien éclairée.</div>
            <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-2 w-full mt-[18px]">
              <button type="button" onClick={() => cameraRef.current?.click()} className="h-[44px] rounded-full bg-terracotta-deep text-[#FBF3EA] text-[13px] font-semibold cursor-pointer">
                Prendre une photo
              </button>
              <button type="button" onClick={() => galerieRef.current?.click()} className="h-[44px] rounded-full border border-border bg-cream text-ink text-[13px] font-semibold cursor-pointer">
                Importer
              </button>
            </div>
          </div>
        ) : (
          <div
            role="img"
            aria-label={montrePlat ? "Ta tenue mise à plat" : "Ta photo"}
            className="relative rounded-[24px] overflow-hidden border border-border aspect-[1.3]"
            style={{
              background: montrePlat ? "#F0E5D6" : "var(--color-warm-bg)",
              backgroundImage: imageZone ? `url(${imageZone})` : undefined,
              backgroundSize: montrePlat ? "contain" : "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          >
            {enCours && (
              <div role="status" aria-live="polite" className="absolute inset-0 flex items-center justify-center p-[18px]" style={{ background: "rgba(243,238,229,.64)" }}>
                <div className="w-[250px] max-w-full bg-card border border-border rounded-[20px] px-4 pt-[14px] pb-[10px]">
                  <div className="flex items-center gap-[10px]">
                    <SpinnerCintre sombre />
                    <span className="font-serif font-medium text-[16px] text-ink">Capsela regarde ta tenue</span>
                  </div>
                  <ul className="flex flex-col mt-2 list-none p-0 m-0">
                    {etapes.map((e) => (
                      <li key={e.label} className={"flex items-center gap-[10px] min-h-[30px] text-[12.5px] " + (e.etat === "attente" ? "text-[#8B8375]" : "text-ink")}>
                        <svg viewBox="0 0 24 24" className="w-[16px] h-[16px] flex-shrink-0" fill={e.etat === "cours" ? "#A66950" : "none"} stroke={e.etat === "faite" ? "#9E5B43" : e.etat === "cours" ? "#A66950" : "#CFC3B0"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d={e.etat === "faite" ? "M6 12.5l4 4 8-9" : e.etat === "cours" ? "M12 8.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7z" : "M12 7a5 5 0 1 1 0 10a5 5 0 1 1 0-10z"} />
                        </svg>
                        {e.label}
                        <span className="sr-only">{e.etat === "faite" ? " : fait" : e.etat === "cours" ? " : en cours" : " : à venir"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bascule photo / à plat : seulement quand la planche existe. */}
        {tenueUrl && apercu && (phase === "resultat" || phase === "ajout") && (
          <div role="group" aria-label="Image affichée" className="grid grid-cols-2 gap-1 p-1 mt-3 rounded-full bg-[#F0E5D6]">
            {(["photo", "plat"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={vue === v}
                onClick={() => setVue(v)}
                className={"h-[36px] rounded-full text-[12.5px] font-semibold cursor-pointer " + (vue === v ? "bg-card text-ink" : "text-[#5C5648]")}
              >
                {v === "photo" ? "Voir ma photo" : "Voir l'image à plat"}
              </button>
            ))}
          </div>
        )}

        {/* Phrase de statut. */}
        <div role="status" aria-live="polite" className="mt-4">
          {phase === "choix" && <p className="text-[13px] text-[#5C5648]">Capsela repère chaque pièce, tu choisis celles à ajouter.</p>}
          {phase === "resultat" && (
            <>
              <p className="font-serif font-medium text-[18px] text-ink">{seul ? "Une seule pièce repérée." : `Capsela a repéré ${nbRepere} pièces.`}</p>
              {tenueUrl && <p className="text-[12px] text-[#5C5648] mt-1">Image générée à partir de ta photo : vérifie qu&apos;elle ressemble à tes pièces.</p>}
            </>
          )}
          {phase === "vide" && (
            <>
              <p className="font-serif font-medium text-[18px] text-ink">Capsela n&apos;a pas repéré de pièces sur cette photo.</p>
              <ul className="mt-2 text-[13px] text-[#5C5648] list-disc pl-5 space-y-1">
                <li>Photographie la tenue en pied.</li>
                <li>Choisis un fond simple.</li>
                <li>Cherche une bonne lumière.</li>
              </ul>
            </>
          )}
          {phase === "echec" && (
            <p className="text-[13.5px] text-ink" role="alert">
              {messageEchec(code).texte}
            </p>
          )}
          {phase === "ajout" && <p className="text-[13px] text-[#5C5648]">Ajout {Math.min(progression.fait + 1, progression.total)} sur {progression.total}…</p>}
        </div>

        {/* Dressing gratuit : plus d'objets que de places. */}
        {phase === "resultat" && plein && places !== null && (
          <div className="mt-3 rounded-[16px] border border-border bg-card px-4 py-3 text-[13px] text-ink">
            Il te reste {places} {places > 1 ? "places" : "place"} dans ton dressing gratuit. Choisis les pièces à garder.
            <button type="button" onClick={() => actions.goPremium()} className="block min-h-[44px] text-[12.5px] font-semibold text-terracotta-deep underline underline-offset-[3px] cursor-pointer">
              Découvrir Premium
            </button>
          </div>
        )}
        {erreurAjout && (
          <div role="alert" className="mt-3 rounded-[16px] border border-border bg-card px-4 py-3 text-[13px] text-ink">
            {erreurAjout}
          </div>
        )}

        {/* Les objets repérés. */}
        {(phase === "resultat" || phase === "ajout") && (
          <ul className="list-none p-0 mt-4 flex flex-col gap-2">
            {brouillons.map((b) => {
              const manques = manquesDe(b);
              const ouvert = ouverte === b.cle;
              const peut = b.coche || peutCocher(brouillons, places);
              return (
                <li key={b.cle} className={"rounded-[20px] border border-border bg-card transition-opacity " + (b.coche ? "" : "opacity-[.55]")}>
                  <div className="flex items-center gap-3 pl-3 pr-1 min-h-[72px]">
                    <button
                      type="button"
                      aria-expanded={ouvert}
                      aria-label={`Modifier ${b.nom || "la pièce"}`}
                      disabled={enAjout}
                      onClick={() => setOuverte(ouvert ? null : b.cle)}
                      className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer py-2"
                    >
                      <span className="w-[56px] h-[56px] flex-shrink-0 rounded-[14px] overflow-hidden flex items-center justify-center" style={{ background: "#F0E5D6" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={b.photoUrl} alt="" className="w-full h-full object-contain" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-serif font-medium text-[16px] text-ink truncate">{b.nom || "Nouvelle pièce"}</span>
                        <span className="block text-[12px] text-[#5C5648]">{libelleCategorie(b.cat)}</span>
                        {!b.coche ? (
                          <span className="block text-[11.5px] text-[#8B8375]">Ne sera pas ajoutée</span>
                        ) : (
                          manques.length > 0 && <span className="block text-[11.5px] font-semibold text-terracotta-deep">{phraseManque(manques)}</span>
                        )}
                      </span>
                    </button>
                    {!seul && (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={b.coche}
                        aria-label={`Ajouter ${b.nom || "cette pièce"}`}
                        disabled={enAjout || !peut}
                        onClick={() => modifier(b.cle, { coche: !b.coche })}
                        className="w-[44px] h-[44px] flex-shrink-0 flex items-center justify-center cursor-pointer disabled:cursor-default"
                      >
                        <span
                          className={"w-[26px] h-[26px] rounded-full border flex items-center justify-center " + (b.coche ? "bg-terracotta-deep border-terracotta-deep" : "bg-card border-[#CFC3B0]")}
                        >
                          {b.coche && <Coche couleur="#FBF3EA" taille={16} />}
                        </span>
                      </button>
                    )}
                  </div>

                  {ouvert && (
                    <div className="px-3 pb-4 pt-1 flex flex-col gap-3 border-t border-border">
                      <label className="flex flex-col gap-1 mt-3">
                        <span className={EYEBROW}>Nom</span>
                        <Input value={b.nom} onChange={(e) => modifier(b.cle, { nom: e.target.value })} onFocus={(e) => { const el = e.currentTarget; setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 250); }} />
                      </label>
                      <ChampSelect
                        label="Catégorie"
                        valeurSerif
                        fond
                        value={b.cat}
                        onChange={(v) => modifier(b.cle, (x) => changerCategorie(x, v as CategoryKey))}
                        options={CATS.map(([c, l]) => ({ value: c, label: l }))}
                      />
                      {modelesDe(b.cat).length > 0 && (
                        <ChampSelect
                          label="Modèle"
                          fond
                          value={b.type}
                          placeholder={b.cat === "chaussures" ? "Choisir" : "Facultatif"}
                          onChange={(v) => modifier(b.cle, { type: v })}
                          options={modelesDe(b.cat).map((t) => ({ value: t, label: t }))}
                        />
                      )}

                      <div>
                        <div className="flex items-baseline justify-between">
                          <span className={EYEBROW}>Couleur principale</span>
                          <span className="text-[11.5px] text-[#8B8375]">{b.couleurLue ? b.couleur.nom : "À choisir"}</span>
                        </div>
                        <div role="radiogroup" aria-label="Couleur principale" className="flex flex-wrap gap-[2px] mt-1">
                          {(b.cat === "bijou" ? PALETTE_BIJOU.slice(0, 8) : NOMS_PASTILLES.flatMap((n) => PALETTE.filter(([nom]) => nom === n))).map(([nom, hex]) => {
                            const on = b.couleur.hex === hex;
                            const claire = luminance(hex) > 0.8;
                            return (
                              <button
                                key={hex}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                aria-label={nom}
                                onClick={() => modifier(b.cle, { couleur: { nom, hex }, couleurLue: true })}
                                className="w-[44px] h-[44px] rounded-full bg-transparent p-[3px] cursor-pointer"
                                style={{ border: `2px solid ${on ? "#1D1A16" : "transparent"}` }}
                              >
                                <span className="w-full h-full rounded-full flex items-center justify-center" style={{ background: hex, border: `1px solid ${claire ? "#D9CDB8" : hex}` }}>
                                  {on && <Coche couleur={claire ? "#1D1A16" : "#FBF8F3"} />}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <button type="button" onClick={() => setCouleurPour(b.cle)} className="min-h-[44px] text-[12.5px] font-semibold text-terracotta-deep cursor-pointer">
                          Toutes les couleurs
                        </button>
                      </div>

                      {aDesManches(b.cat) && (
                        <div>
                          <span className={EYEBROW}>Manches</span>
                          <div role="radiogroup" aria-label="Manches" className="grid grid-cols-2 gap-2 mt-[10px]">
                            {MANCHES.map(({ valeur, libelle }) => (
                              <button
                                key={valeur}
                                type="button"
                                role="radio"
                                aria-checked={b.manches === valeur}
                                onClick={() => modifier(b.cle, { manches: b.manches === valeur ? null : valeur })}
                                className={chip(b.manches === valeur)}
                              >
                                {libelle}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="flex items-baseline justify-between">
                          <span className={EYEBROW}>Saisons</span>
                          <span className="text-[11.5px] text-[#8B8375]">{b.saisons.length ? `${b.saisons.length} choisie${b.saisons.length > 1 ? "s" : ""}` : "Au moins une"}</span>
                        </div>
                        <div role="group" aria-label="Saisons" className="grid grid-cols-4 gap-[6px] mt-[10px]">
                          {QUATRE_SAISONS.map((sa: CapsuleSeason) => {
                            const on = b.saisons.includes(sa);
                            return (
                              <button
                                key={sa}
                                type="button"
                                aria-pressed={on}
                                onClick={() => modifier(b.cle, { saisons: QUATRE_SAISONS.filter((x) => (x === sa ? !on : b.saisons.includes(x))) })}
                                className={chip(on) + " !px-1"}
                              >
                                {sa}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Terminé. */}
        {phase === "termine" && (
          <div className="mt-2">
            <p className="font-serif font-medium text-[20px] text-ink" role="status">
              {nPieces(ajoutees.length)} {ajoutees.length > 1 ? "ajoutées" : "ajoutée"} à ton dressing
            </p>
            <div className="flex gap-2 mt-4 flex-wrap">
              {ajoutees.map((u) => (
                <span key={u} className="w-[64px] h-[64px] rounded-[14px] overflow-hidden flex items-center justify-center" style={{ background: "#F0E5D6" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="w-full h-full object-contain" />
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-2 mt-6">
              <Button variante="principal" onClick={actions.goWardrobe}>
                Voir mon dressing
              </Button>
              <Button variante="secondaire" onClick={recommencer}>
                Importer une autre tenue
              </Button>
            </div>
          </div>
        )}

        {/* Rien repéré / échec : les deux sorties. */}
        {(phase === "vide" || phase === "echec") && (
          <div className="flex flex-col gap-2 mt-6">
            {phase === "echec" && messageEchec(code).reessayer && aFichier && (
              <Button variante="principal" onClick={() => fichierRef.current && void lancer(fichierRef.current)}>
                Réessayer
              </Button>
            )}
            <Button variante={phase === "echec" && messageEchec(code).reessayer ? "secondaire" : "principal"} onClick={recommencer}>
              Reprendre une photo
            </Button>
            {phase === "vide" && (
              <Button variante="secondaire" onClick={() => { fin.current = true; actions.go("add"); }}>
                Ajouter une pièce à la main
              </Button>
            )}
          </div>
        )}
      </div>

      {/* L'action, fixée hors du défilement. */}
      {(phase === "resultat" || phase === "ajout") && (
        <div className="absolute left-0 right-0 bottom-0 bg-cream border-t border-border px-[18px] pt-3" style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom))" }}>
          <button
            type="button"
            onClick={() => void valider()}
            disabled={pretes.length === 0 || enAjout}
            aria-busy={enAjout}
            className={
              "w-full h-[52px] rounded-full flex items-center justify-center gap-[10px] text-[13.5px] font-semibold uppercase tracking-[.08em] " +
              (pretes.length === 0 && !enAjout ? "bg-[#E2C9A8] text-[#5C5648] cursor-not-allowed" : "bg-terracotta-deep text-[#FBF3EA] cursor-pointer disabled:cursor-default")
            }
          >
            {enAjout && <SpinnerCintre />}
            {enAjout ? `Ajout ${Math.min(progression.fait + 1, progression.total)} sur ${progression.total}` : pretes.length <= 1 ? (seul ? "Ajouter la pièce" : `Ajouter ${nPieces(pretes.length)}`) : `Ajouter ${nPieces(pretes.length)}`}
          </button>
          <div className="text-center text-[12px] text-[#5C5648] mt-2 min-h-[16px]">
            {enAjout ? "Tu les retrouves dans ton dressing." : incomplet ?? (brouillons.some((b) => b.coche) ? "Touche une pièce pour la modifier." : "Coche au moins une pièce.")}
          </div>
        </div>
      )}

      <BottomSheet title="Toutes les couleurs" open={couleurPour !== null} onClose={() => setCouleurPour(null)}>
        {(() => {
          const cible = brouillons.find((b) => b.cle === couleurPour);
          if (!cible) return null;
          const groupes = cible.cat === "bijou" ? [{ libelle: "", pastilles: PALETTE_BIJOU }] : FAMILLES_COULEURS.map((f) => ({ libelle: f.libelle, pastilles: f.noms.flatMap((n) => PALETTE.filter(([nom]) => nom === n)) }));
          return groupes.map((g, i) => (
            <div key={g.libelle || "metaux"} className={i > 0 ? "mt-[20px]" : ""}>
              {g.libelle && <div className="t-label text-muted mb-[10px]">{g.libelle}</div>}
              <div className="grid grid-cols-4 gap-x-2 gap-y-[18px]">
                {g.pastilles.map(([nom, hex]) => {
                  const on = cible.couleur.hex === hex;
                  return (
                    <button key={hex} aria-pressed={on} onClick={() => modifier(cible.cle, { couleur: { nom, hex }, couleurLue: true })} className="flex flex-col items-center gap-[7px] cursor-pointer">
                      <span className="w-[38px] h-[38px] rounded-champ" style={{ background: hex, border: on ? "2px solid var(--color-ink)" : "1px solid rgba(29,26,22,.12)" }} />
                      <span className={"text-[9px] text-center leading-[1.3] " + (on ? "text-ink" : "text-muted")}>{nom}{on ? " ✓" : ""}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ));
        })()}
        <Button variante="principal" className="mt-[26px]" onClick={() => setCouleurPour(null)}>
          Terminé
        </Button>
      </BottomSheet>
    </div>
  );
}
