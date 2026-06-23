const STORAGE_KEY = "study_checkin_app_data";

const fallbackData = {
  version: 1,
  subjects: [
    {
      id: "subject_math",
      name: "数学",
      color: "#2F6FED",
      note: "函数与错题整理",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "subject_english",
      name: "英语",
      color: "#16A672",
      note: "阅读与单词复习",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "subject_physics",
      name: "物理",
      color: "#D97706",
      note: "力学专题",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  tasks: [
    {
      id: "task_math_1",
      subjectId: "subject_math",
      title: "整理函数错题",
      description: "完成最近三套卷子的函数错题归纳",
      estimatedMinutes: 30,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "task_english_1",
      subjectId: "subject_english",
      title: "背诵 40 个核心单词",
      description: "复习昨日错词并完成今日新词",
      estimatedMinutes: 25,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "task_physics_1",
      subjectId: "subject_physics",
      title: "完成力学专题练习",
      description: "重点检查受力分析步骤",
      estimatedMinutes: 45,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  checkins: [],
  timerLogs: [],
  settings: {
    alarmEnabled: true,
    defaultTimerMinutes: 25,
    weekStartsOn: 1
  }
};

let appData = loadData();
let activeSubjectId = "all";

let timer = {
  intervalId: null,
  status: "idle",
  taskId: null,
  totalSeconds: 1500,
  remainingSeconds: 1500,
  remainingMs: 1500000,
  endsAt: null,
  startedAt: null
};

let sevenDayChart = null;

function getDefaultTimerSeconds() {
  return (appData.settings?.defaultTimerMinutes || 25) * 60;
}

function normalizeData(data) {
  return {
    version: data.version || 1,
    subjects: Array.isArray(data.subjects) ? data.subjects : [],
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    checkins: Array.isArray(data.checkins) ? data.checkins : [],
    timerLogs: Array.isArray(data.timerLogs) ? data.timerLogs : [],
    settings: {
      alarmEnabled: data.settings?.alarmEnabled ?? true,
      defaultTimerMinutes: data.settings?.defaultTimerMinutes ?? 25,
      weekStartsOn: data.settings?.weekStartsOn ?? 1
    }
  };
}

function loadData() {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackData));
    return normalizeData(structuredClone(fallbackData));
  }

  try {
    return normalizeData(JSON.parse(stored));
  } catch (error) {
    console.warn("本地数据解析失败，已使用默认演示数据。", error);
    return normalizeData(structuredClone(fallbackData));
  }
}

function saveData(data) {
  appData = normalizeData(data || appData);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateString) {
  if (!dateString) {
    return null;
  }

  const [year, month, day] = String(dateString).split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function isDateInRange(dateString, startDate, endDate) {
  const date = parseLocalDate(dateString);

  if (!date) {
    return false;
  }

  return date >= startOfDay(startDate) && date <= startOfDay(endDate);
}

function getWeekRange(baseDate = new Date()) {
  const current = startOfDay(baseDate);
  const day = current.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = addDays(current, mondayOffset);
  const end = addDays(start, 6);

  return { start, end };
}

function getMonthRange(baseDate = new Date()) {
  return {
    start: new Date(baseDate.getFullYear(), baseDate.getMonth(), 1),
    end: new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0)
  };
}

function formatMinutes(minutes) {
  const totalMinutes = Number(minutes || 0);

  if (totalMinutes < 60) {
    return `${totalMinutes} 分钟`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const restMinutes = totalMinutes % 60;

  return restMinutes > 0 ? `${hours} 小时 ${restMinutes} 分钟` : `${hours} 小时`;
}

function getSubject(subjectId) {
  return appData.subjects.find((subject) => subject.id === subjectId);
}

function getTask(taskId) {
  return appData.tasks.find((task) => task.id === taskId);
}

function isTaskDoneToday(taskId) {
  const today = getLocalDateString();
  return appData.checkins.some((checkin) => checkin.taskId === taskId && checkin.date === today);
}

function getVisibleTasks() {
  const activeTasks = appData.tasks.filter((task) => task.isActive !== false);

  if (activeSubjectId === "all") {
    return activeTasks;
  }

  return activeTasks.filter((task) => task.subjectId === activeSubjectId);
}

function renderDate() {
  const now = new Date();
  const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  const weekdayFormatter = new Intl.DateTimeFormat("zh-CN", {
    weekday: "long"
  });

  document.getElementById("currentDate").textContent = dateFormatter.format(now);
  document.getElementById("weekday").textContent = weekdayFormatter.format(now);
}

function renderSubjects() {
  const tabs = document.getElementById("subjectTabs");
  const allTab = createSubjectTab({ id: "all", name: "全部", color: "#64748B" });
  const subjectTabs = appData.subjects.map(createSubjectTab);

  tabs.replaceChildren(allTab, ...subjectTabs);
}

function createSubjectTab(subject) {
  const button = document.createElement("button");
  button.className = `subject-tab${activeSubjectId === subject.id ? " is-active" : ""}`;
  button.type = "button";
  button.role = "tab";
  button.textContent = subject.name;
  button.style.setProperty("--subject-color", subject.color);
  button.setAttribute("aria-selected", String(activeSubjectId === subject.id));
  button.addEventListener("click", () => {
    activeSubjectId = subject.id;
    render();
  });

  return button;
}

function renderTasks() {
  const taskList = document.getElementById("taskList");
  const tasks = getVisibleTasks();

  if (tasks.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "当前学科暂无任务，后续可在这里接入新增任务表单。";
    taskList.replaceChildren(emptyState);
    return;
  }

  const taskCards = tasks.map((task) => {
    const subject = getSubject(task.subjectId);
    const isDone = isTaskDoneToday(task.id);
    var todayTimer = appData.timerLogs.filter(function(log) { return log.taskId === task.id && log.date === getLocalDateString(); });
    var lastTimerLog = todayTimer.length > 0 ? todayTimer[todayTimer.length - 1] : null;
    const card = document.createElement("article");
    card.className = `task-card${isDone ? " is-done" : ""}`;
    card.style.setProperty("--subject-color", subject?.color || "#2F6FED");

    const content = document.createElement("div");
    const title = document.createElement("h3");
    const meta = document.createElement("div");
    const subjectLabel = document.createElement("span");
    const minutesLabel = document.createElement("span");
    const statusLabel = document.createElement("span");
    const actions = document.createElement("div");
    const startButton = document.createElement("button");
    const button = document.createElement("button");

    title.textContent = task.title;
    meta.className = "task-meta";
    subjectLabel.textContent = subject?.name || "未分类";
    minutesLabel.textContent = `${task.estimatedMinutes} 分钟`;
    if (timer.taskId === task.id && timer.status === "running") {
      statusLabel.textContent = "计时中 " + formatTimer(timer.remainingSeconds);
    } else if (lastTimerLog) {
      statusLabel.textContent = "已计时 " + lastTimerLog.actualMinutes + " 分钟";
    } else {
      statusLabel.textContent = isDone ? "今日已完成" : "等待打卡";
    }
    actions.className = "task-actions";
    startButton.className = "task-start";
    startButton.type = "button";
    startButton.textContent = timer.taskId === task.id && timer.status === "running" ? "进行中" : "开始";
    startButton.disabled = timer.taskId === task.id && timer.status === "running";
    startButton.addEventListener("click", () => startPomodoro(task));

    button.className = "task-check";
    button.type = "button";
    button.textContent = isDone ? "取消" : "打卡";
    button.addEventListener("click", () => toggleCheckin(task));

    meta.append(subjectLabel, minutesLabel, statusLabel);
    content.append(title, meta);
    var editBtn = document.createElement("button");
    editBtn.className = "task-action-icon";
    editBtn.textContent = "\u270f\ufe0f";
    editBtn.title = "\u7f16\u8f91\u4efb\u52a1";
    editBtn.addEventListener("click", function() { showEditTaskModal(task); });
    var delBtn = document.createElement("button");
    delBtn.className = "task-action-icon danger";
    delBtn.textContent = "\u2716";
    delBtn.title = "\u5220\u9664\u4efb\u52a1";
    delBtn.addEventListener("click", function() {
      if (confirm("\u786e\u5b9a\u5220\u9664\u4efb\u52a1\u300c" + task.title + "\u300d\u5417\uff1f")) { deleteTask(task.id); }
    });
    actions.append(startButton, button, editBtn, delBtn);
    card.append(content, actions);

    return card;
  });

  taskList.replaceChildren(...taskCards);
}

function formatTimer(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
}

function renderTimer() {
  const display = document.getElementById("timerDisplay");
  const taskName = document.getElementById("timerTaskName");
  const status = document.getElementById("timerStatus");
  const startButton = document.getElementById("timerStartButton");
  const pauseButton = document.getElementById("timerPauseButton");
  const finishButton = document.getElementById("timerFinishButton");
  const resetButton = document.getElementById("timerResetButton");
  const task = getTask(timer.taskId);
  const statusLabels = {
    idle: "未开始",
    running: "运行中",
    paused: "已暂停",
    completed: "已完成"
  };

  display.textContent = formatTimer(timer.remainingSeconds);
  taskName.textContent = task ? `当前任务：${task.title}` : "请选择任务后开始";
  status.textContent = statusLabels[timer.status] || "未开始";
  startButton.textContent = timer.status === "paused" ? "继续" : "开始";
  startButton.disabled = timer.status === "running";
  pauseButton.disabled = timer.status !== "running";
  finishButton.disabled = timer.status !== "running" && timer.status !== "paused";
  resetButton.disabled = timer.status === "idle" && timer.remainingSeconds === timer.totalSeconds;
}

function requestNotificationPermission() {
  if (!("Notification" in window) || Notification.permission !== "default") {
    return;
  }

  Notification.requestPermission().catch(() => {});
}

function showTimerNotification(task) {
  const title = "番茄钟时间到";
  const minutes = Math.round(getDefaultTimerSeconds() / 60);
  const body = task ? `${task.title} 的 ${minutes} 分钟专注已完成。` : `${minutes} 分钟专注已完成。`;

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body });
    return;
  }

  alert(`${title}\n${body}`);
}

