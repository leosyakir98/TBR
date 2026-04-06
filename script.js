const STORAGE_KEY = "today-task-tracker-v1";

const taskForm = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const priorityInput = document.getElementById("task-priority");
const estimateInput = document.getElementById("task-estimate");
const notesInput = document.getElementById("task-notes");
const saveTaskBtn = document.getElementById("save-task-btn");
const resetFormBtn = document.getElementById("reset-form-btn");
const clearDoneBtn = document.getElementById("clear-done-btn");
const loadStarterBtn = document.getElementById("load-starter-btn");
const liveTime = document.getElementById("live-time");
const todayDate = document.getElementById("today-date");
const completionRate = document.getElementById("completion-rate");
const completionCaption = document.getElementById("completion-caption");
const openCount = document.getElementById("open-count");
const doneCount = document.getElementById("done-count");
const timeLeft = document.getElementById("time-left");
const focusList = document.getElementById("focus-list");
const taskList = document.getElementById("task-list");
const taskEmpty = document.getElementById("task-empty");

let tasks = loadTasks();
let activeFilter = "all";
let editingTaskId = null;

function loadTasks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function persistTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function formatToday() {
  const now = new Date();
  todayDate.textContent = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function updateClock() {
  liveTime.textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function minutesToLabel(totalMinutes) {
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function priorityRank(priority) {
  return { high: 0, medium: 1, low: 2 }[priority] ?? 3;
}

function getFilteredTasks() {
  if (activeFilter === "open") {
    return tasks.filter((task) => !task.done);
  }

  if (activeFilter === "done") {
    return tasks.filter((task) => task.done);
  }

  return tasks;
}

function updateSummary() {
  const total = tasks.length;
  const done = tasks.filter((task) => task.done).length;
  const open = total - done;
  const openMinutes = tasks
    .filter((task) => !task.done)
    .reduce((sum, task) => sum + Number(task.estimate), 0);
  const percent = total ? Math.round((done / total) * 100) : 0;

  completionRate.textContent = `${percent}%`;
  completionCaption.textContent = `${done} of ${total} tasks done`;
  openCount.textContent = String(open);
  doneCount.textContent = String(done);
  timeLeft.textContent = minutesToLabel(openMinutes);
}

function updateFocusBoard() {
  const focusTasks = tasks
    .filter((task) => !task.done)
    .sort((left, right) => {
      const byPriority = priorityRank(left.priority) - priorityRank(right.priority);
      if (byPriority !== 0) {
        return byPriority;
      }
      return left.createdAt - right.createdAt;
    })
    .slice(0, 3);

  focusList.innerHTML = "";

  if (focusTasks.length === 0) {
    focusList.innerHTML = '<p class="empty-copy">No focus tasks yet. Add a few tasks and your top priorities will appear here.</p>';
    return;
  }

  focusTasks.forEach((task, index) => {
    const pill = document.createElement("article");
    pill.className = "focus-pill";
    pill.innerHTML = `
      <strong>${index + 1}. ${escapeHtml(task.title)}</strong>
      <span class="badge ${task.priority}">${task.priority}</span>
      <span class="task-meta">${minutesToLabel(Number(task.estimate))}</span>
    `;
    focusList.appendChild(pill);
  });
}

function renderTasks() {
  const visibleTasks = getFilteredTasks()
    .slice()
    .sort((left, right) => {
      if (left.done !== right.done) {
        return Number(left.done) - Number(right.done);
      }

      const byPriority = priorityRank(left.priority) - priorityRank(right.priority);
      if (byPriority !== 0) {
        return byPriority;
      }

      return left.createdAt - right.createdAt;
    });

  taskList.innerHTML = "";
  taskEmpty.hidden = visibleTasks.length > 0;

  visibleTasks.forEach((task) => {
    const item = document.createElement("article");
    item.className = `task-item${task.done ? " is-done" : ""}`;

    const checkbox = document.createElement("button");
    checkbox.type = "button";
    checkbox.className = `task-checkbox${task.done ? " is-done" : ""}`;
    checkbox.setAttribute("aria-label", task.done ? "Mark task as open" : "Mark task as done");
    checkbox.addEventListener("click", () => toggleTask(task.id));

    const content = document.createElement("div");
    content.innerHTML = `
      <h3 class="task-title">${escapeHtml(task.title)}</h3>
      <p class="task-meta">
        <span class="badge ${task.priority}">${task.priority}</span>
        ${minutesToLabel(Number(task.estimate))}
      </p>
      <p class="task-notes">${escapeHtml(task.notes || "No notes added.")}</p>
    `;

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "small-button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => loadTaskIntoForm(task.id));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "small-button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteTask(task.id));

    actions.append(editButton, deleteButton);
    item.append(checkbox, content, actions);
    taskList.appendChild(item);
  });
}

function refreshUi() {
  persistTasks();
  updateSummary();
  updateFocusBoard();
  renderTasks();
}

function resetForm() {
  taskForm.reset();
  priorityInput.value = "medium";
  estimateInput.value = "30";
  editingTaskId = null;
  saveTaskBtn.textContent = "Add Task";
  titleInput.focus();
}

function createTask(data) {
  return {
    id: crypto.randomUUID(),
    title: data.title.trim(),
    priority: data.priority,
    estimate: Number(data.estimate),
    notes: data.notes.trim(),
    done: false,
    createdAt: Date.now(),
  };
}

function handleSubmit(event) {
  event.preventDefault();

  const formData = Object.fromEntries(new FormData(taskForm).entries());
  if (!formData.title.trim()) {
    titleInput.focus();
    return;
  }

  if (editingTaskId) {
    tasks = tasks.map((task) => {
      if (task.id !== editingTaskId) {
        return task;
      }

      return {
        ...task,
        title: formData.title.trim(),
        priority: formData.priority,
        estimate: Number(formData.estimate),
        notes: formData.notes.trim(),
      };
    });
  } else {
    tasks.unshift(createTask(formData));
  }

  refreshUi();
  resetForm();
}

function toggleTask(id) {
  tasks = tasks.map((task) => (
    task.id === id
      ? { ...task, done: !task.done }
      : task
  ));
  refreshUi();
}

function deleteTask(id) {
  tasks = tasks.filter((task) => task.id !== id);

  if (editingTaskId === id) {
    resetForm();
  }

  refreshUi();
}

function loadTaskIntoForm(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) {
    return;
  }

  editingTaskId = id;
  titleInput.value = task.title;
  priorityInput.value = task.priority;
  estimateInput.value = String(task.estimate);
  notesInput.value = task.notes;
  saveTaskBtn.textContent = "Update Task";
  titleInput.focus();
}

function clearCompletedTasks() {
  tasks = tasks.filter((task) => !task.done);

  if (editingTaskId && !tasks.some((task) => task.id === editingTaskId)) {
    resetForm();
  }

  refreshUi();
}

function setFilter(filter) {
  activeFilter = filter;
  document.querySelectorAll(".filter-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.filter === filter);
  });
  renderTasks();
}

function loadStarterTasks() {
  if (tasks.length > 0) {
    return;
  }

  tasks = [
    createTask({ title: "Finish the highest-impact task first", priority: "high", estimate: "90", notes: "Pick the one thing that most improves today." }),
    createTask({ title: "Reply to important messages", priority: "medium", estimate: "30", notes: "Keep it focused and avoid inbox drift." }),
    createTask({ title: "Wrap up and review tomorrow", priority: "low", estimate: "15", notes: "Leave the next step obvious for future you." }),
  ];

  refreshUi();
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

taskForm.addEventListener("submit", handleSubmit);
resetFormBtn.addEventListener("click", resetForm);
clearDoneBtn.addEventListener("click", clearCompletedTasks);
loadStarterBtn.addEventListener("click", loadStarterTasks);
document.querySelectorAll(".filter-button").forEach((button) => {
  button.addEventListener("click", () => setFilter(button.dataset.filter));
});

formatToday();
updateClock();
refreshUi();
window.setInterval(updateClock, 1000);
