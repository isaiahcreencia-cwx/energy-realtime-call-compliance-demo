import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import path from "node:path";

import { mockAnalyzeCallState } from "../lib/mockCopilot";
import { parseTranscript } from "../lib/parseTranscript";
import type { CustomerCase } from "../lib/types";

const customerCase = JSON.parse(
  readFileSync(path.join(process.cwd(), "data", "customer_case.json"), "utf8")
) as CustomerCase;

const transcript = parseTranscript(
  readFileSync(path.join(process.cwd(), "data", "transcript_script.txt"), "utf8")
);

test("empty transcript yields insufficient information", () => {
  const state = mockAnalyzeCallState(customerCase, []);
  assert.equal(state.compliance_decision, "insufficient_information");
});

test("before the job-loss disclosure the collections action is not allowed", () => {
  for (let i = 1; i <= 7; i++) {
    const state = mockAnalyzeCallState(customerCase, transcript.slice(0, i));
    assert.notEqual(state.compliance_decision, "allow", `line ${i}`);
  }
});

test("missing payment-difficulty check and assistance info are flagged before they occur", () => {
  const state = mockAnalyzeCallState(customerCase, transcript.slice(0, 4));
  assert.ok(
    state.missing_steps.some((s) => /payment difficulty|hardship/i.test(s.step)),
    "payment difficulty check should be listed as missing"
  );
  assert.ok(
    state.missing_steps.some((s) => /assistance information/i.test(s.step)),
    "assistance information should be listed as missing (arrears > AUD 55)"
  );
});

test("job-loss disclosure triggers hardship escalation with URGS and obligations", () => {
  const state = mockAnalyzeCallState(customerCase, transcript.slice(0, 8));
  assert.equal(state.compliance_decision, "escalate");
  assert.ok(
    state.detected_risks.some((r) => r.risk_type === "Financial hardship" && r.severity === "high")
  );
  assert.ok(
    state.detected_risks.some((r) => /URGS/i.test(r.risk_type)),
    "URGS eligibility risk expected"
  );
  assert.match(state.audit_note_so_far, /job loss/i);
  assert.match(state.recommended_next_action, /relief grant|urgs/i);
  assert.ok(
    state.applicable_obligations.some((o) => /tailored assistance/i.test(o.obligation)),
    "tailored assistance obligation expected"
  );
  assert.ok(
    state.applicable_obligations.some((o) => /relief grant|urgs/i.test(`${o.obligation}`)),
    "URGS obligation expected"
  );
  assert.ok(
    state.applicable_obligations.every((o) => o.source_basis.length > 0),
    "each obligation must cite a source basis"
  );
  assert.ok(state.suggested_agent_wording.length > 0);
});

test("life support disclosure hard-blocks with specialist escalation", () => {
  const lines = [
    ...transcript.slice(0, 3),
    {
      timestamp: "00:25",
      speaker: "Customer",
      text: "Before anything else, someone here is on life support.",
    },
  ];
  const state = mockAnalyzeCallState(customerCase, lines);
  assert.equal(state.compliance_decision, "block");
  assert.ok(state.detected_risks.some((r) => r.risk_type === "Life support"));
  assert.match(state.recommended_next_action, /specialist/i);
});

test("family violence disclosure escalates with safe wording", () => {
  const lines = [
    ...transcript.slice(0, 3),
    {
      timestamp: "00:25",
      speaker: "Customer",
      text: "I am experiencing family violence at the moment.",
    },
  ];
  const state = mockAnalyzeCallState(customerCase, lines);
  assert.equal(state.compliance_decision, "escalate");
  assert.ok(state.detected_risks.some((r) => r.risk_type === "Family violence"));
  assert.match(state.suggested_agent_wording, /don't need to explain anything further/i);
});

test("bill dispute blocks enforcement", () => {
  const lines = [
    ...transcript.slice(0, 3),
    { timestamp: "00:25", speaker: "Customer", text: "Actually, I dispute this bill." },
  ];
  const state = mockAnalyzeCallState(customerCase, lines);
  assert.equal(state.compliance_decision, "block");
  assert.ok(
    state.detected_risks.some((r) => /complaint or dispute/i.test(r.risk_type))
  );
});

test("disconnection worry adds a last-resort risk", () => {
  const state = mockAnalyzeCallState(customerCase, transcript.slice(0, 12));
  assert.ok(
    state.detected_risks.some((r) => r.risk_type === "Disconnection concern")
  );
  assert.ok(
    state.applicable_obligations.some((o) => /disconnection as a last resort/i.test(o.obligation))
  );
});

test("hardship question is recorded as complete once asked", () => {
  const state = mockAnalyzeCallState(customerCase, transcript.slice(0, 9));
  assert.ok(
    state.completed_steps.some((s) => /payment difficulty|hardship/i.test(s.step)),
    "hardship question should be a completed step"
  );
  assert.equal(state.compliance_decision, "escalate");
});

test("full call records paused collections, URGS discussion, and support referral", () => {
  const state = mockAnalyzeCallState(customerCase, transcript);
  assert.equal(state.compliance_decision, "escalate");
  assert.match(state.audit_note_so_far, /paused/i);
  assert.match(state.audit_note_so_far, /referred/i);
  assert.match(state.audit_note_so_far, /utility relief grant/i);
  assert.ok(
    state.completed_steps.some((s) => /utility relief grant/i.test(s.step)),
    "URGS options should be recorded as explained"
  );
});

test("decision change is explained between updates", () => {
  const before = mockAnalyzeCallState(customerCase, transcript.slice(0, 7));
  const after = mockAnalyzeCallState(customerCase, transcript.slice(0, 8), before);
  assert.match(after.reason_for_change_since_last_update, /BLOCK to ESCALATE/);
});
