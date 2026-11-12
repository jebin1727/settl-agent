// Thin wrapper over AG Grid with app-wide defaults — feature components
// import THIS, not ag-grid-react directly, so grid behavior (sorting,
// filtering, theme) stays consistent everywhere instead of each screen
// reconfiguring its own. See SA-Arch.md §6.
"use client";

import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import Box from "@mui/material/Box";

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({
  accentColor: "#1E7A5F",
  borderRadius: 8,
});

interface DataTableProps<T> {
  rowData: T[];
  columnDefs: ColDef<T>[];
  height?: number;
  getRowId?: (row: T) => string;
}

export function DataTable<T>({ rowData, columnDefs, height = 420, getRowId }: DataTableProps<T>) {
  return (
    <Box sx={{ height, width: "100%" }}>
      <AgGridReact<T>
        rowData={rowData}
        columnDefs={columnDefs}
        theme={theme}
        defaultColDef={{
          sortable: true,
          resizable: true,
          filter: true,
          flex: 1,
          minWidth: 110,
          // Without this, a row tall enough to fit a wrapped/autoHeight
          // column (e.g. DisputesPanel's "Agent reasoning") leaves every
          // other cell in that row anchored to the top with visible dead
          // space below it instead of centered in the row.
          cellStyle: { display: "flex", alignItems: "center" },
        }}
        getRowId={getRowId ? (params) => getRowId(params.data) : undefined}
        animateRows
      />
    </Box>
  );
}
