import { supabase } from "./supabaseClient.js";

const rowsElement = document.querySelector("[data-student-rows]");
const searchInput = document.querySelector("[data-student-search]");
const classFilter = document.querySelector("[data-student-class-filter]");
const studentDialog = document.querySelector("[data-student-dialog]");
const studentForm = document.querySelector("[data-student-form]");

let teacherId = null;
let classes = [];
let students = [];
let toastTimer = 0;
let studentSaveInProgress = false;

const avatarClasses = ["avatar-lilac", "avatar-blue", "avatar-peach", "avatar-green", "avatar-yellow", "avatar-pink"];

function showToast(message, kind = "success") {
  const toast = document.querySelector("[data-student-toast]");
  if (!toast) {
    console.error("Student page toast element is missing.");
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

function setFormError(message = "") {
  const element = document.querySelector("[data-student-form-error]");
  if (!element) {
    console.error("Student form error element is missing.");
    return;
  }
  element.textContent = message;
  element.hidden = !message;
}

function showRowsMessage(message) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 5;
  cell.className = "register-empty-cell";
  cell.textContent = message;
  row.append(cell);
  rowsElement.replaceChildren(row);
}

function runStudentAction(action, context) {
  try {
    Promise.resolve(action()).catch((error) => {
      console.error(`${context} failed:`, error);
      showToast(`Couldn’t ${context}. Please try again.`, "error");
    });
  } catch (error) {
    console.error(`${context} failed:`, error);
    showToast(`Couldn’t ${context}. Please try again.`, "error");
  }
}

function classLabel(classId) {
  const classRow = classes.find((item) => item.id === classId);
  return classRow ? `${classRow.name} · ${classRow.section}` : "Class unavailable";
}

function visibleStudents() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  return students.filter((student) => {
    const matchesClass = !classFilter.value || student.class_id === classFilter.value;
    const matchesSearch =
      `${student.full_name} ${student.roll_number} ${classLabel(student.class_id)}`
        .toLocaleLowerCase()
        .includes(query);
    return matchesClass && matchesSearch;
  });
}

function renderStudents() {
  const visible = visibleStudents();
  document.querySelector("[data-student-count]").textContent = `· ${students.length} records`;
  document.querySelector("[data-student-footer]").textContent =
    `Showing ${visible.length} of ${students.length} students`;

  if (!visible.length) {
    showRowsMessage(students.length ? "No students match your search or class filter." : "No students yet. Add a student to get started.");
    return;
  }

  const fragment = document.createDocumentFragment();
  visible.forEach((student) => {
    const row = document.createElement("tr");
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
    avatar.className = `student-avatar ${avatarClasses[student.full_name.length % avatarClasses.length]}`;
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = initials || "?";
    const names = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = student.full_name;
    const email = document.createElement("small");
    email.textContent = "Student";
    names.append(name, email);
    identity.append(avatar, names);
    identityCell.append(identity);

    const rollCell = document.createElement("td");
    rollCell.textContent = student.roll_number;
    const classCell = document.createElement("td");
    classCell.textContent = classLabel(student.class_id);
    const statusCell = document.createElement("td");
    const active = student.status === "active";
    const badge = document.createElement("span");
    badge.className = `badge ${active ? "badge-present" : "badge-neutral"}`;
    badge.textContent = active ? "Active" : "Inactive";
    statusCell.append(badge);

    const actionCell = document.createElement("td");
    const toggle = document.createElement("button");
    toggle.className = "button button-secondary student-status-button";
    toggle.type = "button";
    toggle.textContent = active ? "Deactivate" : "Reactivate";
    toggle.setAttribute("aria-label", `${active ? "Deactivate" : "Reactivate"} ${student.full_name}`);
    toggle.addEventListener("click", () => {
      void updateStudentStatus(student, active ? "inactive" : "active", toggle);
    });
    actionCell.append(toggle);
    row.append(identityCell, rollCell, classCell, statusCell, actionCell);
    fragment.append(row);
  });

  rowsElement.replaceChildren(fragment);
}

function populateClassSelect() {
  const activeClasses = classes.filter((classRow) => classRow.status === "active");
  const optionLists = [classFilter, studentForm.elements.namedItem("class_id")];

  optionLists.forEach((select) => {
    const firstOption = select === classFilter
      ? new Option("All classes", "")
      : new Option("Choose a class", "");
    select.replaceChildren(firstOption);
    activeClasses.forEach((classRow) => {
      select.append(new Option(`${classRow.name} · ${classRow.section}`, classRow.id));
    });
    if (select !== classFilter) select.disabled = activeClasses.length === 0;
  });

  document.querySelector("[data-open-student-form]").disabled = activeClasses.length === 0;
}

function openStudentForm() {
  studentForm.reset();
  setFormError();
  document.querySelector("#student-dialog-title").textContent = "Add a student";
  studentForm.elements.namedItem("class_id").disabled = classes.every((classRow) => classRow.status !== "active");
  studentDialog.showModal();
  studentForm.elements.namedItem("full_name").focus();
}

