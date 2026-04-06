-- ============================================
-- IIEST E-Gate Pass System Database Schema
-- Full System (v4) — includes all features
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    phone           VARCHAR(15),
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('guard', 'staff', 'admin')),
    organization    VARCHAR(50) DEFAULT 'iiest' CHECK (organization IN ('iiest', 'bank', 'school', 'iti', 'other')),
    department      VARCHAR(255),
    designation     VARCHAR(255),
    profile_photo   TEXT,
    push_token      TEXT,
    gate_assigned   VARCHAR(100),
    -- Staff availability (v4)
    availability    VARCHAR(20) DEFAULT 'available'
                    CHECK (availability IN ('available', 'in_meeting', 'on_leave', 'unavailable')),
    availability_note TEXT,
    available_from  TIMESTAMP,
    is_active       BOOLEAN DEFAULT true,
    is_approved     BOOLEAN DEFAULT false,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- VISITORS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS visitors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       VARCHAR(255) NOT NULL,
    phone           VARCHAR(15) NOT NULL,
    photo_url       TEXT,
    id_type         VARCHAR(50),
    id_number       VARCHAR(100),
    address         TEXT,
    visitor_email   VARCHAR(255),           -- v4: pre-visit portal
    id_card_photo_url TEXT,                 -- v4: ID card capture
    is_blacklisted  BOOLEAN DEFAULT false,
    blacklist_reason TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- VISIT REQUESTS TABLE (Professor Approval Flow)
-- ============================================
CREATE TABLE IF NOT EXISTS visit_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id      UUID NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
    guard_id        UUID NOT NULL REFERENCES users(id),
    staff_id        UUID NOT NULL REFERENCES users(id),
    purpose         TEXT NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
    reject_reason   TEXT,
    approval_message TEXT,
    notes           TEXT,
    meeting_status  VARCHAR(20) DEFAULT 'not_confirmed'
                    CHECK (meeting_status IN ('not_confirmed', 'met', 'not_met')),
    meeting_confirmed_at TIMESTAMP,
    pre_visit       BOOLEAN DEFAULT false,  -- v4: pre-visit portal
    scheduled_date  TIMESTAMP,              -- v4: pre-visit portal
    requested_at    TIMESTAMP DEFAULT NOW(),
    responded_at    TIMESTAMP,
    valid_until     TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- GENERAL VISITS TABLE (No Approval Needed)
-- ============================================
CREATE TABLE IF NOT EXISTS general_visits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id      UUID NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
    guard_id        UUID NOT NULL REFERENCES users(id),
    purpose         VARCHAR(100) NOT NULL,
    purpose_detail  TEXT,
    status          VARCHAR(20) DEFAULT 'approved'
                    CHECK (status IN ('approved', 'expired', 'revoked')),
    vehicle_number  VARCHAR(20),            -- v4: vehicle tracking
    vehicle_type    VARCHAR(20) DEFAULT 'none', -- v4: vehicle tracking
    vehicle_photo_url TEXT,                 -- v4: vehicle tracking
    valid_from      TIMESTAMP DEFAULT NOW(),
    valid_until     TIMESTAMP NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- GATE PASSES TABLE (QR Codes)
-- ============================================
CREATE TABLE IF NOT EXISTS gate_passes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pass_code       VARCHAR(100) UNIQUE NOT NULL,
    visit_request_id UUID REFERENCES visit_requests(id),
    general_visit_id UUID REFERENCES general_visits(id),
    visitor_id      UUID NOT NULL REFERENCES visitors(id),
    generated_by    UUID NOT NULL REFERENCES users(id),
    qr_data         TEXT NOT NULL,
    status          VARCHAR(20) DEFAULT 'active'
                    CHECK (status IN ('active', 'used', 'expired', 'revoked')),
    entry_time      TIMESTAMP,
    exit_time       TIMESTAMP,
    valid_until     TIMESTAMP NOT NULL,
    sms_sent        BOOLEAN DEFAULT false,  -- v4: SMS tracking
    sms_sent_at     TIMESTAMP,              -- v4: SMS tracking
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- SCAN LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS scan_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gate_pass_id    UUID NOT NULL REFERENCES gate_passes(id),
    scanned_by      UUID NOT NULL REFERENCES users(id),
    scan_type       VARCHAR(10) CHECK (scan_type IN ('entry', 'exit', 'verify')),
    scan_result     VARCHAR(20) NOT NULL,
    location        VARCHAR(255),
    scanned_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    title           VARCHAR(255) NOT NULL,
    body            TEXT NOT NULL,
    type            VARCHAR(50),
    reference_id    UUID,
    is_read         BOOLEAN DEFAULT false,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- ACTIVITY LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50),
    entity_id       UUID,
    details         JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- CAMPUS LOCKDOWNS TABLE (v4)
