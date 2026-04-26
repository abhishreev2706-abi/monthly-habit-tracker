/* ── Monthly Habit Tracker — app.js ── */

// ── DEFAULT DATA ──────────────────────────────────────────────
const DEFAULT_HABITS = [
  'Wake up early', '50 Pushups', '5 Liters Water', 'Exercise',
  'No Alcohol', '2 Hr Guitar', 'Reading', 'No Smoking',
  'Sleep Early', 'Meditation'
];

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// ── STATE ─────────────────────────────────────────────────────
let state = {
  month: new Date().getMonth(),   // 0-indexed
  year:  new Date().getFullYear(),
  name:  '',
  habits: [...DEFAULT_HABITS],
  dark:   false,
  // Per-month data keyed by "YYYY-MM"
  // Each entry: { checks: {}, sleep: {}, notes: '' }
  data: {}
};

// Returns key like "2025-06" for current selected month
function monthKey() {
  return `${state.year}-${String(state.month + 1).padStart(2, '0')}`;
}

// Returns the data bucket for the current month, creating it if missing
function monthData() {
  const k = monthKey();
  if (!state.data[k]) state.data[k] = { checks: {}, sleep: {}, notes: '' };
  return state.data[k];
}

// ── STORAGE ───────────────────────────────────────────────────
const STORAGE_KEY = 'mht_v1';

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { Object.assign(state, JSON.parse(raw)); } catch(e) {}
  }
}

// ── HELPERS ───────────────────────────────────────────────────
function daysInMonth(month, year) {
  return new Date(year, month + 1, 0).getDate();
}

function checkKey(hIdx, day) { return `${hIdx}-${day}`; }


// Returns 'today' | 'past' | 'future' | 'other-month'
function dayStatus(day) {
  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth();
  const todayD = now.getDate();
  if (state.year !== todayY || state.month !== todayM) return 'other-month';
  if (day === todayD) return 'today';
  if (day < todayD)  return 'past';
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
  updateChart();
  refreshNotes();
  saveState();
}

// ── HABIT TABLE ───────────────────────────────────────────────
function renderTable() {
  const days = daysInMonth(state.month, state.year);
  const headerRow = document.getElementById('headerRow');
  const body      = document.getElementById('habitBody');

  // Header
  headerRow.innerHTML = '<th>Habit</th>';
  for (let d = 1; d <= days; d++) {
    headerRow.innerHTML += `<th>${d}</th>`;
  }
  headerRow.innerHTML += '<th>Progress</th>';

  // Body
  body.innerHTML = '';
  state.habits.forEach((habit, hIdx) => {
    const tr = document.createElement('tr');

    // Habit name cell (editable)
    const nameTd = document.createElement('td');
    const input  = document.createElement('input');
    input.className = 'habit-name';
    input.value = habit;
    input.addEventListener('change', () => {
      state.habits[hIdx] = input.value;
      saveState();
      updateSummary();
    });
    nameTd.appendChild(input);
    tr.appendChild(nameTd);

    // Day cells
    let doneCount = 0;
    for (let d = 1; d <= days; d++) {
      const td  = document.createElement('td');
      const key = checkKey(hIdx, d);
      const md  = monthData();
      const div = document.createElement('div');
      const status  = dayStatus(d);
      const isToday = status === 'today';
      const locked  = !isToday;

      let cellClass = 'day-cell';
      if (md.checks[key]) cellClass += ' done';
      if (isToday) cellClass += ' today';
      if (locked)  cellClass += ' locked';

      div.className   = cellClass;
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

    // Progress cell
    const pct = Math.round((doneCount / days) * 100);
    const ptd = document.createElement('td');
    ptd.className = 'progress-cell';
    ptd.id = `prog-${hIdx}`;
    ptd.innerHTML = `
      <div>${pct}%</div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" style="width:${pct}%"></div>
      </div>`;
    tr.appendChild(ptd);

    body.appendChild(tr);
  });

  updateSummary();
}

function updateProgress(hIdx, days) {
  const checks = monthData().checks;
  const done = Object.keys(checks)
    .filter(k => k.startsWith(`${hIdx}-`) && checks[k]).length;
  const pct = Math.round((done / days) * 100);
  const cell = document.getElementById(`prog-${hIdx}`);
  if (!cell) return;
  cell.innerHTML = `
    <div>${pct}%</div>
    <div class="progress-bar-wrap">
      <div class="progress-bar-fill" style="width:${pct}%"></div>
    </div>`;
}

function updateSummary() {
  const days  = daysInMonth(state.month, state.year);
  const total = state.habits.length * days;
  const done  = Object.values(monthData().checks).filter(Boolean).length;
  const pct   = total ? Math.round((done / total) * 100) : 0;
  const badge = document.getElementById('summaryBadge');
  badge.textContent = `${pct}% monthly completion (${done}/${total})`;
}

// ── SLEEP TRACKER ─────────────────────────────────────────────
let sleepChart = null;

function renderSleepInputs() {
  const days = daysInMonth(state.month, state.year);
  const wrap = document.getElementById('sleepInputs');
  wrap.innerHTML = '';

  for (let d = 1; d <= days; d++) {
    const div   = document.createElement('div');
    div.className = 'sleep-day';
    const label = document.createElement('label');
    label.textContent = d;
    const inp   = document.createElement('input');
    inp.type  = 'number';
    inp.min   = 0; inp.max = 24; inp.step = .5;
    inp.value = monthData().sleep[d] ?? '';
    inp.placeholder = '—';
    inp.addEventListener('input', () => {
      monthData().sleep[d] = inp.value;
      saveState();
      updateChart();
    });
    div.appendChild(label);
    div.appendChild(inp);
    wrap.appendChild(div);
  }
}

function updateChart() {
  const days   = daysInMonth(state.month, state.year);
  const labels = Array.from({length: days}, (_, i) => i + 1);
  const data   = labels.map(d => parseFloat(monthData().sleep[d]) || null);

  const ctx = document.getElementById('sleepChart').getContext('2d');

  if (sleepChart) sleepChart.destroy();

  const isDark = state.dark;
  const gridColor = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)';
  const textColor = isDark ? '#94a3b8' : '#6b7280';

  sleepChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Hours Slept',
        data,
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,.12)',
        borderWidth: 2.5,
        pointBackgroundColor: '#6366f1',
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: .4,
        fill: true,
        spanGaps: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font: { size: 12 } } },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        x: {
          ticks: { color: textColor, maxTicksLimit: 16 },
          grid:  { color: gridColor }
        },
        y: {
          min: 0, max: 12,
          ticks: { color: textColor, stepSize: 2 },
          grid:  { color: gridColor },
          title: { display: true, text: 'Hours', color: textColor }
        }
      }
    }
  });
}

