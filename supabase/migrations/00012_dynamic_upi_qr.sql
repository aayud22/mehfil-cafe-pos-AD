-- ==============================================================================
-- Migration 00012: Release 4 Feature 5 — Dynamic UPI QR
-- ==============================================================================

alter table public.app_settings
  add column if not exists upi_id text
    check (upi_id is null or upi_id ~ '^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}$'),
  add column if not exists upi_payee_name text
    check (upi_payee_name is null or length(upi_payee_name) <= 40);
