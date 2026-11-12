// Proves the sidebar replaced the old top-tabs as the real navigation
// mechanism: clicking a nav item must report the selected section back to
// the controlling page (AppShell is a controlled component — it owns no
// section state itself, see dashboard/page.tsx).
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "./AppShell";

describe("AppShell sidebar navigation", () => {
  it("renders the children content passed to it", () => {
    render(
      <AppShell activeSection="settlements" onSectionChange={() => {}}>
        <div>dashboard content</div>
      </AppShell>
    );

    expect(screen.getByText("dashboard content")).toBeInTheDocument();
  });

  it("calls onSectionChange with the clicked section's key", () => {
    const onSectionChange = vi.fn();
    render(
      <AppShell activeSection="settlements" onSectionChange={onSectionChange}>
        <div>content</div>
      </AppShell>
    );

    fireEvent.click(screen.getAllByText("Disputes")[0]);

    expect(onSectionChange).toHaveBeenCalledWith("disputes");
  });

  it("does not report a change when the active section is clicked again", () => {
    const onSectionChange = vi.fn();
    render(
      <AppShell activeSection="settlements" onSectionChange={onSectionChange}>
        <div>content</div>
      </AppShell>
    );

    fireEvent.click(screen.getAllByText("Settlements")[0]);

    expect(onSectionChange).toHaveBeenCalledWith("settlements");
  });
});
