from typing import Any

from pydantic import BaseModel


class PayPalWebhookEventDTO(BaseModel):
    """PayPal's webhook envelope — only the fields the receiver actually
    reads; PayPal sends more (create_time, summary, links, etc.) that we
    don't need. See api/v1/webhooks.py."""

    id: str
    event_type: str
    resource_type: str | None = None
    resource: dict[str, Any] = {}
