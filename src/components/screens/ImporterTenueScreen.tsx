"use client";

import { useEffect, useRef, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import BoutonRetour from "@/components/BoutonRetour";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { avecTraitsDUnion } from "@/components/TraitsDUnion";
import { CameraIcon, CarteAnalyse, ChampSelect, chip, Coche, EYEBROW, luminance, NOMS_PASTILLES, SpinnerCintre } from "@/components/screens/AddScreen";
import { useAuth } from "@/lib/auth";
import { MISE_A_PLAT_DISPONIBLE } from "@/lib/miseAPlat";
import { CATS, FAMILLES_COULEURS, PALETTE, PALETTE_BIJOU } from "@/lib/data";
import { motifDisponible, deleteDressingPhotos, detourerPhotoAvecCause, dressingPhotoPath, estPhotoDetouree, estPhotoMiseAPlat, importerTenue, uploadDressingPhoto, type CodeImportTenue, type CodeMiseAPlat } from "@/lib/dressing";
import { MESSAGE_ECHEC_MISE_A_PLAT } from "@/components/screens/PieceScreen";
import {
  aCreer,
  brouillonsDepuis,
  changerCategorie,
  depasseLesPlaces,
  libelleCategorie,
  limiterAuxPlaces,
  manquesDe,
  modelesDe,
  nPieces,
  phraseManque,
  pieceDepuis,
  apercuPhotoConfiee,
  apercuTicketConfie,
  brouillonsDepuisTicket,
  reprendrePhoto,
  reprendreTicket,
  type BrouillonPiece,
} from "@/lib/importTenue";
import { aDesManches, MANCHES } from "@/lib/manches";
import { aUnMotif, MOTIFS } from "@/lib/motifs";
import { placesRestantes } from "@/lib/premium";
import { QUATRE_SAISONS } from "@/lib/saisons";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useCapsela } from "@/lib/store";
import type { CapsuleSeason, CategoryKey } from "@/lib/types";

type Phase = "choix" | "analyse" | "resultat" | "ajout" | "termine" | "vide" | "echec";

/** Ce que dit l'écran quand l'import n'aboutit pas : toujours « ta photo est inchangée », sans reproche. */
function messageEchec(code: CodeImportTenue | "photo"): { texte: string; reessayer: boolean } {
  if (code === "quota_atteint") return { texte: "Tu as atteint la limite du jour, reviens demain.", reessayer: false };
  if (code === "photo") return { texte: "L'envoi de ta photo n'a pas abouti. Vérifie ta connexion et réessaie.", reessayer: true };
  if (code === "photo_refusee" || code === "photo_invalide") return { texte: "Cette photo n'a pas pu être traitée. Ta photo est inchangée : essaie-en une autre.", reessayer: false };
  // La cause, dite quand on la connaît (11/10/2026) : « n'a pas abouti » seul masquait un service sans crédit ou non relié.
  if (code === "credits_epuises") return { texte: "Le service de détourage n'a plus de crédit pour le moment. Ta photo est inchangée.", reessayer: false };
  if (code === "non_configure") return { texte: "Le service de détourage n'est pas relié pour le moment. Ta photo est inchangée.", reessayer: false };
  if (code === "lecture_indisponible") return { texte: "Capsela n'a pas pu lire ta photo : le service de lecture n'a pas répondu. Ta photo est inchangée.", reessayer: true };
  if (code === "resultat_invalide") return { texte: "Le service a rendu une image inexploitable. Ta photo est inchangée.", reessayer: true };
  return { texte: "Le détourage n'a pas abouti : le service n'a pas répondu. Ta photo est inchangée.", reessayer: true };
}

/**
 * Les huit pastilles d'une carte. La couleur de la pièce prend la dernière place si elle n'y est pas (30/10/2026, signalé : un short
 * lu « Bleu ciel » n'apparaissait qu'après « Toutes les couleurs ») — même règle que « Ajouter une pièce ».
 */
function pastillesAvec(b: BrouillonPiece): [string, string][] {
  const base = (b.cat === "bijou" ? PALETTE_BIJOU.slice(0, 8) : NOMS_PASTILLES.flatMap((n) => PALETTE.filter(([nom]) => nom === n))).slice(0, 8);
  return base.some(([, hex]) => hex === b.couleur.hex) ? base : [...base.slice(0, 7), [b.couleur.nom, b.couleur.hex]];
}

