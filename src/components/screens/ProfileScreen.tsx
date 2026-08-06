"use client";

import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { GENDERS, MORPHOLOGIES } from "@/lib/profile";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-[13px] border-b border-[#efe7da] last:border-b-0">
      <span className="text-[12px] text-muted flex-shrink-0 mt-[1px]">{label}</span>
      <span className="text-[13.5px] text-ink text-right leading-[1.45]">{value || "—"}</span>
    </div>
  );
}

export default function ProfileScreen() {
  const { profile, email, demoMode, signOut } = useAuth();
  const { actions } = useCapsela();

  const genderLabel = GENDERS.find((g) => g.key === profile.gender)?.label ?? "";
  const morphoLabel = MORPHOLOGIES.find((m) => m.key === profile.morphology)?.label ?? "";
  const sizeParts = [
    profile.heightCm ? profile.heightCm + " cm" : null,
    profile.clothingSize,
    profile.shoeSize ? "Pointure " + profile.shoeSize : null,
  ].filter(Boolean);

  const initial = (profile.displayName || email || "C").charAt(0).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    actions.goWelcome();
  };

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <div className="flex items-center gap-[14px]">
        <button
          onClick={actions.goTenues}
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div className="font-serif text-[25px] text-ink">Ton profil</div>
      </div>

      <div className="mt-5 bg-ink rounded-[22px] p-6 flex items-center gap-4">
        <span className="w-[54px] h-[54px] rounded-full bg-terracotta text-cream flex items-center justify-center font-serif text-[24px] flex-shrink-0">
          {initial}
        </span>
        <div className="min-w-0">
          <div className="font-serif text-[20px] text-cream truncate">
            {profile.displayName || "Ton compte"}
          </div>
          <div className="text-[12px] text-[#a99c88] mt-[2px] truncate">{email ?? ""}</div>
          {demoMode && (
            <div className="text-[10.5px] text-gold mt-1">
              Mode démo — les données restent sur cet appareil
            </div>
          )}
        </div>
      </div>

      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-3">Tes infos</div>
      <div className="bg-card border border-border rounded-2xl px-4">
        <Row label="Genre" value={genderLabel} />
        <Row label="Taille" value={sizeParts.join(" · ")} />
        <Row label="Style" value={profile.styles.join(", ")} />
        <Row label="Morphologie" value={morphoLabel} />
        <Row
          label="Goûts"
          value={[...profile.favoriteColors, ...profile.tastes].join(", ")}
        />
      </div>

      <button
        onClick={actions.goProfileSetup}
        className="mt-5 w-full bg-ink text-cream text-center rounded-full py-[15px] text-[13px] tracking-[.1em] uppercase cursor-pointer"
      >
        Modifier mon profil
      </button>
      <button
        onClick={handleSignOut}
        className="mt-[10px] w-full border border-border-soft text-rust text-center rounded-full py-[13px] text-[12.5px] cursor-pointer bg-transparent"
      >
        Se déconnecter
      </button>
    </div>
  );
}
