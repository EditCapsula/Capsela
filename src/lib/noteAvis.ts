import { colorimetrieMoteur } from "./colorimetrieMoteur";
import { repartirPiecesAvis, titresAffichables } from "./avisStylisteClient";
import { noteDeLaTenue, type NoteTenue } from "./noteTenue";
import { paletteHexes, type Profile } from "./profile";
import { compositionReconnue, type VetementReconnu } from "./reconnaissance";
import type { Weather } from "./data";
import type { Item } from "./types";
import type { AvisStyliste, PieceSuggeree } from "../../supabase/functions/_shared/avisStyliste.ts";

/**
 * La note d'un avis, depuis ce que les deux écrans qui l'affichent possèdent déjà (le résultat d'une analyse et
 * un avis rouvert depuis le Journal) : une seule façon de la fabriquer, pour qu'un avis rouvert se relise avec la
 * même note qu'au premier jour. Aucun appel réseau : les pièces reconnues, le profil et le dressing suffisent.
 * Null quand la note n'est pas calculable (cf. noteTenue.ts).
 */
export function noteDeLAvis(e: {
  avis: AvisStyliste;
  pieces: PieceSuggeree[];
  reconnaissance: VetementReconnu[];
  dressing: Item[];
  profile: Profile;
  meteo: Weather;
}): NoteTenue | null {
  const titres = titresAffichables(e.avis);
  const { conseil } = repartirPiecesAvis(e.pieces, e.dressing, e.avis.suggestions.length);
  return noteDeLaTenue({
    avis: e.avis,
    composition: compositionReconnue(e.reconnaissance, e.dressing),
    dressing: e.dressing,
    piecesDuConseil: conseil,
    titreConseil: titres.conseil,
    titreVerdict: titres.verdict,
    palette: paletteHexes(e.profile),
    colorimetrie: colorimetrieMoteur(e.profile.colorimetrie),
    meteo: e.meteo,
  });
}
