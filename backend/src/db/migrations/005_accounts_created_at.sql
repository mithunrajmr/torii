-- Migration: 005_accounts_created_at.sql
-- Adds: created_at to accounts, last_account_number sequence table for auto-generation.
-- Run AFTER 004_faq_feedback_loop.sql.
--
-- WHY: accounts table in 001 never had a created_at column, causing ERR_LIST_ACCOUNTS_FAILED
-- whenever the teller accounts page tried to ORDER BY created_at DESC.
--
-- Also adds the account_number_seq table used by the backend to auto-generate
-- sequential 10-digit account numbers (format: 10XXXXXXXX, starting at 1000000007).

-- ── 1. Add created_at to accounts ─────────────────────────────────────────────
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Back-fill NULL rows for any existing accounts (safe no-op if already set)
UPDATE accounts SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;

-- ── 2. Add index for the new column ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS accounts_created_at_idx ON accounts(created_at DESC);

-- ── 3. Account number sequence table ─────────────────────────────────────────
-- Holds the last-used sequential suffix so the backend can atomically claim the
-- next number without a full table scan.
-- The prefix '10' is fixed; suffix is 8 digits, zero-padded → 1000000001 … 1099999999.
CREATE TABLE IF NOT EXISTS account_number_seq (
    id      INTEGER PRIMARY KEY DEFAULT 1,   -- only ever one row
    last_seq BIGINT NOT NULL DEFAULT 7        -- starts after the 6 seed accounts (…001–006)
);

-- Seed the single row (idempotent)
INSERT INTO account_number_seq (id, last_seq)
VALUES (1, 7)
ON CONFLICT (id) DO NOTHING;
