# Textes légaux — brouillons du 30/09/2026

**BROUILLONS À FAIRE VALIDER PAR UN JURISTE AVANT PUBLICATION.** Ils sont
rédigés à partir de ce que le code fait réellement au 30/09/2026 (inventaire
fichier par fichier), pas d'un modèle générique : chaque phrase qui décrit
un traitement doit rester vraie dans le code. Si le code change (nouveau
prestataire, paiement ouvert, nouvelle donnée), le texte concerné change
avec lui.

| Fichier | Page | Obligatoire pour |
| --- | --- | --- |
| `mentions-legales.md` | Mentions légales | LCEN (art. 6 III) |
| `confidentialite.md` | Politique de confidentialité | RGPD (art. 13), App Store et Google Play (URL publique exigée) |
| `cgu.md` | Conditions générales d'utilisation | Cadre du service, compte, contenus |
| `cgv.md` | Conditions générales de vente (Premium) | Code de la consommation, dès que l'abonnement est vendu |
| `droits-rgpd.md` | Tes droits | RGPD (art. 15 à 22) — version courte, lisible dans l'app |
| `cookies.md` | Cookies et traceurs | Directive ePrivacy, lignes directrices CNIL |

Ton : tutoiement, comme toute l'app.

## Ce qui reste à compléter (`[À COMPLÉTER]`)

Rien de cela n'est dans le code ni dans les docs ; je ne l'ai pas inventé.

1. **Éditeur** : nom ou raison sociale, forme juridique, capital, SIREN/SIRET,
   RCS ou RNE, adresse, numéro de TVA intracommunautaire, directrice de la
   publication. En entreprise individuelle, l'adresse personnelle peut être
   remplacée par celle d'une domiciliation.
2. **Adresse de contact** pour les demandes RGPD et le support. (Une adresse
   apparaît comme autrice des commits ; je ne l'ai pas reprise sans ton
   accord.)
3. **Région d'hébergement Supabase** (visible dans le tableau de bord :
   Settings → General → Region). Elle décide s'il y a transfert hors UE pour
   la base et les photos.
4. **Domaine public** de l'app (les textes et les stores exigent une URL).
5. **Mode de paiement** de Premium : achat intégré App Store / Google Play,
   ou paiement web (Stripe…). Les CGV en dépendent (facturation,
   remboursement, résiliation).
6. **Médiateur de la consommation** (obligatoire pour vendre à des
   consommateurs : art. L612-1 du Code de la consommation).

## Points à vérifier par le juriste (`[À VÉRIFIER]`)

- Adresses des prestataires (reprises de leurs sites, à contrôler au moment
  de publier).
- Mécanismes de transfert hors UE (Data Privacy Framework, clauses
  contractuelles types) : à confirmer dans les contrats (DPA) de chaque
  prestataire.
- Âge minimum retenu (15 ans dans les brouillons : majorité numérique pour
  le consentement en France, art. 45 de la loi Informatique et Libertés).
- Qualification des données de silhouette et des photos portées (ni
  données de santé ni biométrie au sens de l'art. 9 dans l'usage actuel —
  aucune identification de la personne — mais à confirmer).

## Écarts entre le code et ce que les textes devront pouvoir dire

Ce que j'ai relevé en écrivant, par ordre d'importance. Aucun n'est encore
traité.

1. **Export incomplet** (droit à la portabilité) : `dataExport.ts` n'inclut
   ni les looks planifiés (`planned_outfits`), ni les valises, ni les
   verdicts du jour (`outfit_feedback`), ni le statut Premium, ni le
   compteur de tenues. Les trois premiers sont des données fournies par
   l'utilisatrice : ils doivent y être. Correction simple.
2. **Photo du dressing envoyée avec ses métadonnées dans un cas rare** : si la
   compression échoue (ou grossit le fichier), `compressDressingPhoto` envoie
   l'original, EXIF et GPS compris. La photo d'avis, elle, est refusée dans
   ce cas. À aligner.
3. **Liens « Acheter »** : une pièce du catalogue dont `lien_affiliation` est
   rempli affiche « Acheter » / « Acheter cette pièce ». Le point 16 dit
   qu'aucune source commerciale n'est branchée au lancement : à vérifier en
   base (`select count(*) from vestiaire_universel where lien_affiliation is
   not null;`). Si des liens existent et restent, ils doivent être signalés
   comme liens commerciaux.
4. **Inscription** : pas d'âge minimum, et « En continuant, tu acceptes nos
   Conditions et notre Politique de confidentialité » n'est pas cliquable.
   Les deux textes doivent être accessibles AVANT la création du compte.
5. **Géolocalisation activée d'office** dans les préférences
   (`geoConsent: true`). Le navigateur demande quand même l'autorisation, ce
   qui recueille le consentement ; le texte le décrit ainsi. Un réglage
   désactivé au départ serait plus prudent.
6. **Suppression du compte** : les données du compte sont effacées côté
   serveur, mais l'appareil garde deux clés locales (valises en cache,
   dernière ville). À vider à la déconnexion qui suit la suppression.
7. **Consentement à la mesure d'audience sans échéance** : la CNIL recommande
   de redemander le choix après 6 mois. Le choix est aujourd'hui conservé
   sans limite.
8. **Sentry** : le stockage des adresses IP se désactive dans le tableau de
   bord Sentry (Settings → Security & Privacy → « Prevent Storing of IP
   Addresses »). Le texte suppose que c'est fait.
