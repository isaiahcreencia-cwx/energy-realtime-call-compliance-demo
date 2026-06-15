export interface TranscriptLine {
  timestamp: string;
  speaker: string;
  text: string;
}

export interface DetectedRisk {
  risk_type: string;
  severity: "low" | "medium" | "high";
  evidence: string;
  impact: string;
}

export interface CompletedStep {
  step: string;
  evidence: string;
}

export interface MissingStep {
  step: string;
  reason: string;
}

export interface ApplicableObligation {
  obligation: string;
  source_basis: string;
  why_relevant: string;
}

export type ComplianceDecision =
  | "allow"
  | "block"
  | "escalate"
  | "insufficient_information";

export interface CopilotState {
  running_summary: string;
  customer_intent: string;
  detected_risks: DetectedRisk[];
  compliance_decision: ComplianceDecision;
  decision_reason: string;
  applicable_obligations: ApplicableObligation[];
  completed_steps: CompletedStep[];
  missing_steps: MissingStep[];
  recommended_next_action: string;
  suggested_agent_wording: string;
  audit_note_so_far: string;
  reason_for_change_since_last_update: string;
  confidence: number;
}

export interface CustomerCase {
  customer_name: string;
  customer_id: string;
  jurisdiction: string;
  regulator: string;
  sector: string;
  customer_type: string;
  account_status: string;
  balance_due: number;
  currency: string;
  arrears_amount: number;
  arrears_amount_includes_gst: boolean;
  days_since_pay_by_date: number;
  service_type: string;
  proposed_action: string;
  proposed_next_action: string;
  previous_contact_attempts: number;
  assistance_information_provided: boolean;
  six_business_day_response_window_given: boolean;
  standard_assistance_offered: boolean;
  tailored_assistance_status: string;
  hardship_assessment_completed: boolean;
  payment_plan_status: string;
  utility_relief_grant_status: string;
  concession_status: string;
  known_vulnerability_flag: boolean;
  family_violence_flag: boolean;
  life_support_flag: boolean;
  special_needs_flag: boolean;
  complaint_or_dispute_status: string;
  complaint_open: boolean;
  agent_goal: string;
}

export type CopilotSource = "openai" | "mock";

export interface CopilotApiResponse {
  state: CopilotState;
  source: CopilotSource;
  /** Friendly note shown when the app fell back to mock mode. */
  fallback_note?: string;
}
