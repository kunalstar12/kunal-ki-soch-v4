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

// ==================== KUNAL KE RULES ENGINE ====================

/**
 * RULE 1: ZigZag Pattern
 * Detect alternating big/small pattern
 */
function ruleZigZag(entries) {
  const recent = entries.slice(-6).map((e) => e.side || sideFromNumber(e.number));
  
  let isZigZag = true;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i] === recent[i - 1]) {
      isZigZag = false;
      break;
    }
  }

  if (isZigZag && recent.length >= 3) {
    return recent[recent.length - 1];
  }

  return null;
}

/**
 * RULE 2: 2-Bar Reverse Rule
 * If 2 bars of same type came (big, big or small, small), next should be opposite
 */
function rule2BarReverse(entries) {
  const recent = entries.slice(-3).map((e) => e.side || sideFromNumber(e.number));

  if (recent.length >= 2 && recent[recent.length - 1] === recent[recent.length - 2]) {
    return oppositeSide(recent[recent.length - 1]);
  }

  return null;
}

/**
 * RULE 3: ZigZag Pattern Follow
 * Continue the zigzag if detected
 */
function rule3ZigZagContinue(entries) {
  const recent = entries.slice(-8).map((e) => e.side || sideFromNumber(e.number));

  if (recent.length < 3) return null;

  let zigzagCount = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i] !== recent[i - 1]) {
      zigzagCount++;
    } else {
      zigzagCount = 0;
    }
  }

  if (zigzagCount >= 2) {
    return recent[recent.length - 1] === 'big' ? 'small' : 'big';
  }

  return null;
}

/**
 * RULE 4: Dragon Pattern Follow
 * Track long runs and predict opposite when run exceeds 3 (with 4-level cross protection)
 */
function rule4DragonPattern(entries) {
  const recent = entries.slice(-10).map((e) => e.side || sideFromNumber(e.number));

  if (recent.length < 3) return null;

  let maxRunLength = 1;
  let currentRunLength = 1;
  let lastRun = recent[recent.length - 1];

  for (let i = 1; i < recent.length; i++) {
    if (recent[i] === recent[i - 1]) {
      currentRunLength++;
    } else {
      maxRunLength = Math.max(maxRunLength, currentRunLength);
      currentRunLength = 1;
    }
  }

  maxRunLength = Math.max(maxRunLength, currentRunLength);

  // 4-level cross protection: don't go beyond 4 consecutive same
  if (maxRunLength >= 3 && maxRunLength < 4) {
    return oppositeSide(recent[recent.length - 1]);
  }

  return null;
}

/**
 * MASTER PREDICTION ENGINE combining all 4 rules
 */
function applyAllRules(entries) {
  const rules = [
    { name: '1st rule (ZigZag)', fn: ruleZigZag },
    { name: '2nd rule (2-bar reverse)', fn: rule2BarReverse },
    { name: '3rd rule (ZigZag continue)', fn: rule3ZigZagContinue },
    { name: '4th rule (Dragon pattern)', fn: rule4DragonPattern },
  ];

  const results = [];

  for (const rule of rules) {
    const prediction = rule.fn(entries);
    if (prediction) {
      results.push({ rule: rule.name, side: prediction });
    }
  }

  // Voting system: which side got most votes?
  if (results.length > 0) {
    const votes = {};
    for (const result of results) {
      votes[result.side] = (votes[result.side] || 0) + 1;
    }

    const winner = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
    const appliedRules = results.filter((r) => r.side === winner[0]).map((r) => r.rule);

    return {
      side: winner[0],
      appliedRules,
      votingRules: Object.entries(votes).map(
        ([side, count]) => `${side}: ${count} votes`
      ),
    };
  }

  // Fallback: balance rule
  const recent = entries.slice(-6).map((e) => e.side || sideFromNumber(e.number));
  const bigCount = recent.filter((s) => s === 'big').length;
  const smallCount = recent.filter((s) => s === 'small').length;

  return {
    side: bigCount > smallCount ? 'small' : 'big',
    appliedRules: ['Fallback balance rule'],
    votingRules: [`big: ${bigCount}, small: ${smallCount}`],
  };
}

/**
 * Pick number for the predicted side
 * Considers frequency from history and 4/5-9 ranges
 */
function pickNumberForSide(entries, side) {
  const ranges = side === 'big' ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
  const frequency = {};

  for (const entry of entries) {
    const number = Number(entry.number);
    if (ranges.includes(number)) {
      frequency[number] = (frequency[number] || 0) + 1;
    }
  }

  if (Object.keys(frequency).length === 0) {
    return side === 'big' ? 7 : 2;
  }

  const sorted = Object.entries(frequency).sort(
    (a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0])
  );

  return Number(sorted[0][0]);
}

function generatePrediction() {
  const history = getRecentHistory(10);

  if (!history.length) {
    nodes.predictedSide.textContent = '—';
    nodes.predictedNumber.textContent = '—';
    nodes.predictedSide.className = 'side-pill neutral';
    nodes.predictionReason.textContent =
      'No valid chart history found. Add at least one result row.';
    return null;
  }

  const recent = history.slice(-10);
  const rulesPrediction = applyAllRules(recent);
  const side = rulesPrediction.side;
  const number = pickNumberForSide(recent, side);
  const currentPeriod =
    Number(nodes.currentPeriod.value) ||
    Number(recent[recent.length - 1].period || 0) + 1;

  const reason = `
Applied Rules:
${rulesPrediction.appliedRules.map((r) => `• ${r}`).join('\n')}

Rule Voting:
${rulesPrediction.votingRules.map((v) => `• ${v}`).join('\n')}

Result: ${formatSide(side)} with number ${number} for period ${currentPeriod}
  `.trim();

  nodes.predictedSide.textContent = formatSide(side);
  nodes.predictedSide.className = `side-pill ${
    side === 'big' ? 'side-big' : 'side-small'
  }`;
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
    nodes.historyTableBody.innerHTML =
      '<tr><td colspan="4" class="empty-state">No win/loss history yet</td></tr>';
    return;
  }

  const rowsHtml = state.history
    .slice()
    .reverse()
    .map(
      (entry) => `
      <tr>
        <td>${entry.period}</td>
        <td>${formatSide(entry.side)}</td>
        <td>${entry.number}</td>
        <td><span class="badge ${
          entry.result === 'win' ? 'badge-win' : 'badge-loss'
        }">${entry.result.toUpperCase()}</span></td>
      </tr>
    `
    )
    .join('');

  nodes.historyTableBody.innerHTML = rowsHtml;
}

function saveOutcome() {
  const period = Number(
    nodes.outcomePeriod.value || nodes.currentPeriod.value || 0
  );
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

  // Reset form
  nodes.outcomePeriod.value = '';
  nodes.outcomeNumber.value = '0';
  nodes.outcomeStatus.value = 'win';
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
