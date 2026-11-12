// Confirms the loading state shows a grid-shaped Skeleton instead of
// either a bare "Loading…" string or an empty AG Grid — see
// components/common/TableSkeleton.tsx. useSettlements/useCreateSettlement
// are mocked so this needs no QueryClientProvider or network, and with
// isLoading true the real DataTable (AG Grid) branch never renders.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SettlementsPanel } from "./SettlementsPanel";

vi.mock("@/hooks/useSettlements", () => ({
  useSettlements: () => ({ data: [], isLoading: true }),
  useCreateSettlement: () => ({ mutate: vi.fn(), isPending: false, isError: false, isSuccess: false }),
}));

describe("SettlementsPanel", () => {
  it("shows the table skeleton instead of the grid while settlements are loading", () => {
    render(<SettlementsPanel />);

    expect(screen.getByTestId("table-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });
});
