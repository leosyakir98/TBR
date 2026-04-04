const form = document.getElementById("report-form");
const titleInput = document.getElementById("title");
const previewText = document.getElementById("preview-text");
const reportTitle = document.getElementById("report-title");
const liveTime = document.getElementById("live-time");
const clockInBtn = document.getElementById("clock-in-btn");
const clockOutBtn = document.getElementById("clock-out-btn");
const hoursOutput = document.getElementById("hours-output");
const clearFormBtn = document.getElementById("clear-form-btn");
const saveRecordBtn = document.getElementById("save-record-btn");
const copyBtn = document.getElementById("copy-btn");
const exportBtn = document.getElementById("export-btn");
const exportHistoryBtn = document.getElementById("export-history-btn");
const clearHistoryBtn = document.getElementById("clear-history-btn");
const adminToggleBtn = document.getElementById("admin-toggle-btn");
const adminPanel = document.getElementById("admin-panel");
const adminLoginBtn = document.getElementById("admin-login-btn");
const adminLogoutBtn = document.getElementById("admin-logout-btn");
const adminUsernameInput = document.getElementById("admin-username");
const adminPasswordInput = document.getElementById("admin-password");
const adminStatus = document.getElementById("admin-status");
const previewDay = document.getElementById("preview-day");
const previewMetaTime = document.getElementById("preview-meta-time");
const historyList = document.getElementById("history-list");
const historyEmpty = document.getElementById("history-empty");

const dateInput = document.getElementById("date");
const teamInput = document.getElementById("team");
const workModeInput = document.getElementById("work-mode");
const clockInInput = document.getElementById("clock-in");
const clockOutInput = document.getElementById("clock-out");
const breakMinutesInput = document.getElementById("break-minutes");
const followUpInput = document.getElementById("follow-up");
const updatesInput = document.getElementById("updates");

