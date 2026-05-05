
ALTER TABLE public.tenant_billing ADD COLUMN due_day integer DEFAULT 5;
UPDATE public.tenant_billing SET due_day = EXTRACT(DAY FROM due_date)::integer WHERE due_date IS NOT NULL;
ALTER TABLE public.tenant_billing DROP COLUMN due_date;
