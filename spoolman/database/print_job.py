"""Helper functions for interacting with print_job database objects."""

import logging
from datetime import datetime, timezone

import sqlalchemy
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from spoolman.api.v1.models import EventType, PrintJob, PrintJobEvent
from spoolman.database import models, spool
from spoolman.exceptions import ItemNotFoundError
from spoolman.ws import websocket_manager

logger = logging.getLogger(__name__)


def utc_timezone_naive(dt: datetime) -> datetime:
    """Convert a datetime object to UTC and remove timezone info."""
    return dt.astimezone(tz=timezone.utc).replace(tzinfo=None)


async def create(
    *,
    db: AsyncSession,
    spool_id: int,
    name: str,
    weight_used: float,
    started_at: datetime | None = None,
    completed_at: datetime | None = None,
    cost: float | None = None,
    revenue: float | None = None,
    notes: str | None = None,
    external_reference: str | None = None,
) -> models.PrintJob:
    """Add a new print job to the database."""
    # Verify spool exists
    spool_item = await spool.get_by_id(db, spool_id)

    # Convert datetime values to UTC and remove timezone info
    if started_at is not None:
        started_at = utc_timezone_naive(started_at)
    if completed_at is not None:
        completed_at = utc_timezone_naive(completed_at)

    # Calculate cost if not provided
    if cost is None and weight_used > 0:
        # Calculate cost based on spool price or filament price
        price_per_gram = None
        if spool_item.price is not None and spool_item.initial_weight is not None and spool_item.initial_weight > 0:
            price_per_gram = spool_item.price / spool_item.initial_weight
        elif spool_item.filament.price is not None and spool_item.filament.weight is not None and spool_item.filament.weight > 0:
            price_per_gram = spool_item.filament.price / spool_item.filament.weight

        if price_per_gram is not None:
            cost = weight_used * price_per_gram

    print_job = models.PrintJob(
        spool=spool_item,
        registered=datetime.utcnow().replace(microsecond=0),
        name=name,
        weight_used=weight_used,
        started_at=started_at,
        completed_at=completed_at,
        cost=cost,
        revenue=revenue,
        notes=notes,
        external_reference=external_reference,
    )
    db.add(print_job)
    await db.commit()
    await print_job_changed(print_job, EventType.ADDED)
    return print_job


async def get_by_id(db: AsyncSession, print_job_id: int) -> models.PrintJob:
    """Get a print job object from the database by the unique ID."""
    print_job = await db.get(
        models.PrintJob,
        print_job_id,
        options=[joinedload("*")],  # Load all nested objects as well
    )
    if print_job is None:
        raise ItemNotFoundError(f"No print job with ID {print_job_id} found.")
    return print_job


async def find(
    *,
    db: AsyncSession,
    spool_id: int | None = None,
    name: str | None = None,
    limit: int | None = None,
    offset: int = 0,
) -> tuple[list[models.PrintJob], int]:
    """Find a list of print job objects by search criteria.

    Returns a tuple containing the list of items and the total count of matching items.
    """
    stmt = (
        sqlalchemy.select(models.PrintJob)
        .join(models.PrintJob.spool)
        .options(joinedload(models.PrintJob.spool).joinedload(models.Spool.filament))
    )

    if spool_id is not None:
        stmt = stmt.where(models.PrintJob.spool_id == spool_id)

    if name is not None:
        stmt = stmt.where(models.PrintJob.name.ilike(f"%{name}%"))

    # Order by registered date descending (newest first)
    stmt = stmt.order_by(models.PrintJob.registered.desc())

    total_count = None

    if limit is not None:
        total_count_stmt = stmt.with_only_columns(sqlalchemy.func.count(), maintain_column_froms=True)
        total_count = (await db.execute(total_count_stmt)).scalar()

        stmt = stmt.offset(offset).limit(limit)

    rows = await db.execute(
        stmt,
        execution_options={"populate_existing": True},
    )
    result = list(rows.unique().scalars().all())
    if total_count is None:
        total_count = len(result)

    return result, total_count


async def update(
    *,
    db: AsyncSession,
    print_job_id: int,
    data: dict,
) -> models.PrintJob:
    """Update the fields of a print job object."""
    print_job = await get_by_id(db, print_job_id)
    for k, v in data.items():
        if isinstance(v, datetime):
            setattr(print_job, k, utc_timezone_naive(v))
        else:
            setattr(print_job, k, v)
    await db.commit()
    await print_job_changed(print_job, EventType.UPDATED)
    return print_job


async def delete(db: AsyncSession, print_job_id: int) -> None:
    """Delete a print job object."""
    print_job = await get_by_id(db, print_job_id)
    await print_job_changed(print_job, EventType.DELETED)
    await db.delete(print_job)
    await db.commit()


async def print_job_changed(print_job: models.PrintJob, typ: EventType) -> None:
    """Notify websocket clients that a print job has changed."""
    try:
        await websocket_manager.send(
            ("print_job", str(print_job.id)),
            PrintJobEvent(
                type=typ,
                resource="print_job",
                date=datetime.utcnow(),
                payload=PrintJob.from_db(print_job),
            ),
        )
    except Exception:
        # Important to have a catch-all here since we don't want to stop the call if this fails.
        logger.exception("Failed to send websocket message")
