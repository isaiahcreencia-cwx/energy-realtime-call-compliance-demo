import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import path from "node:path";

import { parseTranscript } from "../lib/parseTranscript";

const raw = readFileSync(
  path.join(process.cwd(), "data", "transcript_script.txt"),
  "utf8"
);

test("parses the full demo transcript", () => {
  const lines = parseTranscript(raw);
  assert.equal(lines.length, 13);
  assert.match(lines[0].text, /calling from SUPA Energy/);
  assert.deepEqual(lines[7], {
    timestamp: "01:00",
    speaker: "Customer",
    text: "No, not really. I lost my job last month and I am struggling to pay rent.",
  });
});

test("ignores blank lines", () => {
  const lines = parseTranscript("\n00:00|Agent|Hello\n\n00:05|Customer|Hi\n\n");
  assert.equal(lines.length, 2);
});

test("splits only on the first two pipes", () => {
  const lines = parseTranscript("00:00|Agent|One | two | three");
  assert.equal(lines[0].text, "One | two | three");
});

test("raises a clear error for malformed lines", () => {
  assert.throws(() => parseTranscript("00:00 Agent Hello"), /Malformed transcript line 1/);
  assert.throws(() => parseTranscript("00:00|Agent|"), /Malformed transcript line 1/);
});
