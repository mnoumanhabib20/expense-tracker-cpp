-- Attendify Pro: grants and row-level security policies
-- Run schema.sql first. All client access is for authenticated teachers only.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
    public.profiles,
    public.classes,
    public.subjects,
    public.students,
    public.class_schedules,
    public.holidays,
    public.class_sessions,
    public.attendance_records
FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (display_name) ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    public.classes,
    public.subjects,
    public.students,
    public.class_schedules,
    public.holidays,
    public.class_sessions,
    public.attendance_records
TO authenticated;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS classes_owner_all ON public.classes;
CREATE POLICY classes_owner_all
    ON public.classes
    FOR ALL
    TO authenticated
    USING (teacher_id = (SELECT auth.uid()))
    WITH CHECK (teacher_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS subjects_owner_all ON public.subjects;
CREATE POLICY subjects_owner_all
    ON public.subjects
    FOR ALL
    TO authenticated
    USING (teacher_id = (SELECT auth.uid()))
    WITH CHECK (teacher_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS students_owner_all ON public.students;
CREATE POLICY students_owner_all
    ON public.students
    FOR ALL
    TO authenticated
    USING (teacher_id = (SELECT auth.uid()))
    WITH CHECK (teacher_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS class_schedules_owner_all ON public.class_schedules;
CREATE POLICY class_schedules_owner_all
    ON public.class_schedules
    FOR ALL
    TO authenticated
    USING (teacher_id = (SELECT auth.uid()))
    WITH CHECK (teacher_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS holidays_owner_all ON public.holidays;
CREATE POLICY holidays_owner_all
    ON public.holidays
    FOR ALL
    TO authenticated
    USING (teacher_id = (SELECT auth.uid()))
    WITH CHECK (teacher_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS class_sessions_owner_all ON public.class_sessions;
CREATE POLICY class_sessions_owner_all
    ON public.class_sessions
    FOR ALL
    TO authenticated
    USING (teacher_id = (SELECT auth.uid()))
    WITH CHECK (teacher_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS attendance_records_owner_all ON public.attendance_records;
CREATE POLICY attendance_records_owner_all
    ON public.attendance_records
    FOR ALL
    TO authenticated
    USING (teacher_id = (SELECT auth.uid()))
    WITH CHECK (teacher_id = (SELECT auth.uid()));
