import { supabase } from "./supabaseClient.js";

const classList = document.querySelector("[data-classes-list]");
const loadingState = document.querySelector("[data-class-loading]");
const emptyState = document.querySelector("[data-class-empty]");
const classDialog = document.querySelector("[data-class-dialog]");
const classForm = document.querySelector("[data-class-form]");
const subjectDialog = document.querySelector("[data-subject-dialog]");
const subjectForm = document.querySelector("[data-subject-form]");
const classSearch = document.querySelector("[data-class-search]");

let teacherId = null;
let classes = [];
let selectedView = "active";
let selectedSubjectClass = null;
let toastTimer = 0;

const iconClasses = [
  "class-icon-lilac",
  "class-icon-blue",
  "class-icon-peach",
  "class-icon-green",
  "class-icon-yellow",
  "class-icon-pink",
];

function showToast(message, kind = "success") {
  const toast = document.querySelector("[data-class-toast]");
  if (!toast) {
    console.error("Class page toast element is missing.");
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

function runUiAction(action, context) {
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

function setFormError(selector, message = "") {
  const element = document.querySelector(selector);
  if (!element) return;
  element.textContent = message;
  element.hidden = !message;
}

function readableError(error, context) {
  const message = error?.message?.toLowerCase() ?? "";
  if (message.includes("duplicate key") || message.includes("unique constraint")) {
    return "A class or subject with those details already exists.";
  }
  if (message.includes("row-level security") || message.includes("policy")) {
    return "Supabase denied this change. Confirm you’re signed in and the database RLS policies are installed.";
  }
  if (message.includes("fetch") || message.includes("network")) {
    return "Couldn’t reach Supabase. Check your connection and try again.";
  }
  console.error(`${context}:`, error);
  return `Couldn’t ${context}. Please try again.`;
}

function makeElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function getVisibleClasses() {
  const query = classSearch.value.trim().toLocaleLowerCase();
  return classes.filter((classRow) => {
    const matchesStatus = classRow.status === selectedView;
    const searchableText = [
      classRow.name,
      classRow.section,
      classRow.academic_year,
      classRow.description,
      ...(classRow.subjects ?? []).map((subject) => subject.name),
    ].join(" ").toLocaleLowerCase();
    return matchesStatus && searchableText.includes(query);
  });
}

function buildClassCard(classRow, index) {
  const card = makeElement("article", "class-card class-management-card");
  const header = makeElement("div", "class-card-header");
  const icon = makeElement("span", `class-icon ${iconClasses[index % iconClasses.length]}`);
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = classRow.name.match(/\d+/)?.[0] ?? classRow.name.slice(0, 2).toLocaleUpperCase();

  const status = makeElement(
    "span",
    `badge ${classRow.status === "active" ? "badge-present" : "badge-neutral"}`,
    classRow.status === "active" ? "Active" : "Archived",
  );
  header.append(icon, status);

  const grade = makeElement("p", "class-grade");
  grade.append(
    document.createTextNode(classRow.name),
    makeElement("span", "", "·"),
    document.createTextNode(classRow.section),
  );

  const title = makeElement("h2", "", `${classRow.name} · ${classRow.section}`);
  const year = makeElement("p", "class-card-meta", `Academic year ${classRow.academic_year}`);
  const description = makeElement(
    "p",
    "class-description",
    classRow.description?.trim() || "No description added.",
  );

  const subjectNames = (classRow.subjects ?? []).map((subject) => subject.name);
  const subjectPreview = makeElement(
    "p",
    "class-subject-preview",
    subjectNames.length
      ? subjectNames.slice(0, 3).join(" · ") + (subjectNames.length > 3 ? ` +${subjectNames.length - 3}` : "")
      : "No subjects added yet",
  );
  const footer = makeElement("div", "class-card-footer");
  const counts = makeElement("span", "class-card-counts");
  counts.append(
    makeElement("span", "", `${classRow.students?.length ?? 0} students`),
    makeElement("span", "", `${subjectNames.length} subjects`),
  );
  footer.append(counts);

  const actions = makeElement("div", "class-card-actions");
  const subjectsButton = makeElement("button", "button button-secondary", "Manage subjects");
  subjectsButton.type = "button";
  subjectsButton.addEventListener("click", () => {
    runUiAction(() => openSubjects(classRow), "open class subjects");
  });

  const editButton = makeElement("button", "button button-secondary", "Edit");
  editButton.type = "button";
  editButton.addEventListener("click", () => {
    runUiAction(() => openClassForm(classRow), "open class editor");
  });

  const archiveButton = makeElement(
    "button",
    "button button-quiet",
    classRow.status === "active" ? "Archive" : "Reactivate",
  );
  archiveButton.type = "button";
  archiveButton.addEventListener("click", () => {
    runUiAction(
      () => updateClassStatus(classRow, classRow.status === "active" ? "archived" : "active"),
      "update class status",
    );
  });

  actions.append(subjectsButton, editButton, archiveButton);
  card.append(header, grade, title, year, description, subjectPreview, footer, actions);
  return card;
}

function renderClasses() {
  const visibleClasses = getVisibleClasses();
  const activeCount = classes.filter((classRow) => classRow.status === "active").length;
  const archivedCount = classes.length - activeCount;

  document.querySelector("[data-active-count]").textContent = String(activeCount);
  document.querySelector("[data-archived-count]").textContent = String(archivedCount);
  document.querySelector("[data-results-label]").textContent =
    `${visibleClasses.length} ${visibleClasses.length === 1 ? "class" : "classes"} ${selectedView}`;

  classList.replaceChildren();
  visibleClasses.forEach((classRow, index) => {
    classList.append(buildClassCard(classRow, index));
  });

  const hasClasses = classes.length > 0;
  const isEmpty = visibleClasses.length === 0;
  classList.hidden = isEmpty;
  emptyState.hidden = !isEmpty;
  if (isEmpty) {
    const title = document.querySelector("[data-empty-title]");
    const copy = document.querySelector("[data-empty-copy]");
    const action = document.querySelector("[data-empty-action]");
    const isSearch = Boolean(classSearch.value.trim());
    const noResults = isSearch;

    title.textContent = noResults
      ? "No matching classes"
      : selectedView === "archived"
        ? "No archived classes"
        : hasClasses
          ? "No active classes"
          : "No classes yet";
    copy.textContent = noResults
      ? "Try another search or switch to your active classes."
      : selectedView === "archived"
        ? "Archived classes will appear here."
        : hasClasses
          ? "Reactivate an archived class or add a new class to get started."
          : "Add your first class to start organizing subjects and students.";
    action.hidden = noResults || (selectedView === "archived" && hasClasses);
  }
}

async function loadClasses() {
  classList.replaceChildren(loadingState);
  loadingState.hidden = false;
  classList.hidden = true;
  emptyState.hidden = true;

  let classRows;
  let error;
  try {
    ({ data: classRows, error } = await supabase
      .from("classes")
      .select("id, teacher_id, name, section, academic_year, description, status, created_at")
      .eq("teacher_id", teacherId)
      .order("academic_year", { ascending: false })
      .order("name", { ascending: true })
      .order("section", { ascending: true }));
    if (!error && classRows?.length) {
      const classIds = classRows.map((classRow) => classRow.id);
      const [
        { data: studentRows, error: studentsError },
        { data: subjectRows, error: subjectsError },
      ] = await Promise.all([
        supabase
          .from("students")
          .select("id, class_id")
          .eq("teacher_id", teacherId)
          .in("class_id", classIds),
        supabase
          .from("subjects")
          .select("id, class_id, name, code")
          .in("class_id", classIds),
      ]);

      error = studentsError || subjectsError;
      if (!error) {
        const studentsByClass = new Map();
        const subjectsByClass = new Map();
        (studentRows ?? []).forEach((student) => {
          const rows = studentsByClass.get(student.class_id) ?? [];
          rows.push(student);
          studentsByClass.set(student.class_id, rows);
        });
        (subjectRows ?? []).forEach((subject) => {
          const rows = subjectsByClass.get(subject.class_id) ?? [];
          rows.push(subject);
          subjectsByClass.set(subject.class_id, rows);
        });
        classRows = classRows.map((classRow) => ({
          ...classRow,
          students: studentsByClass.get(classRow.id) ?? [],
          subjects: subjectsByClass.get(classRow.id) ?? [],
        }));
      }
    }
  } catch (requestError) {
    error = requestError;
  }

  loadingState.hidden = true;
  if (error) {
    console.error("Could not load classes:", error);
    classList.hidden = true;
    emptyState.hidden = false;
    document.querySelector("[data-empty-title]").textContent = "Couldn’t load classes";
    document.querySelector("[data-empty-copy]").textContent =
      "Check your connection and Supabase table/RLS configuration, then reload this page.";
    document.querySelector("[data-empty-action]").hidden = true;
    showToast("Couldn’t load classes. Please try again.", "error");
    return;
  }

  classes = classRows ?? [];
  renderClasses();
}

function openClassForm(classRow = null) {
  classForm.reset();
  setFormError("[data-class-form-error]");
  classForm.dataset.classId = classRow?.id ?? "";
  document.querySelector("#class-dialog-title").textContent = classRow ? "Edit class" : "Add a class";
  classForm.elements.namedItem("name").value = classRow?.name ?? "";
  classForm.elements.namedItem("section").value = classRow?.section ?? "";
  classForm.elements.namedItem("academic_year").value = classRow?.academic_year ?? "";
  classForm.elements.namedItem("description").value = classRow?.description ?? "";
  classDialog.showModal();
  classForm.elements.name.focus();
}

function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
}

async function saveClass(event) {
  event.preventDefault();
  setFormError("[data-class-form-error]");
  const submit = document.querySelector("[data-class-submit]");
  submit.disabled = true;
  submit.textContent = classForm.dataset.classId ? "Saving…" : "Adding…";
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user || authData.user.id !== teacherId) {
      throw new Error("Your session is no longer valid. Please sign in again.");
    }

    const formData = new FormData(classForm);
    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      section: String(formData.get("section") ?? "").trim(),
      academic_year: String(formData.get("academic_year") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim() || null,
      teacher_id: authData.user.id,
    };
    if (!payload.name || !payload.section || !payload.academic_year) {
      setFormError("[data-class-form-error]", "Class name, section, and academic year are required.");
      return;
    }

    let query = supabase.from("classes");
    if (classForm.dataset.classId) {
      query = query
        .update(payload)
        .eq("id", classForm.dataset.classId)
        .eq("teacher_id", authData.user.id);
    } else {
      query = query.insert(payload);
    }

    const { error } = await query;
    if (error) throw error;

    closeDialog(classDialog);
    showToast(classForm.dataset.classId ? "Class details updated." : "Class added.");
    await loadClasses();
  } catch (error) {
    console.error("Could not save class:", error);
    const message = error instanceof Error && error.message.includes("session is no longer valid")
      ? "Your session expired. Please sign in again."
      : readableError(error, "save class");
    setFormError("[data-class-form-error]", message);
  } finally {
    submit.disabled = false;
    submit.textContent = "Save class";
  }
}

