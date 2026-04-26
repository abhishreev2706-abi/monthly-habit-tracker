/* ── Monthly Habit Tracker — app.js ── */

// ── DEFAULT DATA ──────────────────────────────────────────────
const DEFAULT_HABITS = [
  'Wake up early', '50 Pushups', '5 Liters Water', 'Exercise',
  'Reading', 'Sleep Early', 'Meditation'
];

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// Dynamic colors cycling for pie chart
const CHART_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f43f5e','#a855f7'];

// ── STATE ─────────────────────────────────────────────────────
let state = {
  month:  new Date().getMonth(),
  year:   new Date().getFullYear(),
  name:   '',
  habits: [...DEFAULT_HABITS],
  dark:   false,
  data:   {}  // keyed by "YYYY-MM", each: { checks, sleep, notes, income, expenses }
};

function monthKey() {
  return `${state.year}-${String(state.month + 1).padStart(2, '0')}`;
}

function monthData() {
  const k = monthKey();
  if (!state.data[k]) state.data[k] = {
    checks: {}, sleep: {}, notes: '',
    income:   [ { label: 'Salary',    amount: '' } ],
    expenses: [ { label: 'Food',      amount: '' },
                { label: 'Transport', amount: '' } ]
  };
  // migrate older flat-object buckets to array format
  const d = state.data[k];
  if (!Array.isArray(d.income))   d.income   = [ { label: 'Salary',    amount: '' } ];
  if (!Array.isArray(d.expenses)) d.expenses = [ { label: 'Food',      amount: '' },
                                                  { label: 'Transport', amount: '' } ];
  return d;
}

// ── STORAGE ───────────────────────────────────────────────────
const STORAGE_KEY = 'mht_v1';

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) { try { Object.assign(state, JSON.parse(raw)); } catch(e) {} }
}

// ── HELPERS ───────────────────────────────────────────────────
function daysInMonth(month, year) {
  return new Date(year, month + 1, 0).getDate();
}

function checkKey(hIdx, day) { return `${hIdx}-${day}`; }

function dayStatus(day) {
  const now = new Date();
  if (state.year !== now.getFullYear() || state.month !== now.getMonth()) return 'other-month';
  if (day === now.getDate()) return 'today';
  if (day < now.getDate())  return 'past';
  return 'future';
}

// ── INIT SELECTS ──────────────────────────────────────────────
function initSelects() {
  const ms = document.getElementById('monthSelect');
  const ys = document.getElementById('yearSelect');

  MONTHS.forEach((m, i) => {
    const o = document.createElement('option');
    o.value = i; o.textContent = m;
    if (i === state.month) o.selected = true;
    ms.appendChild(o);
  });

  const curYear = new Date().getFullYear();
  for (let y = curYear - 2; y <= curYear + 2; y++) {
    const o = document.createElement('option');
    o.value = y; o.textContent = y;
    if (y === state.year) o.selected = true;
    ys.appendChild(o);
  }

  ms.addEventListener('change', () => { state.month = +ms.value; onMonthChange(); });
  ys.addEventListener('change', () => { state.year  = +ys.value; onMonthChange(); });
}

function onMonthChange() {
  renderTable();
  renderSleepInputs();
  updateSleepChart();
  refreshNotes();
  renderFinance();
  saveState();
}

