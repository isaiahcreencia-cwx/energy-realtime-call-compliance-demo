"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CopilotPanel } from "@/components/CopilotPanel";
import { TranscriptFeed } from "@/components/TranscriptFeed";
import { formatFinalCaseNote } from "@/lib/caseNote";
import { customerCase, transcriptLines } from "@/lib/demoData";
import type {
  CopilotApiResponse,
  CopilotSource,
  CopilotState,
} from "@/lib/types";

const REFRESH_SECONDS = Number(
  process.env.NEXT_PUBLIC_DEMO_REFRESH_SECONDS ?? "4"
);

export default function Page() {
  const [transcriptIndex, setTranscriptIndex] = useState(0);
  const [copilotState, setCopilotState] = useState<CopilotState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [pending, setPending] = useState(false);
  const [source, setSource] = useState<CopilotSource | null>(null);
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);
  const [finalCaseNote, setFinalCaseNote] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Keep latest values available to the auto-play timer without re-binding.
  const stateRef = useRef({ transcriptIndex, pending, copilotState });
  stateRef.current = { transcriptIndex, pending, copilotState };

  // One in-flight/resolved request per line index, so parallel prefetch and a
  // real click for the same line share a single call. Cleared on Reset.
  const requestsRef = useRef(new Map<number, Promise<CopilotApiResponse>>());

  const transcriptSoFar = transcriptLines.slice(0, transcriptIndex);
  const callFinished = transcriptIndex >= transcriptLines.length;

  // Fetch (or reuse) the analysis for the transcript prefix of `index` lines.
  // Each line is analysed independently from the full prefix, so prefetch and a
  // later real click resolve to the same promise. previous_copilot_state is
  // null because parallel warming has no prior outputs to chain from.
  const getOrFetch = useCallback((index: number): Promise<CopilotApiResponse> => {
    const existing = requestsRef.current.get(index);
    if (existing) return existing;
    const promise = (async () => {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript_so_far: transcriptLines.slice(0, index),
          previous_copilot_state: null,
        }),
      });
      if (!response.ok) {
        throw new Error(`Copilot service returned HTTP ${response.status}.`);
      }
      return (await response.json()) as CopilotApiResponse;
    })().catch((err) => {
      // Drop the failed entry so a retry re-fetches instead of replaying the error.
      requestsRef.current.delete(index);
      throw err;
    });
    requestsRef.current.set(index, promise);
    return promise;
  }, []);

  const analyze = useCallback(
    async (nextIndex: number): Promise<void> => {
      setPending(true);
      setLastError(null);
      try {
        const data = await getOrFetch(nextIndex);
        setCopilotState(data.state);
        setSource(data.source);
        setFallbackNote(data.fallback_note ?? null);
      } catch (err) {
        setLastError(
          `The copilot update failed (${
            err instanceof Error ? err.message : "unknown error"
          }). The transcript continues — try Advance one line again, or restart the dev server.`
        );
      } finally {
        setPending(false);
      }
    },
    [getOrFetch]
  );

  const advanceOneLine = useCallback(() => {
    const { transcriptIndex: idx, pending: busy } = stateRef.current;
    if (busy || idx >= transcriptLines.length) return;
    const nextIndex = idx + 1;
    setTranscriptIndex(nextIndex);
    void analyze(nextIndex);
  }, [analyze]);

  // Auto-play loop: advance after REFRESH_SECONDS whenever running and idle.
  useEffect(() => {
    if (!isRunning) return;
    if (transcriptIndex >= transcriptLines.length) {
      setIsRunning(false);
      return;
    }
    if (pending) return;
    const timer = setTimeout(
      advanceOneLine,
      Math.max(1, REFRESH_SECONDS) * 1000
    );
    return () => clearTimeout(timer);
  }, [isRunning, pending, transcriptIndex, advanceOneLine]);

  const startDemo = () => {
    setIsRunning(true);
    // Warm every remaining line in parallel so advancing reads a ready result.
    // Each call is genuinely live; they just complete a few seconds before the
    // presenter clicks. Fire-and-forget — getOrFetch dedupes against real reads.
    for (let i = stateRef.current.transcriptIndex + 1; i <= transcriptLines.length; i++) {
      void getOrFetch(i).catch(() => {
        /* surfaced later if/when this line is actually displayed */
      });
    }
    if (stateRef.current.transcriptIndex === 0 && !stateRef.current.pending) {
      advanceOneLine();
    }
  };

  const reset = () => {
    setIsRunning(false);
    requestsRef.current.clear();
    setTranscriptIndex(0);
    setCopilotState(null);
    setPending(false);
    setSource(null);
    setFallbackNote(null);
    setFinalCaseNote(null);
    setLastError(null);
    setCopied(false);
  };

  const generateCaseNote = () => {
    if (!copilotState) return;
    setFinalCaseNote(
      formatFinalCaseNote(copilotState, customerCase, transcriptSoFar)
    );
    setCopied(false);
  };

  const copyCaseNote = async () => {
    if (!finalCaseNote) return;
    try {
      await navigator.clipboard.writeText(finalCaseNote);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard can be unavailable in some browsers; selection still works.
    }
  };

  return (
    <>
      <header className="app-header">
        <div className="brand-mark">
          <span className="brand-bolt" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M13 2 4.5 13.5h6L11 22l8.5-11.5h-6L13 2Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span className="brand-text">
            <span className="brand-name">SUPA Energy</span>
            <span className="brand-sub">Real-Time Compliance Call Copilot</span>
          </span>
        </div>
        <span className="header-spacer" />
        {source && (
          <span className={`pill ${source === "openai" ? "pill--live" : "pill--mock"}`}>
            <span className="pill-dot" />
            {source === "openai" ? "Live model" : "Simulated copilot"}
          </span>
        )}
        <span className={`pill ${isRunning ? "pill--live" : ""}`}>
          <span className="pill-dot" />
          {isRunning ? "Call in progress" : callFinished ? "Call ended" : "Standby"}
        </span>
      </header>

      <div className="intro">
        <h1>Live agent-assist and compliance control</h1>
        <p>
          This is a simulated live call. The transcript streams in line by line;
          on every line the copilot re-checks the conversation against the
          Victorian hardship policy — built on the ESC Energy Retail Code of
          Practice and the Utility Relief Grant Scheme — updates its decision,
          and guides the agent's next compliant action. The copilot is advisory,
          not legal advice — the agent stays in control.
        </p>
      </div>

      <section className="card top-banner" aria-label="Customer case">
        <div className="banner-profile">
          <p className="card-label">Customer profile</p>
          <div className="profile-head">
            <span className="profile-name">{customerCase.customer_name}</span>
            <span className="profile-id">{customerCase.customer_id}</span>
          </div>
          <div className="profile-grid">
            <div>
              <div className="field-label">Account status</div>
              <div className="field-value field-value--alert">
                {customerCase.account_status}
              </div>
            </div>
            <div>
              <div className="field-label">Balance due</div>
              <div className="field-value">
                {customerCase.currency} {customerCase.balance_due.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="field-label">Days since pay-by date</div>
              <div className="field-value">{customerCase.days_since_pay_by_date}</div>
            </div>
            <div>
              <div className="field-label">Service</div>
              <div className="field-value">{customerCase.service_type}</div>
            </div>
            <div>
              <div className="field-label">Jurisdiction</div>
              <div className="field-value">{customerCase.jurisdiction}</div>
            </div>
            <div>
              <div className="field-label">Sector</div>
              <div className="field-value" style={{ textTransform: "capitalize" }}>
                {customerCase.sector} ({customerCase.customer_type})
              </div>
            </div>
            <div>
              <div className="field-label">Hardship assessment</div>
              <div className="field-value">
                {customerCase.hardship_assessment_completed ? "Completed" : "Not completed"}
              </div>
            </div>
            <div>
              <div className="field-label">Utility Relief Grant</div>
              <div className="field-value" style={{ textTransform: "capitalize" }}>
                {customerCase.utility_relief_grant_status.replace(/_/g, " ")}
              </div>
            </div>
          </div>
        </div>

        <div className="banner-action">
          <p className="card-label">Proposed downstream action</p>
          <div className="field-value">{customerCase.proposed_action}</div>
          <p style={{ color: "var(--muted)", fontSize: 15, marginTop: 6 }}>
            {customerCase.agent_goal}
          </p>
        </div>
      </section>

      <main className="main-grid">
        {/* ---------------- Left column: the call ---------------- */}
        <div className="col">
          <section className="card transcript" aria-label="Live transcript">
            <p className="card-label">
              Live transcript · line {transcriptIndex} of {transcriptLines.length}
            </p>
            <TranscriptFeed lines={transcriptSoFar} />
          </section>

          <section className="card" aria-label="Demo controls">
            <p className="card-label">Demo controls</p>
            <div className="controls">
              {isRunning ? (
                <button className="btn btn--primary" onClick={() => setIsRunning(false)}>
                  Pause
                </button>
              ) : (
                <button
                  className="btn btn--primary"
                  onClick={startDemo}
                  disabled={callFinished}
                >
                  {transcriptIndex === 0 ? "Start live demo" : "Resume"}
                </button>
              )}
              <button
                className="btn"
                onClick={advanceOneLine}
                disabled={pending || callFinished}
              >
                Advance one line
              </button>
              <button className="btn btn--ghost" onClick={reset}>
                Reset
              </button>
              <button
                className="btn"
                onClick={generateCaseNote}
                disabled={!copilotState}
              >
                Generate final case note
              </button>
              <span className="progress-note">
                auto-play {REFRESH_SECONDS}s/line
              </span>
            </div>
          </section>
        </div>

        {/* ---------------- Right column: the copilot ---------------- */}
        <div className="col">
          {fallbackNote && (
            <div className="banner" role="status">
              <span>{fallbackNote}</span>
              <button onClick={() => setFallbackNote(null)} aria-label="Dismiss">
                ✕
              </button>
            </div>
          )}
          {lastError && (
            <div className="banner" role="alert">
              <span>{lastError}</span>
              <button onClick={() => setLastError(null)} aria-label="Dismiss">
                ✕
              </button>
            </div>
          )}

          <CopilotPanel
            state={copilotState}
            pending={pending}
            hasStarted={transcriptIndex > 0}
            proposedAction={customerCase.proposed_action}
          />

          {finalCaseNote && (
            <section className="card case-note" aria-label="Final case note">
              <div className="case-note-actions">
                <p className="card-label" style={{ margin: 0 }}>
                  CRM-ready case note
                </p>
                {copied ? (
                  <span className="copy-confirm">Copied</span>
                ) : (
                  <button className="btn" onClick={copyCaseNote}>
                    Copy to clipboard
                  </button>
                )}
              </div>
              <pre>{finalCaseNote}</pre>
            </section>
          )}
        </div>
      </main>

      <footer className="app-footer">
        Demo environment — all customer data is fictional. The copilot is an
        advisory control referencing the ESC Energy Retail Code of Practice (v5),
        the ESC Water Industry Standard (v4), and the DFFH Utility Relief Grant
        Scheme; it is not legal advice. The human agent remains responsible for
        final action.
      </footer>
    </>
  );
}