/** Échec du détourage d'une pièce à l'ajout : la pièce n'est pas ajoutée, sa carte reste. */
const MESSAGE_ECHEC_DETOURAGE: Record<CodeMiseAPlat, string> = {
  quota_atteint: "Tu as atteint la limite de détourages du jour : reviens demain.",
  non_configure: "Le service de détourage n'est pas relié pour le moment.",
  credits_epuises: "Le service de détourage n'a plus de crédit pour le moment.",
  photo_refusee: "Le détourage n'a pas pu isoler cette pièce : le recadrage ne la montre pas seule.",
  photo_invalide: "Cette photo ne peut pas être détourée.",
  indisponible: "Le détourage n'a pas abouti : le service n'a pas répondu.",
};

/**
 * IMPORTER UNE TENUE (10/10/2026, option B ; maquette « Importer une tenue », 14 états). Une photo de tenue → la fonction Edge
 * `importer-tenue` repère les objets et recadre chacun ; le détourage se fait à l'ajout (pas de mise à plat automatique) → la personne coche, modifie, puis seulement alors une pièce est créée par
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

  // Une photo confiée par « Ajouter une pièce » : le tout premier rendu est déjà l'analyse, sur la même photo (12/10/2026, signalé : un scintillement
  // entre les deux écrans — l'écran de choix s'affichait une image avant que la lecture démarre).
  // Un ticket de caisse confié par « Ajouter une pièce » (30/10/2026) : ses articles arrivent déjà lus, la liste s'affiche d'emblée.
  const [ticket, setTicket] = useState(() => apercuTicketConfie());
  const [phase, setPhase] = useState<Phase>(() => (ticket ? "resultat" : apercuPhotoConfiee() ? "analyse" : "choix"));
  const [apercu, setApercu] = useState<string | null>(() => apercuPhotoConfiee()?.url ?? null);
  // Mise à plat demandée sur une carte (« Mettre à plat ») : en cours, ou la cause de l'échec. Jamais lancée seule.
  const [plat, setPlat] = useState<Record<number, { etat: "cours" | "erreur"; message?: string }>>({});
  const [brouillons, setBrouillons] = useState<BrouillonPiece[]>(() =>
    ticket ? limiterAuxPlaces(brouillonsDepuisTicket(ticket), placesRestantes(etatPremium, state.items.length)) : []
  );
  const [nbRepere, setNbRepere] = useState(() => ticket?.articles.length ?? 0);
  const [ouverte, setOuverte] = useState<number | null>(() => (ticket?.articles.length === 1 ? 0 : null));
  const [code, setCode] = useState<CodeImportTenue | "photo">("indisponible");
  const [progression, setProgression] = useState({ fait: 0, total: 0 });
  const [ajoutees, setAjoutees] = useState<string[]>([]);
  const [erreurAjout, setErreurAjout] = useState<string | null>(null);
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

  const lancer = async (file: File, urlDejaEnvoyee?: string) => {
    fichierRef.current = file;
    setAFichier(true);
    setTicket(null);
    purger(tout());
    fichiers.current = { source: null, tenue: null, objets: new Map() };
    // Photo déjà envoyée : on garde son URL (celle que l'écran précédent affichait), pas de second visuel qui ferait sauter l'image.
    setApercu(urlDejaEnvoyee ?? URL.createObjectURL(file));
    setPlat({});
    setOuverte(null);
    setErreurAjout(null);
    setPhase("analyse");
    if (!isSupabaseConfigured || !userId) {
      setCode("indisponible");
      setPhase("echec");
      return;
    }
    let urlPhoto: string;
    try {
      // Photo déjà envoyée par « Ajouter une pièce » : on ne la renvoie pas.
      urlPhoto = urlDejaEnvoyee ?? (await uploadDressingPhoto(userId, file));
    } catch {
      setCode("photo");
      setPhase("echec");
      return;
    }
    fichiers.current.source = dressingPhotoPath(urlPhoto);
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

  // Une photo confiée par « Ajouter une pièce » (elle montre plusieurs pièces) : la lecture démarre sans second choix de photo.
  useEffect(() => {
    // Le ticket est déjà dans l'état initial : il n'est repris qu'une fois.
    reprendreTicket();
    const confiee = reprendrePhoto();
    // Hors de l'effet (setTimeout) : la lecture met l'état à jour tout de suite. Pas de nettoyage du minuteur : en développement l'effet se joue deux fois et la photo n'est reprise qu'une.
    if (confiee) setTimeout(() => void lancer(confiee.fichier, confiee.url), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Ajoute les pièces demandées (une carte : « Ajouter » ; toutes : « Tout ajouter »), une à une. Les pièces entrées sortent de la liste ;
  // quand il n'en reste plus, l'import est terminé. Un échec en route garde ce qui n'est pas entré.
  const valider = async (cibles: BrouillonPiece[]) => {
    let pretes = cibles.filter((b) => b.coche && manquesDe(b).length === 0);
    if (!pretes.length || phase === "ajout") return;
    // Dressing gratuit : jamais plus de pièces que de places restantes.
    if (places !== null) pretes = pretes.slice(0, Math.max(0, places));
    if (!pretes.length) return;
    setErreurAjout(null);
    setProgression({ fait: 0, total: pretes.length });
    setPhase("ajout");
    // Le détourage (appel payant) n'a lieu qu'ici, pour les seules pièces ajoutées (12/10/2026). Les cartes sont détourées en parallèle ;
    // une pièce dont le détourage échoue n'est pas ajoutée (jamais un recadrage rectangulaire) et reste dans la liste avec sa cause.
    const detourees = await Promise.all(
      pretes.map(async (b) => {
        // Un article de ticket n'a pas de photo : rien à détourer.
        if (!isSupabaseConfigured || !b.photoUrl || estPhotoDetouree(b.photoUrl)) return b;
        const r = await detourerPhotoAvecCause(b.photoUrl, undefined, true);
        if ("code" in r) {
          setPlat((p) => ({ ...p, [b.cle]: { etat: "erreur", message: MESSAGE_ECHEC_DETOURAGE[r.code] } }));
          return null;
        }
        const ancien = fichiers.current.objets.get(b.cle);
        const nouveau = dressingPhotoPath(r.url);
        if (nouveau) fichiers.current.objets.set(b.cle, nouveau);
        if (ancien && ancien !== nouveau) purger([ancien]);
        modifier(b.cle, { photoUrl: r.url });
        setPlat((p) => {
          const { [b.cle]: _fini, ...reste } = p;
          void _fini;
          return reste;
        });
        return { ...b, photoUrl: r.url };
      })
    );
    const aAjouter = detourees.filter((b): b is BrouillonPiece => b !== null);
    const reussies: BrouillonPiece[] = [];
    for (const b of aAjouter) {
      const creee = await actions.ajouterPieceImportee(pieceDepuis(b));
      if (!creee) break;
      reussies.push(b);
      setProgression({ fait: reussies.length, total: pretes.length });
    }
    const gardees = new Set(reussies.map((b) => b.cle));
    for (const k of gardees) fichiers.current.objets.delete(k);
    setAjoutees((a) => [...a, ...reussies.map((b) => b.photoUrl)]);
    const restantes = brouillons.filter((b) => !gardees.has(b.cle));
    setBrouillons((bs) => bs.filter((b) => !gardees.has(b.cle)));
    if (reussies.length === pretes.length && restantes.length === 0) {
      // Tout est traité : ne reste que ce qui sert aux pièces ajoutées.
      purger([fichiers.current.source, fichiers.current.tenue, ...fichiers.current.objets.values()]);
      fichiers.current = { source: null, tenue: null, objets: new Map() };
      fin.current = true;
      setPhase("termine");
      return;
    }
    if (reussies.length < pretes.length) {
      setErreurAjout(
        reussies.length
          ? `${nPieces(reussies.length)} ajoutée${reussies.length > 1 ? "s" : ""}. Les autres n'ont pas pu l'être : tes choix sont conservés, réessaie dans un instant.`
          : aAjouter.length < pretes.length
            ? "Le détourage n'a pas abouti pour ces pièces. Tes choix sont conservés : réessaie dans un instant."
            : "Les pièces n'ont pas pu être ajoutées. Tes choix sont conservés : réessaie dans un instant."
      );
    }
    setPhase("resultat");
  };

  // Retirer une détection : sa carte sort de la liste et son fichier est supprimé. Sans carte restante, rien n'est ajouté.
  const retirer = (cle: number) => {
    const chemin = fichiers.current.objets.get(cle);
    if (chemin) purger([chemin]);
    fichiers.current.objets.delete(cle);
    setBrouillons((bs) => bs.filter((b) => b.cle !== cle));
    setOuverte((o) => (o === cle ? null : o));
  };

  // « Mettre à plat » une pièce, sur demande (le détourage seul est automatique). Rien n'est remplacé si le service échoue.
  const mettreAPlat = async (b: BrouillonPiece) => {
    if (plat[b.cle]?.etat === "cours") return;
    setPlat((p) => ({ ...p, [b.cle]: { etat: "cours" } }));
    const r = await detourerPhotoAvecCause(b.photoUrl, "mise_a_plat");
    if ("code" in r) {
      setPlat((p) => ({ ...p, [b.cle]: { etat: "erreur", message: MESSAGE_ECHEC_MISE_A_PLAT[r.code] } }));
      return;
    }
    // La version à plat remplace la photo de la carte ; l'ancien fichier n'a plus d'usage.
    const ancien = fichiers.current.objets.get(b.cle);
    const nouveau = dressingPhotoPath(r.url);
    if (nouveau) fichiers.current.objets.set(b.cle, nouveau);
    if (ancien && ancien !== nouveau) purger([ancien]);
    modifier(b.cle, { photoUrl: r.url });
    setPlat((p) => {
      const { [b.cle]: _fini, ...reste } = p;
      void _fini;
      return reste;
    });
  };

  const recommencer = () => {
    purger(tout());
    fichiers.current = { source: null, tenue: null, objets: new Map() };
    fin.current = false;
    setApercu(null);
    setTicket(null);
    setBrouillons([]);
    setAjoutees([]);
    setErreurAjout(null);
    setPhase("choix");
  };

  const pretes = aCreer(brouillons);
  const plein = depasseLesPlaces(nbRepere, places);
  const enCours = phase === "analyse";
  const enAjout = phase === "ajout";


  const imageZone = apercu;
  const listeAffichee = phase === "resultat" || phase === "ajout";
  const toutAjouterVisible = listeAffichee && brouillons.length > 1;

  return (
    <div className="absolute inset-0 flex flex-col bg-cream">
      <div className="flex-shrink-0 flex items-center justify-between gap-2 px-[14px] pt-[8px] pb-[6px] min-h-[58px]">
        <BoutonRetour onClick={retour} label="Revenir à l'écran précédent" />
        {toutAjouterVisible ? (
          // « Tout ajouter » dans la barre du haut (30/10/2026, sur le modèle de la capture partagée) : toujours à portée, quelle que soit la liste.
          <button
            type="button"
            onClick={() => void valider(brouillons)}
            disabled={pretes.length === 0 || enAjout}
            className={
              "h-[44px] px-5 flex-shrink-0 rounded-full text-[13px] font-semibold flex items-center gap-[8px] " +
              (pretes.length === 0 || enAjout ? "bg-[#E2C9A8] text-muted-3 cursor-not-allowed" : "bg-terracotta-deep text-on-terracotta cursor-pointer")
            }
          >
            <Coche couleur="currentColor" /> Tout ajouter
          </button>
        ) : (
          <>
            <div className="flex-1 text-center font-serif font-medium text-[19px] text-ink">Ajouter une pièce</div>
            <span className="w-[44px] flex-shrink-0" />
          </>
        )}
      </div>

      <div className="scrollarea flex-1 min-h-0 overflow-y-auto px-[18px] pt-[6px] pb-[40px]" aria-busy={enCours || enAjout}>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFichier} className="hidden" />
        <input ref={galerieRef} type="file" accept="image/*" onChange={onFichier} className="hidden" />

        {/* Zone image : même hauteur à tous les états (ratio 1,3), sauf sur la liste des pièces, qui montre une photo par pièce. */}
        {listeAffichee ? null : phase === "choix" || phase === "echec" || phase === "vide" ? (
          <div className="rounded-[24px] bg-card border border-border aspect-[1.3] p-[18px] flex flex-col items-center justify-center text-center">
            <span className="text-terracotta-deep" aria-hidden="true">
              <CameraIcon />
            </span>
            <div className="font-serif font-medium text-[19px] text-ink mt-[10px]">Photographie ta tenue</div>
            <div className="text-[12.5px] text-muted-3 mt-1">Porte-la en pied, sur un fond simple, bien éclairée.</div>
            <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-2 w-full mt-[18px]">
              <button type="button" onClick={() => cameraRef.current?.click()} className="h-[44px] rounded-full bg-terracotta-deep text-on-terracotta text-[13px] font-semibold cursor-pointer">
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
            aria-label="Ta photo"
            className={"relative rounded-[24px] overflow-hidden border border-border " + (phase === "analyse" ? "aspect-[4/5] max-h-[calc(100dvh-210px)]" : "aspect-[1.3]")}
            style={{
              background: "var(--color-warm-bg)",
              backgroundImage: imageZone ? `url(${imageZone})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          >
            {enCours && <CarteAnalyse />}
          </div>
        )}

        {/* Phrase de statut. */}
        <div role="status" aria-live="polite" className="mt-4">
          {phase === "choix" && <p className="text-[13px] text-muted-3">Capsela repère chaque pièce, tu choisis celles à ajouter.</p>}
          {phase === "resultat" && (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-serif font-medium text-[22px] text-ink">{ticket ? (seul ? "1 article sur ton ticket" : `${nbRepere} articles sur ton ticket`) : seul ? "1 pièce détectée" : `${nbRepere} pièces détectées`}</p>
                <p className="text-[12.5px] text-muted-3 mt-1">
                  {ticket ? "Vérifie chaque pièce avant de l'ajouter : une photo pourra s'ajouter ensuite depuis sa fiche." : "Vérifie les vêtements avant de les ajouter à ton dressing."}
                </p>
              </div>
            </div>
          )}
          {phase === "vide" && (
            <>
              <p className="font-serif font-medium text-[18px] text-ink">Capsela n&apos;a pas repéré de pièces sur cette photo.</p>
              <ul className="mt-2 text-[13px] text-muted-3 list-disc pl-5 space-y-1">
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
          {phase === "ajout" && <p className="text-[13px] text-muted-3">Ajout {Math.min(progression.fait + 1, progression.total)} sur {progression.total}…</p>}
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
              const etatPlat = plat[b.cle];
              const peutAPlat = MISE_A_PLAT_DISPONIBLE && isSupabaseConfigured && Boolean(b.photoUrl) && !estPhotoMiseAPlat(b.photoUrl);
              return (
                <li key={b.cle}>
                  {/* Le nom, à modifier (crayon), et la corbeille (30/10/2026, sur le modèle de la capture partagée). */}
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      aria-expanded={ouvert}
                      aria-label={`Modifier ${b.nom || "la pièce"}`}
                      disabled={enAjout}
                      onClick={() => setOuverte(ouvert ? null : b.cle)}
                      className="min-w-0 flex items-center gap-[8px] text-left cursor-pointer min-h-[44px]"
                    >
                      <span className="font-serif font-medium text-[17px] text-ink truncate">{avecTraitsDUnion(b.nom || "Nouvelle pièce")}</span>
                      <svg viewBox="0 0 24 24" className="w-[15px] h-[15px] flex-shrink-0" fill="none" stroke="#8B8375" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      aria-label={`Retirer ${b.nom || "cette pièce"}`}
                      disabled={enAjout}
                      onClick={() => retirer(b.cle)}
                      className="w-[40px] h-[40px] flex-shrink-0 rounded-full bg-warm-bg flex items-center justify-center cursor-pointer"
                    >
                      <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="#5C5648" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-[6px] rounded-[20px] border border-border bg-card">
                  <div className="flex gap-3 p-3">
                    <span
                      className="relative w-[44%] aspect-[4/5] flex-shrink-0 rounded-[14px] overflow-hidden flex items-center justify-center"
                      style={{ background: "var(--color-warm-bg)" }}
                    >
                      {b.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.photoUrl} alt="" className="w-full h-full object-contain" />
                      ) : (
                        // Article de ticket : pas de photo, la couleur de la pièce à la place (jamais une image inventée).
                        <span aria-hidden="true" className="w-[56%] aspect-square rounded-full" style={{ background: b.couleur.hex, border: "1px solid rgba(29,26,22,.12)" }} />
                      )}
                      {etatPlat?.etat === "cours" && (
                        <span className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(243,238,229,.7)" }} role="status" aria-label="Mise à plat en cours">
                          <SpinnerCintre sombre />
                        </span>
                      )}
                    </span>
                    <div className="flex-1 min-w-0 flex flex-col">
                      <input
                        className="capin w-full h-[40px] bg-transparent border-b border-border text-[13.5px] text-ink"
                        value={b.marque}
                        placeholder="Ajouter la marque"
                        aria-label="Marque"
                        disabled={enAjout}
                        onChange={(e) => modifier(b.cle, { marque: e.target.value })}
                      />
                      <button
                        type="button"
                        disabled={enAjout}
                        onClick={() => setOuverte(b.cle)}
                        className="mt-[10px] text-left cursor-pointer"
                      >
                        <span className="block text-[11px] text-muted-3">Catégorie</span>
                        <span className={"block text-[14px] " + (b.categorieAConfirmer ? "text-[#8B8375]" : "text-ink")}>
                          {b.categorieAConfirmer ? "À choisir" : libelleCategorie(b.cat)}
                        </span>
                      </button>
                      {!b.coche ? (
                        <span className="block text-[11.5px] text-[#8B8375] mt-[6px]">Plus de place dans ton dressing gratuit</span>
                      ) : (
                        manques.length > 0 && <span className="block text-[11.5px] font-semibold text-terracotta-deep mt-[6px]">{phraseManque(manques)}</span>
                      )}
                      <div className="mt-auto pt-3 flex flex-col gap-2">
                        {peutAPlat && (
                          <button
                            type="button"
                            disabled={enAjout || etatPlat?.etat === "cours"}
                            onClick={() => void mettreAPlat(b)}
                            className="h-[40px] px-3 rounded-full border border-border bg-cream text-ink text-[12.5px] font-semibold cursor-pointer disabled:cursor-default disabled:opacity-60"
                          >
                            Mettre à plat
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={enAjout || !b.coche}
                          onClick={() => (manques.length > 0 ? setOuverte(b.cle) : void valider([b]))}
                          className="h-[40px] px-4 rounded-full bg-terracotta-deep text-on-terracotta text-[12.5px] font-semibold cursor-pointer disabled:cursor-default disabled:opacity-50 flex items-center justify-center gap-[6px]"
                        >
                          <Coche couleur="currentColor" /> Ajouter
                        </button>
                      </div>
                    </div>
                  </div>
                  {etatPlat?.etat === "erreur" && (
                    <p role="alert" className="px-3 pb-3 -mt-1 text-[12px] text-muted-3">
                      {etatPlat.message} Ta photo est inchangée.
                    </p>
                  )}

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
                        value={b.categorieAConfirmer ? "" : b.cat}
                        placeholder="Choisir"
                        onChange={(v) => modifier(b.cle, (x) => changerCategorie(x, v as CategoryKey))}
                        options={CATS.map(([c, l]) => ({ value: c, label: l }))}
                      />
                      {!b.categorieAConfirmer && modelesDe(b.cat).length > 0 && (
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
                        <div role="radiogroup" aria-label="Couleur principale" className="grid grid-cols-8 gap-[2px] mt-1">
                          {pastillesAvec(b).map(([nom, hex]) => {
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
                                className="w-full max-w-[44px] aspect-square rounded-full bg-transparent p-[3px] cursor-pointer"
                                style={{ border: `2px solid ${on ? "var(--color-ink)" : "transparent"}` }}
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

                      {!b.categorieAConfirmer && aDesManches(b.cat) && (
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

                      {!b.categorieAConfirmer && motifDisponible() && aUnMotif(b.cat) && (
                        <div>
                          <span className={EYEBROW}>Motif</span>
                          <div role="radiogroup" aria-label="Motif" className="grid grid-cols-2 gap-2 mt-[10px]">
                            {MOTIFS.map(({ valeur, libelle }) => (
                              <button
                                key={valeur}
                                type="button"
                                role="radio"
                                aria-checked={b.motif === valeur}
                                onClick={() => modifier(b.cle, { motif: b.motif === valeur ? null : valeur })}
                                className={chip(b.motif === valeur)}
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
                  </div>
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
                <span key={u} className="w-[64px] h-[64px] rounded-[14px] overflow-hidden flex items-center justify-center" style={{ background: "var(--color-warm-bg)" }}>
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
