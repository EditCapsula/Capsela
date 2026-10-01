import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DOCUMENTS_LEGAUX, SLUGS_LEGAUX, estProvisoire } from "@/lib/legal/documents";
import { lireMarkdown } from "@/lib/legal/markdown";
import { RenduMarkdown } from "@/components/legal/RenduMarkdown";

/**
 * Page publique d'un texte légal (01/10/2026) — rendue à la compilation depuis
 * docs/legal. Hors de l'app : aucune connexion n'est requise pour la lire,
 * y compris avant la création d'un compte (RGPD art. 13, stores).
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return SLUGS_LEGAUX.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = DOCUMENTS_LEGAUX.find((d) => d.slug === slug);
  return { title: doc ? `${doc.titre} — L'édit Capsela` : "L'édit Capsela" };
}

export default async function PageLegale({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = DOCUMENTS_LEGAUX.find((d) => d.slug === slug);
  if (!doc) notFound();
  const source = await readFile(path.join(process.cwd(), "docs", "legal", `${slug}.md`), "utf8");
  const blocs = lireMarkdown(source);
  return (
    <main className="min-h-screen bg-cream text-ink">
      <div className="mx-auto max-w-[680px] px-6 pt-8 pb-16">
        <Link href="/" className="text-[13px] text-terracotta">
          ← Retour à l&apos;application
        </Link>
        {estProvisoire(source) && (
          <div className="mt-5 bg-card border border-border rounded-xl px-4 py-3 text-[12px] text-muted leading-[1.5]">
            Version provisoire : certaines informations de l&apos;éditeur ne sont pas encore renseignées.
          </div>
        )}
        <div className="mt-6">
          <RenduMarkdown blocs={blocs} />
        </div>
      </div>
    </main>
  );
}
