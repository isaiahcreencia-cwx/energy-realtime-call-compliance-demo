import { SYSTEM_PROMPT } from "./prompt";
import { COPILOT_RESPONSE_SCHEMA } from "./schema";
import type { CopilotState, CustomerCase, TranscriptLine } from "./types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.5";

/**
 * Server-side only. Calls the OpenAI Responses API with strict structured
 * outputs and returns the parsed copilot state. Throws a readable Error on
 * any failure so the caller can fall back to the mock engine.
 */
export async function analyzeCallState(
  customerCase: CustomerCase,
  policy: string,
  victoriaHardshipReference: string,
  transcriptSoFar: TranscriptLine[],
  previousCopilotState?: CopilotState | null
): Promise<CopilotState> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const payload = {
    customer_case: customerCase,
    policy,
    victoria_hardship_reference: victoriaHardshipReference,
    transcript_so_far: transcriptSoFar,
    previous_copilot_state: previousCopilotState ?? {},
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let response: Response;
  try {
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(payload) },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "copilot_update",
            strict: true,
            schema: COPILOT_RESPONSE_SCHEMA,
          },
        },
      }),
    });
  } catch (err) {
    throw new Error(
      err instanceof Error && err.name === "AbortError"
        ? "OpenAI request timed out after 30 seconds."
        : `Could not reach the OpenAI API: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      detail = body?.error?.message ?? detail;
    } catch {
      // keep HTTP status as the detail
    }
    throw new Error(`OpenAI API error: ${detail}`);
  }

  const data = await response.json();
  const text = extractOutputText(data);
  if (!text) {
    throw new Error("OpenAI response contained no output text.");
  }

  try {
    return JSON.parse(text) as CopilotState;
  } catch {
    throw new Error("OpenAI response was not valid JSON.");
  }
}

/**
 * Extract output text from a Responses API payload, tolerating SDK/API
 * shape differences: prefer `output_text`, otherwise walk `output[]`.
 */
function extractOutputText(data: any): string | null {
  if (typeof data?.output_text === "string" && data.output_text.length > 0) {
    return data.output_text;
  }
  if (Array.isArray(data?.output)) {
    for (const item of data.output) {
      const content = item?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (
          (block?.type === "output_text" || block?.type === "text") &&
          typeof block?.text === "string"
        ) {
          return block.text;
        }
      }
    }
  }
  return null;
}
