import customerCaseJson from "@/data/customer_case.json";
import policyMd from "@/data/compliance_policy.md";
import victoriaRefMd from "@/data/victoria_hardship_reference.md";
import transcriptTxt from "@/data/transcript_script.txt";

import { parseTranscript } from "./parseTranscript";
import type { CustomerCase, TranscriptLine } from "./types";

/**
 * Demo content loader.
 *
 * The canonical demo files live in `data/` so they are easy to edit:
 *   - data/customer_case.json
 *   - data/compliance_policy.md
 *   - data/victoria_hardship_reference.md
 *   - data/transcript_script.txt
 *
 * They are imported here (the .md/.txt files via the raw-asset rule in
 * next.config.mjs) so they're bundled into the build and always available
 * on Vercel without filesystem access at runtime.
 */
export const customerCase = customerCaseJson as CustomerCase;
export const compliancePolicy: string = policyMd;
export const victoriaHardshipReference: string = victoriaRefMd;
export const transcriptLines: TranscriptLine[] = parseTranscript(transcriptTxt);