// ── CONFIRM MODAL ────────────────────────────────────────────
function showInlineConfirm(tr, message, onYes, onNo) {
  // Remove any existing confirm row
  const next = tr.nextSibling;
  if (next && next.classList && next.classList.contains('confirm-row')) next.remove();

  // Build centered overlay
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';

  const box = document.createElement('div');
  box.className = 'confirm-box';

  const msg = document.createElement('p');
  msg.textContent = message;

  const actions = document.createElement('div');
  actions.className = 'confirm-actions';

  const yes = document.createElement('button');
  yes.className = 'confirm-yes'; yes.textContent = 'Yes';
  yes.addEventListener('click', () => { overlay.remove(); onYes(); });

  const no = document.createElement('button');
  no.className = 'confirm-no'; no.textContent = 'No';
  no.addEventListener('click', () => { overlay.remove(); if (onNo) onNo(); });

  // Close on backdrop click
  overlay.addEventListener('click', e => {
    if (e.target === overlay) { overlay.remove(); if (onNo) onNo(); }
  });

  actions.appendChild(yes);
  actions.appendChild(no);
  box.appendChild(msg);
  box.appendChild(actions);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

// ── HABIT TABLE ───────────────────────────────────────────────
function addHabit() {
  state.habits.push('New Habit');
  saveState();
  renderTable();
  const inputs = document.querySelectorAll('.habit-name');
  if (inputs.length) inputs[inputs.length - 1].focus();
}

function deleteHabit(hIdx, tr) {
  showInlineConfirm(
    tr,
    `Delete "${state.habits[hIdx]}"? All tracked data will be removed.`,
    () => {
      Object.values(state.data).forEach(md => {
        Object.keys(md.checks).forEach(k => {
          if (k.startsWith(`${hIdx}-`)) delete md.checks[k];
        });
      });
      state.habits.splice(hIdx, 1);
      saveState();
      renderTable();
    }
  );
}

function renderTable() {
  const days      = daysInMonth(state.month, state.year);
  const headerRow = document.getElementById('headerRow');
  const body      = document.getElementById('habitBody');

  headerRow.innerHTML = '<th>Habit</th>';
  for (let d = 1; d <= days; d++) headerRow.innerHTML += `<th>${d}</th>`;
  headerRow.innerHTML += '<th>Progress</th>';

  body.innerHTML = '';
  state.habits.forEach((habit, hIdx) => {
    const tr = document.createElement('tr');

    // Habit name + delete button
    const nameTd = document.createElement('td');
    const input  = document.createElement('input');
    input.className = 'habit-name';
    input.value = habit;
    input.addEventListener('focus', () => { input.dataset.before = input.value; });
    input.addEventListener('change', () => {
      const newName = input.value.trim();
      if (!newName || newName === input.dataset.before) { input.value = input.dataset.before; return; }
      showInlineConfirm(
        tr,
        `Rename "${input.dataset.before}" to "${newName}"?`,
        () => { state.habits[hIdx] = newName; saveState(); updateSummary(); },
        () => { input.value = input.dataset.before; }
      );
    });
    const del = document.createElement('button');
    del.className = 'btn-del habit-del'; del.textContent = '✕'; del.title = 'Remove habit';
    del.addEventListener('click', () => deleteHabit(hIdx, tr));
    nameTd.appendChild(input);
    nameTd.appendChild(del);
    tr.appendChild(nameTd);

    // Day cells
    let doneCount = 0;
    for (let d = 1; d <= days; d++) {
      const td     = document.createElement('td');
      const key    = checkKey(hIdx, d);
      const md     = monthData();
      const div    = document.createElement('div');
      const status = dayStatus(d);
      const isToday = status === 'today';
      const locked  = !isToday;

      let cls = 'day-cell';
      if (md.checks[key]) cls += ' done';
      if (isToday) cls += ' today';
      if (locked)  cls += ' locked';

      div.className   = cls;
      div.textContent = md.checks[key] ? '✓' : '';
      div.title       = locked ? (status === 'past' ? 'Past day — locked' : 'Future day — locked') : 'Click to toggle';

      if (!locked) {
        div.addEventListener('click', () => {
          monthData().checks[key] = !monthData().checks[key];
          div.className   = 'day-cell today' + (monthData().checks[key] ? ' done' : '');
          div.textContent = monthData().checks[key] ? '✓' : '';
          saveState();
          updateProgress(hIdx, days);
          updateSummary();
        });
      }
      if (md.checks[key]) doneCount++;
      td.appendChild(div);
      tr.appendChild(td);
    }

    // Progress
    const pct = Math.round((doneCount / days) * 100);
    const ptd = document.createElement('td');
    ptd.className = 'progress-cell';
    ptd.id = `prog-${hIdx}`;
    ptd.innerHTML = `<div>${pct}%</div><div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>`;
    tr.appendChild(ptd);

    body.appendChild(tr);
  });

  updateSummary();

  // Wire add button (re-clone to avoid duplicate listeners)
  const addBtn = document.getElementById('addHabitBtn');
  const newBtn = addBtn.cloneNode(true);
  addBtn.parentNode.replaceChild(newBtn, addBtn);
  newBtn.addEventListener('click', addHabit);
}

function updateProgress(hIdx, days) {
  const checks = monthData().checks;
  const done   = Object.keys(checks).filter(k => k.startsWith(`${hIdx}-`) && checks[k]).length;
  const pct    = Math.round((done / days) * 100);
  const cell   = document.getElementById(`prog-${hIdx}`);
  if (!cell) return;
  cell.innerHTML = `<div>${pct}%</div><div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>`;
}

function updateSummary() {
  const days  = daysInMonth(state.month, state.year);
  const total = state.habits.length * days;
  const done  = Object.values(monthData().checks).filter(Boolean).length;
  const pct   = total ? Math.round((done / total) * 100) : 0;
  document.getElementById('summaryBadge').textContent = `${pct}% monthly completion (${done}/${total})`;
}

// ── SLEEP TRACKER ─────────────────────────────────────────────
let sleepChart = null;

function renderSleepInputs() {
  const days = daysInMonth(state.month, state.year);
  const wrap = document.getElementById('sleepInputs');
  wrap.innerHTML = '';

  for (let d = 1; d <= days; d++) {
    const div = document.createElement('div');
    div.className = 'sleep-day';
    const label = document.createElement('label');
    label.textContent = d;
    const inp = document.createElement('input');
    inp.type = 'number'; inp.min = 0; inp.max = 24; inp.step = .5;
    inp.value = monthData().sleep[d] ?? '';
    inp.placeholder = '—';
    inp.addEventListener('input', () => { monthData().sleep[d] = inp.value; saveState(); updateSleepChart(); });
    div.appendChild(label);
    div.appendChild(inp);
    wrap.appendChild(div);
  }
}

function updateSleepChart() {
  const days      = daysInMonth(state.month, state.year);
  const labels    = Array.from({length: days}, (_, i) => i + 1);
  const data      = labels.map(d => parseFloat(monthData().sleep[d]) || null);
  const ctx       = document.getElementById('sleepChart').getContext('2d');
  const isDark    = state.dark;
  const gridColor = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)';
  const textColor = isDark ? '#94a3b8' : '#6b7280';

  if (sleepChart) sleepChart.destroy();
  sleepChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: 'Hours Slept', data, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,.12)', borderWidth: 2.5, pointBackgroundColor: '#6366f1', pointRadius: 4, pointHoverRadius: 6, tension: .4, fill: true, spanGaps: true }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: textColor, font: { size: 12 } } }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        x: { ticks: { color: textColor, maxTicksLimit: 16 }, grid: { color: gridColor } },
        y: { min: 0, max: 12, ticks: { color: textColor, stepSize: 2 }, grid: { color: gridColor }, title: { display: true, text: 'Hours', color: textColor } }
      }
    }
  });
}

