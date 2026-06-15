/**
 * Strict JSON schema for the copilot's structured response.
 * Mirrors the build plan, section 9.3.
 */
export const COPILOT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "running_summary",
    "customer_intent",
    "detected_risks",
    "compliance_decision",
    "decision_reason",
    "applicable_obligations",
    "completed_steps",
    "missing_steps",
    "recommended_next_action",
    "suggested_agent_wording",
    "audit_note_so_far",
    "reason_for_change_since_last_update",
    "confidence",
  ],
  properties: {
    running_summary: { type: "string" },
    customer_intent: { type: "string" },
    detected_risks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["risk_type", "severity", "evidence", "impact"],
        properties: {
          risk_type: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          evidence: { type: "string" },
          impact: { type: "string" },
        },
      },
    },
    compliance_decision: {
      type: "string",
      enum: ["allow", "block", "escalate", "insufficient_information"],
    },
    decision_reason: { type: "string" },
    applicable_obligations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["obligation", "source_basis", "why_relevant"],
        properties: {
          obligation: { type: "string" },
          source_basis: { type: "string" },
          why_relevant: { type: "string" },
        },
      },
    },
    completed_steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["step", "evidence"],
        properties: {
          step: { type: "string" },
          evidence: { type: "string" },
        },
      },
    },
    missing_steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["step", "reason"],
        properties: {
          step: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
    recommended_next_action: { type: "string" },
    suggested_agent_wording: { type: "string" },
    audit_note_so_far: { type: "string" },
    reason_for_change_since_last_update: { type: "string" },
    confidence: { type: "number" },
  },
} as const;
