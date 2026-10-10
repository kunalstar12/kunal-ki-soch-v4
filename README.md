const STORAGE_KEY = 'kunal_ki_soch_v4_history';
const AUTO_TICK_SECONDS = 30;

const state = {
  timer: AUTO_TICK_SECONDS,
  history: loadHistory(),
  lastPrediction: null,
};

const nodes = {
  countdown: document.getElementById('countdown'),
  currentPeriod: document.getElementById('currentPeriod'),
  timerValue: document.getElementById('timerValue'),
  historyInput: document.getElementById('historyInput'),
  generatePredictionBtn: document.getElementById('generatePredictionBtn'),
  loadDemoBtn: document.getElementById('loadDemoBtn'),
  predictedSide: document.getElementById('predictedSide'),
  predictedNumber: document.getElementById('predictedNumber'),
  predictionReason: document.getElementById('predictionReason'),
  outcomePeriod: document.getElementById('outcomePeriod'),
  outcomeSide: document.getElementById('outcomeSide'),
  outcomeNumber: document.getElementById('outcomeNumber'),
  outcomeStatus: document.getElementById('outcomeStatus'),
  saveOutcomeBtn: document.getElementById('saveOutcomeBtn'),
  historyTableBody: document.getElementById('historyTableBody'),
};

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
}

function updateCountdown() {
  nodes.countdown.textContent = state.timer;
}

function formatSide(side) {
  if (!side) return '—';
  return side === 'big' ? 'Big' : 'Small';
}

function sideFromNumber(value) {
  const number = Number(value);
  return number >= 5 ? 'big' : 'small';
}

function oppositeSide(side) {
  return side === 'big' ? 'small' : 'big';
}

function parseEntry(entryText) {
  const cleaned = String(entryText).trim();
  if (!cleaned) return null;

  const linePattern = /^(\d+)\s*[|,-]\s*(big|small)\s*[|,-]\s*(\d)$/i;
  const simplePattern = /^(big|small)\s*(\d)$/i;
  const numberOnlyPattern = /^(\d)$/;

  const lineMatch = cleaned.match(linePattern);
  if (lineMatch) {
    return {
      period: Number(lineMatch[1]),
      side: lineMatch[2].toLowerCase(),
      number: Number(lineMatch[3]),
    };
  }

  const simpleMatch = cleaned.match(simplePattern);
  if (simpleMatch) {
    return {
      side: simpleMatch[1].toLowerCase(),
      number: Number(simpleMatch[2]),
    };
  }

  const numberMatch = cleaned.match(numberOnlyPattern);
  if (numberMatch) {
    return {
      number: Number(numberMatch[1]),
      side: sideFromNumber(numberMatch[1]),
    };
  }

  return null;
}

function parseHistoryText(rawText) {
  const tokenized = rawText
    .split(/\n|,|\|/)
    .map((item) => item.trim())
    .filter(Boolean);

  const entries = [];
  for (const token of tokenized) {
    const entry = parseEntry(token);
    if (entry) entries.push(entry);
  }

  return entries;
}

function getRecentHistory(limit = 10) {
  const rawText = nodes.historyInput.value.trim();
  const parsed = parseHistoryText(rawText);
  const valid = parsed.filter((entry) => entry && Number.isFinite(entry.number));

  return valid.slice(-limit);
}

function countConsecutiveSameSide(entries) {
  const recent = entries.slice(-6).map((entry) => entry.side || sideFromNumber(entry.number));
  let maxRun = 1;
  let currentRun = 1;

  for (let i = 1; i < recent.length; i += 1) {
    if (recent[i] === recent[i - 1]) {
      currentRun += 1;
      maxRun = Math.max(maxRun, currentRun);
    } else {
      currentRun = 1;
    }
  }

  return maxRun;
}

function chooseSideFromRecent(entries) {
  const recent = entries.slice(-6).map((entry) => entry.side || sideFromNumber(entry.number));
  const sameSidePattern = countConsecutiveSameSide(entries);

  if (sameSidePattern >= 4) {
    return oppositeSide(recent[recent.length - 1]);
  }

  const lastTwo = recent.slice(-2);
  const last = recent[recent.length - 1];
  const prior = recent[recent.length - 2];

  if (lastTwo[0] === lastTwo[1]) {
    return oppositeSide(last);
  }

  const zigzag = recent.length >= 3 && recent[recent.length - 1] !== recent[recent.length - 2] && recent[recent.length - 2] !== recent[recent.length - 3]
    ? last
    : null;

  if (zigzag) {
    return zigzag;
  }

  const bigCount = recent.filter((side) => side === 'big').length;
  const smallCount = recent.filter((side) => side === 'small').length;

  if (bigCount === smallCount) {
    return last === 'big' ? 'small' : 'big';
  }

  return bigCount > smallCount ? 'big' : 'small';
}

