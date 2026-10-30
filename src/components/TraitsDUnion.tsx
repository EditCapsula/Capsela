/**
 * Le trait d'union de Bodoni Moda est un filet : à 24 px, sa taille optique d'affichage l'amincit au point qu'il disparaît (« Qu'as tu »,
 * constaté en rendu le 30/10/2026 ; « aimes tu » dans l'étape Couleurs du profil le même jour). Il garde la même police, avec la taille
 * optique d'un texte courant, dont le filet reste visible. Pour tout titre en Bodoni qui contient un trait d'union.
 */
export function avecTraitsDUnion(texte: string): React.ReactNode {
  const morceaux = texte.split("-");
  return morceaux.flatMap((m, i) => (i === 0 ? [m] : [<span key={i} style={{ fontVariationSettings: '"opsz" 10' }}>-</span>, m]));
}
