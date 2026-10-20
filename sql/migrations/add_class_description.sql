-- Apply this migration if public.classes already exists without description.
ALTER TABLE public.classes
    ADD COLUMN IF NOT EXISTS description text;
