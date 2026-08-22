"use client";

import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessCode.trim() || busy) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Jipity could not be unlocked.");
      }

      window.location.replace("/");
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : "Jipity could not be unlocked.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="card auth-card" aria-labelledby="jipity-login-title">
        <div className="brand" id="jipity-login-title">
          Jipity ✦
        </div>
        <p className="auth-description">
          This companion is private. Enter your access code to unlock it.
        </p>
        <form onSubmit={unlock} className="auth-form">
          <label htmlFor="jipity-access-code">Private access code</label>
          <input
            id="jipity-access-code"
            name="accessCode"
            type="password"
            autoComplete="current-password"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            placeholder="Enter your private access code"
            disabled={busy}
            required
          />
          <button type="submit" disabled={busy || !accessCode.trim()}>
            {busy ? "Unlocking…" : "Unlock Jipity"}
          </button>
        </form>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <p className="auth-privacy">
          Your access code is checked on the server and never saved in browser
          storage.
        </p>
      </section>
    </main>
  );
}
