"""
CaféSmart ML Data Bootstrap — Seed historical sales data for model training.

Reads from PostgreSQL (via asyncpg) or falls back to CSV files
when the database is empty. Produces per-item sales arrays used
by forecaster.py for training.
"""

import asyncio
import csv
import logging
import os
from datetime import date
from typing import Optional

logger = logging.getLogger(__name__)

CSV_SALES_PATH = os.path.join(
    os.path.dirname(__file__), "..", "docs", "sales_logs.csv"
)


async def fetch_sales_from_db(dsn: str) -> dict[str, list[int]]:
    """
    Query PostgreSQL OrderItem aggregation grouped by menuItem + date.
    Returns {menuItemName: [qty_day1, qty_day2, ...]} sorted by date ascending.
    """
    try:
        import asyncpg
    except ImportError:
        logger.warning("asyncpg not installed — skipping DB bootstrap")
        return {}

    conn = await asyncpg.connect(dsn)
    try:
        rows = await conn.fetch("""
            SELECT mi.name AS item_name, SUM(oi.quantity)::int AS sold_qty
            FROM "MenuItem" mi
            JOIN "OrderItem" oi ON oi."menuItemId" = mi.id
            JOIN "Order" o ON o.id = oi."orderId"
            WHERE o."createdAt" >= $1
            GROUP BY mi.name, o."createdAt"::date
            ORDER BY o."createdAt"::date ASC
        """, date.today().replace(day=1))
    finally:
        await conn.close()

    result: dict[str, list[int]] = {}
    for row in rows:
        item_name = row["item_name"]
        if item_name not in result:
            result[item_name] = []
        result[item_name].append(row["sold_qty"])

    return result


def fetch_sales_from_csv(csv_path: Optional[str] = None) -> dict[str, list[int]]:
    """
    Parse inventory_records.csv or sales_logs.csv for per-item daily sales.
    CSV format: Date, Item, Sold_Qty
    """
    path = csv_path or CSV_SALES_PATH
    if not os.path.exists(path):
        logger.warning("CSV file not found: %s", path)
        return {}

    result: dict[str, list[int]] = {}
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            item_name = row.get("Item") or row.get("item") or row.get("name", "").strip()
            sold_str = row.get("Sold_Qty") or row.get("sold_qty") or row.get("quantity", "0")
            try:
                sold_qty = int(float(sold_str))
            except (ValueError, TypeError):
                continue
            if item_name not in result:
                result[item_name] = []
            result[item_name].append(sold_qty)

    return result


async def bootstrap_data(dsn: Optional[str] = None) -> dict[str, list[int]]:
    """
    Main entry point: try DB first, fall back to CSV.
    """
    if dsn:
        try:
            db_data = await fetch_sales_from_db(dsn)
            if db_data:
                logger.info("Bootstrapped %d items from PostgreSQL", len(db_data))
                return db_data
        except Exception:
            logger.exception("DB bootstrap failed, falling back to CSV")

    csv_data = fetch_sales_from_csv()
    logger.info("Bootstrapped %d items from CSV", len(csv_data))
    return csv_data


# ── Synchronous wrapper for use in FastAPI endpoints ──────────────

def bootstrap_sync(dsn: Optional[str] = None) -> dict[str, list[int]]:
    """Synchronous wrapper for bootstrap_data."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import nest_asyncio
            nest_asyncio.apply()
        return loop.run_until_complete(bootstrap_data(dsn))
    except RuntimeError:
        return asyncio.run(bootstrap_data(dsn))
