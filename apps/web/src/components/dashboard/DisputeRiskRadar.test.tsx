import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DisputeRiskRadar } from "./DisputeRiskRadar";
import type { DisputeDTO } from "@/types/api";

function dispute(overrides: Partial<DisputeDTO>): DisputeDTO {
  return {
    id: "d1",
    paypal_dispute_id: "PP-D-1",
    status: "escalated",
    risk_score: "0.45",
    decision: "escalate",
    rationale: "Some reasoning",
    risk_breakdown: {
      fraud_risk: 0.2,
      policy_risk: 0.4,
      chargeback_risk: 0.3,
      identity_risk: 0.1,
      merchant_risk: 0.5,
    },
    amount: "220.00",
    currency_code: "USD",
    reason: "SIGNIFICANTLY_NOT_AS_DESCRIBED",
    created_at: "2026-11-12T10:00:00Z",
    resolved_at: null,
    ...overrides,
  };
}

describe("DisputeRiskRadar", () => {
  it("shows an empty state when no dispute has a risk breakdown yet", () => {
    render(<DisputeRiskRadar disputes={[dispute({ risk_breakdown: null, risk_score: null })]} />);

    expect(screen.getByText("No triaged disputes yet.")).toBeInTheDocument();
  });

  it("renders the radar and risk score card for the most recently triaged dispute", () => {
    render(<DisputeRiskRadar disputes={[dispute({})]} />);

    expect(screen.getByRole("img", { name: /Dispute risk radar across five factors/ })).toBeInTheDocument();
    expect(screen.getByText("Risk Score")).toBeInTheDocument();
    expect(screen.getByText("0.45")).toBeInTheDocument();
    expect(screen.getByText("Latest triaged: PP-D-1")).toBeInTheDocument();
  });

  it("picks the most recent dispute by created_at when several have a breakdown", () => {
    render(
      <DisputeRiskRadar
        disputes={[
          dispute({ id: "older", paypal_dispute_id: "PP-OLD", created_at: "2026-11-01T10:00:00Z" }),
          dispute({ id: "newer", paypal_dispute_id: "PP-NEW", created_at: "2026-11-12T10:00:00Z" }),
        ]}
      />
    );

    expect(screen.getByText("Latest triaged: PP-NEW")).toBeInTheDocument();
  });

  it("shows a 'not enough history' fallback instead of a fabricated trend when there's no prior week of data", () => {
    render(<DisputeRiskRadar disputes={[dispute({})]} />);

    expect(screen.getByText(/Not enough history yet/)).toBeInTheDocument();
  });
});
