-- Attendify Pro: core schema
-- Run this before policies.sql in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    display_name text NOT NULL DEFAULT 'New teacher',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.classes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id uuid NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles (id) ON DELETE CASCADE,
    name text NOT NULL,
    section text NOT NULL,
    academic_year text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'archived')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT classes_teacher_name_section_year_key
        UNIQUE (teacher_id, name, section, academic_year),
    CONSTRAINT classes_id_teacher_key UNIQUE (id, teacher_id)
);

CREATE TABLE IF NOT EXISTS public.subjects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id uuid NOT NULL DEFAULT auth.uid(),
    class_id uuid NOT NULL,
    name text NOT NULL,
    subject_code text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT subjects_class_owner_fkey
        FOREIGN KEY (class_id, teacher_id)
        REFERENCES public.classes (id, teacher_id) ON DELETE CASCADE,
    CONSTRAINT subjects_id_teacher_class_key UNIQUE (id, teacher_id, class_id),
    CONSTRAINT subjects_class_name_key UNIQUE (class_id, name),
    CONSTRAINT subjects_class_code_key UNIQUE (class_id, subject_code)
);

CREATE TABLE IF NOT EXISTS public.students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id uuid NOT NULL DEFAULT auth.uid(),
    class_id uuid NOT NULL,
    roll_number text NOT NULL,
    full_name text NOT NULL,
    status text NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'archived')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT students_class_owner_fkey
        FOREIGN KEY (class_id, teacher_id)
        REFERENCES public.classes (id, teacher_id) ON DELETE CASCADE,
    CONSTRAINT students_id_teacher_key UNIQUE (id, teacher_id),
    CONSTRAINT students_class_roll_number_key UNIQUE (class_id, roll_number)
);

