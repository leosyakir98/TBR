const form = document.getElementById("report-form");
const titleInput = document.getElementById("title");
const dateInput = document.getElementById("date");
const teamInput = document.getElementById("team");
const workModeInput = document.getElementById("work-mode");
const sessionList = document.getElementById("session-list");
const addSessionBtn = document.getElementById("add-session-btn");

const liveTime = document.getElementById("live-time");
const reportTitle = document.getElementById("report-title");
const previewText = document.getElementById("preview-text");
const hoursOutput = document.getElementById("hours-output");
const previewDay = document.getElementById("preview-day");
const sessionCount = document.getElementById("session-count");
const editStatus = document.getElementById("edit-status");

const clearFormBtn = document.getElementById("clear-form-btn");
const saveRecordBtn = document.getElementById("save-record-btn");
const copyBtn = document.getElementById("copy-btn");
const exportBtn = document.getElementById("export-btn");
const exportHistoryBtn = document.getElementById("export-history-btn");
const clearHistoryBtn = document.getElementById("clear-history-btn");

const historyList = document.getElementById("history-list");
const historyEmpty = document.getElementById("history-empty");
const adminToggleBtn = document.getElementById("admin-toggle-btn");
const adminPanel = document.getElementById("admin-panel");
const adminLoginBtn = document.getElementById("admin-login-btn");
const adminLogoutBtn = document.getElementById("admin-logout-btn");
const adminUsernameInput = document.getElementById("admin-username");
const adminPasswordInput = document.getElementById("admin-password");
const adminStatus = document.getElementById("admin-status");

const SUPABASE_URL = "https://ulwnlwdjawxfmvcxfbxb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsd25sd2RqYXd4Zm12Y3hmYnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMTk3MDYsImV4cCI6MjA5MDg5NTcwNn0.jIM4gmyW9c0jvUmKbd78Rpsnzmy0r9RdThfFDvY7axk";
const TABLE_NAME = "attendance_records";
const ADMIN_STATE_KEY = "attendance-tracker-admin-state";
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "HSUJ";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let sessions = [];
let historyRecords = [];
let historyChannel = null;
let currentRecordId = null;

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createSession(session = {}) {
  return {
    id: session.id || createId(),
    clockIn: session.clockIn || session.clock_in || "",
    clockOut: session.clockOut || session.clock_out || "",
    breakMinutes: session.breakMinutes ?? session.break_minutes ?? "",
    plan: session.plan || "",
    update: session.update || ""
  };
}