const STORAGE_KEY = "attendance-tracker-history-v1";
const ADMIN_STATE_KEY = "attendance-tracker-admin-state";
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "HSUJ";

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
  const now = new Date();
  liveTime.textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getCurrentTimeValue() {
  const now = new Date();
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
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
  const timeText = `${normalizedHour}.${pad(minutes)} ${suffix}`;

  if (includeMode && workMode) {
    return `${timeText} (${workMode})`;
  }

  return timeText;
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

function formatWorkedHours(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} hours`;
  }

  return `${hours} hours ${minutes} minutes`;
}

function buildReportText(data) {
  const totalMinutes = getWorkedMinutes(data.clockIn, data.clockOut, data.breakMinutes);

  return [
    `Date: ${formatDateLabel(data.date)}`,
    `Clock in: ${formatTime(data.clockIn, true, data.workMode)}`,
    `Clock out: ${formatTime(data.clockOut, false, data.workMode)}`,
    `Break: ${data.breakMinutes || 0} minutes`,
    `Total working hours: ${formatWorkedHours(totalMinutes)}`,
    `Team: ${data.team || "-"}`,
    "",
    "Planned / follow-up details:",
    data.followUp || "-",
    "",
    "Update on outcomes:",
    data.updates || "-",
  ].join("\n");
}

function sanitizeFileName(value) {
  return (value || "attendance-report")
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function buildExportRow(data) {
  const totalMinutes = getWorkedMinutes(data.clockIn, data.clockOut, data.breakMinutes);
  return {
    title: data.title || "",
    date: formatDateLabel(data.date),
    workMode: data.workMode || "",
    clockIn: formatTime(data.clockIn, true, data.workMode),
    clockOut: formatTime(data.clockOut, false, data.workMode),
    breakMinutes: data.breakMinutes || "0",
    totalHours: formatWorkedHours(totalMinutes),
    team: data.team || "",
    followUp: data.followUp || "",
    updates: data.updates || "",
  };
}

function getFormData() {
  return Object.fromEntries(new FormData(form).entries());
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function isAdmin() {
  return localStorage.getItem(ADMIN_STATE_KEY) === "true";
}

function setAdminState(isLoggedIn) {
  localStorage.setItem(ADMIN_STATE_KEY, String(isLoggedIn));
  updateAdminUi();
}

function updateAdminUi() {
  const loggedIn = isAdmin();
  const adminOnlyItems = document.querySelectorAll(".admin-only");

  adminOnlyItems.forEach((item) => {
    item.hidden = !loggedIn;
  });

  adminToggleBtn.textContent = loggedIn ? "Admin Active" : "Admin Login";
  adminLogoutBtn.hidden = !loggedIn;
  adminLoginBtn.hidden = loggedIn;

  if (loggedIn) {
    adminStatus.textContent = "Admin access enabled. You can now delete records and clear history.";
  } else {
    adminStatus.textContent = "Admin access is required to delete records or clear history.";
  }
}

function getHistoryLabel(record) {
  const totalMinutes = getWorkedMinutes(record.clockIn, record.clockOut, record.breakMinutes);
  return `${formatDateLabel(record.date)} | ${formatWorkedHours(totalMinutes)} | ${record.team || "No team"}`;
}

function fillForm(record) {
  titleInput.value = record.title || "";
  dateInput.value = record.date || "";
  teamInput.value = record.team || "";
  workModeInput.value = record.workMode || "remote/field";
  clockInInput.value = record.clockIn || "";
  clockOutInput.value = record.clockOut || "";
  breakMinutesInput.value = record.breakMinutes || "0";
  followUpInput.value = record.followUp || "";
  updatesInput.value = record.updates || "";
  updatePreview();
}

function deleteHistoryItem(id) {
  if (!isAdmin()) {
    adminStatus.textContent = "Admin login required to delete records.";
    return;
  }

  const next = loadHistory().filter((record) => record.id !== id);
  saveHistory(next);
  renderHistory();
}

function renderHistory() {
  const records = loadHistory().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  historyList.innerHTML = "";

  if (records.length === 0) {
    historyEmpty.hidden = false;
    historyList.appendChild(historyEmpty);
    return;
  }

  historyEmpty.hidden = true;

  records.forEach((record) => {
    const item = document.createElement("article");
    item.className = "history-item";

    const content = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = record.title || "Untitled Project";
    const meta = document.createElement("p");
    meta.className = "history-meta";
    meta.textContent = getHistoryLabel(record);

    content.appendChild(title);
    content.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.className = "small-button";
    loadButton.textContent = "Load";
    loadButton.addEventListener("click", () => fillForm(record));

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "small-button";
    removeButton.textContent = "Delete";
    removeButton.addEventListener("click", () => deleteHistoryItem(record.id));

    actions.appendChild(loadButton);
    actions.appendChild(removeButton);
    item.appendChild(content);
    item.appendChild(actions);
    historyList.appendChild(item);
  });
}

function persistRecord() {
  const data = getFormData();

  if (!data.date) {
    return false;
  }

  const record = {
    ...data,
    id: data.date,
    savedAt: new Date().toISOString(),
  };

  const records = loadHistory();
  const existingIndex = records.findIndex((entry) => entry.id === record.id);

  if (existingIndex >= 0) {
    records[existingIndex] = record;
  } else {
    records.push(record);
  }

  saveHistory(records);
  renderHistory();
  return true;
}

function saveRecordManually() {
  const data = getFormData();

  if (!data.date) {
    saveRecordBtn.textContent = "Select date first";
    window.setTimeout(() => {
      saveRecordBtn.textContent = "Save Record";
    }, 1500);
    return;
  }

  persistRecord();
  saveRecordBtn.textContent = "Saved";
  window.setTimeout(() => {
    saveRecordBtn.textContent = "Save Record";
  }, 1500);
}

function clearForm() {
  titleInput.value = "";
  dateInput.value = "";
  teamInput.value = "";
  workModeInput.value = "remote/field";
  clockInInput.value = "";
  clockOutInput.value = "";
  breakMinutesInput.value = "60";
  followUpInput.value = "";
  updatesInput.value = "";
  updatePreview();

  clearFormBtn.textContent = "Cleared";
  window.setTimeout(() => {
    clearFormBtn.textContent = "Clear Form";
  }, 1500);
}

function toggleAdminPanel() {
  adminPanel.hidden = !adminPanel.hidden;
}

function loginAdmin() {
  const username = adminUsernameInput.value.trim();
  const password = adminPasswordInput.value;

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    setAdminState(true);
    adminStatus.textContent = "Admin login successful.";
    adminPasswordInput.value = "";
    return;
  }

  setAdminState(false);
  adminStatus.textContent = "Invalid admin username or password.";
}

function logoutAdmin() {
  setAdminState(false);
  adminUsernameInput.value = "";
  adminPasswordInput.value = "";
  adminStatus.textContent = "Admin logged out.";
}

function updatePreview() {
  const data = getFormData();
  const totalMinutes = getWorkedMinutes(data.clockIn, data.clockOut, data.breakMinutes);

  reportTitle.textContent = data.title || "Untitled Project";
  previewText.textContent = buildReportText(data);
  hoursOutput.textContent = formatWorkedHours(totalMinutes);
  previewDay.textContent = data.date
    ? new Date(`${data.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" })
    : "Today";
  previewMetaTime.textContent = data.clockOut || data.clockIn || getCurrentTimeValue();
}

function copyReport() {
  const data = getFormData();
  const report = `${data.title || "Untitled Project"}\n${buildReportText(data)}`;

  navigator.clipboard.writeText(report).then(() => {
    copyBtn.textContent = "Copied";
    window.setTimeout(() => {
      copyBtn.textContent = "Copy Report";
    }, 1400);
  }).catch(() => {
    copyBtn.textContent = "Copy failed";
    window.setTimeout(() => {
      copyBtn.textContent = "Copy Report";
    }, 1400);
  });
}

function exportToExcel() {
  const data = getFormData();
  const row = buildExportRow(data);
  const headers = [
    "Project Title",
    "Date",
    "Work Mode",
    "Clock In",
    "Clock Out",
    "Break Minutes",
    "Total Hours",
    "Team",
    "Planned Or Follow Up Details",
    "Update On Outcomes",
  ];
  const values = [
    row.title,
    row.date,
    row.workMode,
    row.clockIn,
    row.clockOut,
    row.breakMinutes,
    row.totalHours,
    row.team,
    row.followUp,
    row.updates,
  ];

  exportRowsAsCsv(headers, [values], `${sanitizeFileName(data.title)}-${data.date || "report"}.csv`);

  exportBtn.textContent = "Exported";
  window.setTimeout(() => {
    exportBtn.textContent = "Export Current";
  }, 1500);
}

function exportRowsAsCsv(headers, rows, fileName) {
  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(",")),
    "",
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportHistoryToExcel() {
  const records = loadHistory().sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  if (records.length === 0) {
    exportHistoryBtn.textContent = "No history";
    window.setTimeout(() => {
      exportHistoryBtn.textContent = "Export Full History";
    }, 1500);
    return;
  }

  const headers = [
    "Project Title",
    "Date",
    "Work Mode",
    "Clock In",
    "Clock Out",
    "Break Minutes",
    "Total Hours",
    "Team",
    "Planned Or Follow Up Details",
    "Update On Outcomes",
  ];
  const rows = records.map((record) => {
    const row = buildExportRow(record);
    return [
      row.title,
      row.date,
      row.workMode,
      row.clockIn,
      row.clockOut,
      row.breakMinutes,
      row.totalHours,
      row.team,
      row.followUp,
      row.updates,
    ];
  });

  exportRowsAsCsv(headers, rows, "attendance-history.csv");

  exportHistoryBtn.textContent = "Exported";
  window.setTimeout(() => {
    exportHistoryBtn.textContent = "Export Full History";
  }, 1500);
}

clockInBtn.addEventListener("click", () => {
  clockInInput.value = getCurrentTimeValue();
  updatePreview();
});

clockOutBtn.addEventListener("click", () => {
  clockOutInput.value = getCurrentTimeValue();
  updatePreview();
});

clearFormBtn.addEventListener("click", clearForm);
saveRecordBtn.addEventListener("click", saveRecordManually);
copyBtn.addEventListener("click", copyReport);
exportBtn.addEventListener("click", exportToExcel);
exportHistoryBtn.addEventListener("click", exportHistoryToExcel);
adminToggleBtn.addEventListener("click", toggleAdminPanel);
adminLoginBtn.addEventListener("click", loginAdmin);
adminLogoutBtn.addEventListener("click", logoutAdmin);
clearHistoryBtn.addEventListener("click", () => {
  if (!isAdmin()) {
    adminStatus.textContent = "Admin login required to clear history.";
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
  adminStatus.textContent = "History cleared.";
});
form.addEventListener("input", updatePreview);
titleInput.addEventListener("input", updatePreview);

setTodayDate();
updateClock();
updateAdminUi();
renderHistory();
updatePreview();
window.setInterval(updateClock, 1000);
