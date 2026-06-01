#!/usr/bin/env python3
"""
Migration script: Add governance enhancements (FTE mode, time slices, reuse flag)
"""

import sqlite3
import os
from pathlib import Path

def get_db_path():
    return Path(os.environ.get("DB_PATH") or Path(__file__).parent / "simulator_poste.db")

def migrate_governance_enhancements():
    """Add governance_mode, governance_fte_periods, and governance_apply_reuse columns"""

    db_path = get_db_path()

    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        return False

    print(f"📊 Migrating business_plans table in {db_path}")

    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='business_plans'")
        if not cursor.fetchone():
            print("✅ business_plans table not found - it will be created by the application")
            conn.close()
            return True

        # Check existing columns
        cursor.execute("PRAGMA table_info(business_plans)")
        columns = {row[1] for row in cursor.fetchall()}

        migrations = []

        if 'governance_mode' not in columns:
            migrations.append(('governance_mode', 'TEXT DEFAULT "percentage"', 'Modalità calcolo governance'))

        if 'governance_fte_periods' not in columns:
            migrations.append(('governance_fte_periods', 'TEXT DEFAULT "[]"', 'Time slices per governance FTE'))

        if 'governance_apply_reuse' not in columns:
            migrations.append(('governance_apply_reuse', 'INTEGER DEFAULT 0', 'Flag: applicare riuso alla governance'))

        if not migrations:
            print("✅ Columns already exist, no migration needed")
            conn.close()
            return True

        # Apply migrations
        for column_name, column_type, description in migrations:
            print(f"  ➕ Adding column: {column_name} ({description})")
            cursor.execute(f"ALTER TABLE business_plans ADD COLUMN {column_name} {column_type}")

        conn.commit()
        print(f"✅ Migration completed: added {len(migrations)} column(s)")

        conn.close()
        return True

    except Exception as e:
        print(f"❌ Migration failed: {str(e)}")
        if conn:
            conn.close()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Governance Enhancements Migration")
    print("=" * 60)
    success = migrate_governance_enhancements()
    print("=" * 60)
    exit(0 if success else 1)