// ── NOTES ─────────────────────────────────────────────────────
function initNotes() {
  const ta = document.getElementById('notesArea');
  ta.value = monthData().notes;
  ta.addEventListener('input', () => { monthData().notes = ta.value; saveState(); });
}

function refreshNotes() {
  document.getElementById('notesArea').value = monthData().notes;
}

// ── FINANCE TRACKER ───────────────────────────────────────────
let pieChart = null;
let barChart = null;

// Render rows for an array of { label, amount } items
function buildFinanceRows(containerId, addBtnId, arr, onChange, defaultCount = 0) {
  const wrap = document.getElementById(containerId);
  wrap.innerHTML = '';

  arr.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'finance-row';

    // Editable label
    const lbl = document.createElement('input');
    lbl.type = 'text'; lbl.className = 'finance-label-input';
    lbl.value = item.label; lbl.placeholder = 'Category name';
    lbl.addEventListener('input', () => { item.label = lbl.value; onChange(); saveState(); });

    // Amount
    const amt = document.createElement('input');
    amt.type = 'number'; amt.min = 0; amt.step = 1; amt.placeholder = '0';
    amt.value = item.amount ?? '';
    amt.addEventListener('input', () => { item.amount = amt.value; onChange(); saveState(); });

    // Delete button — hide for default rows
    const del = document.createElement('button');
    del.className = 'btn-del'; del.textContent = '✕'; del.title = 'Remove';
    del.addEventListener('click', () => {
      arr.splice(idx, 1);
      saveState();
      buildFinanceRows(containerId, addBtnId, arr, onChange);
      onChange();
    });
    if (idx < defaultCount) del.style.visibility = 'hidden';

    row.appendChild(lbl);
    row.appendChild(amt);
    row.appendChild(del);
    wrap.appendChild(row);
  });

  // Wire the Add button
  const addBtn = document.getElementById(addBtnId);
  // Clone to remove old listeners
  const newBtn = addBtn.cloneNode(true);
  addBtn.parentNode.replaceChild(newBtn, addBtn);
  newBtn.addEventListener('click', () => {
    arr.push({ label: '', amount: '' });
    saveState();
    buildFinanceRows(containerId, addBtnId, arr, onChange);
    // Focus the new label input
    const inputs = document.querySelectorAll(`#${containerId} .finance-label-input`);
    if (inputs.length) inputs[inputs.length - 1].focus();
  });
}

function sumArr(arr) {
  return arr.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);
}