function bindEvent(element, eventName, handler) {
  if (!element) {
    return;
  }

  element.addEventListener(eventName, handler);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function setTodayDate() {
  if (!dateInput.value) {
    const now = new Date();
    dateInput.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
}

function updateClock() {
  if (!liveTime) {
    return;
  }

  liveTime.textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatDateLabel(dateValue) {
  if (!dateValue) {
    return "No date selected";
  }

  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  const ordinal = day % 10 === 1 && day !== 11
    ? "st"
    : day % 10 === 2 && day !== 12
      ? "nd"
      : day % 10 === 3 && day !== 13
        ? "rd"
        : "th";

  return `${day}${ordinal} ${date.toLocaleString("en-US", { month: "long" })} ${year}`;
}

function formatTime(value, includeMode, workMode) {
  if (!value) {
    return "-";
  }

  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  const suffix = hours >= 12 ? "pm" : "am";
  const normalizedHour = hours % 12 || 12;
  const text = `${normalizedHour}.${pad(minutes)} ${suffix}`;

  return includeMode && workMode ? `${text} (${workMode})` : text;
}

function getWorkedMinutes(clockIn, clockOut, breakMinutes) {
  if (!clockIn || !clockOut) {
    return 0;
  }

  const [inHour, inMinute] = clockIn.split(":").map(Number);
  const [outHour, outMinute] = clockOut.split(":").map(Number);

  let total = (outHour * 60 + outMinute) - (inHour * 60 + inMinute);

  if (total < 0) {
    total += 24 * 60;
  }

  return Math.max(total - Number(breakMinutes || 0), 0);
}

function getTotalWorkedMinutes(items) {
  return items.reduce((sum, session) => {
    return sum + getWorkedMinutes(session.clockIn, session.clockOut, session.breakMinutes);
  }, 0);
}

function formatWorkedHours(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} hours`;
  }

  return `${hours} hours ${minutes} minutes`;
}

function getFormData() {
  return {
    title: titleInput.value.trim(),
    date: dateInput.value,
    team: teamInput.value.trim(),
    workMode: workModeInput.value,
    sessions: sessions.map((session) => ({
      clockIn: session.clockIn,
      clockOut: session.clockOut,
      breakMinutes: session.breakMinutes === "" ? "" : Number(session.breakMinutes),
      plan: session.plan.trim(),
      update: session.update.trim()
    }))
  };
}

function renderSessions() {
  sessionList.innerHTML = "";

  sessions.forEach((session, index) => {
    const card = document.createElement("article");
    card.className = "session-card";

    card.innerHTML = `
      <div class="session-card-header">
        <div>
          <h4>Session ${index + 1}</h4>
          <p class="session-meta">${formatWorkedHours(getWorkedMinutes(session.clockIn, session.clockOut, session.breakMinutes))}</p>
        </div>
        <button class="small-button" type="button" data-action="remove-session" data-session-id="${session.id}" ${sessions.length === 1 ? "disabled" : ""}>Remove</button>
      </div>

      <div class="session-grid">
        <label>
          <span>Clock in</span>
          <input type="time" data-field="clockIn" data-session-id="${session.id}" value="${session.clockIn}">
        </label>

        <label>
          <span>Clock out</span>
          <input type="time" data-field="clockOut" data-session-id="${session.id}" value="${session.clockOut}">
        </label>

        <label>
          <span>Break minutes</span>
          <input type="number" min="0" step="5" data-field="breakMinutes" data-session-id="${session.id}" value="${session.breakMinutes}">
        </label>
      </div>

      <div class="session-notes">
        <label>
          <span>Plan / follow-up for this session</span>
          <textarea rows="4" data-field="plan" data-session-id="${session.id}">${session.plan}</textarea>
        </label>

        <label>
          <span>Update on outcomes for this session</span>
          <textarea rows="4" data-field="update" data-session-id="${session.id}">${session.update}</textarea>
        </label>
      </div>
    `;

    sessionList.appendChild(card);
  });

  sessionCount.textContent = String(sessions.length);
}

function buildReportText(data) {
  const totalMinutes = getTotalWorkedMinutes(data.sessions);

  const sessionLines = data.sessions.map((session, index) => {
    const sessionMinutes = getWorkedMinutes(session.clockIn, session.clockOut, session.breakMinutes);

    return [
      `Session ${index + 1}: ${formatTime(session.clockIn, index === 0, data.workMode)} to ${formatTime(session.clockOut, false, data.workMode)} | Break ${session.breakMinutes || 0} min | ${formatWorkedHours(sessionMinutes)}`,
      `Plan / follow-up: ${session.plan || "-"}`,
      `Update on outcomes: ${session.update || "-"}`
    ].join("\n");
  });

  return [
    `Date: ${formatDateLabel(data.date)}`,
    `Total working hours: ${formatWorkedHours(totalMinutes)}`,
    `Team: ${data.team || "-"}`,
    "",
    "Sessions:",
    sessionLines.length ? sessionLines.join("\n\n") : "-"
  ].join("\n");
}

function updatePreview() {
  const data = getFormData();

  reportTitle.textContent = data.title || "Untitled Project";
  previewText.textContent = buildReportText(data);
  hoursOutput.textContent = formatWorkedHours(getTotalWorkedMinutes(data.sessions));
  previewDay.textContent = data.date
    ? new Date(`${data.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" })
    : "Today";
}

function isAdmin() {
  return localStorage.getItem(ADMIN_STATE_KEY) === "true";
}

function setAdminState(value) {
  localStorage.setItem(ADMIN_STATE_KEY, String(value));
  updateAdminUi();
}

function updateAdminUi() {
  const loggedIn = isAdmin();

  document.querySelectorAll(".admin-only").forEach((node) => {
    node.hidden = !loggedIn;
  });

  adminToggleBtn.textContent = loggedIn ? "Admin Active" : "Admin Login";
  adminLoginBtn.hidden = loggedIn;
  adminLogoutBtn.hidden = !loggedIn;

  if (!adminStatus.dataset.messageLocked) {
    adminStatus.textContent = loggedIn
      ? "Admin access enabled. You can now delete records and clear history."
      : "Admin access is required to delete records or clear history.";
  }
}

function setStatusMessage(message) {
  adminStatus.dataset.messageLocked = "true";
  adminStatus.textContent = message;

  window.setTimeout(() => {
    delete adminStatus.dataset.messageLocked;
    updateAdminUi();
  }, 2000);
}

function setEditingState(record) {
  currentRecordId = record ? record.id : null;
  editStatus.textContent = record ? "Editing Saved Record" : "New Record";
  saveRecordBtn.textContent = record ? "Update Record" : "Save Record";
}

function mapFormToRecord(data) {
  const firstSession = data.sessions[0] || {};
  const lastSession = data.sessions[data.sessions.length - 1] || {};
  const totalBreakMinutes = data.sessions.reduce((sum, session) => sum + Number(session.breakMinutes || 0), 0);

  return {
    project_title: data.title || "",
    work_date: data.date || null,
    team: data.team || "",
    work_mode: data.workMode || "",
    clock_in: firstSession.clockIn || null,
    clock_out: lastSession.clockOut || null,
    break_minutes: totalBreakMinutes || null,
    follow_up: data.sessions.map((session, index) => `Session ${index + 1}: ${session.plan || "-"}`).join("\n\n"),
    updates: data.sessions.map((session, index) => `Session ${index + 1}: ${session.update || "-"}`).join("\n\n"),
    sessions: data.sessions
  };
}

function mapRecordToForm(record) {
  const mappedSessions = Array.isArray(record.sessions) && record.sessions.length
    ? record.sessions.map((session) => createSession(session))
    : [createSession({
        clockIn: record.clock_in,
        clockOut: record.clock_out,
        breakMinutes: record.break_minutes,
        plan: "",
        update: ""
      })];

  return {
    id: record.id,
    title: record.project_title || "",
    date: record.work_date || "",
    team: record.team || "",
    workMode: record.work_mode || "remote/field",
    sessions: mappedSessions
  };
}

function fillForm(record) {
  const mapped = mapRecordToForm(record);

  titleInput.value = mapped.title;
  dateInput.value = mapped.date;
  teamInput.value = mapped.team;
  workModeInput.value = mapped.workMode;
  sessions = mapped.sessions;

  renderSessions();
  setEditingState(record);
  updatePreview();
}

function getHistoryLabel(record) {
  const mapped = mapRecordToForm(record);
  return `${formatDateLabel(mapped.date)} | ${formatWorkedHours(getTotalWorkedMinutes(mapped.sessions))} | ${mapped.sessions.length} sessions`;
}

async function loadHistoryFromSupabase() {
  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .select("*")
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    historyRecords = [];
    renderHistory();
    setStatusMessage(`Supabase load error: ${error.message}`);
    return;
  }

  historyRecords = data || [];
  renderHistory();
}

function subscribeToHistoryChanges() {
  if (historyChannel) {
    supabaseClient.removeChannel(historyChannel);
  }

  historyChannel = supabaseClient
    .channel("attendance-records-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: TABLE_NAME }, async () => {
      await loadHistoryFromSupabase();
    })
    .subscribe();
}

async function saveRecordToSupabase() {
  const data = getFormData();

  if (!data.date) {
    const original = saveRecordBtn.textContent;
    saveRecordBtn.textContent = "Select date first";
    window.setTimeout(() => {
      saveRecordBtn.textContent = currentRecordId ? "Update Record" : original;
    }, 1500);
    return;
  }

  const payload = mapFormToRecord(data);

  const result = currentRecordId
    ? await supabaseClient.from(TABLE_NAME).update(payload).eq("id", currentRecordId)
    : await supabaseClient.from(TABLE_NAME).upsert(payload, { onConflict: "work_date" });

  if (result.error) {
    setStatusMessage(`Supabase save error: ${result.error.message}`);
    return;
  }

  saveRecordBtn.textContent = currentRecordId ? "Updated" : "Saved";
  window.setTimeout(() => {
    saveRecordBtn.textContent = currentRecordId ? "Update Record" : "Save Record";
  }, 1500);

  await loadHistoryFromSupabase();
}

async function deleteHistoryItem(id) {
  if (!isAdmin()) {
    setStatusMessage("Admin login required to delete records.");
    return;
  }

  const { error } = await supabaseClient.from(TABLE_NAME).delete().eq("id", id);

  if (error) {
    setStatusMessage(`Supabase delete error: ${error.message}`);
    return;
  }

  if (currentRecordId === id) {
    clearForm();
  }

  await loadHistoryFromSupabase();
}

function renderHistory() {
  historyList.innerHTML = "";

  if (historyRecords.length === 0) {
    historyEmpty.hidden = false;
    historyList.appendChild(historyEmpty);
    return;
  }

  historyEmpty.hidden = true;

  historyRecords.forEach((record) => {
    const item = document.createElement("article");
    item.className = "history-item";

    const content = document.createElement("div");
    const heading = document.createElement("h3");
    heading.textContent = record.project_title || "Untitled Project";

    const meta = document.createElement("p");
    meta.className = "history-meta";
    meta.textContent = getHistoryLabel(record);

    content.appendChild(heading);
    content.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "small-button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => fillForm(record));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "small-button admin-only";
    deleteButton.textContent = "Delete";
    deleteButton.hidden = !isAdmin();
    deleteButton.addEventListener("click", () => deleteHistoryItem(record.id));

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);

    item.appendChild(content);
    item.appendChild(actions);

    historyList.appendChild(item);
  });
}

