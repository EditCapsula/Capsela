"use client";

import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { GENDER_DEPENDENT_FIELDS, fieldNeedsRevalidation, genderLabel, morphologyLabel, styleLabel } from "@/lib/profile";
import { APP_VERSION } from "@/lib/data";

export default function ProfileScreen() {
  const { profile, email, demoMode, signOut } = useAuth();
  const { state, actions } = useCapsela();

  const initial = (profile.displayName || email || "C").trim().charAt(0).toUpperCase() || "C";
  const tailleValue =
    [
      profile.tailleHaut && "Haut " + profile.tailleHaut,
      profile.tailleBas && "Bas " + profile.tailleBas,
      profile.pointure && "Chaussures " + profile.pointure,
    ]
      .filter(Boolean)
      .join(" · ") || "—";
  const morphoSet = Boolean(profile.morphology);
  const rows = [
    { label: "Genre", value: genderLabel(profile.gender) || "—" },
    { label: "Tailles", value: tailleValue },
    { label: "Style", value: styleLabel(profile.styles[0], profile.gender) || "—", onClick: () => actions.goProfileSetup("style", true) },
    {
      label: "Morphologie",
      value: morphoSet ? morphologyLabel(profile.morphology) : "Non renseignée",
      // Cliquable uniquement tant que non renseignée (recette 25/08/2026) —
      // invite à la compléter ; une fois renseignée, comportement inchangé
      // (simple valeur, comme avant).
      onClick: morphoSet ? undefined : () => actions.goProfileSetup("morpho", true),
    },
  ];

  const handleSignOut = async () => {
    await signOut();
    actions.goWelcome();
  };

  // Bloc "à compléter" (recette 20/08/2026, mécanique générique de
  // revalidation) : état calculé à chaque rendu, jamais une alerte au
  // lancement de l'app — persiste tant qu'aucune valeur valide n'a été
  // ré-enregistrée pour ce champ.
  const toRevalidate = GENDER_DEPENDENT_FIELDS.find((f) => fieldNeedsRevalidation(f, profile));

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-[100px]">
      <div className="flex items-center gap-[14px]">
        <button
          onClick={() => actions.go(state.profileReturn)}
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div className="font-serif text-[24px] text-ink">Ton profil</div>
      </div>

      <div className="bg-ink rounded-[20px] p-5 mt-5 flex items-center gap-[14px]">
        <div className="w-[56px] h-[56px] rounded-full bg-terracotta flex items-center justify-center flex-shrink-0">
          <span className="font-serif text-[22px] text-cream">{initial}</span>
        </div>
        <div className="min-w-0">
          <div className="font-serif text-[19px] text-cream truncate">{profile.displayName || "Ton nom"}</div>
          <div className="text-[12.5px] text-cream-dark-muted mt-[3px] truncate">{email ?? "non renseignée"}</div>
          {demoMode && (
            <div className="text-[11.5px] text-gold mt-[5px]">Mode démo — les données restent sur cet appareil</div>
          )}
        </div>
      </div>

      {toRevalidate && (
        <button
          onClick={actions.goProfileEdit}
          className="w-full text-left bg-[#F6EBE2] border border-terracotta rounded-2xl p-4 mt-5 cursor-pointer"
        >
          <div className="text-[11px] tracking-[.16em] uppercase text-terracotta">À compléter</div>
          <div className="text-[13.5px] text-ink mt-[6px]">{toRevalidate.fieldLabel} est à mettre à jour.</div>
        </button>
      )}

      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-[10px]">Tes infos</div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {rows.map((r) => {
          const Tag = r.onClick ? "button" : "div";
          return (
            <Tag
              key={r.label}
              onClick={r.onClick}
              className={
                "flex items-center justify-between px-4 py-[15px] border-b border-border last:border-b-0 gap-4 w-full text-left " +
                (r.onClick ? "cursor-pointer" : "")
              }
            >
              <span className="text-[13px] text-muted flex-shrink-0">{r.label}</span>
              <span className="flex items-center gap-[6px]">
                <span className="text-[13.5px] text-ink text-right leading-[1.4]">{r.value}</span>
                {r.onClick && <span className="text-placeholder">›</span>}
              </span>
            </Tag>
          );
        })}
        {/* Palette (recette 25/08/2026) — remplace le résumé texte "Couleurs :
            X, Y, Z" par des pastilles reprenant les teintes réellement
            enregistrées (profile.paletteCouleurs, déjà des hex) ; cliquable
            comme Style/Morphologie-non-renseignée, vers l'étape palette du
            questionnaire profil. */}
        <button
          onClick={() => actions.goProfileSetup("pal_couleurs", true)}
          className="flex items-center justify-between px-4 py-[15px] border-b border-border last:border-b-0 gap-4 w-full text-left cursor-pointer"
        >
          <span className="text-[13px] text-muted flex-shrink-0">Palette</span>
          <span className="flex items-center gap-[6px]">
            {profile.paletteCouleurs.length ? (
              <span className="flex items-center gap-[5px]">
                {profile.paletteCouleurs.map((hex, i) => (
                  <span
                    key={i}
                    className="w-[16px] h-[16px] rounded-full flex-shrink-0"
                    style={{ background: hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.12)" }}
                  />
                ))}
              </span>
            ) : (
              <span className="text-[13.5px] text-ink">Non renseignée</span>
            )}
            <span className="text-placeholder">›</span>
          </span>
        </button>
      </div>

      <button
        onClick={actions.goProfileEdit}
        className="mt-[22px] w-full bg-ink text-cream text-center rounded-full py-4 text-[12.5px] tracking-[.12em] uppercase cursor-pointer"
      >
        Modifier mon profil
      </button>

      {/* Section Compte (recette 25/08/2026) — regroupe ce qui vivait avant
          en boutons séparés (Informations légales) plus deux nouvelles
          entrées : Confidentialité et données pointe vers le même écran
          (sa section "Politique de confidentialité" couvre déjà ce sujet,
          jamais un second écran dupliqué) ; Supprimer mon compte reste pour
          l'instant un simple repère visuel sans action réelle, aucun
          parcours de suppression de compte n'existe encore dans l'app —
          même traitement (chevron, cursor-pointer, sans onClick) que les
          lignes de LegalScreen, qui n'ont elles non plus pas encore de
          destination branchée. */}
      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-[10px]">Compte</div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <button
          onClick={actions.goLegal}
          className="flex items-center justify-between px-4 py-[15px] border-b border-border last:border-b-0 gap-4 w-full text-left cursor-pointer"
        >
          <span className="text-[13.5px] text-ink">Informations légales</span>
          <span className="text-placeholder">›</span>
        </button>
        <button
          onClick={actions.goLegal}
          className="flex items-center justify-between px-4 py-[15px] border-b border-border last:border-b-0 gap-4 w-full text-left cursor-pointer"
        >
          <span className="text-[13.5px] text-ink">Confidentialité et données</span>
          <span className="text-placeholder">›</span>
        </button>
        <div className="flex items-center justify-between px-4 py-[15px] border-b border-border last:border-b-0 gap-4 cursor-pointer">
          <span className="text-[13.5px] text-rust">Supprimer mon compte</span>
          <span className="text-rust">›</span>
        </div>
      </div>

      <div className="text-center text-[11px] text-placeholder mt-[22px]">L&apos;édit Capsela · v{APP_VERSION}</div>
      <button onClick={handleSignOut} className="mt-[10px] w-full text-center text-[12.5px] text-terracotta cursor-pointer">
        Se déconnecter
      </button>
    </div>
  );
}
