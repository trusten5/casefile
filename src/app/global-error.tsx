"use client";

import Link from "next/link";
import { useEffect } from "react";

// Catches errors that escape the root layout itself — error.tsx can't, since
// it renders inside that layout. Must render its own <html>/<body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // This replaces the root layout entirely, so globals.css/Tailwind aren't
  // guaranteed to be loaded — inline styles only, nothing that depends on
  // the app's normal CSS bundle actually reaching the page.
  return (
    <html>
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 1.5rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#666" }}>
          That&apos;s on us, not you. Try again, or head back home.
        </p>
        <div style={{ marginTop: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            type="button"
            onClick={reset}
            style={{
              borderRadius: "9999px",
              background: "#000",
              color: "#fff",
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <Link href="/" style={{ fontSize: "0.875rem", fontWeight: 500, color: "#666" }}>
            Go home
          </Link>
        </div>
      </body>
    </html>
  );
}
