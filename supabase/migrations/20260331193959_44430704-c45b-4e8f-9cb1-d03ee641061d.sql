
ALTER TABLE public.tenant_billing
  ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_start_date date,
  ADD COLUMN IF NOT EXISTS trial_end_date date;
