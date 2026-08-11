"use client";

import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { colorNameFromHex, genderLabel } from "@/lib/profile";

export default function ProfileScreen() {
  const { profile, email, demoMode, signOut } = useAuth();
  const { state, actions } = useCapsela();

  const initial = (profile.displayName || email || "C").trim().charAt(0).toUpperCase() || "C";
  const tailleValue =
    [
      profile.tailleHaut && "Haut " + profile.tailleHaut,
      profile.tailleBas && "Bas " + profile.tailleBas,
      profile.pointure && "Pointure " + profile.pointure,
    ]
      .filter(Boolean)
      .join(" · ") || "—";
  const rows = [
    { label: "Genre", value: genderLabel(profile.gender) || "—" },
    { label: "Taille", value: tailleValue },
    { label: "Style", value: profile.styles.join(", ") || "—" },
    { label: "Morphologie", value: profile.morphology || "—" },
    {
      label: "Goûts",
      value: profile.favoriteColors.map(colorNameFromHex).filter(Boolean).join(", ") || "—",
    },
  ];

  const handleSignOut = async () => {
    await signOut();
    actions.goWelcome();
  };

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-10">
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

      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-[10px]">Tes infos</div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between px-4 py-[15px] border-b border-border last:border-b-0 gap-4"
          >
            <span className="text-[13px] text-muted flex-shrink-0">{r.label}</span>
            <span className="text-[13.5px] text-ink text-right leading-[1.4]">{r.value}</span>
          </div>
        ))}
      </div>

      <button
        onClick={actions.goProfileEdit}
        className="mt-[22px] w-full bg-ink text-cream text-center rounded-full py-4 text-[12.5px] tracking-[.12em] uppercase cursor-pointer"
      >
        Modifier mon profil
      </button>
      <button
        onClick={handleSignOut}
        className="mt-[10px] w-full bg-card border border-border text-terracotta text-center rounded-full py-[15px] text-[13px] cursor-pointer"
      >
        Se déconnecter
      </button>
      <div className="text-center text-[11px] text-placeholder mt-[18px]">L&apos;édit Capsela · v1.4.0</div>
    </div>
  );
}
