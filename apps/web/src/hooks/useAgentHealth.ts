// Custom hook pattern from SA-Arch.md §7: encapsulates fetch + loading +
// error state behind TanStack Query so components stay declarative — a
// component calls useAgentHealth() and gets back {data, isLoading, isError},
// never a raw useEffect/useState pair.
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/apiClient";
import type { AppStatus } from "@/components/common/StatusChip";

type HealthResponse = { status: "ok" };

export function useAgentHealth() {
  const query = useQuery({
    queryKey: ["agent-health"],
    queryFn: () => apiFetch<HealthResponse>("/api/health"),
    refetchInterval: 15_000,
  });

  const status: AppStatus = query.isPending ? "pending" : query.isError ? "down" : "ok";

  return { ...query, status };
}
