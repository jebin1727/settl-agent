// Proves the testing pipeline for reusable components: render, assert on
// what the user would actually see. Every common/ component should carry a
// test like this — they're used everywhere, so they're exactly what's worth
// testing (SA-Arch.md §11).
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusChip } from "./StatusChip";

describe("StatusChip", () => {
  it("renders the operational label for ok status", () => {
    render(<StatusChip status="ok" />);
    expect(screen.getByText("Operational")).toBeInTheDocument();
  });

  it("renders the down label for down status", () => {
    render(<StatusChip status="down" />);
    expect(screen.getByText("Down")).toBeInTheDocument();
  });

  it("renders a pending label while checking", () => {
    render(<StatusChip status="pending" />);
    expect(screen.getByText("Checking…")).toBeInTheDocument();
  });
});
