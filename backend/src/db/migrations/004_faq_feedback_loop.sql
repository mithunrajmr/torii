-- Migration: 004_faq_feedback_loop.sql
-- Adds: faq_query_log + faq_kb_proposals tables for the FAQ feedback loop.
-- Run AFTER 003_agent_architecture.sql.
--
-- Purpose:
--   faq_query_log     — Every FAQ query the kiosk receives is logged here.
--                       Low-confidence / unanswered queries surface KB gaps.
--   faq_kb_proposals  — Staff-reviewed proposals for new KB entries generated
--                       from clusters of unanswered queries.
--
-- Usage:
--   Run in Supabase SQL editor. Safe to re-run (all IF NOT EXISTS guarded).

-- ── 1. faq_query_log ──────────────────────────────────────────────────────────
-- Populated by kioskController.js after every FAQ_QUERY intent resolution.
-- One row per customer query. Drives gap analysis for KB improvement.

CREATE TABLE IF NOT EXISTS faq_query_log (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID         REFERENCES accounts(id) ON DELETE SET NULL,
    session_id      VARCHAR(64)  NULL,               -- kiosk session (SHA-256 of QR token)
    query_text      TEXT         NOT NULL,            -- PII-redacted customer question
    detected_domain VARCHAR(30)  NULL,               -- best_category from search_bank_faq
    was_answered    BOOLEAN      NOT NULL DEFAULT FALSE,  -- true if confidence >= 0.10
    confidence      FLOAT        NOT NULL DEFAULT 0.0,    -- best relevance_score (0.0–1.0)
    matched_faq_id  VARCHAR(20)  NULL,               -- e.g. "fd-001" — which entry matched
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS faq_query_log_account_idx    ON faq_query_log(account_id);
CREATE INDEX IF NOT EXISTS faq_query_log_answered_idx   ON faq_query_log(was_answered);
CREATE INDEX IF NOT EXISTS faq_query_log_domain_idx     ON faq_query_log(detected_domain);
CREATE INDEX IF NOT EXISTS faq_query_log_created_at_idx ON faq_query_log(created_at DESC);

COMMENT ON TABLE faq_query_log IS
    'Every FAQ query from the kiosk. Unanswered rows (was_answered=false) are '
    'KB coverage gaps that should be reviewed periodically.';

COMMENT ON COLUMN faq_query_log.confidence IS
    'Relevance score 0.0–1.0 from search_bank_faq keyword scorer. '
    'Score < 0.10 = unanswered (no matching KB entry). '
    'Score 0.10–0.20 = partial match. Score >= 0.20 = confident answer.';

-- ── 2. faq_kb_proposals ───────────────────────────────────────────────────────
-- Populated manually or by a future KB Manager agent after gap analysis.
-- Staff reviews and approves/rejects each proposed KB entry before it goes live.

CREATE TABLE IF NOT EXISTS faq_kb_proposals (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    proposed_question  TEXT      NOT NULL,           -- suggested FAQ question text
    proposed_answer    TEXT      NOT NULL,           -- suggested answer text
    proposed_category  VARCHAR(30) NOT NULL,         -- target KB category
    proposed_keywords  TEXT[]    NOT NULL DEFAULT '{}', -- keyword list for scoring
    source_query_ids   UUID[]    DEFAULT '{}',       -- faq_query_log IDs that triggered this
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
                                                     -- PENDING | APPROVED | REJECTED
    reviewed_by     VARCHAR(50)  NULL,               -- teller/staff who reviewed
    review_notes    TEXT         NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at     TIMESTAMP WITH TIME ZONE NULL,

    CONSTRAINT faq_kb_proposals_status_check
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS faq_kb_proposals_status_idx   ON faq_kb_proposals(status);
CREATE INDEX IF NOT EXISTS faq_kb_proposals_category_idx ON faq_kb_proposals(proposed_category);

COMMENT ON TABLE faq_kb_proposals IS
    'Staff-reviewed proposals for new bank_faq_tool.py KB entries. '
    'PENDING proposals appear in the teller dashboard for review. '
    'APPROVED proposals are manually added to bank_faq_tool.py in the next deploy.';