var sharedAudioCtx = null;

function unlockAudio() {
  if (sharedAudioCtx) {
    if (sharedAudioCtx.state === "suspended") { sharedAudioCtx.resume(); }
    return;
  }
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { return; }
  sharedAudioCtx = new AC();
  var silent = sharedAudioCtx.createBufferSource();
  silent.buffer = sharedAudioCtx.createBuffer(1, 1, 22050);
  silent.connect(sharedAudioCtx.destination);
  silent.start(0);
}

function playRing() {
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { return; }
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AC();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume();
  }
  var ctx = sharedAudioCtx;
  var masterGain = ctx.createGain();
  var now = ctx.currentTime;
  var pattern = [0, 0.32, 0.64, 1.08, 1.4, 1.72];
  masterGain.gain.setValueAtTime(0.0001, now);
  masterGain.gain.exponentialRampToValueAtTime(0.24, now + 0.02);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.25);
  masterGain.connect(ctx.destination);
  pattern.forEach(function(offset, index) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    var start = now + offset;
    var end = start + 0.2;
    osc.type = "sine";
    osc.frequency.setValueAtTime(index % 2 === 0 ? 880 : 1175, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(1, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(start);
    osc.stop(end + 0.02);
  });
  setTimeout(function() {
    ctx.close().catch(function() {});
  }, 2600);
}