function clearForm() {
  titleInput.value = "";
  dateInput.value = "";
  teamInput.value = "";
  workModeInput.value = "remote/field";

  sessions = [createSession()];
  renderSessions();
  setEditingState(null);
  updatePreview();
}

function toggleAdminPanel() {
  adminPanel.hidden = !adminPanel.hidden;
}

function loginAdmin() {
  const username = adminUsernameInput.value.trim();
  const password = adminPasswordInput.value;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    setAdminState(true);
    adminPasswordInput.value = "";
    setStatusMessage("Admin login successful.");
    renderHistory();
    return;
  }

  setAdminState(false);
  setStatusMessage("Invalid admin username or password.");
}

function logoutAdmin() {
  setAdminState(false);
  adminUsernameInput.value = "";
  adminPasswordInput.value = "";
  setStatusMessage("Admin logged out.");
  renderHistory();
}

function buildExportRow(data) {
  return {
    "Project Title": data.title || "",
    Date: formatDateLabel(data.date),
    Team: data.team || "",
    "Work Mode": data.workMode || "",
    Sessions: data.sessions.length,
    "Total Hours": formatWorkedHours(getTotalWorkedMinutes(data.sessions)),
    "Session Details": data.sessions.map((session, index) => {
      return [
        `Session ${index + 1}`,
        `Time: ${session.clockIn || "-"} - ${session.clockOut || "-"}`,
        `Break: ${session.breakMinutes || 0} min`,
        `Plan: ${session.plan || "-"}`,
        `Update: ${session.update || "-"}`
      ].join(" | ");
    }).join(" || ")
  };
}

