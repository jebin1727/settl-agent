"use client";

// Fires only if the ROOT layout itself throws — can't assume providers
// (ThemeProvider, etc.) are available, so this stays plain HTML/CSS and
// replaces <html>/<body> entirely, per Next.js App Router convention.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem", textAlign: "center" }}>
        <h1>Something went wrong.</h1>
        <button onClick={reset} style={{ padding: "0.5rem 1rem", marginTop: "1rem" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