function tickTimer() {
  if (timer.status !== "running" || !timer.endsAt) {
    return;
  }

  timer.remainingMs = timer.endsAt - Date.now();
  timer.remainingSeconds = Math.max(0, Math.ceil(timer.remainingMs / 1000));

  if (timer.remainingMs <= 0) {
    completeTimer();
    return;
  }

  renderTimer();
}

function clearTimerInterval() {
  if (timer.intervalId) {
    window.clearInterval(timer.intervalId);
    timer.intervalId = null;
  }
}

function startPomodoro(task = getTask(timer.taskId)) {
  if (!task && timer.status !== "paused") {
    alert("请先点击任务旁的“开始”按钮。");
    return;
  }

  requestNotificationPermission();
  if (timer.status === "running" && task && task.id !== timer.taskId) {
    const currentTask = getTask(timer.taskId);
    if (!confirm("计时器正在为「" + (currentTask?.title || "当前任务") + "」计时。确定切换到「" + task.title + "」吗？\n（当前计时进度将丢失）")) {
      renderTasks();
      return;
    }
  }


  if (timer.status === "paused") {
    timer.status = "running";
    timer.endsAt = Date.now() + Math.max(timer.remainingMs || timer.remainingSeconds * 1000, 1000);
 } else {
    const taskSeconds = task.estimatedMinutes * 60;
    timer.status = "running";
    timer.taskId = task.id;
    timer.totalSeconds = taskSeconds;
    timer.remainingSeconds = taskSeconds;
    timer.remainingMs = taskSeconds * 1000;
    timer.endsAt = Date.now() + timer.remainingMs;
    timer.startedAt = new Date().toISOString();
  }

  clearTimerInterval();
  timer.intervalId = window.setInterval(tickTimer, 250);
  tickTimer();
  renderTasks();
}

function pauseTimer() {
  if (timer.status !== "running") {
    return;
  }

  tickTimer();
  timer.remainingMs = Math.max(0, timer.remainingMs || 0);
  timer.status = "paused";
  timer.endsAt = null;
  clearTimerInterval();
  renderTimer();
  renderTasks();
}

function resetTimer() {
  clearTimerInterval();
  const defaultSeconds = getDefaultTimerSeconds();
  timer.status = "idle";
  timer.taskId = null;
  timer.totalSeconds = defaultSeconds;
  timer.remainingSeconds = defaultSeconds;
  timer.remainingMs = defaultSeconds * 1000;
  timer.endsAt = null;
  timer.startedAt = null;
  renderTimer();
  renderTasks();
}

function completeTimer() {
  const task = getTask(timer.taskId);
  const finishedAt = new Date().toISOString();

  clearTimerInterval();
  timer.status = "completed";
  timer.remainingSeconds = 0;
  timer.remainingMs = 0;
  timer.endsAt = null;

  if (task) {
    appData.timerLogs.push({
      id: `timer_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      subjectId: task.subjectId,
      taskId: task.id,
      plannedMinutes: task.estimatedMinutes,
      actualMinutes: Math.max(1, Math.round((timer.totalSeconds * 1000 - Math.max(0, timer.remainingMs || 0)) / 60000)),
      startedAt: timer.startedAt || finishedAt,
      endedAt: finishedAt,
      date: getLocalDateString()
    });
    saveData();
  }

  playRing();
  showTimerNotification(task);
  renderTimer();
  renderTasks();
}

function finishTimerEarly() {
  if (timer.status !== "running" && timer.status !== "paused") {
    return;
  }
  const task = getTask(timer.taskId);
  const finishedAt = new Date().toISOString();

  clearTimerInterval();
  timer.status = "completed";
  timer.remainingMs = Math.max(0, timer.endsAt ? timer.endsAt - Date.now() : 0);
  timer.remainingSeconds = Math.max(0, Math.ceil(timer.remainingMs / 1000));
  timer.endsAt = null;

  if (task) {
    appData.timerLogs.push({
      id: `timer_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      subjectId: task.subjectId,
      taskId: task.id,
      plannedMinutes: task.estimatedMinutes,
      actualMinutes: Math.max(1, Math.round((timer.totalSeconds * 1000 - timer.remainingMs) / 60000)),
      startedAt: timer.startedAt || finishedAt,
      endedAt: finishedAt,
      date: getLocalDateString()
    });
    saveData();
  }

  renderTimer();
  renderTasks();
}

