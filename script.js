const form = document.getElementById("report-form");
const titleInput = document.getElementById("title");
const previewText = document.getElementById("preview-text");
const reportTitle = document.getElementById("report-title");
const liveTime = document.getElementById("live-time");
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

const SUPABASE_URL = "https://ulwnlwdjawxfmvcxfbxb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsd25sd2RqYXd4Zm12Y3hmYnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMTk3MDYsImV4cCI6MjA5MDg5NTcwNn0.jIM4gmyW9c0jvUmKbd78Rpsnzmy0r9RdThfFDvY7axk";
const TABLE_NAME = "attendance_records";
const ADMIN_STATE_KEY = "attendance-tracker-admin-state";
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "HSUJ";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let historyRecords = [];
let historyChannel = null;

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
  adminStatus.textContent = loggedIn
    ? "Admin access enabled. You can now delete records and clear history."
    : "Admin access is required to delete records or clear history.";
}

function getHistoryLabel(record) {
  const totalMinutes = getWorkedMinutes(record.clock_in, record.clock_out, record.break_minutes);
  return `${formatDateLabel(record.work_date)} | ${formatWorkedHours(totalMinutes)} | ${record.team || "No team"}`;
}

function mapRecordToForm(record) {
  return {
    id: record.id,
    title: record.project_title || "",
    date: record.work_date || "",
    team: record.team || "",
    workMode: record.work_mode || "remote/field",
    clockIn: record.clock_in || "",
    clockOut: record.clock_out || "",
    breakMinutes: record.break_minutes ?? "",
    followUp: record.follow_up || "",
    updates: record.updates || "",
  };
}

function mapFormToRecord(data) {
  return {
    project_title: data.title || "",
    work_date: data.date || null,
    team: data.team || "",
    work_mode: data.workMode || "",
    clock_in: data.clockIn || null,
    clock_out: data.clockOut || null,
    break_minutes: data.breakMinutes === "" ? null : Number(data.breakMinutes),
    follow_up: data.followUp || "",
    updates: data.updates || "",
  };
}

function fillForm(record) {
  const mapped = mapRecordToForm(record);
  titleInput.value = mapped.title;
  dateInput.value = mapped.date;
  teamInput.value = mapped.team;
  workModeInput.value = mapped.workMode || "remote/field";
  clockInInput.value = mapped.clockIn;
  clockOutInput.value = mapped.clockOut;
  breakMinutesInput.value = mapped.breakMinutes === null ? "" : mapped.breakMinutes;
  followUpInput.value = mapped.followUp;
  updatesInput.value = mapped.updates;
  updatePreview();
}

async function loadHistoryFromSupabase() {
  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .select("*")
    .order("work_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    adminStatus.textContent = `Supabase load error: ${error.message}`;
    historyRecords = [];
    renderHistory();
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
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE_NAME },
      async () => {
        await loadHistoryFromSupabase();
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        adminStatus.textContent = isAdmin()
          ? "Admin access enabled. Realtime sync is active."
          : "Realtime sync is active. Refresh is no longer needed.";
      }
    });
}

async function saveRecordToSupabase() {
  const data = getFormData();

  if (!data.date) {
    saveRecordBtn.textContent = "Select date first";
    window.setTimeout(() => {
      saveRecordBtn.textContent = "Save Record";
    }, 1500);
    return;
  }

  const payload = mapFormToRecord(data);

  const { error } = await supabaseClient
    .from(TABLE_NAME)
    .upsert(payload, { onConflict: "work_date" });

  if (error) {
    saveRecordBtn.textContent = "Save failed";
    adminStatus.textContent = `Supabase save error: ${error.message}`;
    window.setTimeout(() => {
      saveRecordBtn.textContent = "Save Record";
    }, 1500);
    return;
  }

  saveRecordBtn.textContent = "Saved";
  window.setTimeout(() => {
    saveRecordBtn.textContent = "Save Record";
  }, 1500);

  await loadHistoryFromSupabase();
}

async function deleteHistoryItem(id) {
  if (!isAdmin()) {
    adminStatus.textContent = "Admin login required to delete records.";
    return;
  }

  const { error } = await supabaseClient
    .from(TABLE_NAME)
    .delete()
    .eq("id", id);

  if (error) {
    adminStatus.textContent = `Supabase delete error: ${error.message}`;
    return;
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
    const title = document.createElement("h3");
    title.textContent = record.project_title || "Untitled Project";
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
    removeButton.className = "small-button admin-only";
    removeButton.textContent = "Delete";
    removeButton.hidden = !isAdmin();
    removeButton.addEventListener("click", () => deleteHistoryItem(record.id));

    actions.appendChild(loadButton);
    actions.appendChild(removeButton);
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
  clockInInput.value = "";
  clockOutInput.value = "";
  breakMinutesInput.value = "";
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
    renderHistory();
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
  renderHistory();
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

function exportHistoryToExcel() {
  if (historyRecords.length === 0) {
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

  const rows = historyRecords
    .slice()
    .sort((a, b) => (a.work_date || "").localeCompare(b.work_date || ""))
    .map((record) => {
      const row = buildExportRow(mapRecordToForm(record));
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

async function clearAllHistory() {
  if (!isAdmin()) {
    adminStatus.textContent = "Admin login required to clear history.";
    return;
  }

  const { error } = await supabaseClient
    .from(TABLE_NAME)
    .delete()
    .not("id", "is", null);

  if (error) {
    adminStatus.textContent = `Supabase clear error: ${error.message}`;
    return;
  }

  adminStatus.textContent = "History cleared.";
  await loadHistoryFromSupabase();
}

clearFormBtn.addEventListener("click", clearForm);
saveRecordBtn.addEventListener("click", saveRecordToSupabase);
copyBtn.addEventListener("click", copyReport);
exportBtn.addEventListener("click", exportToExcel);
exportHistoryBtn.addEventListener("click", exportHistoryToExcel);
adminToggleBtn.addEventListener("click", toggleAdminPanel);
adminLoginBtn.addEventListener("click", loginAdmin);
adminLogoutBtn.addEventListener("click", logoutAdmin);
clearHistoryBtn.addEventListener("click", clearAllHistory);
form.addEventListener("input", updatePreview);
titleInput.addEventListener("input", updatePreview);

setTodayDate();
updateClock();
updateAdminUi();
updatePreview();
loadHistoryFromSupabase();
subscribeToHistoryChanges();
window.setInterval(updateClock, 1000);
