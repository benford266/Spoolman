"""Print job related endpoints."""

import asyncio
import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from spoolman.api.v1.models import Message, PrintJob, PrintJobEvent
from spoolman.database import print_job
from spoolman.database.database import get_db_session
from spoolman.ws import websocket_manager

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/print-job",
    tags=["print_job"],
)

# ruff: noqa: D103


class PrintJobParameters(BaseModel):
    spool_id: int = Field(description="The ID of the spool used for this print job.")
    name: str = Field(max_length=128, description="Name/description of the print job.", examples=["Benchy"])
    weight_used: float = Field(ge=0, description="Weight of filament used for this job in grams.", examples=[15.5])
    started_at: datetime | None = Field(None, description="When the print job was started.")
    completed_at: datetime | None = Field(None, description="When the print job was completed.")
    cost: float | None = Field(
        None,
        ge=0,
        description="Cost of filament used for this job. If not provided, will be calculated from spool/filament price.",
        examples=[0.31],
    )
    revenue: float | None = Field(
        None,
        ge=0,
        description="Revenue from this job for ROI tracking.",
        examples=[5.0],
    )
    notes: str | None = Field(None, max_length=1024, description="Free text notes about this print job.", examples=[""])
    external_reference: str | None = Field(
        None,
        max_length=256,
        description="External reference ID.",
        examples=["benchy_v2.gcode"],
    )


class PrintJobUpdateParameters(BaseModel):
    spool_id: int | None = Field(None, description="The ID of the spool used for this print job.")
    name: str | None = Field(None, max_length=128, description="Name/description of the print job.")
    weight_used: float | None = Field(None, ge=0, description="Weight of filament used for this job in grams.")
    started_at: datetime | None = Field(None, description="When the print job was started.")
    completed_at: datetime | None = Field(None, description="When the print job was completed.")
    cost: float | None = Field(None, ge=0, description="Cost of filament used for this job.")
    revenue: float | None = Field(None, ge=0, description="Revenue from this job for ROI tracking.")
    notes: str | None = Field(None, max_length=1024, description="Free text notes about this print job.")
    external_reference: str | None = Field(None, max_length=256, description="External reference ID.")


@router.get(
    "",
    name="Find print jobs",
    description=(
        "Get a list of print jobs that matches the search query. "
        "A websocket is served on the same path to listen for updates to any print job, or added or deleted jobs. "
        "See the HTTP Response code 299 for the content of the websocket messages."
    ),
    response_model_exclude_none=True,
    responses={
        200: {"model": list[PrintJob]},
        299: {"model": PrintJobEvent, "description": "Websocket message"},
    },
)
async def find(
    *,
    db: Annotated[AsyncSession, Depends(get_db_session)],
    spool_id: Annotated[
        int | None,
        Query(title="Spool ID", description="Filter by spool ID."),
    ] = None,
    name: Annotated[
        str | None,
        Query(title="Job Name", description="Partial case-insensitive search for job name."),
    ] = None,
    limit: Annotated[
        int | None,
        Query(title="Limit", description="Maximum number of items in the response."),
    ] = None,
    offset: Annotated[int, Query(title="Offset", description="Offset in the full result set if a limit is set.")] = 0,
) -> JSONResponse:
    db_items, total_count = await print_job.find(
        db=db,
        spool_id=spool_id,
        name=name,
        limit=limit,
        offset=offset,
    )

    # Set x-total-count header for pagination
    return JSONResponse(
        content=jsonable_encoder(
            (PrintJob.from_db(db_item) for db_item in db_items),
            exclude_none=True,
        ),
        headers={"x-total-count": str(total_count)},
    )


@router.websocket(
    "",
    name="Listen to print job changes",
)
async def notify_any(
    websocket: WebSocket,
) -> None:
    await websocket.accept()
    websocket_manager.connect(("print_job",), websocket)
    try:
        while True:
            await asyncio.sleep(0.5)
            if await websocket.receive_text():
                await websocket.send_json({"status": "healthy"})
    except WebSocketDisconnect:
        websocket_manager.disconnect(("print_job",), websocket)


@router.get(
    "/{print_job_id}",
    name="Get print job",
    description=(
        "Get a specific print job. A websocket is served on the same path to listen for changes to the job. "
        "See the HTTP Response code 299 for the content of the websocket messages."
    ),
    response_model_exclude_none=True,
    responses={404: {"model": Message}, 299: {"model": PrintJobEvent, "description": "Websocket message"}},
)
async def get(
    db: Annotated[AsyncSession, Depends(get_db_session)],
    print_job_id: int,
) -> PrintJob:
    db_item = await print_job.get_by_id(db, print_job_id)
    return PrintJob.from_db(db_item)


@router.websocket(
    "/{print_job_id}",
    name="Listen to print job changes",
)
async def notify(
    websocket: WebSocket,
    print_job_id: int,
) -> None:
    await websocket.accept()
    websocket_manager.connect(("print_job", str(print_job_id)), websocket)
    try:
        while True:
            await asyncio.sleep(0.5)
            if await websocket.receive_text():
                await websocket.send_json({"status": "healthy"})
    except WebSocketDisconnect:
        websocket_manager.disconnect(("print_job", str(print_job_id)), websocket)


@router.post(
    "",
    name="Add print job",
    description="Add a new print job to the database.",
    response_model_exclude_none=True,
    response_model=PrintJob,
    responses={
        400: {"model": Message},
    },
)
async def create(  # noqa: ANN201
    db: Annotated[AsyncSession, Depends(get_db_session)],
    body: PrintJobParameters,
):
    db_item = await print_job.create(
        db=db,
        spool_id=body.spool_id,
        name=body.name,
        weight_used=body.weight_used,
        started_at=body.started_at,
        completed_at=body.completed_at,
        cost=body.cost,
        revenue=body.revenue,
        notes=body.notes,
        external_reference=body.external_reference,
    )
    return PrintJob.from_db(db_item)


@router.patch(
    "/{print_job_id}",
    name="Update print job",
    description=(
        "Update any attribute of a print job. "
        "Only fields specified in the request will be affected."
    ),
    response_model_exclude_none=True,
    response_model=PrintJob,
    responses={
        400: {"model": Message},
        404: {"model": Message},
    },
)
async def update(  # noqa: ANN201
    db: Annotated[AsyncSession, Depends(get_db_session)],
    print_job_id: int,
    body: PrintJobUpdateParameters,
):
    patch_data = body.model_dump(exclude_unset=True)

    db_item = await print_job.update(
        db=db,
        print_job_id=print_job_id,
        data=patch_data,
    )

    return PrintJob.from_db(db_item)


@router.delete(
    "/{print_job_id}",
    name="Delete print job",
    description="Delete a print job.",
    responses={404: {"model": Message}},
)
async def delete(
    db: Annotated[AsyncSession, Depends(get_db_session)],
    print_job_id: int,
) -> Message:
    await print_job.delete(db, print_job_id)
    return Message(message="Success!")
