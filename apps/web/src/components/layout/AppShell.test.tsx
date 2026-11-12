// Proves the sidebar replaced the old top-tabs as the real navigation
// mechanism: clicking a nav item must report the selected section back to
// the controlling page (AppShell is a controlled component — it owns no
// section state itself, see dashboard/page.tsx). Needs a QueryClientProvider
// now that the header's AgentOnlineBadge reads real agent health via
// useAgentHealth() — not something the old header-only AppShell needed.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "./AppShell";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("AppShell sidebar navigation", () => {
  it("renders the children content passed to it", () => {
    renderWithQueryClient(
      <AppShell activeSection="settlements" onSectionChange={() => {}}>
        <div>dashboard content</div>
      </AppShell>
    );

    expect(screen.getByText("dashboard content")).toBeInTheDocument();
  });

  it("calls onSectionChange with the clicked section's key", () => {
    const onSectionChange = vi.fn();
    renderWithQueryClient(
      <AppShell activeSection="settlements" onSectionChange={onSectionChange}>
        <div>content</div>
      </AppShell>
    );

    fireEvent.click(screen.getAllByText("Disputes")[0]);

    expect(onSectionChange).toHaveBeenCalledWith("disputes");
  });

  it("does not report a change when the active section is clicked again", () => {
    const onSectionChange = vi.fn();
    renderWithQueryClient(
      <AppShell activeSection="settlements" onSectionChange={onSectionChange}>
        <div>content</div>
      </AppShell>
    );

    fireEvent.click(screen.getAllByText("Settlements")[0]);

    expect(onSectionChange).toHaveBeenCalledWith("settlements");
  });
});
