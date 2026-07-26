-- Migration: 003_agent_architecture.sql
-- Adds: ESCALATED ticket status, session tracking, agent performance log.
-- Run AFTER 001_initial_schema.sql and 002_accounts_add_email.sql.

-- ── 1. Add ESCALATED to ticket_status ENUM ────────────────────────────────────
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'ESCALATED';

-- ── 2. Add full_name to accounts (needed for name-match scoring) ──────────────
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS full_name VARCHAR(100) NULL;

-- ── 3. Add session_id to teller_tickets ──────────────────────────────────────
-- session_id is SHA-256(qr_token)[0:32] — links every ticket back to the exact
-- kiosk QR session, enabling correct multi-user status polling.
ALTER TABLE teller_tickets ADD COLUMN IF NOT EXISTS session_id VARCHAR(64) NULL;
CREATE INDEX IF NOT EXISTS teller_tickets_session_id_idx ON teller_tickets(session_id);

-- ── 4. Add session_id to audit_logs ──────────────────────────────────────────
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS session_id VARCHAR(64) NULL;

-- ── 5. Create agent_performance_log ──────────────────────────────────────────
-- Records every swarm invocation and its teller outcome, enabling feedback loops.
CREATE TABLE IF NOT EXISTS agent_performance_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name      VARCHAR(50)  NOT NULL,   -- 'VISION_OCR' | 'WATCHDOG_AML' | 'ADVISOR'
    ticket_id       UUID         REFERENCES teller_tickets(id) ON DELETE SET NULL,
    session_id      VARCHAR(64)  NULL,
    input_summary   JSONB        NULL,       -- redacted inputs (image_size_kb, tx_count, balance_tier)
    output_summary  JSONB        NULL,       -- agent output (confidence, flag, offer_type)
    teller_outcome  VARCHAR(20)  NULL,       -- APPROVED | REJECTED | ESCALATED — set later
    teller_override BOOLEAN      DEFAULT FALSE, -- TRUE when teller disagreed with AI recommendation
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS agent_perf_ticket_idx  ON agent_performance_log(ticket_id);
CREATE INDEX IF NOT EXISTS agent_perf_session_idx ON agent_performance_log(session_id);
CREATE INDEX IF NOT EXISTS agent_perf_name_idx    ON agent_performance_log(agent_name);

-- ── 6. Create agent_config ────────────────────────────────────────────────────
-- Live-editable thresholds. Application reads this at startup (cached 5 min).
-- Change a value here to update agent behaviour without redeploying.
CREATE TABLE IF NOT EXISTS agent_config (
    agent_name                 VARCHAR(50)  PRIMARY KEY,
    clarity_threshold          FLOAT        DEFAULT 0.80,
    confidence_floor           FLOAT        DEFAULT 0.60,
    name_match_hard_reject     FLOAT        DEFAULT 0.50,
    name_match_soft_flag       FLOAT        DEFAULT 0.80,
    aml_tx_count_threshold     INTEGER      DEFAULT 3,
    aml_amount_threshold       BIGINT       DEFAULT 200000,
    prompt_suffix              TEXT         NULL,  -- appended to base agent prompt at call time
    updated_at                 TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by                 VARCHAR(50)  DEFAULT 'INITIAL_SEED'
);

-- Seed default config rows (idempotent)
INSERT INTO agent_config (agent_name) VALUES
    ('VISION_OCR'),
    ('WATCHDOG_AML'),
    ('ADVISOR')
ON CONFLICT (agent_name) DO NOTHING;
