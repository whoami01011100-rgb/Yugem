import os
import threading

import oracledb
from dotenv import load_dotenv

load_dotenv()

ORACLE_USER = os.getenv("ORACLE_USER")
ORACLE_PASSWORD = os.getenv("ORACLE_PASSWORD")
ORACLE_DSN = os.getenv("ORACLE_DSN")

# Reuse Oracle connections across API requests.
# This does NOT cache employee roles, permissions, or query results.
_POOL = None
_POOL_LOCK = threading.Lock()


def _get_pool():
    """Create the shared Oracle connection pool on first use."""
    global _POOL

    if _POOL is not None:
        return _POOL

    if not ORACLE_USER:
        raise RuntimeError("ORACLE_USER is not configured")
    if not ORACLE_PASSWORD:
        raise RuntimeError("ORACLE_PASSWORD is not configured")
    if not ORACLE_DSN:
        raise RuntimeError("ORACLE_DSN is not configured")

    with _POOL_LOCK:
        if _POOL is None:
            _POOL = oracledb.create_pool(
                user=ORACLE_USER,
                password=ORACLE_PASSWORD,
                dsn=ORACLE_DSN,
                min=1,
                max=5,
                increment=1,
                getmode=oracledb.POOL_GETMODE_WAIT,
                wait_timeout=10000,
                timeout=60,
                ping_interval=60,
            )

    return _POOL


def get_connection():
    """
    Acquire a pooled connection.
    Existing routes should still call connection.close() in finally;
    for pooled connections this returns the connection to the pool.
    """
    return _get_pool().acquire()


def close_pool():
    """Optional: call during application shutdown, not per request."""
    global _POOL

    with _POOL_LOCK:
        if _POOL is not None:
            _POOL.close()
            _POOL = None


def test_connection():
    """Test Oracle connectivity using a pooled connection."""
    connection = None

    try:
        connection = get_connection()

        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    SYS_CONTEXT('USERENV', 'DB_NAME'),
                    SYS_CONTEXT('USERENV', 'SERVICE_NAME')
                FROM DUAL
            """)
            row = cursor.fetchone()

        return {
            "connected": True,
            "database": row[0],
            "service": row[1],
        }

    finally:
        if connection is not None:
            connection.close()
