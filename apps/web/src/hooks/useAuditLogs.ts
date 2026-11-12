import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/apiClient";
import type { AuditLogDTO } from "@/types/api";

export function useAuditLogs() {
  return useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => apiFetch<AuditLogDTO[]>("/api/audit-logs"),
    refetchInterval: 10_000,
  });
}
