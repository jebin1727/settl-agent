"use client";

import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { useMemo } from "react";

import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { TableSkeleton } from "@/components/common/TableSkeleton";
import { VolumeTrend } from "@/components/dashboard/VolumeTrend";
import { useSettlements } from "@/hooks/useSettlements";
import type { SettlementDTO } from "@/types/api";

import { CreateSettlementForm } from "./CreateSettlementForm";

export function SettlementsPanel() {
  const { data, isLoading } = useSettlements();

  // useMemo here is warranted (SA-Arch.md §7): columnDefs is an array of
  // objects recreated on every render otherwise, which AG Grid treats as a
  // prop change and re-processes unnecessarily.
  const columnDefs = useMemo<ColDef<SettlementDTO>[]>(
    () => [
      { field: "id", headerName: "Settlement", valueFormatter: (p) => p.value?.slice(0, 8) ?? "" },
      { field: "gross_amount", headerName: "Gross (USD)" },
      { field: "platform_fee_amount", headerName: "Platform fee" },
      { field: "provider_amount", headerName: "Provider gets" },
      {
        field: "status",
        headerName: "Status",
        cellRenderer: (params: ICellRendererParams<SettlementDTO>) =>
          params.value ? <StatusBadge status={params.value} /> : null,
      },
      { field: "paypal_payout_batch_id", headerName: "PayPal Payout Batch" },
      {
        field: "created_at",
        headerName: "Created",
        valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleString() : ""),
      },
    ],
    []
  );

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <VolumeTrend />
      </Paper>
      <Typography variant="h6">New settlement</Typography>
      <CreateSettlementForm />
      <Typography variant="h6">Settlement ledger</Typography>
      {isLoading ? (
        <TableSkeleton />
      ) : (
        <DataTable<SettlementDTO>
          rowData={data ?? []}
          columnDefs={columnDefs}
          getRowId={(row) => row.id}
        />
      )}
    </Stack>
  );
}
