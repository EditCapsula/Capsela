"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Le cas où la mise en page racine elle-même échoue : `error.tsx` ne peut
 * alors pas s'afficher, puisqu'il vit à l'intérieur. Ce composant remplace
 * `<html>` et `<body>` en entier, ce qui interdit d'y utiliser les classes
 * du thème — les polices et les variables CSS ne sont pas chargées à ce
 * stade. Les couleurs sont donc écrites en dur, et ce sont les seules du
 * dépôt à l'être.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ margin: 0, background: "#F3EEE5", color: "#1D1A16", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 36px", textAlign: "center" }}>
          <h1 style={{ fontSize: 26, fontWeight: 500, margin: 0 }}>L&apos;édit n&apos;a pas pu s&apos;afficher.</h1>
          <p style={{ fontSize: 14, color: "#6B6459", marginTop: 12, maxWidth: 300, lineHeight: 1.55 }}>
            Rien n&apos;est perdu — ton dressing et tes tenues enregistrées sont intacts.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: 32, background: "#A66950", color: "#F3EEE5", border: 0, borderRadius: 999, padding: "16px 40px", fontSize: 13, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer" }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
