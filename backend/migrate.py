"""Run Alembic without needing the `alembic` command on PATH.

    python migrate.py            # same as: alembic upgrade head
    python migrate.py current    # any other alembic command works too
"""
import sys

from alembic.config import main

if __name__ == "__main__":
    main(argv=sys.argv[1:] or ["upgrade", "head"], prog="migrate.py")