async function updateClassStatus(classRow, status) {
  const { error } = await supabase
    .from("classes")
    .update({ status })
    .eq("id", classRow.id)
    .eq("teacher_id", teacherId);

  if (error) {
    console.error("Could not update class status:", error);
    showToast(readableError(error, "update class status"), "error");
    return;
  }

  showToast(status === "archived" ? "Class archived." : "Class reactivated.");
  await loadClasses();
}

function renderSubjects(subjects) {
  const list = document.querySelector("[data-subject-list]");
  list.replaceChildren();
  if (!subjects.length) {
    list.append(makeElement("p", "subject-empty", "No subjects yet. Add the first subject for this class."));
    return;
  }

  subjects.forEach((subject) => {
    const item = makeElement("div", "subject-list-item");
    const identity = makeElement("span", "subject-list-identity");
    identity.append(
      makeElement("strong", "", subject.name),
      makeElement("small", "", subject.code || "No subject code"),
    );
    const edit = makeElement("button", "button button-secondary subject-edit-button", "Edit");
    edit.type = "button";
    edit.addEventListener("click", () => {
      runUiAction(() => openSubjectEdit(subject), "open subject editor");
    });
    item.append(identity, edit);
    list.append(item);
  });
}

async function loadSubjects(classId) {
  const list = document.querySelector("[data-subject-list]");
  list.replaceChildren(makeElement("p", "subject-empty", "Loading subjects…"));
  const { data, error } = await supabase
    .from("subjects")
    .select("id, class_id, name, code, created_at")
    .eq("class_id", classId)
    .order("name", { ascending: true });

  if (error) {
    console.error("Could not load subjects:", error);
    list.replaceChildren(makeElement("p", "subject-error", "Couldn’t load subjects. Check your connection and try again."));
    showToast(readableError(error, "load subjects"), "error");
    return;
  }

  renderSubjects(data ?? []);
}

