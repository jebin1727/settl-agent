import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DisputeRiskStrip } from "./DisputeRiskStrip";
import type { DisputeDTO } from "@/types/api";

function dispute(overrides: Partial<DisputeDTO>): DisputeDTO {
  return {
    id: "d1",
    paypal_dispute_id: "PP-D-1",
    status: "auto_resolved",
    risk_score: "0.1",
    decision: "accept_claim",
    rationale: null,
    created_at: "2026-11-03T10:00:00Z",
    resolved_at: null,
    ...overrides,
  };
}

describe("DisputeRiskStrip", () => {
  it("shows an empty state when there are no triaged disputes", () => {
    render(<DisputeRiskStrip disputes={[]} />);

    expect(screen.getByText("No triaged disputes yet.")).toBeInTheDocument();
  });

  it("ignores untriaged (open) disputes since they have no risk score decision yet", () => {
    render(<DisputeRiskStrip disputes={[dispute({ id: "d1", status: "open", risk_score: null })]} />);

    expect(screen.getByText("No triaged disputes yet.")).toBeInTheDocument();
  });

  it("plots triaged disputes and labels the auto-resolve threshold", () => {
    render(
      <DisputeRiskStrip
        disputes={[
          dispute({ id: "d1", status: "auto_resolved", risk_score: "0.1" }),
          dispute({ id: "d2", status: "escalated", risk_score: "0.8" }),
        ]}
      />
    );

    expect(
      screen.getByRole("img", { name: /Dispute risk scores against the auto-resolve threshold/ })
    ).toBeInTheDocument();
    expect(screen.getByText("Auto-resolved")).toBeInTheDocument();
    expect(screen.getByText("Escalated")).toBeInTheDocument();
  });
});
