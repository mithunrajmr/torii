-- Migration: 006_expanded_branch_services.sql
-- NON-DESTRUCTIVE & FULLY BACKWARD COMPATIBLE
-- Domain: Enterprise Autonomous Branch Operations & Multi-Service Platform

-- 1. Create Enums for Service Request Types & Statuses
DO $$ BEGIN
    CREATE TYPE service_type_enum AS ENUM (
        'FULL_KYC',
        'AADHAAR_LINK',
        'PAN_LINK',
        'ADDRESS_CHANGE',
        'NOMINEE_UPDATE',
        'ACCOUNT_UPGRADE',
        'HIGH_VALUE_CLEARANCE'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE service_status_enum AS ENUM (
        'DRAFT',
        'SUBMITTED',
        'PENDING_TELLER_REVIEW',
        'NEEDS_CUSTOMER_ACTION',
        'APPROVED',
        'REJECTED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Normalized Service Requests Table
CREATE TABLE IF NOT EXISTS service_requests (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id              UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    service_type            service_type_enum NOT NULL,
    status                  service_status_enum NOT NULL DEFAULT 'SUBMITTED',
    form_data               JSONB NOT NULL DEFAULT '{}',
    digital_signature_path  VARCHAR(255) NULL,
    ai_verification_summary JSONB NULL,
    session_id              VARCHAR(64) NULL,
    reviewed_by             VARCHAR(50) NULL,
    rejection_reason        VARCHAR(255) NULL,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS sr_account_id_idx   ON service_requests(account_id);
CREATE INDEX IF NOT EXISTS sr_service_type_idx ON service_requests(service_type);
CREATE INDEX IF NOT EXISTS sr_status_idx       ON service_requests(status);
CREATE INDEX IF NOT EXISTS sr_session_id_idx   ON service_requests(session_id);

-- 3. Multi-Document Association Table
CREATE TABLE IF NOT EXISTS service_documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_request_id  UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
    document_type       VARCHAR(50) NOT NULL,
    document_path       VARCHAR(255) NOT NULL,
    ocr_data            JSONB NULL,
    clarity_score       FLOAT NULL,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS sd_request_id_idx ON service_documents(service_request_id);

-- 4. Backward-Compatible Column Additions to accounts Table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS aadhaar_number VARCHAR(12) NULL;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS aadhaar_linked BOOLEAN DEFAULT FALSE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255) NULL;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255) NULL;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS city VARCHAR(100) NULL;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS state VARCHAR(100) NULL;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS pincode VARCHAR(10) NULL;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS nominee_details JSONB NULL;
