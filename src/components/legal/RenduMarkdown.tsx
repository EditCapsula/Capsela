import type { ReactNode } from "react";
import type { Block, Inline } from "@/lib/legal/markdown";

/** Rendu des blocs de lireMarkdown : du texte, jamais de HTML brut. */

function Inlines({ items }: { items: Inline[] }): ReactNode {
  return items.map((m, i) => {
    switch (m.type) {
      case "text":
        return m.text;
      case "strong":
        return <strong key={i} className="font-semibold"><Inlines items={m.children} /></strong>;
      case "em":
        return <em key={i}><Inlines items={m.children} /></em>;
      case "code":
        return <code key={i} className="text-[0.92em]">{m.text}</code>;
      case "link":
        return (
          <a key={i} href={m.href} className="text-terracotta underline" {...(m.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            <Inlines items={m.children} />
          </a>
        );
    }
  });
}

export function RenduMarkdown({ blocs }: { blocs: Block[] }) {
  return (
    <>
      {blocs.map((b, i) => {
        switch (b.type) {
          case "heading":
            if (b.niveau === 1) return <h1 key={i} className="t-titre-ecran text-ink"><Inlines items={b.children} /></h1>;
            if (b.niveau === 2) return <h2 key={i} className="t-titre-section text-ink mt-8"><Inlines items={b.children} /></h2>;
            return <h3 key={i} className="text-[15px] font-semibold text-ink mt-6"><Inlines items={b.children} /></h3>;
          case "paragraph":
            return <p key={i} className="text-[14px] leading-[1.6] text-ink mt-3"><Inlines items={b.children} /></p>;
          case "quote":
            return <blockquote key={i} className="text-[13px] leading-[1.55] text-muted mt-3 pl-3 border-l-2 border-border"><Inlines items={b.children} /></blockquote>;
          case "rule":
            return <hr key={i} className="border-border my-6" />;
          case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag key={i} className={"text-[14px] leading-[1.6] text-ink mt-3 pl-5 " + (b.ordered ? "list-decimal" : "list-disc")}>
                {b.items.map((it, j) => (
                  <li key={j} className="mt-1"><Inlines items={it} /></li>
                ))}
              </Tag>
            );
          }
          case "table":
            return (
              <div key={i} className="mt-4 overflow-x-auto">
                <table className="w-full text-[13px] leading-[1.5] border-collapse">
                  <thead>
                    <tr>
                      {b.head.map((c, j) => (
                        <th key={j} className="text-left align-top font-semibold px-3 py-2 border-b border-border"><Inlines items={c} /></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>
                        {r.map((c, k) => (
                          <td key={k} className="align-top px-3 py-2 border-b border-border"><Inlines items={c} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </>
  );
}
