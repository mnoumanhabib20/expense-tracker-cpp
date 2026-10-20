import { supabase } from "./supabaseClient.js";

const classSelect = document.querySelector("[data-register-class]");
const dateInput = document.querySelector("[data-register-date]");
const sessionSelect = document.querySelector("[data-register-session]");
const rowsContainer = document.querySelector("[data-register-rows]");
const saveButton = document.querySelector("[data-save-register]");
const markAllButton = document.querySelector("[data-mark-all]");
const searchInput = document.querySelector("[data-register-search]");
const saveStatus = document.querySelector("[data-register-save-status]");
const studentCount = document.querySelector("[data-register-student-count]");
const classInfo = document.querySelector("[data-register-class-info]");

const attendanceValues = ["Present", "Absent", "Leave", "Not Marked"];
const avatarClasses = ["avatar-lilac", "avatar-blue", "avatar-peach", "avatar-green", "avatar-yellow", "avatar-pink"];

let teacherId = null;
let students = [];
let attendanceByStudent = new Map();
let toastTimer = 0;
let requestVersion = 0;
let attendanceSaveInProgress = false;

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function showToast(message, kind = "success") {
  const toast = document.querySelector("[data-attendance-toast]");
  if (!toast) {
    console.error("Attendance toast element is missing.");
    return;
  }
  toast.textContent = message;
  toast.classList.toggle("is-error", kind === "error");
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 4500);
}

function showRowsMessage(message) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 3;
  cell.className = "register-empty-cell";
  cell.textContent = message;
  row.append(cell);
  rowsContainer.replaceChildren(row);
}

function updateCounts() {
  const counts = Object.fromEntries(attendanceValues.map((status) => [status, 0]));
  rowsContainer.querySelectorAll("[data-attendance-status]").forEach((select) => {
    counts[select.value] += 1;
    select.className = `status-select status-${select.value.toLocaleLowerCase().replaceAll(" ", "-")}`;
  });
  Object.entries(counts).forEach(([status, count]) => {
    const output = document.querySelector(`[data-count="${status}"]`);
    if (output) output.textContent = String(count);
  });
}

function getVisibleStudents() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  return students.filter((student) =>
    `${student.full_name} ${student.roll_number}`.toLocaleLowerCase().includes(query),
  );
}

function renderRegister() {
  if (!students.length) {
    showRowsMessage("No active students are enrolled in this class.");
    studentCount.textContent = "· 0 students";
    saveButton.disabled = true;
    markAllButton.disabled = true;
    updateCounts();
    return;
  }

  const visibleStudents = getVisibleStudents();
  if (!visibleStudents.length) {
    showRowsMessage("No students match your search.");
  } else {
    const fragment = document.createDocumentFragment();
    visibleStudents.forEach((student, index) => {
      const row = document.createElement("tr");
      row.dataset.studentRow = student.id;

      const identityCell = document.createElement("td");
      const identity = document.createElement("div");
      identity.className = "student-cell";
      const initials = student.full_name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toLocaleUpperCase() ?? "")
        .join("");
      const avatar = document.createElement("span");
      avatar.className = `student-avatar ${avatarClasses[index % avatarClasses.length]}`;
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = initials || "?";
      const nameContainer = document.createElement("span");
      const name = document.createElement("strong");
      name.textContent = student.full_name;
      const secondary = document.createElement("small");
      secondary.textContent = "Student";
      nameContainer.append(name, secondary);
      identity.append(avatar, nameContainer);
      identityCell.append(identity);

      const rollCell = document.createElement("td");
      rollCell.textContent = student.roll_number;

      const statusCell = document.createElement("td");
      const label = document.createElement("label");
      const select = document.createElement("select");
      const inputId = `attendance-${student.id}`;
      label.className = "sr-only";
      label.htmlFor = inputId;
      label.textContent = `Attendance status for ${student.full_name}`;
      select.id = inputId;
      select.className = "status-select";
      select.dataset.attendanceStatus = "";
      select.dataset.studentId = student.id;
      const savedStatus = attendanceByStudent.get(student.id) ?? "Not Marked";

      attendanceValues.forEach((status) => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status;
        option.selected = status === savedStatus;
        select.append(option);
      });

      select.addEventListener("change", () => {
        attendanceByStudent.set(student.id, select.value);
        saveStatus.textContent = "Unsaved changes";
        updateCounts();
      });

      statusCell.append(label, select);
      row.append(identityCell, rollCell, statusCell);
      fragment.append(row);
    });
    rowsContainer.replaceChildren(fragment);
  }

  studentCount.textContent = `· ${students.length} ${students.length === 1 ? "student" : "students"}`;
  saveButton.disabled = students.length === 0;
  markAllButton.disabled = students.length === 0;
  updateCounts();
}

