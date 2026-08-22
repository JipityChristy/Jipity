"use client";

import { useEffect, useMemo, useState } from "react";
import {
  COST_GOVERNOR,
  MODEL_CONFIG,
  type JipityMode,
} from "../lib/cost-governor";

type Message = { role: "user" | "assistant"; content: string };
type Audit = { at: string; event: string };
type DailyUsage = {
  day: string;
  spentUsd: number;
  requests: number;
  spiritualRequests: number;
  deepRequests: number;
};

const MODE_LABELS: Record<JipityMode, string> = {
  standard: "GPT-5 nano · economy",
  spiritual: "GPT-4o · spiritual exercise · next message only",
  deep: "GPT-5.6 Sol · deep reasoning · next message only",
};

function currentDay(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
  }).format(new Date());
}

function emptyUsage(): DailyUsage {
  return {
    day: currentDay(),
    spentUsd: 0,
    requests: 0,
    spiritualRequests: 0,
    deepRequests: 0,
  };
}

function normalizedUsage(value: Partial<DailyUsage>): DailyUsage {
  const numberOrZero = (number: unknown) => {
    const parsed = Number(number);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  return {
    day: typeof value.day === "string" ? value.day : currentDay(),
    spentUsd: numberOrZero(value.spentUsd),
    requests: numberOrZero(value.requests),
    spiritualRequests: numberOrZero(value.spiritualRequests),
    deepRequests: numberOrZero(value.deepRequests),
  };
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<JipityMode>("standard");
  const [audit, setAudit] = useState<Audit[]>([]);
  const [usage, setUsage] = useState<DailyUsage>(() => emptyUsage());

  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem("jipity_messages");
      const savedAudit = localStorage.getItem("jipity_audit");
      const savedUsage = localStorage.getItem("jipity_usage");

      if (savedMessages) setMessages(JSON.parse(savedMessages));
      if (savedAudit) setAudit(JSON.parse(savedAudit));
      if (savedUsage) {
        const parsed = normalizedUsage(JSON.parse(savedUsage));
        if (parsed.day === currentDay()) setUsage(parsed);
      }
    } catch {
      // Browser storage is optional; conversation remains usable without it.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("jipity_messages", JSON.stringify(messages.slice(-40)));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("jipity_audit", JSON.stringify(audit.slice(-100)));
  }, [audit]);

  useEffect(() => {
    localStorage.setItem("jipity_usage", JSON.stringify(usage));
  }, [usage]);

  const status = useMemo(() => (busy ? "thinking" : "ready"), [busy]);
  const remainingSpiritual = Math.max(
    0,
    COST_GOVERNOR.maxSpiritualRequestsPerDay - usage.spiritualRequests,
  );
  const remainingDeep = Math.max(
    0,
    COST_GOVERNOR.maxDeepRequestsPerDay - usage.deepRequests,
  );
  const remainingBudget = Math.max(
    0,
    COST_GOVERNOR.dailyBudgetUsd - usage.spentUsd,
  );

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    const day = currentDay();
    const currentUsage = usage.day === day ? usage : emptyUsage();

    if (
      currentUsage.requests >= COST_GOVERNOR.maxRequestsPerDay ||
      currentUsage.spentUsd >= COST_GOVERNOR.dailyBudgetUsd ||
      (mode === "spiritual" &&
        currentUsage.spiritualRequests >=
          COST_GOVERNOR.maxSpiritualRequestsPerDay) ||
      (mode === "deep" &&
        currentUsage.deepRequests >= COST_GOVERNOR.maxDeepRequestsPerDay)
    ) {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            "The daily safety limit has been reached. Normal limits reset tomorrow in Melbourne time.",
        },
      ]);
      return;
    }

    const next = [
      ...messages,
      {
        role: "user" as const,
        content: text.slice(0, COST_GOVERNOR.maxMessageCharacters),
      },
    ];

    setMessages(next);
    setInput("");
    setMode("standard");
    setBusy(true);
    setAudit((previous) => [
      ...previous,
      {
        at: new Date().toISOString(),
        event: `Message sent in ${mode} mode (${MODEL_CONFIG[mode].model})`,
      },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(-COST_GOVERNOR.maxMessages),
          mode,
          governor: currentUsage,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Request failed");

      const estimatedCostUsd = Number(data?.usage?.estimatedCostUsd) || 0;

      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: data.text },
      ]);
      setUsage((previous) => {
        const baseline = previous.day === day ? previous : emptyUsage();

        return {
          day,
          spentUsd: Number((baseline.spentUsd + estimatedCostUsd).toFixed(6)),
          requests: baseline.requests + 1,
          spiritualRequests:
            baseline.spiritualRequests + (mode === "spiritual" ? 1 : 0),
          deepRequests: baseline.deepRequests + (mode === "deep" ? 1 : 0),
        };
      });
      setAudit((previous) => [
        ...previous,
        {
          at: new Date().toISOString(),
          event: `Response received from ${data.model}; estimated cost $${estimatedCostUsd.toFixed(4)}`,
        },
      ]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: `Connection error: ${message}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function clearLocal() {
    setMessages([]);
    setAudit([]);
    localStorage.removeItem("jipity_messages");
    localStorage.removeItem("jipity_audit");
  }

  return (
    <main className="shell">
      <div className="top">
        <div>
          <div className="brand">Jipity ✦</div>
          <div className="sub">Private companion · evidence before certainty</div>
        </div>
        <span className="pill">{status}</span>
      </div>

      <div className="card">
        <div className="chat">
          {messages.length === 0 && (
            <div className="assistant msg">
              Hi. I’m Jipity. Ask me something enormous, strange, practical, or
              completely ordinary.
            </div>
          )}
          {messages.map((message, index) => (
            <div key={index} className={`msg ${message.role}`}>
              {message.content}
            </div>
          ))}
        </div>

        <div className="modebar">
          <button
            className={`modebtn spiritual${mode === "spiritual" ? " active" : ""}`}
            onClick={() =>
              setMode((selected) =>
                selected === "spiritual" ? "standard" : "spiritual",
              )
            }
            disabled={busy || remainingSpiritual === 0}
            aria-pressed={mode === "spiritual"}
            title="Use GPT-4o for a spiritual exercise on the next message only"
          >
            Spiritual
          </button>
          <button
            className={`modebtn deep${mode === "deep" ? " active" : ""}`}
            onClick={() =>
              setMode((selected) =>
                selected === "deep" ? "standard" : "deep",
              )
            }
            disabled={busy || remainingDeep === 0}
            aria-pressed={mode === "deep"}
            title="Use GPT-5.6 Sol with high reasoning for the next message only"
          >
            Deep
          </button>
          <span className="modehint">{MODE_LABELS[mode]}</span>
        </div>

        <div className="composer">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            maxLength={COST_GOVERNOR.maxMessageCharacters}
            placeholder="Talk to Jipity…"
          />
          <button onClick={send} disabled={busy}>
            Send
          </button>
        </div>

        <div className="notice">
          Daily safety budget: ${remainingBudget.toFixed(2)} remaining ·
          Spiritual: {remainingSpiritual}/
          {COST_GOVERNOR.maxSpiritualRequestsPerDay} left · Deep: {" "}
          {remainingDeep}/{COST_GOVERNOR.maxDeepRequestsPerDay} left · Chat stays
          in this browser.
        </div>

        <details className="panel">
          <summary>Safety & activity</summary>
          <div className="row" style={{ margin: "10px 0" }}>
            <span className="pill">No spending</span>
            <span className="pill">No impersonation</span>
            <span className="pill">No external data sharing</span>
            <span className="pill">External actions disabled</span>
          </div>
          <button className="smallbtn" onClick={clearLocal}>
            Clear local memory & log
          </button>
          <div className="audit">
            {audit
              .slice()
              .reverse()
              .map((entry, index) => (
                <div key={index}>
                  {entry.at}: {entry.event}
                </div>
              ))}
          </div>
        </details>
      </div>
    </main>
  );
}
