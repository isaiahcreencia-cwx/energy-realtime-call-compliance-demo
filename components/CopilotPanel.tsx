"use client";

import type { CopilotState } from "@/lib/types";

const DECISION_LABEL: Record<CopilotState["compliance_decision"], string> = {
  allow: "ALLOW",
  block: "BLOCK",
  escalate: "ESCALATE",
  insufficient_information: "INSUFFICIENT INFORMATION",
};

export function CopilotPanel({
  state,
  pending,
  hasStarted,
  proposedAction,
}: {
  state: CopilotState | null;
  pending: boolean;
  hasStarted: boolean;
  proposedAction: string;
}) {
  const decision = state?.compliance_decision ?? "insufficient_information";
  const urgsRelevant = (state?.applicable_obligations ?? []).some((o) =>
    /relief grant|urgs/i.test(`${o.obligation} ${o.why_relevant}`)
  );

  return (
    <div className={`card copilot-panel copilot-panel--${decision}`}>
      <div className="copilot-head">
        <span className="copilot-title">Compliance copilot</span>
        <span className="copilot-status">
          {pending && <span className="thinking">Analysing latest line…</span>}
        </span>
      </div>

      {!state && !hasStarted ? (
        <div className="copilot-idle">
          The copilot activates as soon as the call starts. It listens to every
          line, checks the mandatory process, and recommends the next compliant
          action.
        </div>
      ) : !state ? (
        <div className="copilot-idle">Waiting for the first analysis…</div>
      ) : (
        <>
          <div
            key={decision}
            className={`decision-badge decision-badge--${decision} decision-flash`}
            role="status"
          >
            <span className="decision-word">{DECISION_LABEL[decision]}</span>
            <span className="decision-reason">{state.decision_reason}</span>
          </div>

          <div className="copilot-sections">
            <div className="copilot-col">
            <div className="section">
              <h3>Running summary</h3>
              <p>{state.running_summary}</p>
            </div>

            <div className="section">
              <h3>Customer intent</h3>
              <p>{state.customer_intent}</p>
            </div>

            <div className="section">
              <h3>Recommended next action</h3>
              <p>{state.recommended_next_action}</p>
            </div>

            <div className="section section--wording">
              <h3>Suggested agent wording</h3>
              <p>{state.suggested_agent_wording}</p>
            </div>

            <div className="section">
              <h3>Why this changed</h3>
              <p>{state.reason_for_change_since_last_update}</p>
            </div>

            <div className="section">
              <h3>Audit note so far</h3>
              <p>{state.audit_note_so_far}</p>
            </div>

            <div className="section">
              <h3>Confidence</h3>
              <div className="confidence-row">
                <div className="confidence-track" aria-hidden>
                  <div
                    className="confidence-fill"
                    style={{
                      width: `${Math.round(Math.min(1, Math.max(0, state.confidence)) * 100)}%`,
                    }}
                  />
                </div>
                <span className="confidence-value">
                  {Math.round(Math.min(1, Math.max(0, state.confidence)) * 100)}%
                </span>
              </div>
            </div>
            </div>

            <div className="copilot-col">
            <div className="section">
              <h3>Detected risk flags</h3>
              {state.detected_risks.length === 0 ? (
                <p>No risk signals detected so far.</p>
              ) : (
                <ul>
                  {state.detected_risks.map((risk, i) => (
                    <li key={i} style={{ display: "block" }}>
                      <span className={`risk risk--${risk.severity}`}>
                        <span className="risk-head">
                          <span className="risk-type">{risk.risk_type}</span>
                          <span className="risk-severity">{risk.severity}</span>
                        </span>
                        <span className="risk-detail">
                          {risk.evidence} {risk.impact}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="section">
              <h3>Completed mandatory steps</h3>
              {state.completed_steps.length === 0 ? (
                <p>No mandatory steps evidenced yet.</p>
              ) : (
                <ul>
                  {state.completed_steps.map((step, i) => (
                    <li key={i}>
                      <span className="step-icon step-icon--done" aria-hidden>
                        ✓
                      </span>
                      <span>
                        {step.step}
                        <span className="step-evidence">{step.evidence}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="section">
              <h3>Missing mandatory steps</h3>
              {state.missing_steps.length === 0 ? (
                <p>All mandatory steps are evidenced.</p>
              ) : (
                <ul>
                  {state.missing_steps.map((step, i) => (
                    <li key={i}>
                      <span className="step-icon step-icon--missing" aria-hidden>
                        ✕
                      </span>
                      <span>
                        {step.step}
                        <span className="step-evidence">{step.reason}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {decision !== "allow" && decision !== "insufficient_information" && (
              <div className="section section--blocked">
                <h3>Blocked downstream action</h3>
                <p>{proposedAction}</p>
              </div>
            )}

            <div className="section">
              <h3>Relevant obligations</h3>
              {state.applicable_obligations.length === 0 ? (
                <p>No specific obligations triggered yet.</p>
              ) : (
                <ul>
                  {state.applicable_obligations.map((o, i) => (
                    <li key={i} style={{ display: "block" }}>
                      <span className="obligation">
                        <span className="obligation-head">
                          <span className="obligation-name">{o.obligation}</span>
                          <span className="obligation-source">{o.source_basis}</span>
                        </span>
                        <span className="risk-detail">{o.why_relevant}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {urgsRelevant && (
              <div className="section section--urgs">
                <h3>URGS prompt</h3>
                <p>
                  Discuss Utility Relief Grant Scheme support — screening or
                  application assistance may apply. If the customer requests an
                  application, place the account on hold with no disconnection
                  action while the grant is considered.
                </p>
              </div>
            )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