function toggleCheckin(task) {
  const today = getLocalDateString();
  const existingIndex = appData.checkins.findIndex((checkin) => checkin.taskId === task.id && checkin.date === today);

  if (existingIndex >= 0) {
    appData.checkins.splice(existingIndex, 1);
  } else {
    appData.checkins.push({
      id: `checkin_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      taskId: task.id,
      subjectId: task.subjectId,
      date: today,
      createdAt: new Date().toISOString()
    });
  }

  saveData();
  render();
}

function renderStats() {
  const today = getLocalDateString();
  const visibleTasks = getVisibleTasks();
  const visibleTaskIds = new Set(visibleTasks.map((task) => task.id));
  const todayCheckins = appData.checkins.filter((checkin) => checkin.date === today && visibleTaskIds.has(checkin.taskId));
  const plannedMinutes = visibleTasks.reduce((sum, task) => sum + Number(task.estimatedMinutes || 0), 0);
  const activeSubject = activeSubjectId === "all" ? null : getSubject(activeSubjectId);

  document.getElementById("activeSubjectName").textContent = activeSubject?.name || "全部学科";
  document.getElementById("todayProgress").textContent = `${todayCheckins.length} / ${visibleTasks.length}`;
  document.getElementById("completedCount").textContent = String(todayCheckins.length);
  document.getElementById("plannedMinutes").textContent = `${plannedMinutes} 分钟`;
  document.getElementById("subjectCount").textContent = String(appData.subjects.length);
  document.getElementById("weekSummary").textContent = todayCheckins.length > 0 ? "已有记录" : "待生成";
}

function generateReport() {
  const today = new Date();
  const week = getWeekRange(today);
  const month = getMonthRange(today);
  const weekCheckins = appData.checkins.filter((c) =>
    isDateInRange(c.date, week.start, week.end)
  );
  const weekMinutes = appData.timerLogs
    .filter((log) => isDateInRange(log.date, week.start, week.end))
    .reduce((sum, log) => sum + Number(log.actualMinutes || 0), 0);
  const monthCheckins = appData.checkins.filter((c) =>
    isDateInRange(c.date, month.start, month.end)
  );
  const monthMinutes = appData.timerLogs
    .filter((log) => isDateInRange(log.date, month.start, month.end))
    .reduce((sum, log) => sum + Number(log.actualMinutes || 0), 0);
  document.getElementById("weekStudyMinutes").textContent = formatMinutes(weekMinutes);
  document.getElementById("weekCompletedTasks").textContent = String(weekCheckins.length);
  document.getElementById("monthStudyMinutes").textContent = formatMinutes(monthMinutes);
  document.getElementById("monthCompletedTasks").textContent = String(monthCheckins.length);
}

function renderSevenDayChart() {
  const today = new Date();
  const labels = [];
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const date = addDays(today, -i);
    const dateStr = getLocalDateString(date);
    const dayLabel = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);
    labels.push(dayLabel);
    const dayMinutes = appData.timerLogs
      .filter((log) => log.date === dateStr)
      .reduce((sum, log) => sum + Number(log.actualMinutes || 0), 0);
    data.push(dayMinutes);
  }
  const canvas = document.getElementById("sevenDayChart");
  const fallback = document.getElementById("chartFallback");
  if (!canvas) return;
  if (typeof Chart === "undefined") {
    canvas.hidden = true;
    if (fallback) {
      fallback.hidden = false;
      fallback.innerHTML = data
        .map((val, i) =>
          `\x3Cdiv class=\"bar-row\">\x3Cspan>${labels[i]}\x3C/span>\x3Cdiv class=\"bar\" style=\"width:${Math.max(val * 3, 6)}px\">\x3C/div>\x3Cspan>${val} 分钟\x3C/span>\x3C/div>`
        )
        .join("");
    }
    return;
  }
  canvas.hidden = false;
  if (fallback) fallback.hidden = true;
  if (sevenDayChart) {
    sevenDayChart.data.labels = labels;
    sevenDayChart.data.datasets[0].data = data;
    sevenDayChart.update("none");
    return;
  }
  sevenDayChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "学习时长（分钟）",
        data,
        backgroundColor: "rgba(47, 111, 237, 0.6)",
        borderColor: "rgba(47, 111, 237, 0.9)",
        borderWidth: 1,
        borderRadius: 4,
        maxBarThickness: 40
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.y} 分钟`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 5,
            font: { size: 11 }
          },
          grid: { color: "rgba(148, 163, 184, 0.16)" }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 } }
        }
      }
    }
  });
}

function render() {
  renderDate();
  renderSubjects();
  renderTasks();
  renderTimer();
  renderStats();
  generateReport();
  renderSevenDayChart();
}
document.addEventListener("DOMContentLoaded", function() {
  document.getElementById("timerStartButton").addEventListener("click", function() { unlockAudio(); startPomodoro(); });
  document.getElementById("timerPauseButton").addEventListener("click", pauseTimer);
  document.getElementById("timerResetButton").addEventListener("click", resetTimer);
  document.getElementById("timerFinishButton").addEventListener("click", finishTimerEarly);

  var addSubjectBtn = document.querySelector(".subject-panel .icon-button");
  if (addSubjectBtn) { addSubjectBtn.addEventListener("click", showSubjectModal); }

  var manageSubjectBtn = document.querySelector(".subject-panel .manage-subjects-btn");
  if (manageSubjectBtn) { manageSubjectBtn.addEventListener("click", showManageSubjectsModal); }

  var taskBtns = document.querySelectorAll(".task-panel .primary-button");
  taskBtns.forEach(function(btn) {
    if (btn.textContent.trim() === "\u65b0\u589e\u4efb\u52a1") {
      btn.addEventListener("click", showTaskModal);
    }
  });

  var exportBtn = document.getElementById("exportDataBtn");
  if (exportBtn) { exportBtn.addEventListener("click", exportData); }
  var importBtn = document.getElementById("importDataBtn");
  if (importBtn) { importBtn.addEventListener("click", importData); }

  var pwaHint = document.getElementById("pwaHint");
  var pwaDismiss = document.getElementById("pwaDismiss");
  if (pwaHint && pwaDismiss) {
    if (!window.navigator.standalone && !window.matchMedia("(display-mode: standalone)").matches) {
      pwaHint.hidden = false;
    }
    pwaDismiss.addEventListener("click", function() { pwaHint.hidden = true; });
  }

  render();
})

function createId(type) {
  return type + "_" + Date.now() + "_" + Math.random().toString(16).slice(2, 8);
}

function addSubject(name, color, note) {
  var trimmedName = String(name || "").trim();
  if (!trimmedName) { alert("\u5b66\u79d1\u540d\u79f0\u4e0d\u80fd\u4e3a\u7a7a\u3002"); return null; }
  var dup = appData.subjects.some(function(s) { return s.name.trim().toLowerCase() === trimmedName.toLowerCase(); });
  if (dup) { alert("\u5b66\u79d1\u540d\u79f0\u4e0d\u80fd\u91cd\u590d\u3002"); return null; }
  var now = new Date().toISOString();
  var subject = { id: createId("subject"), name: trimmedName, color: color || "#4F7CFF", note: String(note || "").trim(), createdAt: now, updatedAt: now };
  appData.subjects.push(subject);
  saveData();
  render();
  return subject;
}

function addTask(subjectId, title, estimatedMinutes, description) {
  var trimmedTitle = String(title || "").trim();
  var mins = Number.parseInt(estimatedMinutes, 10);
  if (!subjectId) { alert("\u8bf7\u9009\u62e9\u5b66\u79d1\u3002"); return null; }
  if (!trimmedTitle) { alert("\u4efb\u52a1\u540d\u79f0\u4e0d\u80fd\u4e3a\u7a7a\u3002"); return null; }
  if (!Number.isInteger(mins) || mins <= 0) { alert("\u9884\u8ba1\u5b66\u4e60\u65f6\u957f\u5fc5\u987b\u4e3a\u6b63\u6574\u6570\u3002"); return null; }
  var now = new Date().toISOString();
  var task = { id: createId("task"), subjectId: subjectId, title: trimmedTitle, description: String(description || "").trim(), estimatedMinutes: mins, isActive: true, createdAt: now, updatedAt: now };
  appData.tasks.push(task);
  if (activeSubjectId === "all") { activeSubjectId = subjectId; }
  saveData();
  render();
  return task;
}

var DEFAULT_SUBJECT_COLORS = ["#4F7CFF", "#22A06B", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

function hideModal() {
  var overlay = document.getElementById("modalOverlay");
  if (overlay) { overlay.remove(); }
}

function showModal(title, bodyEl) {
  hideModal();
  var overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "modalOverlay";
  overlay.addEventListener("click", function(e) { if (e.target === overlay) hideModal(); });
  var box = document.createElement("div");
  box.className = "modal-box";
  var head = document.createElement("div");
  head.className = "modal-heading";
  var h3 = document.createElement("h3");
  h3.textContent = title;
  head.appendChild(h3);
  var closeBtn = document.createElement("button");
  closeBtn.className = "modal-close";
  closeBtn.textContent = "\u00d7";
  closeBtn.addEventListener("click", hideModal);
  head.appendChild(closeBtn);
  box.appendChild(head);
  box.appendChild(bodyEl);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  var firstInput = overlay.querySelector("input, select");
  if (firstInput) { firstInput.focus(); }
}

function showSubjectModal() {
  var body = document.createElement("div");
  body.className = "modal-body";

  var label1 = document.createElement("label");
  label1.textContent = "\u5b66\u79d1\u540d\u79f0";
  body.appendChild(label1);

  var nameInput = document.createElement("input");
  nameInput.type = "text"; nameInput.id = "modalSubjectName"; nameInput.className = "modal-input";
  nameInput.placeholder = "\u4f8b\u5982\uff1a\u6570\u5b66"; nameInput.maxLength = 20;
  body.appendChild(nameInput);

  var label2 = document.createElement("label");
  label2.textContent = "\u5b66\u79d1\u989c\u8272";
  body.appendChild(label2);

  var cp = document.createElement("div");
  cp.className = "color-picker";
  DEFAULT_SUBJECT_COLORS.forEach(function(c, idx) {
    var btn = document.createElement("button");
    btn.className = "color-option" + (idx === 0 ? " is-active" : "");
    btn.type = "button"; btn.dataset.color = c; btn.style.background = c;
    btn.addEventListener("click", function() {
      cp.querySelectorAll(".color-option").forEach(function(b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
    });
    cp.appendChild(btn);
  });
  body.appendChild(cp);

  var label3 = document.createElement("label");
  label3.textContent = "\u5907\u6ce8\uff08\u53ef\u9009\uff09";
  body.appendChild(label3);

  var noteInput = document.createElement("input");
  noteInput.type = "text"; noteInput.id = "modalSubjectNote"; noteInput.className = "modal-input";
  noteInput.placeholder = "\u4f8b\u5982\uff1a\u91cd\u70b9\u590d\u4e60\u51fd\u6570";
  body.appendChild(noteInput);

  var actions = document.createElement("div");
  actions.className = "modal-actions";
  var cancelBtn = document.createElement("button");
  cancelBtn.className = "secondary-button"; cancelBtn.textContent = "\u53d6\u6d88";
  cancelBtn.addEventListener("click", hideModal);
  actions.appendChild(cancelBtn);
  var confirmBtn = document.createElement("button");
  confirmBtn.className = "primary-button"; confirmBtn.textContent = "\u786e\u8ba4\u6dfb\u52a0";
  confirmBtn.addEventListener("click", function() {
    var name = document.getElementById("modalSubjectName").value;
    var active = cp.querySelector(".color-option.is-active");
    var color = active ? active.dataset.color : "#4F7CFF";
    var note = document.getElementById("modalSubjectNote").value;
    if (addSubject(name, color, note)) { hideModal(); }
  });
  actions.appendChild(confirmBtn);
  body.appendChild(actions);

  showModal("\u65b0\u589e\u5b66\u79d1", body);
  nameInput.addEventListener("keydown", function(e) { if (e.key === "Enter") confirmBtn.click(); });
}

function showTaskModal() {
  if (appData.subjects.length === 0) {
    alert("\u8bf7\u5148\u6dfb\u52a0\u5b66\u79d1\uff0c\u518d\u6dfb\u52a0\u4efb\u52a1\u3002");
    return;
  }

  var body = document.createElement("div");
  body.className = "modal-body";

  var label1 = document.createElement("label");
  label1.textContent = "\u6240\u5c5e\u5b66\u79d1";
  body.appendChild(label1);

  var subjSelect = document.createElement("select");
  subjSelect.id = "modalTaskSubject"; subjSelect.className = "modal-input";
  appData.subjects.forEach(function(s) {
    var opt = document.createElement("option");
    opt.value = s.id; opt.textContent = s.name;
    subjSelect.appendChild(opt);
  });
  body.appendChild(subjSelect);

  var label2 = document.createElement("label");
  label2.textContent = "\u4efb\u52a1\u540d\u79f0";
  body.appendChild(label2);

  var titleInput = document.createElement("input");
  titleInput.type = "text"; titleInput.id = "modalTaskTitle"; titleInput.className = "modal-input";
  titleInput.placeholder = "\u4f8b\u5982\uff1a\u5b8c\u6210\u51fd\u6570\u9519\u9898\u6574\u7406"; titleInput.maxLength = 40;
  body.appendChild(titleInput);

  var label3 = document.createElement("label");
  label3.textContent = "\u9884\u8ba1\u65f6\u957f\uff08\u5206\u949f\uff09";
  body.appendChild(label3);

  var minInput = document.createElement("input");
  minInput.type = "number"; minInput.id = "modalTaskMinutes"; minInput.className = "modal-input";
  minInput.placeholder = "30"; minInput.min = "1"; minInput.max = "480";
  body.appendChild(minInput);

  var label4 = document.createElement("label");
  label4.textContent = "\u4efb\u52a1\u8bf4\u660e\uff08\u53ef\u9009\uff09";
  body.appendChild(label4);

  var descInput = document.createElement("input");
  descInput.type = "text"; descInput.id = "modalTaskDesc"; descInput.className = "modal-input";
  descInput.placeholder = "\u4f8b\u5982\uff1a\u6574\u7406\u6700\u8fd1\u4e09\u5957\u5377\u5b50";
  body.appendChild(descInput);

  var actions = document.createElement("div");
  actions.className = "modal-actions";
  var cancelBtn = document.createElement("button");
  cancelBtn.className = "secondary-button"; cancelBtn.textContent = "\u53d6\u6d88";
  cancelBtn.addEventListener("click", hideModal);
  actions.appendChild(cancelBtn);
  var confirmBtn = document.createElement("button");
  confirmBtn.className = "primary-button"; confirmBtn.textContent = "\u786e\u8ba4\u6dfb\u52a0";
  confirmBtn.addEventListener("click", function() {
    var subjectId = document.getElementById("modalTaskSubject").value;
    var title = document.getElementById("modalTaskTitle").value;
    var mins = document.getElementById("modalTaskMinutes").value;
    var desc = document.getElementById("modalTaskDesc").value;
    if (addTask(subjectId, title, mins, desc)) { hideModal(); }
  });
  actions.appendChild(confirmBtn);
  body.appendChild(actions);

  showModal("\u65b0\u589e\u4efb\u52a1", body);
  titleInput.addEventListener("keydown", function(e) { if (e.key === "Enter") confirmBtn.click(); });
}

/* ── Subject Management ── */
function editSubject(subjectId, name, color, note) {
  var sub = appData.subjects.find(function(s) { return s.id === subjectId; });
  if (!sub) { alert("\u5b66\u79d1\u4e0d\u5b58\u5728\u3002"); return; }
  var trimmedName = String(name || "").trim();
  if (!trimmedName) { alert("\u5b66\u79d1\u540d\u79f0\u4e0d\u80fd\u4e3a\u7a7a\u3002"); return; }
  var dup = appData.subjects.some(function(s) { return s.id !== subjectId && s.name.trim().toLowerCase() === trimmedName.toLowerCase(); });
  if (dup) { alert("\u5b66\u79d1\u540d\u79f0\u4e0d\u80fd\u91cd\u590d\u3002"); return; }
  sub.name = trimmedName;
  sub.color = color || "#4F7CFF";
  sub.note = String(note || "").trim();
  sub.updatedAt = new Date().toISOString();
  saveData();
  render();
}

function deleteSubject(subjectId) {
  var sub = appData.subjects.find(function(s) { return s.id === subjectId; });
  if (!sub) { return; }
  var taskCount = appData.tasks.filter(function(t) { return t.subjectId === subjectId; }).length;
  var msg = "\u786e\u5b9a\u5220\u9664\u5b66\u79d1\u300c" + sub.name + "\u300d";
  if (taskCount > 0) { msg += "\uff08\u540c\u65f6\u5220\u9664\u5176\u4e0b\u7684 " + taskCount + " \u4e2a\u4efb\u52a1\u53ca\u76f8\u5173\u6253\u5361\u8bb0\u5f55\uff09"; }
  msg += "\u5417\uff1f";
  if (!confirm(msg)) { return; }
  appData.subjects = appData.subjects.filter(function(s) { return s.id !== subjectId; });
  appData.tasks = appData.tasks.filter(function(t) { return t.subjectId !== subjectId; });
  appData.checkins = appData.checkins.filter(function(c) { return c.subjectId !== subjectId; });
  appData.timerLogs = appData.timerLogs.filter(function(l) { return l.subjectId !== subjectId; });
  if (activeSubjectId === subjectId) { activeSubjectId = "all"; }
  saveData();
  render();
}

/* ── Task Management ── */
function editTask(taskId, subjectId, title, estimatedMinutes, description) {
  var task = appData.tasks.find(function(t) { return t.id === taskId; });
  if (!task) { alert("\u4efb\u52a1\u4e0d\u5b58\u5728\u3002"); return; }
  var trimmedTitle = String(title || "").trim();
  var mins = Number.parseInt(estimatedMinutes, 10);
  if (!subjectId) { alert("\u8bf7\u9009\u62e9\u5b66\u79d1\u3002"); return; }
  if (!trimmedTitle) { alert("\u4efb\u52a1\u540d\u79f0\u4e0d\u80fd\u4e3a\u7a7a\u3002"); return; }
  if (!Number.isInteger(mins) || mins <= 0) { alert("\u9884\u8ba1\u5b66\u4e60\u65f6\u957f\u5fc5\u987b\u4e3a\u6b63\u6574\u6570\u3002"); return; }
  task.subjectId = subjectId;
  task.title = trimmedTitle;
  task.estimatedMinutes = mins;
  task.description = String(description || "").trim();
  task.updatedAt = new Date().toISOString();
  saveData();
  render();
}

function deleteTask(taskId) {
  appData.tasks = appData.tasks.filter(function(t) { return t.id !== taskId; });
  appData.checkins = appData.checkins.filter(function(c) { return c.taskId !== taskId; });
  appData.timerLogs = appData.timerLogs.filter(function(l) { return l.taskId !== taskId; });
  saveData();
  render();
}

/* ── Manage Subjects Modal ── */
function showManageSubjectsModal() {
  if (appData.subjects.length === 0) {
    alert("\u5c1a\u65e0\u5b66\u79d1\uff0c\u8bf7\u5148\u65b0\u589e\u3002");
    return;
  }
  var body = document.createElement("div");
  body.className = "modal-body";
  appData.subjects.forEach(function(sub) {
    var row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)";
    var dot = document.createElement("span");
    dot.style.cssText = "width:14px;height:14px;border-radius:50%;background:" + sub.color + ";flex:0 0 auto";
    var info = document.createElement("div");
    info.style.cssText = "flex:1;min-width:0";
    var nameEl = document.createElement("strong");
    nameEl.textContent = sub.name;
    nameEl.style.display = "block";
    var noteEl = document.createElement("span");
    noteEl.textContent = sub.note || "\u6682\u65e0\u5907\u6ce8";
    noteEl.style.cssText = "color:var(--muted);font-size:13px";
    info.appendChild(nameEl);
    info.appendChild(noteEl);
    var editBtn = document.createElement("button");
    editBtn.className = "task-action-icon"; editBtn.textContent = "\u270f\ufe0f";
    editBtn.title = "\u7f16\u8f91";
    editBtn.addEventListener("click", function() { showEditSubjectModal(sub.id); });
    var delBtn = document.createElement("button");
    delBtn.className = "task-action-icon danger"; delBtn.textContent = "\u2716";
    delBtn.title = "\u5220\u9664";
    delBtn.addEventListener("click", function() { hideModal(); deleteSubject(sub.id); });
    row.append(dot, info, editBtn, delBtn);
    body.appendChild(row);
  });
  var closeRow = document.createElement("div");
  closeRow.style.cssText = "display:flex;justify-content:flex-end;margin-top:12px";
  var closeBtn = document.createElement("button");
  closeBtn.className = "secondary-button"; closeBtn.textContent = "\u5173\u95ed";
  closeBtn.addEventListener("click", hideModal);
  closeRow.appendChild(closeBtn);
  body.appendChild(closeRow);
  showModal("\u7ba1\u7406\u5b66\u79d1", body);
}

/* ── Edit Subject Modal ── */
function showEditSubjectModal(subjectId) {
  var sub = appData.subjects.find(function(s) { return s.id === subjectId; });
  if (!sub) { return; }
  hideModal();
  var body = document.createElement("div");
  body.className = "modal-body";
  var label1 = document.createElement("label"); label1.textContent = "\u5b66\u79d1\u540d\u79f0"; body.appendChild(label1);
  var nameInput = document.createElement("input"); nameInput.type = "text"; nameInput.id = "editSubjectName"; nameInput.className = "modal-input"; nameInput.value = sub.name; nameInput.maxLength = 20; body.appendChild(nameInput);
  var label2 = document.createElement("label"); label2.textContent = "\u5b66\u79d1\u989c\u8272"; body.appendChild(label2);
  var cp = document.createElement("div"); cp.className = "color-picker";
  DEFAULT_SUBJECT_COLORS.forEach(function(c, idx) {
    var btn = document.createElement("button");
    btn.className = "color-option" + (c === sub.color ? " is-active" : "");
    btn.type = "button"; btn.dataset.color = c; btn.style.background = c;
    btn.addEventListener("click", function() { cp.querySelectorAll(".color-option").forEach(function(b) { b.classList.remove("is-active"); }); btn.classList.add("is-active"); });
    cp.appendChild(btn);
  });
  body.appendChild(cp);
  var label3 = document.createElement("label"); label3.textContent = "\u5907\u6ce8\uff08\u53ef\u9009\uff09"; body.appendChild(label3);
  var noteInput = document.createElement("input"); noteInput.type = "text"; noteInput.id = "editSubjectNote"; noteInput.className = "modal-input"; noteInput.value = sub.note || ""; body.appendChild(noteInput);
  var actions = document.createElement("div"); actions.className = "modal-actions";
  var cancelBtn = document.createElement("button"); cancelBtn.className = "secondary-button"; cancelBtn.textContent = "\u53d6\u6d88"; cancelBtn.addEventListener("click", hideModal); actions.appendChild(cancelBtn);
  var confirmBtn = document.createElement("button"); confirmBtn.className = "primary-button"; confirmBtn.textContent = "\u4fdd\u5b58";
  confirmBtn.addEventListener("click", function() {
    var name = document.getElementById("editSubjectName").value;
    var active = cp.querySelector(".color-option.is-active");
    var color = active ? active.dataset.color : "#4F7CFF";
    var note = document.getElementById("editSubjectNote").value;
    editSubject(subjectId, name, color, note);
    hideModal();
  });
  actions.appendChild(confirmBtn);
  body.appendChild(actions);
  showModal("\u7f16\u8f91\u5b66\u79d1", body);
  nameInput.addEventListener("keydown", function(e) { if (e.key === "Enter") confirmBtn.click(); });
}

/* ── Edit Task Modal ── */
function showEditTaskModal(task) {
  if (!task) { return; }
  hideModal();
  var body = document.createElement("div");
  body.className = "modal-body";
  var label1 = document.createElement("label"); label1.textContent = "\u6240\u5c5e\u5b66\u79d1"; body.appendChild(label1);
  var subjSelect = document.createElement("select"); subjSelect.id = "editTaskSubject"; subjSelect.className = "modal-input";
  appData.subjects.forEach(function(s) {
    var opt = document.createElement("option"); opt.value = s.id; opt.textContent = s.name;
    if (s.id === task.subjectId) { opt.selected = true; }
    subjSelect.appendChild(opt);
  });
  body.appendChild(subjSelect);
  var label2 = document.createElement("label"); label2.textContent = "\u4efb\u52a1\u540d\u79f0"; body.appendChild(label2);
  var titleInput = document.createElement("input"); titleInput.type = "text"; titleInput.id = "editTaskTitle"; titleInput.className = "modal-input"; titleInput.value = task.title; titleInput.maxLength = 40; body.appendChild(titleInput);
  var label3 = document.createElement("label"); label3.textContent = "\u9884\u8ba1\u65f6\u957f\uff08\u5206\u949f\uff09"; body.appendChild(label3);
  var minInput = document.createElement("input"); minInput.type = "number"; minInput.id = "editTaskMinutes"; minInput.className = "modal-input"; minInput.value = task.estimatedMinutes; minInput.min = "1"; minInput.max = "480"; body.appendChild(minInput);
  var label4 = document.createElement("label"); label4.textContent = "\u4efb\u52a1\u8bf4\u660e\uff08\u53ef\u9009\uff09"; body.appendChild(label4);
  var descInput = document.createElement("input"); descInput.type = "text"; descInput.id = "editTaskDesc"; descInput.className = "modal-input"; descInput.value = task.description || ""; body.appendChild(descInput);
  var actions = document.createElement("div"); actions.className = "modal-actions";
  var cancelBtn = document.createElement("button"); cancelBtn.className = "secondary-button"; cancelBtn.textContent = "\u53d6\u6d88"; cancelBtn.addEventListener("click", hideModal); actions.appendChild(cancelBtn);
  var confirmBtn = document.createElement("button"); confirmBtn.className = "primary-button"; confirmBtn.textContent = "\u4fdd\u5b58";
  confirmBtn.addEventListener("click", function() {
    var sid = document.getElementById("editTaskSubject").value;
    var title = document.getElementById("editTaskTitle").value;
    var mins = document.getElementById("editTaskMinutes").value;
    var desc = document.getElementById("editTaskDesc").value;
    editTask(task.id, sid, title, mins, desc);
    hideModal();
  });
  actions.appendChild(confirmBtn);
  body.appendChild(actions);
  showModal("\u7f16\u8f91\u4efb\u52a1", body);
  titleInput.addEventListener("keydown", function(e) { if (e.key === "Enter") confirmBtn.click(); });
}

/* ── Data Export / Import ── */
function exportData() {
  try {
    var blob = new Blob([JSON.stringify(appData, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "\u5b66\u4e60\u6253\u5361\u5907\u4efd_" + getLocalDateString() + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert("\u6570\u636e\u5df2\u5bfc\u51fa\u3002");
  } catch (e) {
    alert("\u5bfc\u51fa\u5931\u8d25\uff1a" + e.message);
  }
}

function importData() {
  var input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.addEventListener("change", function(e) {
    var file = e.target.files[0];
    if (!file) { return; }
    var reader = new FileReader();
    reader.addEventListener("load", function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        if (!data || typeof data !== "object") { alert("\u65e0\u6548\u7684\u5907\u4efd\u6587\u4ef6\u3002"); return; }
        data.version = data.version || 1;
        data.subjects = Array.isArray(data.subjects) ? data.subjects : [];
        data.tasks = Array.isArray(data.tasks) ? data.tasks : [];
        data.checkins = Array.isArray(data.checkins) ? data.checkins : [];
        data.timerLogs = Array.isArray(data.timerLogs) ? data.timerLogs : [];
        data.settings = data.settings || {};
        if (!confirm("\u786e\u5b9a\u5bfc\u5165\u6570\u636e\u5417\uff1f\u5f53\u524d\u6570\u636e\u5c06\u88ab\u8986\u76d6\u3002")) { return; }
        saveData(data, {});
        render();
        alert("\u6570\u636e\u5df2\u5bfc\u5165\u5e76\u5237\u65b0\u3002");
      } catch (parseErr) {
        alert("\u6587\u4ef6\u89e3\u6790\u5931\u8d25\uff1a" + parseErr.message);
      }
    });
    reader.readAsText(file);
  });
  input.click();
}