function pickNumberForSide(entries, side) {
  const choices = entries.filter((entry) => (entry.side || sideFromNumber(entry.number)) === side);
  const pool = choices.length ? choices : entries;

  const ranges = side === 'big' ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
  const frequency = {};

  for (const item of pool) {
    const number = Number(item.number);
    if (ranges.includes(number)) {
      frequency[number] = (frequency[number] || 0) + 1;
    }
  }

  if (Object.keys(frequency).length === 0) {
    return side === 'big' ? 7 : 3;
  }

  const best = Object.entries(frequency).sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))[0];
  return Number(best[0]);
}

function generatePrediction() {
  const history = getRecentHistory(10);

  if (!history.length) {
    nodes.predictedSide.textContent = '—';
    nodes.predictedNumber.textContent = '—';
    nodes.predictedSide.className = 'side-pill neutral';
    nodes.predictionReason.textContent = 'No valid chart history found. Add at least one result row.';
    return null;
  }

  const recent = history.slice(-10);
  const side = chooseSideFromRecent(recent);
  const number = pickNumberForSide(recent, side);

  const lastNumber = recent[recent.length - 1].number;
  const currentPeriod = Number(nodes.currentPeriod.value) || Number(recent[recent.length - 1].period || 0) + 1;

  const reason = [
    'Zigzag pattern checked.',
    'Reverse rule applied for two-bar big/small shift.',
    'Dragon trend and 4-level protection considered.',
    `Recent data suggests ${formatSide(side)} with a number around ${number}.`,
    `Current period ${currentPeriod} is aligned with the chart structure.`
  ].join(' ');

  nodes.predictedSide.textContent = formatSide(side);
  nodes.predictedSide.className = `side-pill ${side === 'big' ? 'side-big' : 'side-small'}`;
  nodes.predictedNumber.textContent = String(number);
  nodes.predictionReason.textContent = reason;

  state.lastPrediction = {
    period: currentPeriod,
    side,
    number,
    reason,
    timestamp: new Date().toISOString(),
  };

  nodes.outcomePeriod.value = currentPeriod;
  nodes.currentPeriod.value = currentPeriod;

  return state.lastPrediction;
}

function renderHistory() {
  if (!state.history.length) {
    nodes.historyTableBody.innerHTML = '<tr><td colspan="4" class="empty-state">No win/loss history yet</td></tr>';
    return;
  }

  const rowsHtml = state.history
    .slice()
    .reverse()
    .map((entry) => `
      <tr>
        <td>${entry.period}</td>
        <td>${formatSide(entry.side)}</td>
        <td>${entry.number}</td>
        <td><span class="badge ${entry.result === 'win' ? 'badge-win' : 'badge-loss'}">${entry.result.toUpperCase()}</span></td>
      </tr>
    `)
    .join('');

  nodes.historyTableBody.innerHTML = rowsHtml;
}

function saveOutcome() {
  const period = Number(nodes.outcomePeriod.value || nodes.currentPeriod.value || 0);
  const side = nodes.outcomeSide.value;
  const number = Number(nodes.outcomeNumber.value);
  const result = nodes.outcomeStatus.value;

  if (!period || !Number.isFinite(number)) {
    alert('Please enter a valid period and result first.');
    return;
  }

  state.history.push({
    period,
    side,
    number,
    result,
    createdAt: new Date().toISOString(),
  });

  saveHistory();
  renderHistory();
}

function loadDemoData() {
  const demo = `
1021 | big | 7
1022 | small | 2
1023 | big | 8
1024 | small | 1
1025 | big | 6
1026 | small | 3
1027 | big | 5
1028 | big | 9
1029 | small | 4
1030 | small | 2
  `;

  nodes.historyInput.value = demo.trim();
  nodes.currentPeriod.value = 1031;
  nodes.outcomePeriod.value = 1031;
  generatePrediction();
}

nodes.generatePredictionBtn.addEventListener('click', generatePrediction);
nodes.saveOutcomeBtn.addEventListener('click', saveOutcome);
nodes.loadDemoBtn.addEventListener('click', loadDemoData);
nodes.timerValue.addEventListener('change', () => {
  const nextValue = Number(nodes.timerValue.value);
  if (!Number.isFinite(nextValue) || nextValue < 10 || nextValue > 60) {
    nodes.timerValue.value = String(AUTO_TICK_SECONDS);
    return;
  }
  state.timer = nextValue;
  updateCountdown();
});

function startAutoTimer() {
  setInterval(() => {
    state.timer = Math.max(0, state.timer - 1);
    updateCountdown();

    if (state.timer === 0) {
      generatePrediction();
      state.timer = Number(nodes.timerValue.value) || AUTO_TICK_SECONDS;
      updateCountdown();
    }
  }, 1000);
}

function init() {
  updateCountdown();
  renderHistory();
  loadDemoData();
  startAutoTimer();
}

init();