function openSubjects(classRow) {
  selectedSubjectClass = classRow;
  subjectForm.reset();
  subjectForm.dataset.subjectId = "";
  document.querySelector("[data-subject-class-name]").textContent =
    `${classRow.name} · ${classRow.section} · ${classRow.academic_year}`;
  document.querySelector("[data-subject-submit]").textContent = "Add subject";
  setFormError("[data-subject-form-error]");
  subjectDialog.showModal();
  runUiAction(() => loadSubjects(classRow.id), "load subjects");
}

function openSubjectEdit(subject) {
  subjectForm.dataset.subjectId = subject.id;
  subjectForm.elements.namedItem("name").value = subject.name;
  subjectForm.elements.namedItem("code").value = subject.code ?? "";
  document.querySelector("[data-subject-submit]").textContent = "Save subject";
  subjectForm.elements.namedItem("name").focus();
}

async function saveSubject(event) {
  event.preventDefault();
  setFormError("[data-subject-form-error]");
  if (!selectedSubjectClass) return;

  const formData = new FormData(subjectForm);
  const payload = {
    name: String(formData.get("name")).trim(),
    code: String(formData.get("code")).trim() || null,
  };
  if (!payload.name) {
    setFormError("[data-subject-form-error]", "Subject name is required.");
    return;
  }

  const submit = document.querySelector("[data-subject-submit]");
  submit.disabled = true;
  submit.textContent = subjectForm.dataset.subjectId ? "Saving…" : "Adding…";
  let query = supabase.from("subjects");
  if (subjectForm.dataset.subjectId) {
    query = query
      .update(payload)
      .eq("id", subjectForm.dataset.subjectId)
      .eq("class_id", selectedSubjectClass.id);
  } else {
    query = query.insert({ ...payload, class_id: selectedSubjectClass.id });
  }

  let error;
  try {
    ({ error } = await query);
  } catch (requestError) {
    submit.disabled = false;
    submit.textContent = subjectForm.dataset.subjectId ? "Save subject" : "Add subject";
    console.error("Could not save subject:", requestError);
    setFormError("[data-subject-form-error]", readableError(requestError, "save subject"));
    return;
  }
  submit.disabled = false;
  submit.textContent = subjectForm.dataset.subjectId ? "Save subject" : "Add subject";
  if (error) {
    console.error("Could not save subject:", error);
    setFormError("[data-subject-form-error]", readableError(error, "save subject"));
    return;
  }

  const wasEdit = Boolean(subjectForm.dataset.subjectId);
  subjectForm.reset();
  subjectForm.dataset.subjectId = "";
  submit.textContent = "Add subject";
  showToast(wasEdit ? "Subject updated." : "Subject added.");
  await loadSubjects(selectedSubjectClass.id);
  await loadClasses();
}

