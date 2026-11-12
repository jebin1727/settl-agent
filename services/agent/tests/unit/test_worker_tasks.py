"""Unit test for the webhook-triggered worker job — the DisputeService
itself is already covered exhaustively by test_dispute_service.py; this
only proves the job wires a fresh DB session, calls the service, and
commits/rolls back correctly."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.schemas.dispute_dto import DisputeTriageResultDTO
from src.workers.tasks import triage_dispute_job


async def test_triage_dispute_job_commits_on_success():
    fake_session = AsyncMock()
    fake_session_cm = MagicMock()
    fake_session_cm.__aenter__ = AsyncMock(return_value=fake_session)
    fake_session_cm.__aexit__ = AsyncMock(return_value=False)

    fake_result = DisputeTriageResultDTO(
        dispute_id="PP-D-1", risk_score="0.1", decision="accept_claim", rationale="ok", status="auto_resolved"
    )

    with (
        patch("src.workers.tasks.SessionLocal", return_value=fake_session_cm),
        patch("src.workers.tasks.DisputeService") as mock_service_cls,
    ):
        mock_service_cls.return_value.triage = AsyncMock(return_value=fake_result)

        status = await triage_dispute_job(None, "PP-D-1")

    assert status == "auto_resolved"
    fake_session.commit.assert_awaited_once()
    fake_session.rollback.assert_not_awaited()


async def test_triage_dispute_job_rolls_back_on_failure():
    fake_session = AsyncMock()
    fake_session_cm = MagicMock()
    fake_session_cm.__aenter__ = AsyncMock(return_value=fake_session)
    fake_session_cm.__aexit__ = AsyncMock(return_value=False)

    with (
        patch("src.workers.tasks.SessionLocal", return_value=fake_session_cm),
        patch("src.workers.tasks.DisputeService") as mock_service_cls,
    ):
        mock_service_cls.return_value.triage = AsyncMock(side_effect=RuntimeError("boom"))

        with pytest.raises(RuntimeError):
            await triage_dispute_job(None, "PP-D-1")

    fake_session.rollback.assert_awaited_once()
    fake_session.commit.assert_not_awaited()