async function loadClasses() {
  classSelect.disabled = true;
  classSelect.replaceChildren(new Option("Loading classes…", ""));

  const { data, error } = await supabase
    .from("classes")
    .select("id, name, section, academic_year")
    .eq("teacher_id", teacherId)
    .eq("status", "active")
    .order("academic_year", { ascending: false })
    .order("name")
    .order("section");

  if (error) throw error;

  classSelect.replaceChildren(new Option("Choose a class", ""));
  (data ?? []).forEach((classRow) => {
    const option = new Option(
      `${classRow.name} · ${classRow.section} (${classRow.academic_year})`,
      classRow.id,
    );
    classSelect.append(option);
  });
  classSelect.disabled = false;

  if (!data?.length) {
    classSelect.disabled = true;
    classSelect.replaceChildren(new Option("No active classes available", ""));
    showRowsMessage("Add an active class and students before taking attendance.");
  }
}

async function loadSessions() {
  const classId = classSelect.value;
  const selectedDate = dateInput.value;
  const version = ++requestVersion;

  sessionSelect.disabled = true;
  sessionSelect.replaceChildren(new Option("Loading sessions…", ""));
  students = [];
  attendanceByStudent.clear();
  renderRegister();
  saveButton.disabled = true;
  saveStatus.textContent = "Changes haven’t been saved.";

  if (!classId || !selectedDate) {
    sessionSelect.replaceChildren(new Option("Select a class and date", ""));
    updateClassInfo();
    return;
  }

  const { data, error } = await supabase
    .from("class_sessions")
    .select("id, class_id, subject_id, session_date, title, start_time, end_time, status, created_by")
    .eq("class_id", classId)
    .eq("session_date", selectedDate)
    .eq("created_by", teacherId)
    .neq("status", "cancelled")
    .order("start_time");

  if (version !== requestVersion) return;
  if (error) throw error;

  sessionSelect.replaceChildren(new Option("Choose a session", ""));
  (data ?? []).forEach((session) => {
    const label = `${session.start_time.slice(0, 5)}–${session.end_time.slice(0, 5)} · ${session.title}`;
    sessionSelect.append(new Option(label, session.id));
  });
  sessionSelect.disabled = data?.length === 0;
  updateClassInfo(data?.[0] ?? null);

  if (!data?.length) {
    sessionSelect.replaceChildren(new Option("No sessions for this date", ""));
    showRowsMessage("No scheduled class sessions found for this class and date.");
    studentCount.textContent = "· No session";
  }
}

function updateClassInfo(session = null) {
  const classRow = [...classSelect.options]
    .filter((option) => option.value)
    .map((option) => ({ id: option.value, label: option.textContent }))
    .find((item) => item.id === classSelect.value);
  const content = classInfo.querySelector("span:last-child");
  const icon = classInfo.querySelector(".class-icon");
  content.replaceChildren();

  const title = document.createElement("strong");
  title.textContent = classRow?.label ?? "Select a class";
  const subtitle = document.createElement("small");
  subtitle.textContent = session
    ? `${session.title} · ${session.session_date}`
    : "Choose a session for this date";
  const gradeNumber = classRow?.label.match(/\d+/)?.[0] ?? "—";
  icon.textContent = gradeNumber;
  content.append(title, subtitle);
}

async function loadRegister() {
  const sessionId = sessionSelect.value;
  const classId = classSelect.value;
  const version = ++requestVersion;

  students = [];
  attendanceByStudent.clear();
  saveButton.disabled = true;
  markAllButton.disabled = true;
  saveStatus.textContent = "Changes haven’t been saved.";
  updateCounts();

  if (!sessionId || !classId) {
    showRowsMessage("Choose a class and session to load its roster.");
    studentCount.textContent = "· Select a class session";
    return;
  }

  showRowsMessage("Loading roster and saved attendance…");

  const [{ data: studentData, error: studentError }, { data: attendanceData, error: attendanceError }] =
    await Promise.all([
      supabase
        .from("students")
        .select("id, class_id, roll_number, full_name")
        .eq("teacher_id", teacherId)
        .eq("class_id", classId)
        .eq("status", "active")
        .order("roll_number"),
      supabase
        .from("attendance_records")
        .select("student_id, attendance_status")
        .eq("session_id", sessionId),
    ]);

  if (version !== requestVersion) return;
  if (studentError) throw studentError;
  if (attendanceError) throw attendanceError;

  students = studentData ?? [];
  attendanceByStudent = new Map(
    (attendanceData ?? []).map((record) => [record.student_id, record.attendance_status]),
  );
  renderRegister();
  saveStatus.textContent = "Showing saved attendance.";
}

