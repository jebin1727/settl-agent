"""Repository wrapping the PayPal Agent Toolkit. Calls `PayPalAPI.run()`
directly rather than going through the LangChain `Tool` wrapper (that layer
exists for letting an LLM *choose* which tool to call — our dispute/
settlement services already know exactly which PayPal operation they want,
so the extra indirection buys nothing here). See SA-Arch.md §4/§8: this is
the ONLY place in the codebase that talks to PayPal directly.
"""

import json
from decimal import Decimal
from typing import Any

from paypal_agent_toolkit.shared.api import PayPalAPI
from paypal_agent_toolkit.shared.configuration import Context
from paypal_agent_toolkit.shared.paypal_client import PayPalClient

from src.core.config import Settings, get_settings
from src.core.errors import PayPalToolError
from src.core.logging import get_logger

logger = get_logger(__name__)


class PayPalRepository:
    def __init__(self, settings: Settings | None = None):
        settings = settings or get_settings()
        context = Context(sandbox=settings.paypal_environment == "SANDBOX")
        self._api = PayPalAPI(
            client_id=settings.paypal_client_id, secret=settings.paypal_client_secret, context=context
        )
        # Webhook signature verification isn't one of the toolkit's fixed
        # tools (its tool list covers orders/invoices/disputes/etc, not
        # notifications) — this talks to PayPal's raw REST client directly
        # for that one call. Same credentials, same sandbox/live context.
        self._client = PayPalClient(
            client_id=settings.paypal_client_id, secret=settings.paypal_client_secret, context=context
        )

    def _run(self, method: str, params: dict[str, Any]) -> dict[str, Any]:
        logger.info("paypal_call", method=method)
        try:
            raw = self._api.run(method, params)
            result = json.loads(raw)
        except Exception as exc:
            logger.error("paypal_call_failed", method=method, error=str(exc))
            raise PayPalToolError(f"PayPal call '{method}' failed: {exc}") from exc

        if isinstance(result, dict) and "error" in result and "message" not in result:
            # PayPalTool swallows HTTP errors into the string body rather
            # than raising — surface them as a proper AppError instead of
            # letting a silent failure look like a successful response.
            logger.error("paypal_call_returned_error", method=method, result=result)
            raise PayPalToolError(f"PayPal call '{method}' returned an error: {result}")

        return result

    # -- Orders ------------------------------------------------------------

    def create_order(self, currency_code: str, items: list[dict[str, Any]]) -> dict[str, Any]:
        return self._run("create_order", {"currency_code": currency_code, "items": items})

    def get_order(self, order_id: str) -> dict[str, Any]:
        return self._run("get_order_details", {"order_id": order_id})

    # -- Invoices ------------------------------------------------------------

    def create_invoice(
        self,
        currency_code: str,
        items: list[dict[str, Any]],
        recipient_email: str,
        note: str | None = None,
    ) -> dict[str, Any]:
        return self._run(
            "create_invoice",
            {
                "currency_code": currency_code,
                "items": items,
                "primary_recipients": [{"billing_info": {"email_address": recipient_email}}],
                "note": note,
            },
        )

    def send_invoice(self, invoice_id: str) -> dict[str, Any]:
        return self._run("send_invoice", {"invoice_id": invoice_id})

    def get_invoice(self, invoice_id: str) -> dict[str, Any]:
        return self._run("get_invoice", {"invoice_id": invoice_id})

    def list_invoices(self) -> dict[str, Any]:
        return self._run("list_invoices", {})

    # -- Disputes ------------------------------------------------------------

    def list_disputes(self) -> dict[str, Any]:
        return self._run("list_disputes", {})

    def get_dispute(self, dispute_id: str) -> dict[str, Any]:
        return self._run("get_dispute", {"dispute_id": dispute_id})

    def accept_dispute_claim(self, dispute_id: str, note: str) -> dict[str, Any]:
        return self._run("accept_dispute_claim", {"dispute_id": dispute_id, "note": note})

    # -- Payouts ---------------------------------------------------------------

    def create_payout(
        self, recipient_email: str, amount: Decimal, currency_code: str, note: str, sender_batch_id: str
    ) -> dict[str, Any]:
        """The actual "pay the provider" action — Payouts isn't one of the
        toolkit's fixed tools (confirmed: its coverage is orders/invoices/
        disputes/subscriptions/products/shipment-tracking/reporting, not
        payouts), so this is a raw REST call via PayPalClient, same pattern
        as verify_webhook_signature. See settlement_service.py for why this
        replaced invoicing the provider — that billed them for their OWN
        earnings instead of paying them."""
        payload = {
            "sender_batch_header": {
                "sender_batch_id": sender_batch_id,
                "email_subject": "You've been paid via SettlAgent",
                "email_message": note,
            },
            "items": [
                {
                    "recipient_type": "EMAIL",
                    "amount": {"value": str(amount), "currency": currency_code},
                    "receiver": recipient_email,
                    "note": note,
                    "sender_item_id": sender_batch_id,
                }
            ],
        }
        try:
            return self._client.post("/v1/payments/payouts", payload)
        except Exception as exc:
            logger.error("payout_call_failed", error=str(exc))
            raise PayPalToolError(f"PayPal payout call failed: {exc}") from exc

    def get_payout(self, payout_batch_id: str) -> dict[str, Any]:
        try:
            return self._client.get(f"/v1/payments/payouts/{payout_batch_id}")
        except Exception as exc:
            logger.error("get_payout_failed", error=str(exc))
            raise PayPalToolError(f"PayPal get_payout call failed: {exc}") from exc

    # -- Webhooks ------------------------------------------------------------

    def verify_webhook_signature(self, headers: dict[str, str], webhook_id: str, event_body: dict[str, Any]) -> bool:
        """PayPal's own verification call — confirms a webhook payload was
        actually signed by PayPal, not forged. `headers` are the incoming
        request's headers (lowercased keys); PayPal expects the specific
        PAYPAL-* transmission headers it sent with the original delivery."""
        payload = {
            "auth_algo": headers.get("paypal-auth-algo"),
            "cert_url": headers.get("paypal-cert-url"),
            "transmission_id": headers.get("paypal-transmission-id"),
            "transmission_sig": headers.get("paypal-transmission-sig"),
            "transmission_time": headers.get("paypal-transmission-time"),
            "webhook_id": webhook_id,
            "webhook_event": event_body,
        }
        try:
            result = self._client.post("/v1/notifications/verify-webhook-signature", payload)
        except Exception as exc:
            logger.error("webhook_verification_call_failed", error=str(exc))
            raise PayPalToolError(f"Webhook signature verification call failed: {exc}") from exc

        return result.get("verification_status") == "SUCCESS"


def split_items(gross_amount: Decimal, currency_code: str, description: str) -> list[dict[str, Any]]:
    """Builds a single-line-item payload for an order/invoice from a gross
    amount — the split itself (platform fee vs. provider amount) is computed
    by settlement_service.calculate_split; this just shapes the PayPal
    request body."""
    return [
        {
            "name": description,
            "item_cost": float(gross_amount),
            "item_total": float(gross_amount),
            "quantity": 1,
        }
    ]