-- ============================================
CREATE TABLE IF NOT EXISTS campus_lockdowns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activated_by    UUID NOT NULL REFERENCES users(id),
    reason          TEXT NOT NULL,
    activated_at    TIMESTAMP DEFAULT NOW(),
    lifted_at       TIMESTAMP,
    is_active       BOOLEAN DEFAULT true
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_approved ON users(is_approved);
CREATE INDEX IF NOT EXISTS idx_visitors_phone ON visitors(phone);
CREATE INDEX IF NOT EXISTS idx_visit_requests_staff ON visit_requests(staff_id);
CREATE INDEX IF NOT EXISTS idx_visit_requests_guard ON visit_requests(guard_id);
CREATE INDEX IF NOT EXISTS idx_visit_requests_status ON visit_requests(status);
CREATE INDEX IF NOT EXISTS idx_general_visits_guard ON general_visits(guard_id);
CREATE INDEX IF NOT EXISTS idx_gate_passes_code ON gate_passes(pass_code);
CREATE INDEX IF NOT EXISTS idx_gate_passes_status ON gate_passes(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_scan_logs_pass ON scan_logs(gate_pass_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
-- v4 indexes
CREATE INDEX IF NOT EXISTS idx_gate_passes_entry_exit ON gate_passes(entry_time, exit_time) WHERE exit_time IS NULL;
CREATE INDEX IF NOT EXISTS idx_general_visits_vehicle ON general_visits(vehicle_number);
CREATE INDEX IF NOT EXISTS idx_campus_lockdowns_active ON campus_lockdowns(is_active) WHERE is_active = true;

-- ============================================
-- PRE-REGISTRATIONS TABLE (v5)
-- ============================================
CREATE TABLE IF NOT EXISTS pre_registrations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id      UUID NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
    staff_id        UUID NOT NULL REFERENCES users(id),
    purpose         TEXT NOT NULL,
    scheduled_date  DATE NOT NULL,
    scheduled_time  VARCHAR(10),
    status          VARCHAR(20) DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','expired','completed')),
    reject_reason   TEXT,
    approval_message TEXT,
    notes           TEXT,
    visit_request_id UUID REFERENCES visit_requests(id),
    gate_pass_id    UUID REFERENCES gate_passes(id),
    approved_at     TIMESTAMP,
    valid_until     TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- v5 indexes
CREATE INDEX IF NOT EXISTS idx_pre_reg_status ON pre_registrations(status);
CREATE INDEX IF NOT EXISTS idx_pre_reg_staff ON pre_registrations(staff_id);
CREATE INDEX IF NOT EXISTS idx_pre_reg_date ON pre_registrations(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_pre_reg_visitor ON pre_registrations(visitor_id);

-- ============================================
-- OTP VERIFICATIONS TABLE (v6)
-- ============================================
CREATE TABLE IF NOT EXISTS otp_verifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL,
    otp_hash        VARCHAR(255) NOT NULL,
    type            VARCHAR(20) NOT NULL CHECK (type IN ('login', 'reset')),
    expires_at      TIMESTAMP NOT NULL,
    used            BOOLEAN DEFAULT false,
    attempts        INTEGER DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- v6 indexes
CREATE INDEX IF NOT EXISTS idx_otp_email_type ON otp_verifications(email, type, used);