// ── NOTES ─────────────────────────────────────────────────────
function initNotes() {
  const ta = document.getElementById('notesArea');
  ta.value = monthData().notes;
  ta.addEventListener('input', () => {
    monthData().notes = ta.value;
    saveState();
  });
}

// Reload notes textarea when month changes
function refreshNotes() {
  document.getElementById('notesArea').value = monthData().notes;
}

// ── DARK MODE ─────────────────────────────────────────────────
function applyDark() {
  document.body.classList.toggle('dark', state.dark);
  document.getElementById('darkToggle').textContent = state.dark ? '☀️' : '🌙';
  if (sleepChart) updateChart(); // re-render with correct colors
}

// ── RESET ─────────────────────────────────────────────────────
function resetMonth() {
  if (!confirm(`Reset all data for ${MONTHS[state.month]} ${state.year}?`)) return;
  // Clear only the current month's data
  state.data[monthKey()] = { checks: {}, sleep: {}, notes: '' };
  saveState();
  renderTable();
  renderSleepInputs();
  updateChart();
}

// ── PDF EXPORT ────────────────────────────────────────────────
function exportPDF() {
  const el  = document.getElementById('app');
  const opt = {
    margin:    [8, 8],
    filename:  `HabitTracker-${MONTHS[state.month]}-${state.year}.pdf`,
    image:     { type: 'jpeg', quality: .95 },
    html2canvas: { scale: 1.5, useCORS: true },
    jsPDF:     { unit: 'mm', format: 'a3', orientation: 'landscape' }
  };
  html2pdf().set(opt).from(el).save();
}

// ── BOOTSTRAP ─────────────────────────────────────────────────
function init() {
  loadState();
  initSelects();

  // Name input
  const nameInput = document.getElementById('nameInput');
  nameInput.value = state.name;
  nameInput.addEventListener('input', () => { state.name = nameInput.value; });

  // Buttons
  document.getElementById('saveBtn').addEventListener('click', () => {
    state.name = nameInput.value;
    saveState();
    const btn = document.getElementById('saveBtn');
    btn.textContent = '✅ Saved!';
    setTimeout(() => { btn.textContent = '💾 Save'; }, 1500);
  });

  document.getElementById('resetBtn').addEventListener('click', resetMonth);
  document.getElementById('exportBtn').addEventListener('click', exportPDF);
  document.getElementById('darkToggle').addEventListener('click', () => {
    state.dark = !state.dark;
    applyDark();
    saveState();
  });

  applyDark();
  renderTable();
  renderSleepInputs();
  updateChart();
  initNotes();
}

document.addEventListener('DOMContentLoaded', init);
