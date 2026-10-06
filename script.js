const STORAGE_KEY = 'pennyPicnicBudget';

const tips = [
  'Try waiting one day before buying a small treat. Tomorrow-you might decide to save it instead!',
  'Give every dollar a job: some for now, some for later, and some for your big dream.',
  'Small coins count! A few little saves can turn into a big happy surprise.',
  'Before you buy, ask: “Do I want this more than my goal?” You get to choose!',
  'Celebrate a no-spend day by adding a star to your calendar. You are building a habit!'
];

let state = loadState();
let activePaymentTab = 'upcoming';
let transactionType = 'in';
let goalFlowMode = 'first';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const money = (value) => `$${Number(value || 0).toFixed(2)}`;
const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.goal?.name && Number(saved.goal.target) > 0) return { ...saved, payments: saved.payments || [], transactions: saved.transactions || [] };
  } catch (error) { console.warn('Could not load saved plan', error); }
  return null;
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function showDashboard({ scroll = false } = {}) {
  $('#setupView').hidden = true;
  $('#setupView').style.display = 'none';
  $('#setupView').setAttribute('aria-hidden', 'true');
  $('#dashboardView').hidden = false;
  $('#dashboardView').style.display = '';
  $('#dashboardView').setAttribute('aria-hidden', 'false');
  renderAll();
  if (scroll) setTimeout(() => $('#dashboardView').scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

function setGoalStep(step) {
  $$('.setup-step').forEach((item) => item.classList.toggle('is-active', item.dataset.step === String(step)));
  const titles = ['A calmer way to plan your money.', 'What are you saving for?', 'Let’s put a number to it.'];
  const subtitles = ['Make room for the things you care about with a simple, steady money plan.', 'Choose one thing that matters to you. We’ll help you make a clear plan for it.', 'Set the price, then we’ll take you straight to your dashboard.'];
  $('#setupTitle').textContent = titles[step];
  $('.setup-subtitle').textContent = subtitles[step];
}

function showSetup({ mode = 'first' } = {}) {
  goalFlowMode = mode;
  $('#setupView').hidden = false;
  $('#setupView').style.display = '';
  $('#setupView').setAttribute('aria-hidden', 'false');
  $('#dashboardView').hidden = true;
  $('#dashboardView').style.display = 'none';
  $('#dashboardView').setAttribute('aria-hidden', 'true');
  $('#setupForm').reset();
  if (mode === 'edit' && state) {
    $('#goalName').value = state.goal.name;
    $('#goalTarget').value = state.goal.target;
  }
  setGoalStep(mode === 'first' ? 0 : 1);
}

function setupGoalFromForm(event) {
  event.preventDefault();
  const name = $('#goalName').value.trim();
  const target = Number($('#goalTarget').value);
  const starting = Number($('#startingAmount').value) || 0;
  if (!name || !target || target <= 0) return;
  if (goalFlowMode === 'edit' && state) {
    state.goal = { name, target, starting: 0 };
  } else {
    const previous = state;
    state = {
      goal: { name, target, starting: 0 },
      payments: previous?.payments || [],
      transactions: starting ? [{ id: Date.now(), type: 'in', amount: starting, note: 'Starting savings', date: `${todayISO()}T12:00:00` }] : [],
      createdAt: new Date().toISOString(),
      lastTip: previous?.lastTip || 0
    };
  }
  saveState();
  showDashboard({ scroll: true });
}

function renderAll() {
  if (!state) return;
  renderOverview();
  renderPayments();
  renderTransactions();
  renderGoal();
  renderInsights();
  $('#tipText').textContent = tips[state.lastTip || 0];
}

function getSavedAmount() {
  return Math.max(0, Number(state.goal.starting || 0) + state.transactions.reduce((total, item) => total + (item.type === 'in' ? item.amount : -item.amount), 0));
}

function getUpcomingPayments() {
  return state.payments.filter((payment) => !payment.completed).sort((a, b) => a.date.localeCompare(b.date));
}

function renderOverview() {
  const saved = getSavedAmount();
  const totalMoved = state.transactions.reduce((total, item) => total + item.amount, 0);
  const upcoming = getUpcomingPayments();
  $('#savedTotal').textContent = money(saved);
  $('#savedCaption').textContent = saved > 0 ? 'Your goal is growing!' : 'Keep watering your goal';
  $('#monthTotal').textContent = money(totalMoved);
  $('#monthCaption').textContent = state.transactions.length ? `${state.transactions.length} money ${state.transactions.length === 1 ? 'move' : 'moves'} logged` : 'Every coin has a job';
  if (upcoming.length) {
    const next = upcoming[0];
    $('#nextPaymentName').textContent = next.name;
    $('#nextPaymentDate').textContent = `Due ${formatDate(next.date)} · ${money(next.amount)}`;
  } else {
    $('#nextPaymentName').textContent = 'All caught up!';
    $('#nextPaymentDate').textContent = 'No payments coming up';
  }
}

function renderPayments() {
  const upcoming = getUpcomingPayments();
  const completed = state.payments.filter((payment) => payment.completed).sort((a, b) => b.date.localeCompare(a.date));
  $('#upcomingCount').textContent = upcoming.length;
  $('#completedCount').textContent = completed.length;
  const payments = activePaymentTab === 'upcoming' ? upcoming : completed;
  const list = $('#paymentList');
  if (!payments.length) {
    list.innerHTML = `<div class="empty-state"><div><div class="empty-icon">${activePaymentTab === 'upcoming' ? '☁' : '✿'}</div><div>${activePaymentTab === 'upcoming' ? 'No payments due soon.<br>That feels pretty good!' : 'Your finished payments<br>will bloom here.'}</div></div></div>`;
    return;
  }
  list.innerHTML = payments.map((payment) => `
    <div class="payment-item ${payment.completed ? 'completed' : ''}">
      <div class="payment-icon">${payment.completed ? '✓' : '♪'}</div>
      <div class="payment-details"><strong>${escapeHtml(payment.name)}</strong><span>${payment.completed ? `Paid ${formatDate(payment.date)}` : `Due ${formatDate(payment.date)}`}</span></div>
      <span class="payment-price">${money(payment.amount)}</span>
      <span class="payment-status ${payment.completed ? 'done' : ''}">${payment.completed ? 'Done' : dueLabel(payment.date)}</span>
      ${payment.completed ? '' : `<button class="payment-delete" type="button" data-payment-action="complete" data-payment-id="${payment.id}" aria-label="Mark ${escapeHtml(payment.name)} complete">✓</button>`}
    </div>`).join('');
}

function dueLabel(date) {
  const days = Math.ceil((new Date(`${date}T12:00:00`) - new Date()) / 86400000);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days`;
}

function formatDate(date) {
  const parsed = new Date(date);
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date(`${date}T12:00:00`) : parsed;
  return safeDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function renderTransactions() {
  const activities = [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  $('#activityCount').textContent = `${activities.length} ${activities.length === 1 ? 'entry' : 'entries'}`;
  $('#activityList').innerHTML = activities.length ? activities.slice(0, 6).map((item) => `<li class="activity-item"><span class="activity-label">${item.type === 'in' ? '＋' : '−'} ${escapeHtml(item.note)}<small class="activity-date">${formatDate(item.date)}</small></span><span class="activity-value ${item.type}">${item.type === 'in' ? '+' : '-'}${money(item.amount)}</span></li>`).join('') : '<li class="empty-state">Your money moves will show here.</li>';
}

function renderGoal() {
  const saved = getSavedAmount();
  const percent = Math.min(100, Math.max(0, Math.round((saved / state.goal.target) * 100)));
  $('#goalNameDisplay').textContent = state.goal.name;
  $('#progressAmount').textContent = `${money(saved)} saved`;
  $('#progressPercent').textContent = `${percent}%`;
  $('#goalTargetDisplay').textContent = money(state.goal.target);
  $('#progressFill').style.width = `${Math.max(percent, 3)}%`;
  $('#goalEncouragement').textContent = percent >= 100 ? 'You did it! Your dream is ready to come true.' : percent >= 75 ? 'So close! The finish line is in sight.' : percent >= 40 ? 'Look at you go — your goal is really growing.' : 'Every little bit helps your dream grow.';
}

function renderInsights() {
  const saved = getSavedAmount();
  renderPiggyBank(saved, Number(state.goal.target));
  renderGoalGraph(Number(state.goal.target));
}

function renderPiggyBank(saved, target) {
  const percent = Math.min(100, Math.max(0, saved / target * 100));
  const coinSpots = [[32,134],[58,139],[84,131],[111,140],[137,132],[157,143],[45,116],[74,120],[103,115],[132,119],[61,98],[91,102],[121,96],[145,105],[77,80],[107,84],[128,73],[99,65]];
  const coinCount = Math.ceil(percent / 100 * coinSpots.length);
  const fillHeight = percent / 100 * 110;
  $('#piggyFill').setAttribute('y', String(160 - fillHeight));
  $('#piggyFill').setAttribute('height', String(fillHeight));
  $('#piggyCoins').innerHTML = coinSpots.slice(0, coinCount).map(([cx, cy], index) => `<circle class="piggy-coin" cx="${cx}" cy="${cy}" r="9"><title>Saved coin ${index + 1}</title></circle><circle class="piggy-coin-shine" cx="${cx - 3}" cy="${cy - 3}" r="2" />`).join('');
  $('#piggySavedAmount').textContent = money(saved);
  $('#piggyGoalAmount').textContent = money(target);
  $('#piggyFillBar').style.width = `${Math.max(percent, percent ? 4 : 0)}%`;
  $('#piggyMessage').textContent = percent >= 100 ? 'Your piggy bank is full — goal reached!' : percent >= 70 ? 'Almost full. Keep going!' : percent > 0 ? 'Nice work. Every coin is helping.' : 'Your first coin is ready to go in.';
  const banner = $('#greatJobBanner');
  banner.hidden = percent < 100;
  banner.classList.toggle('is-complete', percent >= 100);
  $('.piggy-bank-wrap').classList.toggle('is-full', percent >= 100);
}

function renderGoalGraph(target) {
  let current = 0;
  const points = [{ index: 0, value: 0 }];
  state.transactions.forEach((item, index) => {
    current += item.type === 'in' ? Number(item.amount) : -Number(item.amount);
    points.push({ index: index + 1, value: Math.max(0, current) });
  });
  const width = 620;
  const height = 320;
  const left = 58;
  const right = 18;
  const top = 24;
  const bottom = 258;
  const chartWidth = width - left - right;
  const chartHeight = bottom - top;
  const maxValue = Math.max(target, ...points.map((point) => point.value), 1);
  const maxY = maxValue * 1.12;
  const maxIndex = Math.max(1, points.length - 1);
  const xFor = (index) => left + index / maxIndex * chartWidth;
  const yFor = (value) => bottom - value / maxY * chartHeight;
  const yTicks = [0, maxY / 2, maxY];
  $('#graphGrid').innerHTML = yTicks.map((value) => `<line class="graph-grid-line" x1="${left}" y1="${yFor(value)}" x2="${width - right}" y2="${yFor(value)}" /><text class="graph-y-label" x="${left - 10}" y="${yFor(value) + 4}" text-anchor="end">${money(value)}</text>`).join('');
  $('#graphGoalLine').setAttribute('y1', String(yFor(target)));
  $('#graphGoalLine').setAttribute('y2', String(yFor(target)));
  $('#graphGoalLine').setAttribute('x1', String(left));
  $('#graphGoalLine').setAttribute('x2', String(width - right));
  $('#graphPath').setAttribute('d', points.map((point, index) => `${index ? 'L' : 'M'} ${xFor(point.index)} ${yFor(point.value)}`).join(' '));
  $('#graphPoints').innerHTML = points.slice(1).map((point) => `<circle class="graph-point" cx="${xFor(point.index)}" cy="${yFor(point.value)}" r="5"><title>Log #${point.index}: ${money(point.value)}</title></circle>`).join('');
  $('#graphLabels').innerHTML = `<text class="graph-x-label" x="${left}" y="${bottom + 27}" text-anchor="middle">Start</text><text class="graph-x-label" x="${width - right}" y="${bottom + 27}" text-anchor="end">Log ${points.length - 1}</text><text class="graph-axis-title" x="${left}" y="${top - 8}">Current savings</text>`;
  $('#graphLogCount').textContent = `${state.transactions.length} ${state.transactions.length === 1 ? 'log' : 'logs'}`;
  $('#graphCurrentAmount').textContent = `${money(getSavedAmount())} now`;
  $('#graphGoalLabel').textContent = `Goal ${money(target)}`;
}

function handleTransaction(event) {
  event.preventDefault();
  const amount = Number($('#transactionAmount').value);
  const note = $('#transactionNote').value.trim();
  const date = $('#transactionDate').value || todayISO();
  if (!amount || amount <= 0 || !note) return;
  const available = getSavedAmount();
  if (transactionType === 'out' && available <= 0) {
    showNotice('Nothing to spend yet', 'Add money to your tracker before logging money out.');
    return;
  }
  if (transactionType === 'out' && amount > available) {
    showNotice('That is more than you have', `You can spend up to ${money(available)} right now.`);
    return;
  }
  const before = getSavedAmount();
  state.transactions.push({ id: Date.now(), type: transactionType, amount, note, date: `${date}T12:00:00` });
  saveState();
  event.target.reset();
  setToday();
  renderAll();
  const after = getSavedAmount();
  if (before < state.goal.target && after >= state.goal.target) celebrate();
}

function celebrate() {
  $('#celebrationGoal').textContent = state.goal.name;
  $('#celebration').hidden = false;
  $('#celebration').setAttribute('aria-hidden', 'false');
  const colors = ['#f7b8bd', '#f9d974', '#b9dbb1', '#fffefa', '#9fd7e4'];
  $('#confettiLayer').innerHTML = Array.from({ length: 65 }, (_, index) => `<span class="confetti-piece" style="left:${Math.random() * 100}%;background:${colors[index % colors.length]};--drift:${(Math.random() * 180 - 90).toFixed(0)}px;animation-delay:${(Math.random() * .7).toFixed(2)}s;transform:rotate(${Math.random() * 90}deg)"></span>`).join('');
}

function closeCelebration() { $('#celebration').hidden = true; $('#confettiLayer').innerHTML = ''; }

function todayISO() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
}

function setToday() { $('#transactionDate').value = todayISO(); }

function showNotice(title, message) {
  $('#noticeTitle').textContent = title;
  $('#noticeText').textContent = message;
  $('#noticeToast').hidden = false;
  clearTimeout(showNotice.timer);
  showNotice.timer = setTimeout(() => { $('#noticeToast').hidden = true; }, 4800);
}

function openDialog(id) { const dialog = document.getElementById(id); if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', ''); }
function closeDialog(id) { document.getElementById(id).close?.(); }

function handlePayment(event) {
  event.preventDefault();
  state.payments.push({ id: Date.now(), name: $('#paymentName').value.trim(), amount: Number($('#paymentAmount').value), date: $('#paymentDate').value, completed: false });
  saveState();
  event.target.reset();
  closeDialog('paymentDialog');
  activePaymentTab = 'upcoming';
  $$('.tab-button').forEach((button) => { const active = button.dataset.paymentTab === activePaymentTab; button.classList.toggle('active', active); button.setAttribute('aria-selected', active); });
  renderAll();
}

function renderBatchRows(count = 3) {
  $('#batchRows').innerHTML = Array.from({ length: count }, (_, index) => `
    <div class="batch-row">
      <input class="plain-input batch-what" type="text" maxlength="35" placeholder="${index === 0 ? 'Coffee' : 'What did you buy?'}" aria-label="What did you buy, row ${index + 1}" />
      <div class="input-wrap batch-amount"><span class="currency-symbol small">$</span><input class="batch-spent" type="number" min="0.01" step="0.01" placeholder="0.00" aria-label="How much spent, row ${index + 1}" /></div>
    </div>`).join('');
}

function openBatchDialog() {
  $('#batchDate').value = $('#transactionDate').value || todayISO();
  renderBatchRows();
  openDialog('batchDialog');
  setTimeout(() => $('#batchRows .batch-what')?.focus(), 30);
}

function handleBatchSubmit(event) {
  event.preventDefault();
  const rows = $$('#batchRows .batch-row').map((row) => ({
    note: row.querySelector('.batch-what').value.trim(),
    amount: Number(row.querySelector('.batch-spent').value)
  }));
  const filledRows = rows.filter((row) => row.note || row.amount);
  if (!filledRows.length) {
    showNotice('Nothing to add yet', 'Fill in at least one purchase before saving the batch.');
    return;
  }
  if (filledRows.some((row) => !row.note || !row.amount || row.amount <= 0)) {
    showNotice('Finish each row', 'Add both a purchase name and an amount to each row you started.');
    return;
  }
  const total = filledRows.reduce((sum, row) => sum + row.amount, 0);
  const available = getSavedAmount();
  if (available <= 0) {
    showNotice('Nothing to spend yet', 'Add money to your tracker before logging money out.');
    return;
  }
  if (total > available) {
    showNotice('That is more than you have', `These purchases total ${money(total)}, but you can spend up to ${money(available)}.`);
    return;
  }
  const date = $('#batchDate').value || todayISO();
  filledRows.forEach((row, index) => state.transactions.push({ id: Date.now() + index, type: 'out', amount: row.amount, note: row.note, date: `${date}T12:00:00` }));
  saveState();
  closeDialog('batchDialog');
  renderAll();
  renderBatchRows();
}

function attachEvents() {
  $('#createGoalButton').addEventListener('click', () => { setGoalStep(1); $('#goalName').focus(); });
  $('#backToIntro').addEventListener('click', () => setGoalStep(0));
  $('#goalNameNext').addEventListener('click', () => {
    if (!$('#goalName').value.trim()) { $('#goalName').focus(); return; }
    setGoalStep(2);
    $('#goalTarget').focus();
  });
  $('#backToGoal').addEventListener('click', () => setGoalStep(1));
  $('#setupForm').addEventListener('submit', setupGoalFromForm);
  $('#transactionForm').addEventListener('submit', handleTransaction);
  $$('.money-type').forEach((button) => button.addEventListener('click', () => { transactionType = button.dataset.type; $$('.money-type').forEach((item) => item.classList.toggle('active', item === button)); $('#openBatchButton').hidden = transactionType !== 'out'; }));
  $('#openBatchButton').addEventListener('click', openBatchDialog);
  $('#addBatchRowButton').addEventListener('click', () => { const count = $$('#batchRows .batch-row').length; renderBatchRows(count + 1); $$('#batchRows .batch-what').slice(-1)[0].focus(); });
  $$('.tab-button').forEach((button) => button.addEventListener('click', () => { activePaymentTab = button.dataset.paymentTab; $$('.tab-button').forEach((item) => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-selected', active); }); renderPayments(); }));
  $('#openPaymentButton').addEventListener('click', () => openDialog('paymentDialog'));
  $('#openPaymentButtonBottom').addEventListener('click', () => openDialog('paymentDialog'));
  $('#paymentForm').addEventListener('submit', handlePayment);
  $('#batchForm').addEventListener('submit', handleBatchSubmit);
  $('#newGoalButton').addEventListener('click', () => showSetup({ mode: 'new' }));
  $('#editGoalButton').addEventListener('click', () => showSetup({ mode: 'edit' }));
  $$('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => closeDialog(button.dataset.closeDialog)));
  $('#paymentList').addEventListener('click', (event) => { const button = event.target.closest('[data-payment-action="complete"]'); if (!button) return; const payment = state.payments.find((item) => String(item.id) === button.dataset.paymentId); if (payment) { payment.completed = true; saveState(); renderAll(); } });
  $('#closeCelebration').addEventListener('click', closeCelebration);
  $('#closeNotice').addEventListener('click', () => { $('#noticeToast').hidden = true; });
  $('#nextTipButton').addEventListener('click', () => { state.lastTip = ((state.lastTip || 0) + 1) % tips.length; saveState(); $('#tipText').textContent = tips[state.lastTip]; });
  $('#resetAppButton').addEventListener('click', () => { if (window.confirm('Start a fresh money plan? Your current plan will be cleared from this device.')) { localStorage.removeItem(STORAGE_KEY); state = null; showSetup(); } });
  document.getElementById('paymentDialog').addEventListener('click', (event) => { if (event.target === event.currentTarget) closeDialog('paymentDialog'); });
  document.getElementById('batchDialog').addEventListener('click', (event) => { if (event.target === event.currentTarget) closeDialog('batchDialog'); });
}

attachEvents();
setToday();
if (state) showDashboard(); else showSetup();
