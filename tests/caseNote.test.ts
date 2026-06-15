import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import path from "node:path";

import { formatFinalCaseNote } from "../lib/caseNote";
import { mockAnalyzeCallState } from "../lib/mockCopilot";
import { parseTranscript } from "../lib/parseTranscript";
import type { CustomerCase } from "../lib/types";

const customerCase = JSON.parse(
  readFileSync(path.join(process.cwd(), "data", "customer_case.json"), "utf8")
) as CustomerCase;

const transcript = parseTranscript(
  readFileSync(path.join(process.cwd(), "data", "transcript_script.txt"), "utf8")
);

test("final case note is CRM-ready with status, action and evidence", () => {
  const state = mockAnalyzeCallState(customerCase, transcript);
  const note = formatFinalCaseNote(state, customerCase, transcript);
  assert.match(note, /^CRM Case Note/);
  assert.match(note, /Recommended status: Escalate to hardship\/support team\./);
  assert.match(
    note,
    /Block formal collections and disconnection pre-check pending hardship assessment and support workflow\./
  );
  assert.match(note, /lost their job last month/);
  assert.match(note, /Applicable obligations:/);
  assert.match(note, /Energy Retail Code of Practice/);
  assert.match(note, /Utility Relief Grant/i);
  assert.match(note, /advisory/i);
});
