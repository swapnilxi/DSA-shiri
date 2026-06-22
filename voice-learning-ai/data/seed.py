"""
Seed the database from CSV files in question_banks/.
  python seed.py               # load all CSVs
  python seed.py --csv FILE    # load a specific CSV file

Rules:
  - A question is identified by its exact text (case-insensitive, trimmed).
  - If a question is not in the DB yet, insert it.
  - If it already exists and the new company is different, append the company
    to the existing comma-separated company field.
  - Never insert a duplicate row.
"""
import asyncio
import aiosqlite
import argparse
import csv
import os

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
DB_PATH     = os.path.join(BASE_DIR, "voicelearning.db")
SCHEMA_PATH = os.path.join(BASE_DIR, "..", "backend", "db", "schema.sql")
QB_DIR      = os.path.join(BASE_DIR, "question_banks")


def _csv_files(specific: str | None) -> list[str]:
    if specific:
        return [specific]
    if not os.path.isdir(QB_DIR):
        return []
    return sorted(
        os.path.join(QB_DIR, f)
        for f in os.listdir(QB_DIR)
        if f.endswith(".csv")
    )


def _load_csv(path: str) -> list[dict]:
    rows = []
    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            row = {k.strip(): (v.strip() if v else "") for k, v in row.items() if k is not None}
            if row.get("question"):
                rows.append(row)
    return rows


def _companies_set(raw: str) -> set[str]:
    return {c.strip() for c in raw.split(",") if c.strip()}


async def seed(csv_path: str | None = None):
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

    with open(SCHEMA_PATH) as fh:
        schema = fh.read()

    files = _csv_files(csv_path)
    if not files:
        print("No CSV files found. Put CSVs in:", QB_DIR)
        return

    inserted = updated = skipped = 0

    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(schema)

        for path in files:
            source = os.path.basename(path)
            rows = _load_csv(path)
            print(f"\nProcessing {source} ({len(rows)} rows)…")

            for row in rows:
                q_text  = row.get("question", "").strip()
                company = row.get("company", "").strip()
                if not q_text:
                    continue

                # Check for existing question (case-insensitive match)
                cur = await db.execute(
                    "SELECT id, company FROM questions WHERE LOWER(TRIM(question)) = LOWER(TRIM(?))",
                    (q_text,),
                )
                existing = await cur.fetchone()

                if existing is None:
                    # New question — insert it
                    await db.execute(
                        """INSERT INTO questions
                               (topic, question, difficulty, company, category, expected_keywords, source_file)
                           VALUES (?, ?, ?, ?, ?, ?, ?)""",
                        (
                            row.get("topic", ""),
                            q_text,
                            row.get("difficulty", "Medium").capitalize(),
                            company,
                            row.get("category", ""),
                            row.get("expected_keywords", ""),
                            source,
                        ),
                    )
                    inserted += 1
                else:
                    existing_id, existing_companies_raw = existing
                    existing_companies = _companies_set(existing_companies_raw or "")

                    if company and company not in existing_companies:
                        # Same question, new company — append tag
                        new_companies = ", ".join(sorted(existing_companies | {company}))
                        await db.execute(
                            "UPDATE questions SET company = ? WHERE id = ?",
                            (new_companies, existing_id),
                        )
                        updated += 1
                        print(f"  + Added company '{company}' to: {q_text[:60]}…")
                    else:
                        skipped += 1

        await db.commit()

    print(f"\nDone. inserted={inserted}  company-updated={updated}  skipped={skipped}")
    print(f"Database: {DB_PATH}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed questions into the DB from CSV files.")
    parser.add_argument("--csv", metavar="FILE", help="Seed from a specific CSV instead of all files in question_banks/")
    args = parser.parse_args()
    asyncio.run(seed(args.csv))
