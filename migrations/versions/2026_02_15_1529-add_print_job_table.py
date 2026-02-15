"""add_print_job_table.

Revision ID: 2026_02_15_1529
Revises: 415a8f855e14
Create Date: 2026-02-15 15:29:00.000000
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "2026_02_15_1529"
down_revision = "415a8f855e14"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Perform the upgrade."""
    op.create_table(
        "print_job",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("registered", sa.DateTime(), nullable=False),
        sa.Column("spool_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("weight_used", sa.Float(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("cost", sa.Float(), nullable=True),
        sa.Column("revenue", sa.Float(), nullable=True),
        sa.Column("notes", sa.String(length=1024), nullable=True),
        sa.Column("external_reference", sa.String(length=256), nullable=True),
        sa.ForeignKeyConstraint(["spool_id"], ["spool.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_print_job_id"), "print_job", ["id"], unique=False)
    op.create_index(op.f("ix_print_job_spool_id"), "print_job", ["spool_id"], unique=False)


def downgrade() -> None:
    """Perform the downgrade."""
    op.drop_index(op.f("ix_print_job_spool_id"), table_name="print_job")
    op.drop_index(op.f("ix_print_job_id"), table_name="print_job")
    op.drop_table("print_job")
