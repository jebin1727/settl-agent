"use client";

import { AnimatePresence, m } from "framer-motion";
import { useState } from "react";

import { AgentActivityPage } from "@/components/agent-activity/AgentActivityPage";
import { AuditReportsPage } from "@/components/audit-reports/AuditReportsPage";
import { CommandCenterPage } from "@/components/command-center/CommandCenterPage";
import { DecisionReplayPage } from "@/components/decision-replay/DecisionReplayPage";
import { DisputesPanel } from "@/components/disputes/DisputesPanel";
import { AppShell, type DashboardSection } from "@/components/layout/AppShell";
import { SettlementsPanel } from "@/components/settlements/SettlementsPanel";
import { ErrorBoundaryProvider } from "@/providers/ErrorBoundaryProvider";

const PANEL_TRANSITION = { duration: 0.18 };

export default function DashboardPage() {
  const [section, setSection] = useState<DashboardSection>("command_center");
  // Lifted here so "View Decision Replay" on a dispute case card can jump
  // straight to that dispute's replay, instead of just switching tabs.
  const [replayDisputeId, setReplayDisputeId] = useState<string | null>(null);

  return (
    <AppShell activeSection={section} onSectionChange={setSection}>
      <ErrorBoundaryProvider>
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={section}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={PANEL_TRANSITION}
          >
            {section === "command_center" && <CommandCenterPage onNavigate={setSection} />}
            {section === "settlements" && <SettlementsPanel />}
            {section === "disputes" && (
              <DisputesPanel
                onViewReplay={(disputeId) => {
                  setReplayDisputeId(disputeId);
                  setSection("decision_replay");
                }}
              />
            )}
            {section === "decision_replay" && <DecisionReplayPage initialDisputeId={replayDisputeId} />}
            {section === "activity" && <AgentActivityPage />}
            {section === "audit_reports" && <AuditReportsPage />}
          </m.div>
        </AnimatePresence>
      </ErrorBoundaryProvider>
    </AppShell>
  );
}