CREATE TABLE IF NOT EXISTS public.class_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id uuid NOT NULL DEFAULT auth.uid(),
    class_id uuid NOT NULL,
    subject_id uuid,
    weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    starts_at time NOT NULL,
    ends_at time NOT NULL,
    effective_from date NOT NULL DEFAULT CURRENT_DATE,
    effective_until date,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT class_schedules_time_order_check CHECK (ends_at > starts_at),
    CONSTRAINT class_schedules_effective_dates_check
        CHECK (effective_until IS NULL OR effective_until >= effective_from),
    CONSTRAINT class_schedules_class_owner_fkey
        FOREIGN KEY (class_id, teacher_id)
        REFERENCES public.classes (id, teacher_id) ON DELETE CASCADE,
    CONSTRAINT class_schedules_subject_owner_fkey
        FOREIGN KEY (subject_id, teacher_id, class_id)
        REFERENCES public.subjects (id, teacher_id, class_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.holidays (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id uuid NOT NULL DEFAULT auth.uid()
        REFERENCES public.profiles (id) ON DELETE CASCADE,
    holiday_date date NOT NULL,
    name text NOT NULL,
    academic_year text NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT holidays_teacher_date_name_key
        UNIQUE (teacher_id, holiday_date, name)
);

CREATE TABLE IF NOT EXISTS public.class_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id uuid NOT NULL DEFAULT auth.uid(),
    class_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    session_date date NOT NULL,
    starts_at time NOT NULL,
    ends_at time NOT NULL,
    status text NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT class_sessions_time_order_check CHECK (ends_at > starts_at),
    CONSTRAINT class_sessions_class_owner_fkey
        FOREIGN KEY (class_id, teacher_id)
        REFERENCES public.classes (id, teacher_id) ON DELETE CASCADE,
    CONSTRAINT class_sessions_subject_owner_fkey
        FOREIGN KEY (subject_id, teacher_id, class_id)
        REFERENCES public.subjects (id, teacher_id, class_id) ON DELETE RESTRICT,
    CONSTRAINT class_sessions_id_teacher_class_key UNIQUE (id, teacher_id, class_id)
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id uuid NOT NULL DEFAULT auth.uid(),
    class_id uuid NOT NULL,
    session_id uuid NOT NULL,
    student_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'Not Marked'
        CHECK (status IN ('Present', 'Absent', 'Leave', 'Not Marked')),
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT attendance_records_session_owner_class_fkey
        FOREIGN KEY (session_id, teacher_id, class_id)
        REFERENCES public.class_sessions (id, teacher_id, class_id) ON DELETE RESTRICT,
    CONSTRAINT attendance_records_student_owner_fkey
        FOREIGN KEY (student_id, teacher_id)
        REFERENCES public.students (id, teacher_id) ON DELETE RESTRICT,
    CONSTRAINT attendance_records_session_student_key UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS classes_teacher_status_year_idx
    ON public.classes (teacher_id, status, academic_year);
CREATE INDEX IF NOT EXISTS subjects_teacher_class_idx
    ON public.subjects (teacher_id, class_id);
CREATE INDEX IF NOT EXISTS students_teacher_class_status_idx
    ON public.students (teacher_id, class_id, status);
CREATE INDEX IF NOT EXISTS class_schedules_teacher_class_weekday_idx
    ON public.class_schedules (teacher_id, class_id, weekday)
    WHERE is_active;
CREATE INDEX IF NOT EXISTS holidays_teacher_date_idx
    ON public.holidays (teacher_id, holiday_date);
CREATE INDEX IF NOT EXISTS class_sessions_teacher_class_date_idx
    ON public.class_sessions (teacher_id, class_id, session_date);
CREATE INDEX IF NOT EXISTS class_sessions_teacher_subject_date_idx
    ON public.class_sessions (teacher_id, subject_id, session_date);
CREATE INDEX IF NOT EXISTS attendance_records_teacher_class_session_idx
    ON public.attendance_records (teacher_id, class_id, session_id);
CREATE INDEX IF NOT EXISTS attendance_records_teacher_student_idx
    ON public.attendance_records (teacher_id, student_id);
CREATE INDEX IF NOT EXISTS attendance_records_teacher_status_idx
    ON public.attendance_records (teacher_id, status);

CREATE OR REPLACE FUNCTION public.validate_attendance_student_class()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.students AS student
        JOIN public.class_sessions AS session
          ON session.teacher_id = student.teacher_id
         AND session.class_id = student.class_id
        WHERE student.id = NEW.student_id
          AND student.teacher_id = NEW.teacher_id
          AND session.id = NEW.session_id
          AND session.teacher_id = NEW.teacher_id
          AND session.class_id = NEW.class_id
    ) THEN
        RAISE EXCEPTION 'Student must be enrolled in the session class';
    END IF;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.validate_attendance_student_class()
    FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_attendance_student_class
    ON public.attendance_records;
CREATE TRIGGER validate_attendance_student_class
    BEFORE INSERT OR UPDATE OF session_id, student_id, teacher_id, class_id
    ON public.attendance_records
    FOR EACH ROW EXECUTE FUNCTION public.validate_attendance_student_class();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

DO $block$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'profiles',
        'classes',
        'subjects',
        'students',
        'class_schedules',
        'holidays',
        'class_sessions',
        'attendance_records'
    ]
    LOOP
        EXECUTE pg_catalog.format(
            'DROP TRIGGER IF EXISTS set_updated_at ON public.%I',
            table_name
        );
        EXECUTE pg_catalog.format(
            'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I '
            'FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
            table_name
        );
    END LOOP;
END;
$block$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    INSERT INTO public.profiles (id, display_name)
    VALUES (
        NEW.id,
        COALESCE(
            NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
            'New teacher'
        )
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create profiles for accounts that existed before this trigger was installed.
INSERT INTO public.profiles (id, display_name)
SELECT
    users.id,
    COALESCE(
        NULLIF(pg_catalog.btrim(users.raw_user_meta_data ->> 'full_name'), ''),
        'New teacher'
    )
FROM auth.users AS users
ON CONFLICT (id) DO NOTHING;
