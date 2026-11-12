import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/apiClient";
import type { DisputeDTO, DisputeTriageResult, SimulateDisputeRequest } from "@/types/api";

const DISPUTES_KEY = ["disputes"];

export function useDisputes() {
  return useQuery({
    queryKey: DISPUTES_KEY,
    queryFn: () => apiFetch<DisputeDTO[]>("/api/disputes"),
    refetchInterval: 10_000,
  });
}

export function useTriageDispute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (disputeId: string) =>
      apiFetch<DisputeTriageResult>(`/api/disputes/${encodeURIComponent(disputeId)}/triage`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DISPUTES_KEY });
    },
  });
}

export function useSimulateDispute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SimulateDisputeRequest) =>
      apiFetch<DisputeTriageResult>("/api/disputes/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DISPUTES_KEY });
    },
  });
}
