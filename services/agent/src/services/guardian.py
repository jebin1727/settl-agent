"""Payment Guardian: a pre-payout risk check on every settlement, BEFORE
any real PayPal money moves.

Deliberately rule-based and transparent, not a trained model — there is no
labeled fraud data here, and a fake "ML score" would be exactly the kind of
theater to avoid. Every flag is a named rule computed from real settlement
history, so a human reviewing a held payout sees precisely why it was held.
Pure function (no DB, no HTTP): trivially unit-testable.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from statistics import median

HOLD_SCORE = Decimal("0.4")

# rule -> weight toward the 0-1 score
WEIGHTS: dict[str, Decimal] = {
    "LARGE_AMOUNT": Decimal("0.5"),
    "AMOUNT_ANOMALY": Decimal("0.4"),
    "VELOCITY": Decimal("0.4"),
    "HIGH_FEE": Decimal("0.4"),
    "NEW_RECIPIENT": Decimal("0.3"),
}

MAX_FEE_PERCENT = Decimal("30")
VELOCITY_COUNT = 3
VELOCITY_WINDOW = timedelta(hours=1)
ANOMALY_MULTIPLE = Decimal("3")
ANOMALY_MIN_HISTORY = 3


@dataclass(frozen=True)
class PriorSettlement:
    gross_amount: Decimal
    recipient_email: str | None
    created_at: datetime


@dataclass(frozen=True)
class GuardianAssessment:
    score: Decimal
    flags: list[dict]
    hold: bool


def assess_settlement(
    *,
    gross_amount: Decimal,
    fee_percent: Decimal,
    recipient_email: str,
    history: list[PriorSettlement],
    review_threshold: Decimal,
    now: datetime | None = None,
) -> GuardianAssessment:
    now = now or datetime.now(timezone.utc)
    flags: list[dict] = []

    if gross_amount >= review_threshold:
        flags.append(
            {"rule": "LARGE_AMOUNT", "detail": f"${gross_amount} is at or above the ${review_threshold} review limit"}
        )

    amounts = [h.gross_amount for h in history]
    if len(amounts) >= ANOMALY_MIN_HISTORY:
        typical = Decimal(str(median(amounts)))
        if typical > 0 and gross_amount > typical * ANOMALY_MULTIPLE:
            flags.append(
                {
                    "rule": "AMOUNT_ANOMALY",
                    "detail": f"${gross_amount} is over {ANOMALY_MULTIPLE}x the median settlement (${typical})",
                }
            )

    email = recipient_email.lower()
    same_recipient = [h for h in history if (h.recipient_email or "").lower() == email]
    recent = [h for h in same_recipient if now - h.created_at <= VELOCITY_WINDOW]
    if len(recent) >= VELOCITY_COUNT:
        flags.append(
            {"rule": "VELOCITY", "detail": f"{len(recent)} payouts to this recipient in the last hour"}
        )

    if fee_percent > MAX_FEE_PERCENT:
        flags.append({"rule": "HIGH_FEE", "detail": f"{fee_percent}% platform fee exceeds the {MAX_FEE_PERCENT}% norm"})

    # Only meaningful once a recipient book exists; before that every
    # recipient would trivially be "new".
    known = {(h.recipient_email or "").lower() for h in history if h.recipient_email}
    if known and email not in known:
        flags.append({"rule": "NEW_RECIPIENT", "detail": "First payout to this PayPal email"})

    score = min(sum((WEIGHTS[f["rule"]] for f in flags), Decimal("0")), Decimal("1"))
    return GuardianAssessment(score=score, flags=flags, hold=score >= HOLD_SCORE)