async function saveStudent(event) {
  event.preventDefault();
  if (studentSaveInProgress) return;
  setFormError();
  const formData = new FormData(studentForm);
  const payload = {
    teacher_id: teacherId,
    class_id: String(formData.get("class_id")),
    full_name: String(formData.get("full_name")).trim(),
    roll_number: String(formData.get("roll_number")).trim(),
    status: "active",
  };
  if (!payload.full_name || !payload.roll_number || !payload.class_id) {
    setFormError("Full name, roll number, and class are required.");
    return;
  }

  const submit = document.querySelector("[data-student-submit]");
  studentSaveInProgress = true;
  submit.disabled = true;
  submit.textContent = "Saving…";
  try {
    const { error } = await supabase.from("students").insert(payload);
    if (error) throw error;
    studentDialog.close();
    showToast("Student added.");
    await loadStudents();
  } catch (error) {
    console.error("Could not save student:", error);
    const detail = error.message?.toLowerCase().includes("duplicate")
      ? "That roll number is already in use in this class."
      : error.message?.toLowerCase().includes("row-level security")
        ? "Supabase denied this change. Confirm that you own the selected class."
        : "Couldn’t save this student. Check the connection and try again.";
    setFormError(detail);
    showToast(detail, "error");
  } finally {
    studentSaveInProgress = false;
    submit.disabled = false;
    submit.textContent = "Save student";
  }
}

async function updateStudentStatus(student, status, button) {
  if (button.disabled) return;
  button.disabled = true;
  try {
    const { error } = await supabase
      .from("students")
      .update({ status })
      .eq("id", student.id)
      .eq("teacher_id", teacherId);
    if (error) throw error;
    console.info(`Student ${student.id} status updated to ${status}.`);
    showToast(status === "active" ? "Student reactivated." : "Student deactivated.");
    await loadStudents();
  } catch (error) {
    console.error("Could not update student status:", error);
    showToast("Couldn’t update this student. Check your connection and try again.", "error");
  } finally {
    button.disabled = false;
  }
}

async function loadStudents() {
  rowsElement.setAttribute("aria-busy", "true");
  showRowsMessage("Loading student roster…");
  try {
    const [{ data: classData, error: classError }, { data: studentData, error: studentError }] =
      await Promise.all([
        supabase
          .from("classes")
          .select("id, name, section, academic_year, status")
          .eq("teacher_id", teacherId)
          .order("academic_year", { ascending: false })
          .order("name"),
        supabase
          .from("students")
          .select("id, teacher_id, class_id, roll_number, full_name, status")
          .eq("teacher_id", teacherId)
          .order("full_name"),
      ]);
    if (classError) throw classError;
    if (studentError) throw studentError;

    classes = classData ?? [];
    students = studentData ?? [];
    populateClassSelect();
    renderStudents();
  } catch (error) {
    console.error("Could not load students:", error);
    showRowsMessage("Couldn’t load the student roster. Check your connection and Supabase RLS policies.");
    document.querySelector("[data-student-footer]").textContent = "Student roster unavailable";
    showToast("Couldn’t load students. Please try again.", "error");
  } finally {
    rowsElement.setAttribute("aria-busy", "false");
  }
}

async function initialize() {
  const requiredElements = [
    ["[data-student-rows]", rowsElement],
    ["[data-student-search]", searchInput],
    ["[data-student-class-filter]", classFilter],
    ["[data-student-dialog]", studentDialog],
    ["[data-student-form]", studentForm],
    ["[data-open-student-form]", document.querySelector("[data-open-student-form]")],
    ["[data-student-count]", document.querySelector("[data-student-count]")],
    ["[data-student-footer]", document.querySelector("[data-student-footer]")],
    ["[data-student-submit]", document.querySelector("[data-student-submit]")],
    ["[data-student-form-error]", document.querySelector("[data-student-form-error]")],
    ["[data-student-toast]", document.querySelector("[data-student-toast]")],
    ["[data-close-student-dialog]", document.querySelector("[data-close-student-dialog]")],
  ];
  const missingElements = requiredElements
    .filter(([, element]) => !element)
    .map(([selector]) => selector);
  if (missingElements.length) {
    console.error(`Student page is missing required elements: ${missingElements.join(", ")}`);
    return;
  }

  document.querySelector("[data-open-student-form]").addEventListener("click", () => {
    runStudentAction(openStudentForm, "open student form");
  });
  document.querySelectorAll("[data-close-student-dialog]").forEach((button) => {
    button.addEventListener("click", () => studentDialog.close());
  });
  studentForm.addEventListener("submit", (event) => {
    runStudentAction(() => saveStudent(event), "save student");
  });
  searchInput.addEventListener("input", () => runStudentAction(renderStudents, "filter students"));
  classFilter.addEventListener("change", () => runStudentAction(renderStudents, "filter students"));

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    if (error) console.error("Could not verify the signed-in teacher:", error);
    window.location.replace("login.html");
    return;
  }
  teacherId = data.user.id;
  await loadStudents();
}

void initialize().catch((error) => {
  console.error("Could not initialize the student page:", error);
  showRowsMessage("Couldn’t initialize the student roster. Reload the page and try again.");
});
