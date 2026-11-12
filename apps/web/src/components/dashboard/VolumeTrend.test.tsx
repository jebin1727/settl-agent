// Two things worth proving separately: the aggregation logic (pure, no
// rendering) and the component's three visual states (empty / single-day /
// multi-day — the single-day case is the one easy to get wrong, see
// VolumeTrend.tsx's SinglePointState). useSettlements is mocked so this
// doesn't need a real QueryClientProvider or network.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { aggregateDailyVolume, VolumeTrend } from "./VolumeTrend";

const useSettlementsMock = vi.fn();
vi.mock("@/hooks/useSettlements", () => ({
  useSettlements: () => useSettlementsMock(),
}));

describe("aggregateDailyVolume", () => {
  it("groups settlements by day and sums gross amount", () => {
    const points = aggregateDailyVolume([
      { created_at: "2026-11-01T10:00:00Z", gross_amount: "40.00" },
      { created_at: "2026-11-01T18:00:00Z", gross_amount: "10.00" },
      { created_at: "2026-11-02T09:00:00Z", gross_amount: "25.00" },
    ]);

    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ date: "2026-11-01", total: 50 });
    expect(points[1]).toMatchObject({ date: "2026-11-02", total: 25 });
  });

  it("returns points sorted chronologically regardless of input order", () => {
    const points = aggregateDailyVolume([
      { created_at: "2026-11-05T00:00:00Z", gross_amount: "5.00" },
      { created_at: "2026-11-01T00:00:00Z", gross_amount: "1.00" },
    ]);

    expect(points.map((p) => p.date)).toEqual(["2026-11-01", "2026-11-05"]);
  });

  it("returns an empty array for no settlements", () => {
    expect(aggregateDailyVolume([])).toEqual([]);
  });
});

describe("VolumeTrend", () => {
  it("shows the empty state when there are no settlements", () => {
    useSettlementsMock.mockReturnValue({ data: [] });

    render(<VolumeTrend />);

    expect(screen.getByText("No data yet.")).toBeInTheDocument();
  });

  it("shows a single-point flat state instead of a broken-looking chart for one day of data", () => {
    useSettlementsMock.mockReturnValue({
      data: [{ created_at: "2026-11-03T10:00:00Z", gross_amount: "60.00" }],
    });

    render(<VolumeTrend />);

    expect(screen.getByText(/Only one day of data so far/)).toBeInTheDocument();
    expect(screen.getByText("$60.00")).toBeInTheDocument();
  });

  it("renders a line chart once there are multiple days of data", () => {
    useSettlementsMock.mockReturnValue({
      data: [
        { created_at: "2026-11-01T10:00:00Z", gross_amount: "40.00" },
        { created_at: "2026-11-02T10:00:00Z", gross_amount: "60.00" },
      ],
    });

    render(<VolumeTrend />);

    expect(screen.getByRole("img", { name: /Settlement gross volume by day/ })).toBeInTheDocument();
  });
});