function exportRowsAsXlsx(sheetName, rows, fileName) {
  const worksheet = window.XLSX.utils.json_to_sheet(rows);
  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  window.XLSX.writeFile(workbook, fileName);
}

function exportToExcel() {
  exportRowsAsXlsx("Current Record", [buildExportRow(getFormData())], "attendance-record.xlsx");
}

function exportHistoryToExcel() {
  if (historyRecords.length === 0) {
    exportHistoryBtn.textContent = "No history";
    window.setTimeout(() => {
      exportHistoryBtn.textContent = "Export Full History";
    }, 1500);
    return;
  }

  const rows = historyRecords
    .slice()
    .sort((a, b) => (a.work_date || "").localeCompare(b.work_date || ""))
    .map((record) => buildExportRow(mapRecordToForm(record)));

  exportRowsAsXlsx("Attendance History", rows, "attendance-history.xlsx");
}

async function clearAllHistory() {
  if (!isAdmin()) {
    setStatusMessage("Admin login required to clear history.");
    return;
  }

  const { error } = await supabaseClient.from(TABLE_NAME).delete().not("id", "is", null);

  if (error) {
    setStatusMessage(`Supabase clear error: ${error.message}`);
    return;
  }

  setStatusMessage("History cleared.");
  clearForm();
  await loadHistoryFromSupabase();
}

bindEvent(addSessionBtn, "click", () => {
  sessions.push(createSession());
  renderSessions();
  updatePreview();
});

bindEvent(sessionList, "input", (event) => {
  const sessionId = event.target.dataset.sessionId;
  const field = event.target.dataset.field;

  if (!sessionId || !field) {
    return;
  }

  sessions = sessions.map((session) => {
    if (session.id !== sessionId) {
      return session;
    }

    return {
      ...session,
      [field]: event.target.value
    };
  });

  renderSessions();
  updatePreview();
});

bindEvent(sessionList, "click", (event) => {
  if (event.target.dataset.action !== "remove-session") {
    return;
  }

  const sessionId = event.target.dataset.sessionId;
  sessions = sessions.filter((session) => session.id !== sessionId);

  if (sessions.length === 0) {
    sessions = [createSession()];
  }

  renderSessions();
  updatePreview();
});

bindEvent(clearFormBtn, "click", clearForm);
bindEvent(saveRecordBtn, "click", saveRecordToSupabase);
bindEvent(copyBtn, "click", async () => {
  const data = getFormData();
  await navigator.clipboard.writeText(`${data.title || "Untitled Project"}\n${buildReportText(data)}`);
});
bindEvent(exportBtn, "click", exportToExcel);
bindEvent(exportHistoryBtn, "click", exportHistoryToExcel);
bindEvent(adminToggleBtn, "click", toggleAdminPanel);
bindEvent(adminLoginBtn, "click", loginAdmin);
bindEvent(adminLogoutBtn, "click", logoutAdmin);
bindEvent(clearHistoryBtn, "click", clearAllHistory);
bindEvent(form, "input", updatePreview);

setTodayDate();
sessions = [createSession()];
renderSessions();
setEditingState(null);
updateClock();
updateAdminUi();
updatePreview();
loadHistoryFromSupabase();
subscribeToHistoryChanges();
window.setInterval(updateClock, 1000);
