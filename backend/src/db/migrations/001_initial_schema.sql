-- Migration: 001_initial_schema.sql
-- Domain: Autonomous Branch Operations & Compliance Engine
-- Creates all core tables required by Domain 1 (Auth & Triage) and beyond.

-- Core Banking System Simulation
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    account_number VARCHAR(10) UNIQUE NOT NULL,
    balance DECIMAL(12, 2) DEFAULT 0.00,
    pan_linked BOOLEAN DEFAULT FALSE,
    pan_number VARCHAR(10) NULL
);

-- CBS Transaction Ledger
-- error_code captures compliance blocks such as ERR_PAN_MISSING_OVER_50K
-- Required by Domain 1 for proactive failed-transaction diagnosis (Req 4.1, 4.2, 8.1)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id),
    amount DECIMAL(12, 2) NOT NULL,
    error_code VARCHAR(50) NULL,       -- e.g. 'ERR_PAN_MISSING_OVER_50K' when blocked
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS transactions_account_id_idx ON transactions(account_id);
CREATE INDEX IF NOT EXISTS transactions_error_code_idx ON transactions(error_code);
CREATE INDEX IF NOT EXISTS transactions_created_at_idx ON transactions(created_at);

-- HITL Teller Queue
DO $$ BEGIN
    CREATE TYPE ticket_status AS ENUM (
        'PENDING',
        'PENDING_MANUAL_REVIEW',
        'APPROVED',
        'REJECTED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS teller_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id),
    status ticket_status DEFAULT 'PENDING',
    document_path VARCHAR(255) NOT NULL,
    ocr_data JSONB NULL,
    ai_confidence FLOAT NULL,
    name_mismatch_score FLOAT NULL,
    aml_flagged BOOLEAN DEFAULT FALSE,
    reviewed_by UUID NULL,
    rejection_reason VARCHAR(255) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS teller_tickets_account_id_idx ON teller_tickets(account_id);
CREATE INDEX IF NOT EXISTS teller_tickets_status_idx ON teller_tickets(status);

-- Governance Audit Ledger
-- Receives one immutable row per auth state transition from governanceSidecar.js (Req 9.1)
-- All PAN values and account numbers in payload_snapshot must be redacted before insert.
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    payload_snapshot JSONB NOT NULL,
    actor_id UUID NULL,               -- account UUID, or NULL for pre-auth events
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS audit_logs_event_type_idx ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);
