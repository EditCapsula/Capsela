"use client";

import { useCapsela } from "@/lib/store";
import Button from "@/components/Button";
import LogoCapsela from "@/components/LogoCapsela";

export default function WelcomeScreen() {
  const { actions } = useCapsela();

  return (
    <div className="absolute inset-0 flex flex-col bg-ink">
      <div className="flex-1 flex flex-col justify-center items-center text-center px-[34px]">
        {/* Le logo Capsela, en clair sur le fond sombre (LogoCapsela). */}
        <LogoCapsela taille="lg" claire />
        <div className="font-serif italic text-[21px] text-cream-dark-soft mt-5 leading-[1.35]">
          La bonne tenue,
          <br />
          au bon moment
        </div>
        <div className="text-[13px] text-placeholder mt-4 leading-[1.55] max-w-[280px]">
          Des idées de tenues adaptées à ton style, à la météo et à tes occasions — pensées à partir de
          ta capsule et de ton dressing.
        </div>
      </div>
      <div className="px-7 pb-10 flex flex-col gap-3">
        <Button variante="principal" pleine={false}
          onClick={actions.startOnb}
        >
          Commencer
        </Button>
        <button onClick={actions.goLogin} className="text-center py-2 text-[13px] text-placeholder cursor-pointer">
          J&apos;ai déjà un compte · <span className="text-gold">Se connecter</span>
        </button>
      </div>
    </div>
  );
}