function initializeControls() {
  document.querySelectorAll("[data-open-class-form], [data-empty-action]").forEach((button) => {
    button.addEventListener("click", () => {
      runUiAction(() => openClassForm(), "open class form");
    });
  });
  document.querySelectorAll("[data-close-class-dialog]").forEach((button) => {
    button.addEventListener("click", () => closeDialog(classDialog));
  });
  document.querySelector("[data-close-subject-dialog]").addEventListener("click", () => {
    closeDialog(subjectDialog);
  });
  classForm.addEventListener("submit", (event) => {
    runUiAction(() => saveClass(event), "save class");
  });
  subjectForm.addEventListener("submit", (event) => {
    runUiAction(() => saveSubject(event), "save subject");
  });
  classSearch.addEventListener("input", () => {
    runUiAction(renderClasses, "filter classes");
  });
  document.querySelectorAll("[data-class-view]").forEach((button) => {
    button.addEventListener("click", () => {
      runUiAction(() => {
        selectedView = button.dataset.classView;
        document.querySelectorAll("[data-class-view]").forEach((tab) => {
          const isActive = tab === button;
          tab.classList.toggle("is-active", isActive);
          tab.setAttribute("aria-pressed", String(isActive));
        });
        renderClasses();
      }, "change class view");
    });
  });
}

