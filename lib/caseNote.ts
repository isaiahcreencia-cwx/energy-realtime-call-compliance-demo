import type { CopilotState, CustomerCase, TranscriptLine } from "./types";

const DECISION_STATUS: Record<CopilotState["compliance_decision"], string> = {
  allow: "Proceed with standard workflow.",
  block: "Block proposed action pending completion of mandatory checks.",
  escalate: "Escalate to hardship/support team.",
  insufficient_information: "Insufficient information; do not proceed.",
};

const DECISION_ACTION: Record<CopilotState["compliance_decision"], string> = {
  allow: "Proposed downstream action may proceed.",
  block:
    "Block formal collections and disconnection pre-check pending completion of mandatory checks.",
  escalate:
    "Block formal collections and disconnection pre-check pending hardship assessment and support workflow.",
  insufficient_information:
    "Hold formal collections and disconnection pre-check until sufficient evidence is recorded.",
};

/**
 * Format a CRM-ready final case note from the latest copilot state.
 * Build plan section 13, option 1: latest audit note plus a formatting step.
 */
export function formatFinalCaseNote(
  state: CopilotState,
  customerCase: CustomerCase,
  transcript: TranscriptLine[]
): string {
  const hardshipLine = transcript.find((l) =>
    /lost my job|struggling to pay rent/i.test(l.text)
  );

  const incomeUncertain = transcript.some((l) =>
    /do not know when i will have income/i.test(l.text)
  );

  const evidence = hardshipLine
    ? `Customer stated they lost their job last month, are struggling to pay rent${
        incomeUncertain ? ", and do not know when they will have income again" : ""
      } (transcript ${hardshipLine.timestamp}).`
    : state.detected_risks[0]?.evidence ??
      "See completed step evidence recorded against this case.";

  const completed =
    state.completed_steps.length > 0
      ? state.completed_steps.map((s) => `- ${s.step}`).join("\n")
      : "- None evidenced.";

  const outstanding =
    state.missing_steps.length > 0
      ? state.missing_steps.map((s) => `- ${s.step}`).join("\n")
      : "- None.";

  const obligations =
    state.applicable_obligations.length > 0
      ? state.applicable_obligations
          .map((o) => `- ${o.obligation} (${o.source_basis})`)
          .join("\n")
      : "- None identified.";

  return [
    "CRM Case Note",
    "",
    `Customer: ${customerCase.customer_name} (${customerCase.customer_id})`,
    `Account: ${customerCase.service_type} (${customerCase.jurisdiction}) — ${customerCase.account_status}, ${customerCase.currency} ${customerCase.arrears_amount.toFixed(0)} in arrears (${customerCase.days_since_pay_by_date} days since pay-by date).`,
    "",
    state.audit_note_so_far,
    "",
    `Recommended status: ${DECISION_STATUS[state.compliance_decision]}`,
    `Proposed downstream action: ${DECISION_ACTION[state.compliance_decision]}`,
    `Evidence: ${evidence}`,
    "",
    "Mandatory steps completed:",
    completed,
    "",
    "Outstanding steps:",
    outstanding,
    "",
    "Applicable obligations:",
    obligations,
    "",
    "Note: This summary was prepared with an advisory compliance copilot and is not legal advice. The handling agent remains responsible for the final action.",
  ].join("\n");
}