function fmt(n) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function updateFinanceSummary() {
  const md      = monthData();
  const income  = sumArr(md.income);
  const expense = sumArr(md.expenses);
  const balance = income - expense;
  const savings = income > 0 ? Math.round((balance / income) * 100) : 0;

  document.getElementById('incomeTotal').textContent  = 'Total: ' + fmt(income);
  document.getElementById('expenseTotal').textContent = 'Total: ' + fmt(expense);
  document.getElementById('finIncome').textContent    = fmt(income);
  document.getElementById('finExpense').textContent   = fmt(expense);
  document.getElementById('finBalance').textContent   = fmt(balance);
  document.getElementById('finSavings').textContent   = savings + '%';
  document.getElementById('financeBadge').textContent = `Balance: ${fmt(balance)}`;

  updateFinanceCharts(income, expense, md.expenses);
}

function updateFinanceCharts(income, expense, expArr) {
  const isDark    = state.dark;
  const textColor = isDark ? '#94a3b8' : '#6b7280';
  const gridColor = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)';
  const borderCol = isDark ? '#1e293b' : '#fff';

  const pieLabels = expArr.map(i => i.label || 'Unnamed');
  const pieData   = expArr.map(i => parseFloat(i.amount) || 0);
  const pieColors = expArr.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(document.getElementById('expensePieChart').getContext('2d'), {
    type: 'doughnut',
    data: { labels: pieLabels, datasets: [{ data: pieData, backgroundColor: pieColors, borderWidth: 2, borderColor: borderCol }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: textColor, font: { size: 11 }, padding: 10 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)}` } }
      }
    }
  });

  if (barChart) barChart.destroy();
  barChart = new Chart(document.getElementById('incomeBarChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Income', 'Expenses', 'Balance'],
      datasets: [{
        label: 'Amount (₹)',
        data: [income, expense, income - expense],
        backgroundColor: ['rgba(16,185,129,.75)', 'rgba(239,68,68,.75)', 'rgba(99,102,241,.75)'],
        borderRadius: 8, borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed.y)}` } }
      },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { ticks: { color: textColor }, grid: { color: gridColor }, title: { display: true, text: 'Amount (₹)', color: textColor } }
      }
    }
  });
}

function renderFinance() {
  const md = monthData();
  buildFinanceRows('incomeRows',  'addIncomeBtn',  md.income,   updateFinanceSummary, 1);
  buildFinanceRows('expenseRows', 'addExpenseBtn', md.expenses, updateFinanceSummary, 2);
  updateFinanceSummary();
}

// ── DARK MODE ─────────────────────────────────────────────────
function applyDark() {
  document.body.classList.toggle('dark', state.dark);
  document.getElementById('darkToggle').textContent = state.dark ? '☀️' : '🌙';
  if (sleepChart) updateSleepChart();
}

// ── RESET ─────────────────────────────────────────────────────
function resetMonth() {
  if (!confirm(`Reset all data for ${MONTHS[state.month]} ${state.year}?`)) return;
  state.data[monthKey()] = {
    checks: {}, sleep: {}, notes: '',
    income:   [ { label: 'Salary',    amount: '' } ],
    expenses: [ { label: 'Food',      amount: '' },
                { label: 'Transport', amount: '' } ]
  };
  saveState();
  renderTable();
  renderSleepInputs();
  updateSleepChart();
  refreshNotes();
  renderFinance();
}

// ── PDF EXPORT ────────────────────────────────────────────────
function exportPDF() {
  window.print();
}

// ── BOOTSTRAP ─────────────────────────────────────────────────
function init() {
  loadState();
  initSelects();

  const nameInput = document.getElementById('nameInput');
  nameInput.value = state.name;
  nameInput.addEventListener('input', () => { state.name = nameInput.value; });

  document.getElementById('saveBtn').addEventListener('click', () => {
    state.name = nameInput.value;
    saveState();
    const btn = document.getElementById('saveBtn');
    btn.textContent = '✅ Saved!';
    setTimeout(() => { btn.textContent = '💾 Save'; }, 1500);
  });

  document.getElementById('todayBtn').addEventListener('click', () => {
    const now = new Date();
    state.month = now.getMonth();
    state.year  = now.getFullYear();
    document.getElementById('monthSelect').value = state.month;
    document.getElementById('yearSelect').value  = state.year;
    onMonthChange();
    // Scroll today's column into view
    setTimeout(() => {
      const todayCell = document.querySelector('.day-cell.today');
      if (todayCell) todayCell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 100);
  });

  document.getElementById('resetBtn').addEventListener('click', resetMonth);
  document.getElementById('exportBtn').addEventListener('click', exportPDF);
  document.getElementById('darkToggle').addEventListener('click', () => {
    state.dark = !state.dark;
    applyDark();
    renderFinance();
    saveState();
  });

  applyDark();
  renderTable();
  renderSleepInputs();
  updateSleepChart();
  initNotes();
  renderFinance();
}

document.addEventListener('DOMContentLoaded', init);
