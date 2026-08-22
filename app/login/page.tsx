"use client";

import { useState, type FormEvent } from "react";
import { JipityMark } from "../components/jipity-mark";

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
        <div className="auth-emblem">
          <JipityMark className="auth-mark" />
        </div>
        <div className="eyebrow auth-eyebrow">Private and protected</div>
        <h1 className="brand auth-brand" id="jipity-login-title">
          Jipity
        </h1>
        <p className="auth-mantra">Truth · Wisdom · Freedom</p>
        <p className="auth-description">
          Your private companion is waiting. Enter your access code to unlock
          the conversation.
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
          <span className="status-dot" aria-hidden="true" />
          Server-verified access. Your code is never saved in browser storage.
        </p>
      </section>
    </main>
  );
}
