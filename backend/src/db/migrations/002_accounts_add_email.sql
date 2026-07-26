-- Migration: 002_accounts_add_email.sql
-- Adds the email column to the accounts table.
-- Required by Domain 1 Auth: the OTP is dispatched to accounts.email (Req 2.5),
-- and the masked_email value is returned to KioskLogin.jsx.
--
-- Safe to re-run (IF NOT EXISTS guards throughout).
-- The column is added as NULLable first, then a NOT NULL constraint is deferred
-- until after the seed data (migrate.js) fills every row. This prevents
-- "column cannot be null" failures when the table already has rows.

-- Step 1: add as nullable so the ALTER succeeds on a populated table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL;

-- Step 2: unique index (safe if column already exists)
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_idx ON accounts(email);
