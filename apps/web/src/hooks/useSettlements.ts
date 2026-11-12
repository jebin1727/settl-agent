// Custom hook pattern (SA-Arch.md §7): encapsulates fetch + cache + error
// state behind TanStack Query. Components call useSettlements() and get
// back {data, isLoading, isError} — never a raw useEffect/useState pair.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/apiClient";
import type { CreateSettlementRequest, SettlementDTO } from "@/types/api";

const SETTLEMENTS_KEY = ["settlements"];

export function useSettlements() {
  return useQuery({
    queryKey: SETTLEMENTS_KEY,
    queryFn: () => apiFetch<SettlementDTO[]>("/api/settlements"),
    refetchInterval: 10_000,
  });
}

export function useCreateSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateSettlementRequest) =>
      apiFetch<SettlementDTO>("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTLEMENTS_KEY });
    },
  });
}