async function saveAttendance() {
  const sessionId = sessionSelect.value;
  if (attendanceSaveInProgress) return;
  if (!teacherId || !sessionId || !students.length) {
    showToast("Choose a class session with students before saving.", "error");
    return;
  }

  attendanceSaveInProgress = true;
  const buttonLabel = saveButton.textContent;
  saveButton.disabled = true;
  saveButton.textContent = "Saving…";
  saveButton.setAttribute("aria-busy", "true");
  markAllButton.disabled = true;
  const filterControls = [classSelect, dateInput, sessionSelect];
  const previousDisabledStates = filterControls.map((control) => control.disabled);
  filterControls.forEach((control) => {
    control.disabled = true;
  });
  rowsContainer.querySelectorAll("[data-attendance-status]").forEach((select) => {
    select.disabled = true;
  });
  saveStatus.textContent = "Saving attendance…";

  try {
    const records = students.map((student) => {
      const attendanceStatus = attendanceByStudent.get(student.id) ?? "Not Marked";
      if (!attendanceValues.includes(attendanceStatus)) {
        throw new Error(`Invalid attendance status for student ${student.id}.`);
      }

      return {
        session_id: sessionId,
        student_id: student.id,
        attendance_status: attendanceStatus,
      };
    });

    const { error } = await supabase
      .from("attendance_records")
      .upsert(records, {
        onConflict: "session_id,student_id",
        ignoreDuplicates: false,
      });

    if (error) throw error;

    console.info(`Attendance saved: ${records.length} records for session ${sessionId}.`);
    saveStatus.textContent = `Saved ${records.length} attendance records at ${new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date())}.`;
    showToast(`Attendance saved for ${records.length} ${records.length === 1 ? "student" : "students"}.`);
  } catch (error) {
    console.error("Could not save attendance:", error);
    saveStatus.textContent = "Attendance could not be saved.";
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";
    showToast(
      errorMessage.includes("row-level security")
        ? "Supabase denied this save. Check the attendance_records RLS policy for this session and class."
        : errorMessage.includes("invalid attendance status")
          ? "Attendance wasn’t saved because a status value was invalid. Reload the register and try again."
          : "Attendance wasn’t saved. Check your connection and try again.",
      "error",
    );
  } finally {
    attendanceSaveInProgress = false;
    filterControls.forEach((control, index) => {
      control.disabled = previousDisabledStates[index];
    });
    rowsContainer.querySelectorAll("[data-attendance-status]").forEach((select) => {
      select.disabled = false;
    });
    markAllButton.disabled = students.length === 0;
    saveButton.disabled = students.length === 0;
    saveButton.textContent = buttonLabel;
    saveButton.removeAttribute("aria-busy");
  }
}

function initializeControls() {
  dateInput.value = localDateValue();
  document.querySelector("[data-register-date-label]").textContent =
    new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      .format(new Date(`${dateInput.value}T12:00:00`))
      .toLocaleUpperCase();

  classSelect.addEventListener("change", () => {
    runLoadAction(loadSessions);
  });
  dateInput.addEventListener("change", () => {
    runLoadAction(loadSessions);
  });
  sessionSelect.addEventListener("change", () => {
    runLoadAction(() => {
      const option = sessionSelect.selectedOptions[0];
      const session = option?.value
        ? { title: option.textContent, session_date: dateInput.value }
        : null;
      updateClassInfo(session);
      return loadRegister();
    });
  });
  searchInput.addEventListener("input", () => runLoadAction(renderRegister));
  saveButton.addEventListener("click", () => {
    void saveAttendance().catch(handleSaveError);
  });
  markAllButton.addEventListener("click", () => {
    try {
      students.forEach((student) => attendanceByStudent.set(student.id, "Present"));
      renderRegister();
      saveStatus.textContent = "Unsaved changes";
    } catch (error) {
      handleLoadError(error);
    }
  });
}

function handleLoadError(error) {
  console.error("Could not load the attendance register:", error);
  showRowsMessage("Couldn’t load this register. Check your connection and Supabase RLS policies, then try again.");
  saveButton.disabled = true;
  markAllButton.disabled = true;
  showToast("Couldn’t load attendance data. Please try again.", "error");
}

function handleSaveError(error) {
  console.error("Attendance save action failed unexpectedly:", error);
  saveStatus.textContent = "Attendance could not be saved.";
  showToast("Attendance wasn’t saved. Please try again.", "error");
}

function runLoadAction(action) {
  try {
    Promise.resolve(action()).catch(handleLoadError);
  } catch (error) {
    handleLoadError(error);
  }
}

async function initialize() {
  const requiredElements = [
    ["[data-register-class]", classSelect],
    ["[data-register-date]", dateInput],
    ["[data-register-session]", sessionSelect],
    ["[data-register-rows]", rowsContainer],
    ["[data-save-register]", saveButton],
    ["[data-mark-all]", markAllButton],
    ["[data-register-search]", searchInput],
    ["[data-register-save-status]", saveStatus],
    ["[data-register-student-count]", studentCount],
    ["[data-register-class-info]", classInfo],
    ["[data-register-date-label]", document.querySelector("[data-register-date-label]")],
    ["[data-attendance-toast]", document.querySelector("[data-attendance-toast]")],
    ...["Present", "Absent", "Leave", "Not Marked"].map((status) => [
      `[data-count="${status}"]`,
      document.querySelector(`[data-count="${status}"]`),
    ]),
  ];
  const missingElements = requiredElements
    .filter(([, element]) => !element)
    .map(([selector]) => selector);
  if (missingElements.length) {
    console.error(`Attendance page is missing required elements: ${missingElements.join(", ")}`);
    return;
  }

  initializeControls();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    if (error) console.error("Could not verify the signed-in teacher:", error);
    window.location.replace("login.html");
    return;
  }

  teacherId = data.user.id;
  await loadClasses();
  if (classSelect.value) await loadSessions();
}

void initialize().catch(handleLoadError);
