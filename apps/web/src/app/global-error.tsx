"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", padding: 24 }}>
        <h1>OracleEyes — error</h1>
        <p>{error.message || "The app failed to load."}</p>
        <button type="button" onClick={() => reset()}>
          Reload
        </button>
        <button type="button" onClick={() => (window.location.href = "/")}>
          Back to home
        </button>
      </body>
    </html>
  );
}