async function initialize() {
  const requiredElements = [
    ["[data-classes-list]", classList],
    ["[data-class-loading]", loadingState],
    ["[data-class-empty]", emptyState],
    ["[data-class-dialog]", classDialog],
    ["[data-class-form]", classForm],
    ["[data-subject-dialog]", subjectDialog],
    ["[data-subject-form]", subjectForm],
    ["[data-class-search]", classSearch],
    ["[data-close-subject-dialog]", document.querySelector("[data-close-subject-dialog]")],
    ["[data-subject-list]", document.querySelector("[data-subject-list]")],
    ["[data-class-toast]", document.querySelector("[data-class-toast]")],
    ["[data-active-count]", document.querySelector("[data-active-count]")],
    ["[data-archived-count]", document.querySelector("[data-archived-count]")],
    ["[data-results-label]", document.querySelector("[data-results-label]")],
    ["[data-empty-title]", document.querySelector("[data-empty-title]")],
    ["[data-empty-copy]", document.querySelector("[data-empty-copy]")],
    ["[data-class-submit]", document.querySelector("[data-class-submit]")],
    ["[data-subject-submit]", document.querySelector("[data-subject-submit]")],
    ["[data-subject-class-name]", document.querySelector("[data-subject-class-name]")],
    ["[data-class-form-error]", document.querySelector("[data-class-form-error]")],
    ["[data-subject-form-error]", document.querySelector("[data-subject-form-error]")],
  ];
  const missingElements = requiredElements
    .filter(([, element]) => !element)
    .map(([selector]) => selector);
  if (missingElements.length) {
    console.error(`Class page is missing required elements: ${missingElements.join(", ")}`);
    return;
  }
  if (!document.querySelector("[data-open-class-form]") ||
      !document.querySelector("[data-close-class-dialog]") ||
      !document.querySelector("[data-class-view]")) {
    console.error("Class page is missing one or more class action controls.");
    return;
  }

  initializeControls();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    if (error) console.error("Could not verify the current teacher:", error);
    window.location.replace("login.html");
    return;
  }

  teacherId = data.user.id;
  await loadClasses();
}

void initialize().catch((error) => {
  console.error("Could not initialize class management:", error);
  loadingState.hidden = true;
  classList.hidden = true;
  emptyState.hidden = false;
  document.querySelector("[data-empty-title]").textContent = "Something went wrong";
  document.querySelector("[data-empty-copy]").textContent = "Reload the page and try again.";
  document.querySelector("[data-empty-action]").hidden = true;
});
