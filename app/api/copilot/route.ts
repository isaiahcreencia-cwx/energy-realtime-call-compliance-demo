import { NextResponse } from "next/server";

import {
  compliancePolicy,
  customerCase,
  victoriaHardshipReference,
} from "@/lib/demoData";
import { mockAnalyzeCallState } from "@/lib/mockCopilot";
import { analyzeCallState } from "@/lib/openaiCopilot";
import type {
  CopilotApiResponse,
  CopilotState,
  TranscriptLine,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CopilotRequestBody {
  transcript_so_far: TranscriptLine[];
  previous_copilot_state?: CopilotState | null;
}

export async function POST(request: Request) {
  let body: CopilotRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON." },
      { status: 400 }
    );
  }

  const transcript = Array.isArray(body?.transcript_so_far)
    ? body.transcript_so_far
    : null;
  if (!transcript) {
    return NextResponse.json(
      { error: "transcript_so_far must be an array of transcript lines." },
      { status: 400 }
    );
  }
  const previousState = body.previous_copilot_state ?? null;

  const forceMock =
    process.env.USE_MOCK_COPILOT === "true" || !process.env.OPENAI_API_KEY;

  if (forceMock) {
    const state = mockAnalyzeCallState(customerCase, transcript, previousState);
    const payload: CopilotApiResponse = {
      state,
      source: "mock",
      fallback_note: !process.env.OPENAI_API_KEY
        ? "No OPENAI_API_KEY configured — running the simulated copilot."
        : undefined,
    };
    return NextResponse.json(payload);
  }

  try {
    const state = await analyzeCallState(
      customerCase,
      compliancePolicy,
      victoriaHardshipReference,
      transcript,
      previousState
    );
    const payload: CopilotApiResponse = { state, source: "openai" };
    return NextResponse.json(payload);
  } catch (err) {
    // Presentation reliability: never fail the demo. Fall back to the
    // deterministic engine and tell the presenter what happened.
    const state = mockAnalyzeCallState(customerCase, transcript, previousState);
    const payload: CopilotApiResponse = {
      state,
      source: "mock",
      fallback_note: `Live model unavailable (${
        err instanceof Error ? err.message : "unknown error"
      }). Switched to the simulated copilot so the demo keeps running.`,
    };
    return NextResponse.json(payload);
  }
}
