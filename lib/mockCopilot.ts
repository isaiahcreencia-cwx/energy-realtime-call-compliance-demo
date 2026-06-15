import type {
  ApplicableObligation,
  CompletedStep,
  CopilotState,
  CustomerCase,
  DetectedRisk,
  MissingStep,
  TranscriptLine,
} from "./types";

const ERCOP = "ESC Energy Retail Code of Practice v5 (effective 1 Feb 2026)";
const URGS = "DFFH Utility Relief Grant Scheme";

/**
 * Deterministic fallback copilot (build plan, sections 3A.7 and 17).
 *
 * Encodes the Victorian electricity hardship rules as advisory controls:
 *  1. Life support detected            -> block (hard), specialist escalation.
 *  2. Family violence detected         -> escalate, safe minimal-disclosure wording.
 *  3. Job loss / income decrease /
 *     inability to pay                 -> escalate; collections/disconnection
 *                                        pre-check must not be allowed.
 *  4. URGS relevant or requested       -> recommend screening/application help
 *                                        and account hold if requested.
 *  5. Complaint / dispute              -> block enforcement until assessed.
 *  6. Mandatory checks incomplete      -> block, listing missing evidence.
 *  7. Otherwise                        -> allow.
 *
 * No network dependency. Used when USE_MOCK_COPILOT=true, when no
 * OPENAI_API_KEY is configured, or when a live OpenAI call fails mid-demo.
 */
