// Simulates the "job marked complete" trigger that would normally come from
// a webhook — a direct form for now. See settlement_service.create_and_payout
// on the backend for what happens after submit (the provider's share is
// PAID to them via PayPal Payouts, not invoiced to them).
"use client";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { m } from "framer-motion";
import { useState, type FormEvent } from "react";

import { useCreateSettlement } from "@/hooks/useSettlements";

export function CreateSettlementForm() {
  const [grossAmount, setGrossAmount] = useState("100.00");
  const [feePercent, setFeePercent] = useState("10");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [description, setDescription] = useState("");

  const createSettlement = useCreateSettlement();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    createSettlement.mutate({
      gross_amount: grossAmount,
      platform_fee_percent: feePercent,
      recipient_email: recipientEmail,
      description,
    });
  };

  return (
    <Stack component="form" onSubmit={handleSubmit} spacing={2} sx={{ maxWidth: 420 }}>
      <TextField
        label="Gross amount (USD)"
        value={grossAmount}
        onChange={(e) => setGrossAmount(e.target.value)}
        size="small"
        required
      />
      <TextField
        label="Platform fee %"
        value={feePercent}
        onChange={(e) => setFeePercent(e.target.value)}
        size="small"
        required
      />
      <TextField
        label="Provider's PayPal email (gets paid directly)"
        value={recipientEmail}
        onChange={(e) => setRecipientEmail(e.target.value)}
        size="small"
        required
      />
      <TextField
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        size="small"
        required
      />
      <m.div style={{ display: "inline-block" }} whileTap={{ scale: 0.97 }}>
        <Button type="submit" variant="contained" disabled={createSettlement.isPending}>
          {createSettlement.isPending ? "Paying out…" : "Mark job complete → pay provider via PayPal"}
        </Button>
      </m.div>
      {createSettlement.isError && (
        <Alert severity="error">{(createSettlement.error as Error).message}</Alert>
      )}
      {createSettlement.isSuccess && createSettlement.data.status === "awaiting_approval" && (
        <Alert severity="warning">
          Payment Guardian held this payout for approval (risk {createSettlement.data.risk_score}) — no money has
          moved. Approve it in the queue above.
        </Alert>
      )}
      {createSettlement.isSuccess && createSettlement.data.status === "paid_out" && (
        <Alert severity="success">Guardian cleared it — provider paid via PayPal sandbox Payouts.</Alert>
      )}
    </Stack>
  );
}
