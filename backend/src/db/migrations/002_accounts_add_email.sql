-- Migration: 002_accounts_add_email.sql
-- Adds the email column to the accounts table.
-- Required by Domain 1 Auth: the OTP is dispatched to accounts.email (Req 2.5),
-- and the masked_email value is returned to KioskLogin.jsx.

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_idx ON accounts(email);