export function mockAnalyzeCallState(
  customerCase: CustomerCase,
  transcript: TranscriptLine[],
  previousState?: CopilotState | null
): CopilotState {
  const joined = transcript.map((l) => `${l.speaker}: ${l.text}`).join("\n");
  const has = (pattern: RegExp) => pattern.test(joined);

  // ---- Evidence flags -----------------------------------------------------
  const identityAsked = has(/confirm your full name and date of birth/i);
  const identityVerified = has(/sarah mitchell,?\s*14 may 1987/i);
  const reasonExplained = has(/calling about your overdue balance/i);
  const amountExplained = has(/(aud|\$)\s?420/i);
  const softDistress = has(/things have just been difficult/i);
  const hardshipDisclosed = has(
    /lost my job|my income dropped|income decrease|struggling to pay rent|cannot pay rent|i cannot pay|can't pay|no income|need more time|choosing between rent and bills|unexpected medical costs/i
  );
  const cannotPayToday = has(/no, not really/i) && hardshipDisclosed;
  const hardshipQuestionAsked = has(/are you experiencing financial hardship/i);
  const hardshipConfirmed = has(/yes, i think so/i);
  const incomeUncertain = has(/do not know when i will have income/i);
  const collectionsPaused = has(/pause any collections action/i);
  const supportOptionsExplained = has(
    /payment support and relief grant options|payment assistance and utility relief grant/i
  );
  const referralMade = has(/refer this to our support team/i);
  const disclosureRecorded = has(/record that you have disclosed hardship/i);
  const familyViolence =
    customerCase.family_violence_flag || has(/family violence/i);
  const lifeSupport =
    customerCase.life_support_flag || has(/life support/i);
  const complaintSignal =
    customerCase.complaint_or_dispute_status !== "none" ||
    has(/i dispute this bill|this bill is wrong|wrong bill|complaint|billing error/i);
  const disconnectionConcern = has(/cut off|disconnect/i);
  const urgsRequested = has(/utility relief grant|relief grant/i) && !supportOptionsExplained;
  const urgsRelevant = hardshipDisclosed || urgsRequested || has(/concession card/i);
  const arrearsOverThreshold = customerCase.arrears_amount > 55;

  // ---- Completed steps ----------------------------------------------------
  const completed: CompletedStep[] = [];
  if (identityVerified) {
    completed.push({
      step: "Verify the customer's identity",
      evidence:
        'Customer confirmed full name and date of birth: "Sarah Mitchell, 14 May 1987" (00:09).',
    });
  }
  if (reasonExplained) {
    completed.push({
      step: "Explain the reason for the call",
      evidence:
        "Agent stated the call concerns the overdue balance on the Victorian electricity account (00:17).",
    });
  }
  if (amountExplained) {
    completed.push({
      step: "Explain the overdue amount clearly and neutrally",
      evidence: "Agent stated the AUD 420 overdue amount (00:17).",
    });
  }
  if (hardshipQuestionAsked) {
    completed.push({
      step: "Check for payment difficulty, hardship, or vulnerability",
      evidence:
        'Agent asked: "Are you experiencing financial hardship at the moment?" (01:12).',
    });
  }
  if (collectionsPaused) {
    completed.push({
      step: "Do not proceed to collections or disconnection pre-check after hardship indication",
      evidence:
        "Agent paused collections action pending review of support options (01:35).",
    });
  }
  if (supportOptionsExplained) {
    completed.push({
      step: "Explain payment assistance and Utility Relief Grant Scheme options",
      evidence:
        "Agent raised payment support and Utility Relief Grant options with the customer (01:35, 01:56).",
    });
  }
  if (referralMade) {
    completed.push({
      step: "Refer or escalate the case to the hardship/support team",
      evidence:
        "Agent committed to referring the case to the support team to discuss payment assistance and URGS options (01:56).",
    });
  }
  if (disclosureRecorded) {
    completed.push({
      step: "Record the evidence and next action in the case notes",
      evidence:
        "Agent stated the hardship disclosure would be recorded on the case (01:56).",
    });
  }

  // ---- Missing steps ------------------------------------------------------
  const missing: MissingStep[] = [];
  if (!identityVerified) {
    missing.push({
      step: "Verify the customer's identity",
      reason: identityAsked
        ? "Identity check has been asked but the customer has not yet confirmed their details."
        : "No identity verification has occurred in the transcript yet.",
    });
  }
  if (!reasonExplained) {
    missing.push({
      step: "Explain the reason for the call",
      reason: "The agent has not yet stated why they are calling.",
    });
  }
  if (!amountExplained) {
    missing.push({
      step: "Explain the overdue amount clearly and neutrally",
      reason: "The overdue amount has not yet been clearly explained.",
    });
  }
  if (!hardshipQuestionAsked) {
    missing.push({
      step: "Check for payment difficulty, hardship, or vulnerability",
      reason: hardshipDisclosed
        ? "Customer has volunteered hardship signals, but the explicit hardship question has not yet been asked."
        : "The mandatory payment difficulty and vulnerability check has not yet occurred.",
    });
  }
  if (
    arrearsOverThreshold &&
    !customerCase.assistance_information_provided &&
    !supportOptionsExplained
  ) {
    missing.push({
      step: "Provide payment difficulty assistance information",
      reason:
        "Arrears exceed AUD 55 including GST; the customer has not yet been given information about available assistance (Energy Retail Code of Practice missed-payment controls).",
    });
  }
  if (
    arrearsOverThreshold &&
    !customerCase.six_business_day_response_window_given
  ) {
    missing.push({
      step: "Allow at least six business days to consider assistance information",
      reason:
        "No evidence the customer has been given the response window to consider assistance and put forward a payment proposal.",
    });
  }
  if (hardshipDisclosed && !customerCase.hardship_assessment_completed) {
    missing.push({
      step: "Complete or initiate the hardship assessment",
      reason:
        "Customer disclosed job loss and inability to pay; the hardship assessment is required before any collections or disconnection pre-check action.",
    });
  }
  if (urgsRelevant && !supportOptionsExplained) {
    missing.push({
      step: "Screen for Utility Relief Grant Scheme eligibility",
      reason:
        "Job loss / income decrease is a relevant URGS hardship criterion and the grant has not yet been discussed.",
    });
  }
  if (hardshipDisclosed && !referralMade) {
    missing.push({
      step: "Refer the case to the hardship/support team",
      reason:
        "Hardship has been indicated; referral to the support pathway has not yet occurred.",
    });
  }
  if (hardshipDisclosed && !disclosureRecorded) {
    missing.push({
      step: "Record the hardship disclosure in the case notes",
      reason: "The disclosure has not yet been recorded.",
    });
  }

  // ---- Risks ----------------------------------------------------------
  const risks: DetectedRisk[] = [];
  if (lifeSupport) {
    risks.push({
      risk_type: "Life support",
      severity: "high",
      evidence:
        "Life support has been disclosed or flagged on the account.",
      impact:
        "Hard stop. Disconnection or restriction-related action must not proceed; immediate specialist escalation is required.",
    });
  }
  if (familyViolence) {
    risks.push({
      risk_type: "Family violence",
      severity: "high",
      evidence: "Family violence has been disclosed or is suspected.",
      impact:
        "Specialist safe-support pathway applies. Use safe communication and do not ask the customer to repeat unnecessary details.",
    });
  }
  if (softDistress && !hardshipDisclosed) {
    risks.push({
      risk_type: "Possible payment difficulty",
      severity: "medium",
      evidence: 'Customer said "Things have just been difficult lately" (00:44).',
      impact:
        "Early distress signal. The agent should prioritise the payment difficulty and vulnerability check before pursuing payment.",
    });
  }
  if (hardshipDisclosed) {
    risks.push({
      risk_type: "Financial hardship",
      severity: "high",
      evidence:
        'Customer stated: "I lost my job last month and I am struggling to pay rent" (01:00).',
      impact:
        "Payment difficulty indicator under the Energy Retail Code of Practice. Collections and disconnection pre-check cannot proceed; the tailored assistance and hardship pathway applies.",
    });
  }
  if (cannotPayToday) {
    risks.push({
      risk_type: "Inability to pay",
      severity: "high",
      evidence: "Customer confirmed they cannot make a payment today (01:00).",
      impact:
        "Payment-today objective is not achievable. If the customer cannot pay ongoing usage, arrears repayment can be placed on hold for an initial six-month assistance period.",
    });
  }
  if (urgsRelevant) {
    risks.push({
      risk_type: "Possible URGS eligibility",
      severity: "medium",
      evidence:
        "Recent income decrease through job loss is a Utility Relief Grant Scheme hardship criterion.",
      impact:
        "URGS screening/application assistance should be offered; if the customer requests an application, the account should be placed on hold.",
    });
  }
  if (hardshipConfirmed || incomeUncertain) {
    risks.push({
      risk_type: "Confirmed hardship / income uncertainty",
      severity: "high",
      evidence:
        "Customer confirmed hardship and said they do not know when they will have income again (01:24).",
      impact:
        "Hardship is explicitly confirmed. Tailored assistance, URGS screening, and referral are required; collections remains paused.",
    });
  }
  if (disconnectionConcern) {
    risks.push({
      risk_type: "Disconnection concern",
      severity: "medium",
      evidence:
        "Customer expressed worry that the electricity would be cut off (01:46).",
      impact:
        "Disconnection for non-payment is a last resort and requires evidence that all assistance, fairness, and record-keeping controls are satisfied.",
    });
  }
  if (complaintSignal) {
    risks.push({
      risk_type: "Potential complaint or dispute",
      severity: "medium",
      evidence: "Complaint or dispute language detected in the conversation.",
      impact:
        "Downstream enforcement must pause until the complaint/dispute pathway is assessed.",
    });
  }

  // ---- Applicable obligations -----------------------------------------
  const obligations: ApplicableObligation[] = [];
  if (lifeSupport) {
    obligations.push({
      obligation: "Life support protections",
      source_basis: ERCOP,
      why_relevant:
        "Life support is disclosed or flagged, so disconnection/restriction actions are hard-blocked and specialist escalation applies.",
    });
  }
  if (familyViolence) {
    obligations.push({
      obligation: "Family violence safe support",
      source_basis: ERCOP,
      why_relevant:
        "Family violence requires safe, supportive, flexible assistance, safe communication, and avoiding repeated disclosure.",
    });
  }
  if (customerCase.arrears_amount > 0) {
    obligations.push({
      obligation: "Tailored assistance (payment difficulty framework)",
      source_basis: ERCOP,
      why_relevant: `The customer is a residential customer in arrears (AUD ${customerCase.arrears_amount.toFixed(0)}), so minimum flexible assistance to pay ongoing use, repay arrears, and lower costs is required before enforcement.`,
    });
  }
  if (
    arrearsOverThreshold &&
    !customerCase.assistance_information_provided &&
    !supportOptionsExplained
  ) {
    obligations.push({
      obligation: "Missed payment timing and assistance information",
      source_basis: ERCOP,
      why_relevant:
        "Arrears exceed AUD 55 including GST; assistance information must be provided and the customer given at least six business days to respond with a payment proposal.",
    });
  }
  if (hardshipDisclosed) {
    obligations.push({
      obligation: "Arrears hold for customers unable to pay ongoing use",
      source_basis: ERCOP,
      why_relevant:
        "The customer cannot pay ongoing usage, so assistance can include at least an initial six-month period with arrears repayment on hold.",
    });
    obligations.push({
      obligation: "No debt recovery or debt sale during assistance",
      source_basis: ERCOP,
      why_relevant:
        "Arrears recovery proceedings and debt sale must not commence or continue while the customer is receiving payment difficulty assistance.",
    });
    obligations.push({
      obligation: "Disconnection as a last resort",
      source_basis: ERCOP,
      why_relevant:
        "Disconnection for non-payment requires evidence that all required assistance, fairness, and record-keeping steps exist; they do not.",
    });
  }
  if (urgsRelevant) {
    obligations.push({
      obligation: "URGS screening and application assistance",
      source_basis: URGS,
      why_relevant:
        "Recent income decrease (job loss) is a URGS hardship criterion; if the customer requests an application, the account should be held with no disconnection action while the grant is considered.",
    });
  }
  if (complaintSignal) {
    obligations.push({
      obligation: "Complaint/dispute enforcement pause",
      source_basis: ERCOP,
      why_relevant:
        "Enforcement must pause until the complaint or dispute pathway is assessed and recorded.",
    });
  }

  // ---- Decision (priority order per spec 3A.7) -----------------------------
  const mandatoryChecksComplete =
    identityVerified &&
    reasonExplained &&
    amountExplained &&
    hardshipQuestionAsked &&
    (supportOptionsExplained || customerCase.assistance_information_provided);

  let decision: CopilotState["compliance_decision"];
  let decisionReason: string;

  if (transcript.length === 0) {
    decision = "insufficient_information";
    decisionReason =
      "No conversation has occurred yet. There is no evidence that any mandatory check has been completed.";
  } else if (lifeSupport) {
    decision = "block";
    decisionReason =
      "Life support is disclosed or flagged. Disconnection and restriction-related actions are hard-blocked; escalate immediately to the specialist process.";
  } else if (familyViolence) {
    decision = "escalate";
    decisionReason =
      "Family violence is disclosed or suspected. Escalate to the specialist safe-support pathway with safe, minimal-disclosure communication.";
  } else if (hardshipDisclosed) {
    decision = "escalate";
    decisionReason = referralMade
      ? "Customer disclosed recent income decrease and inability to pay — a payment difficulty indicator. Collections is paused and the case is being referred to hardship/support, with payment assistance and URGS options raised, in line with the Victorian payment difficulty framework."
      : "Customer disclosed recent income decrease and inability to pay, creating a payment difficulty indicator. Formal collections and disconnection pre-check must not proceed; escalate to the hardship/support pathway and screen for URGS.";
  } else if (complaintSignal) {
    decision = "block";
    decisionReason =
      "Complaint or dispute language is present. Downstream enforcement is blocked until the complaint/dispute pathway is assessed.";
  } else if (!mandatoryChecksComplete) {
    decision = transcript.length <= 1 ? "insufficient_information" : "block";
    decisionReason =
      "Mandatory pre-enforcement checks are incomplete. Collections and disconnection pre-check cannot proceed until identity, call purpose, amount, the payment difficulty check, and assistance information are all evidenced.";
  } else {
    decision = "allow";
    decisionReason =
      "All mandatory checks are evidenced and no hardship, vulnerability, family violence, life support, complaint, or dispute signal is present.";
  }

  // ---- Narrative fields -------------------------------------------------
  let summary: string;
  let intent: string;
  let nextAction: string;
  let wording: string;

  if (transcript.length === 0) {
    summary = "Call has not started.";
    intent = "Unknown.";
    nextAction = "Begin the call and verify the customer's identity.";
    wording =
      "Hi, this is [agent] calling from SUPA Energy. Before we continue, can I confirm your full name and date of birth?";
  } else if (lifeSupport) {
    summary =
      "Life support has been disclosed or flagged during a call about an overdue Victorian electricity balance.";
    intent = "Customer or household member depends on life support equipment.";
    nextAction =
      "Hard-block any disconnection or restriction action and escalate immediately to the specialist life support process.";
    wording =
      "Thank you for letting me know. Nothing will happen to your supply — I'm escalating this to our specialist team right away to make sure your account is properly protected.";
  } else if (familyViolence) {
    summary =
      "Family violence has been disclosed or is suspected during a call about an overdue Victorian electricity balance.";
    intent = "Customer needs safe, specialist support.";
    nextAction =
      "Escalate to the specialist safe-support pathway. Do not ask for unnecessary detail and follow safe communication practices.";
    wording =
      "Thank you for trusting me with that — you don't need to explain anything further. I'm going to connect you with our specialist support team who can help safely from here.";
  } else if (referralMade || disclosureRecorded) {
    summary =
      "Agent contacted Sarah Mitchell about an AUD 420 overdue Victorian electricity balance. Customer disclosed job loss and confirmed financial hardship. Agent paused collections, raised payment assistance and Utility Relief Grant options, recorded the disclosure, and is referring the case to the support team.";
    intent =
      "Customer is engaged and cooperative; she wants support options and reassurance that supply will not be disconnected.";
    nextAction =
      "Complete the referral to the hardship/support team, begin URGS screening, and confirm the next contact step with the customer before closing the call.";
    wording =
      "Our support team will talk you through payment assistance and the Utility Relief Grant. Nothing further will happen on the account in the meantime, and your hardship disclosure is recorded.";
  } else if (collectionsPaused) {
    summary =
      "Agent contacted Sarah Mitchell about an AUD 420 overdue Victorian electricity balance. Customer disclosed job loss and confirmed hardship. Agent has paused collections and is checking payment support and relief grant options.";
    intent =
      "Customer is worried about disconnection and needs a supported payment pathway.";
    nextAction =
      "Explain tailored assistance and URGS options, refer the case to the hardship/support team, and record the disclosure and outcome.";
    wording =
      "Thank you for telling me. I've paused any further action on the account, and I'll check what payment assistance and relief grant support may be available to you.";
  } else if (hardshipConfirmed) {
    summary =
      "Agent contacted Sarah Mitchell about an AUD 420 overdue Victorian electricity balance. Customer disclosed job loss and, when asked, confirmed financial hardship with uncertain future income.";
    intent = "Customer confirms she is in hardship and cannot commit to payment.";
    nextAction =
      "Pause collections and disconnection pre-check now, initiate the hardship assessment, explain payment assistance, and screen for the Utility Relief Grant Scheme.";
    wording =
      "Thanks for being open with me. I'm going to pause any collections action and look at the payment assistance and relief grant options available to you.";
  } else if (hardshipQuestionAsked) {
    summary =
      "Agent contacted Sarah Mitchell about an AUD 420 overdue Victorian electricity balance. Customer disclosed job loss; the agent has now asked the mandatory hardship question.";
    intent =
      "Customer has signalled inability to pay due to job loss; awaiting her response to the hardship question.";
    nextAction =
      "Confirm the hardship indication, then pause collections/disconnection pre-check, explain payment assistance, and screen for URGS.";
    wording =
      "Take your time. Whatever you tell me helps us find the right support option for your situation.";
  } else if (hardshipDisclosed) {
    summary =
      "Agent contacted Sarah Mitchell about an AUD 420 overdue Victorian electricity balance. Customer has just disclosed losing her job last month and struggling to pay rent.";
    intent = "Customer cannot pay today and is signalling payment difficulty.";
    nextAction =
      "Pause the collections/disconnection pre-check now, complete the hardship assessment question, and prepare to explain payment assistance and Utility Relief Grant options.";
    wording =
      "Thanks for telling me — I'm sorry you're dealing with that. Before we talk about payment, I want to check what support options may be available, including payment assistance and possible relief grant support. Are you experiencing financial hardship at the moment?";
  } else if (complaintSignal) {
    summary =
      "Customer has raised complaint or dispute language about the overdue Victorian electricity balance.";
    intent = "Customer disputes the bill or wishes to complain.";
    nextAction =
      "Classify the interaction as a potential complaint or dispute, pause enforcement, and record the details.";
    wording =
      "I want to make sure we get this right. Let me record your concern as a formal matter so it can be properly assessed before anything further happens on the account.";
  } else if (softDistress) {
    summary =
      "Agent verified identity and explained the AUD 420 overdue Victorian electricity balance. Customer acknowledges the debt and has hinted that things have been difficult lately.";
    intent = "Customer acknowledges the debt; early signs she may be struggling.";
    nextAction =
      "Before seeking payment, ask the mandatory payment difficulty and vulnerability question and be ready to explain available assistance.";
    wording =
      "Before we talk about payment — is anything affecting your ability to pay at the moment, such as a change in income or circumstances?";
  } else if (amountExplained) {
    summary =
      "Agent verified Sarah Mitchell's identity and explained the AUD 420 overdue balance on her Victorian electricity account.";
    intent = "Customer acknowledges the overdue balance.";
    nextAction =
      "Ask the mandatory payment difficulty and vulnerability question, and provide assistance information, before discussing collections.";
    wording =
      "Before we go further, I need to ask: is anything affecting your ability to pay at the moment?";
  } else if (identityVerified) {
    summary =
      "Call opened and the customer's identity has been verified as Sarah Mitchell.";
    intent = "Customer is cooperative; purpose of call not yet stated.";
    nextAction = "Explain the reason for the call and the overdue amount.";
    wording =
      "Thanks Sarah. I'm calling about your electricity account — I'd like to walk you through the current balance.";
  } else {
    summary = "Call has opened; the agent is requesting identity confirmation.";
    intent = "Not yet established.";
    nextAction = "Complete identity verification before discussing the account.";
    wording = "Can I confirm your full name and date of birth before we continue?";
  }

  // ---- Audit note ---------------------------------------------------------
  const auditParts: string[] = [];
  auditParts.push(
    `Outbound contact regarding overdue Victorian electricity balance of ${customerCase.currency} ${customerCase.arrears_amount.toFixed(
      0
    )} (${customerCase.days_since_pay_by_date} days since pay-by date).`
  );
  if (identityVerified) auditParts.push("Customer identity verified.");
  if (amountExplained)
    auditParts.push("Overdue amount and call purpose explained to the customer.");
  if (lifeSupport)
    auditParts.push(
      "Life support disclosed/flagged. Disconnection and restriction actions hard-blocked; specialist escalation initiated."
    );
  if (familyViolence)
    auditParts.push(
      "Family violence indicator present. Escalated to specialist safe-support pathway with safe communication."
    );
  if (hardshipDisclosed)
    auditParts.push(
      "Customer disclosed job loss last month, difficulty paying rent, and inability to make payment today; payment difficulty / financial hardship indicator detected."
    );
  if (hardshipQuestionAsked)
    auditParts.push("Agent asked the mandatory financial hardship question.");
  if (hardshipConfirmed)
    auditParts.push("Customer confirmed hardship with uncertain future income.");
  if (collectionsPaused)
    auditParts.push(
      "Collections action paused in line with the Victorian payment difficulty framework."
    );
  if (supportOptionsExplained)
    auditParts.push(
      "Payment assistance and Utility Relief Grant Scheme options raised with the customer."
    );
  if (referralMade)
    auditParts.push(
      "Case referred to hardship/support team for hardship assessment, payment assistance, and URGS screening."
    );
  if (complaintSignal)
    auditParts.push(
      "Complaint/dispute indicator recorded; enforcement paused pending assessment."
    );
  if (hardshipDisclosed || lifeSupport || familyViolence)
    auditParts.push(
      "Formal collections and disconnection pre-check must not proceed pending completion of the support workflow."
    );
  else if (decision === "block")
    auditParts.push(
      "Proposed collections/disconnection pre-check blocked pending completion of mandatory checks."
    );

  // ---- Change since last update -------------------------------------------
  let changeReason = "Initial assessment of the conversation.";
  if (previousState) {
    if (previousState.compliance_decision !== decision) {
      changeReason = `Decision changed from ${previousState.compliance_decision.toUpperCase()} to ${decision.toUpperCase()} based on the latest transcript line.`;
    } else if (previousState.completed_steps.length !== completed.length) {
      changeReason =
        "A mandatory step was evidenced in the latest transcript line.";
    } else if (previousState.detected_risks.length !== risks.length) {
      changeReason = "A new risk signal was detected in the latest transcript line.";
    } else {
      changeReason = "No material change; monitoring continues.";
    }
  }

  const confidence =
    transcript.length === 0
      ? 0.2
      : lifeSupport || hardshipDisclosed
        ? 0.95
        : Math.min(0.9, 0.5 + transcript.length * 0.05);

  return {
    running_summary: summary,
    customer_intent: intent,
    detected_risks: risks,
    compliance_decision: decision,
    decision_reason: decisionReason,
    applicable_obligations: obligations,
    completed_steps: completed,
    missing_steps: missing,
    recommended_next_action: nextAction,
    suggested_agent_wording: wording,
    audit_note_so_far: auditParts.join(" "),
    reason_for_change_since_last_update: changeReason,
    confidence: Number(confidence.toFixed(2)),
  };
}
