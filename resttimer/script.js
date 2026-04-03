const STORAGE_KEY = 'gymToolsSetCounterState';
const SAVED_WORKOUTS_KEY = 'gymToolsSetCounterSavedWorkouts';
const THEME_KEY = 'gymToolsTheme';

const screens = {
  menu: document.getElementById('screenMenu'),
  quickSetup: document.getElementById('screenQuickSetup'),
  quickTimer: document.getElementById('screenQuickTimer'),
  setCounter: document.getElementById('screenSetCounter'),
  fullWorkout: document.getElementById('screenFullWorkout')
};

const els = {
  screenTitle: document.getElementById('screenTitle'),
  backButton: document.getElementById('backButton'),
  themeToggle: document.getElementById('themeToggle'),
  utilityClock: document.getElementById('utilityClock'),

  goQuickStart: document.getElementById('goQuickStart'),
  goSetCounter: document.getElementById('goSetCounter'),
  goFullWorkout: document.getElementById('goFullWorkout'),

  quickRestSeconds: document.getElementById('quickRestSeconds'),
  quickSetupStartBtn: document.getElementById('quickSetupStartBtn'),
  quickSetupResetBtn: document.getElementById('quickSetupResetBtn'),
  quickSetupSelectedLabel: document.getElementById('quickSetupSelectedLabel'),
  quickSetsLabel: document.getElementById('quickSetsLabel'),
  quickPresetLabel: document.getElementById('quickPresetLabel'),
  quickStepLabel: document.getElementById('quickStepLabel'),
  quickTimerCard: document.getElementById('quickTimerCard'),
  quickTimerPhase: document.getElementById('quickTimerPhase'),
  quickTimerDisplay: document.getElementById('quickTimerDisplay'),
  quickTimerSubtext: document.getElementById('quickTimerSubtext'),
  quickRestBtn: document.getElementById('quickRestBtn'),
  quickPauseBtn: document.getElementById('quickPauseBtn'),
  quickResetBtn: document.getElementById('quickResetBtn'),
  quickPresetButtons: Array.from(document.querySelectorAll('[data-quick-preset]')),

  setCounterValue: document.getElementById('setCounterValue'),
  setCounterText: document.getElementById('setCounterText'),
  setCounterNextBtn: document.getElementById('setCounterNextBtn'),
  setCounterResetBtn: document.getElementById('setCounterResetBtn'),

  workoutName: document.getElementById('workoutName'),
  blockForm: document.getElementById('blockForm'),
  blockRounds: document.getElementById('blockRounds'),
  blockRest: document.getElementById('blockRest'),
  addBlockBtn: document.getElementById('addBlockBtn'),
  resetBuilderBtn: document.getElementById('resetBuilderBtn'),
  blockList: document.getElementById('blockList'),
  currentWorkoutTitle: document.getElementById('currentWorkoutTitle'),
  currentBlockLabel: document.getElementById('currentBlockLabel'),
  currentProgressLabel: document.getElementById('currentProgressLabel'),
  currentStepLabel: document.getElementById('currentStepLabel'),
  timerCard: document.getElementById('timerCard'),
  timerPhase: document.getElementById('timerPhase'),
  timerDisplay: document.getElementById('timerDisplay'),
  timerSubtext: document.getElementById('timerSubtext'),
  startWorkoutBtn: document.getElementById('startWorkoutBtn'),
  resetFlowBtn: document.getElementById('resetFlowBtn'),
  saveWorkoutBtn: document.getElementById('saveWorkoutBtn'),
  workoutComplete: document.getElementById('workoutComplete'),
  savedWorkouts: document.getElementById('savedWorkouts')
};

let currentScreen = 'menu';
let screenTitleBase = 'Rest Timer';

let appState = loadState();
let savedWorkouts = loadSavedWorkouts();

let fullWorkoutTimerInterval = null;
let quickTimerInterval = null;
let audioContext = null;

let fullWorkoutRemaining = 0;
let fullWorkoutIsRunning = false;
let fullWorkoutIsPaused = false;

let quickStartState = createQuickStartState();
let setCounterState = createSetCounterState();

migrateLegacyState();
applyTheme();
startUtilityClock();
bindEvents();
renderAll();

function createDefaultState() {
  return {
    session: {
      id: `session-${Date.now()}`,
      name: 'Workout A',
      blocks: []
    },
    flow: {
      started: false,
      completed: false,
      currentBlockIndex: 0,
      currentRound: 0
    }
  };
}

function createQuickStartState() {
  const preset = clamp(Number(els.quickRestSeconds?.value), 0, 900);
  return {
    preset,
    remaining: preset,
    completedSets: 0,
    running: false,
    paused: false
  };
}

function createSetCounterState() {
  return {
    completedSets: 0
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed && parsed.session && Array.isArray(parsed.session.blocks) && parsed.flow) {
      return parsed;
    }
  } catch (error) {
    console.error('Failed to load state', error);
  }
  return createDefaultState();
}

function loadSavedWorkouts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_WORKOUTS_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load saved workouts', error);
    return [];
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function saveSavedWorkouts() {
  localStorage.setItem(SAVED_WORKOUTS_KEY, JSON.stringify(savedWorkouts));
}

function migrateLegacyState() {
  let changed = false;

  appState.session.blocks = (appState.session.blocks || []).reduce((acc, block) => {
    if (!block || typeof block !== 'object') return acc;

    let type = block.type;
    if (type === 'standard_set' || type === 'superset' || type === 'triset') {
      type = 'sets';
      changed = true;
    }

    if (type === 'circuit' || (type !== 'sets' && type !== 'quick_rest')) {
      changed = true;
      return acc;
    }

    acc.push({
      id: block.id || `block-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      type,
      rounds: type === 'quick_rest' ? 1 : clamp(Number(block.rounds) || 1, 1, 20),
      rest: clamp(Number(block.rest), 0, 900)
    });
    return acc;
  }, []);

  if (!appState.flow) {
    appState.flow = createDefaultState().flow;
    changed = true;
  }

  if (changed) {
    appState.flow = createDefaultState().flow;
    saveState();
  }
}

function bindEvents() {
  els.themeToggle?.addEventListener('click', toggleTheme);
  els.backButton?.addEventListener('click', handleBackClick);

  els.goQuickStart?.addEventListener('click', () => navigateTo('quickSetup'));
  els.goSetCounter?.addEventListener('click', () => navigateTo('setCounter'));
  els.goFullWorkout?.addEventListener('click', () => navigateTo('fullWorkout'));

  els.quickSetupStartBtn?.addEventListener('click', startQuickStartFlow);
  els.quickSetupResetBtn?.addEventListener('click', resetQuickStart);
  els.quickRestBtn?.addEventListener('click', handleQuickRestPress);
  els.quickResetBtn?.addEventListener('click', resetQuickStartFromTimer);

  els.quickPresetButtons?.forEach((button) => {
    button.addEventListener('click', () => setQuickPreset(Number(button.dataset.quickPreset)));
  });

  els.setCounterNextBtn?.addEventListener('click', () => {
    setCounterState.completedSets += 1;
    renderSetCounter();
  });
  els.setCounterResetBtn?.addEventListener('click', () => {
    setCounterState = createSetCounterState();
    renderSetCounter();
  });

  els.workoutName?.addEventListener('input', (event) => {
    appState.session.name = event.target.value.trim() || 'Workout A';
    saveState();
    renderFullWorkoutHeader();
    renderSavedWorkouts();
  });

  els.blockForm?.addEventListener('submit', handleAddBlock);
  els.resetBuilderBtn?.addEventListener('click', clearWorkout);
  els.startWorkoutBtn?.addEventListener('click', handleFullWorkoutStartPause);
  els.resetFlowBtn?.addEventListener('click', resetFullWorkoutFlowOnly);
  els.saveWorkoutBtn?.addEventListener('click', saveCurrentWorkout);

  document.querySelectorAll('.stepper').forEach((stepper) => {
    stepper.addEventListener('click', (event) => {
      const button = event.target.closest('[data-stepper-action]');
      if (!button) return;
      handleStepperClick(stepper, button.dataset.stepperAction);
    });
  });
}

function navigateTo(screen) {
  currentScreen = screen;
  stopQuickTimerIfHidden();
  renderScreenState();
  renderAll();
}

function handleBackClick(event) {
  if (currentScreen === 'menu') {
    return;
  }
  event.preventDefault();
  navigateTo('menu');
}

function renderScreenState() {
  Object.entries(screens).forEach(([name, node]) => {
    node?.classList.toggle('hidden', name !== currentScreen);
  });

  const screenTitles = {
    menu: 'Rest Timer',
    quickSetup: 'Quick Start',
    quickTimer: 'Quick Start',
    setCounter: 'Set Counter',
    fullWorkout: 'Full Workout'
  };

  screenTitleBase = screenTitles[currentScreen] || 'Rest Timer';
  if (els.screenTitle) {
    els.screenTitle.textContent = screenTitleBase;
  }

  if (els.backButton) {
    if (currentScreen === 'menu') {
      els.backButton.setAttribute('href', '../menu.html');
    } else {
      els.backButton.setAttribute('href', '#');
    }
  }
}

function renderAll() {
  renderScreenState();
  renderQuickStart();
  renderSetCounter();
  renderFullWorkout();
}

function startUtilityClock() {
  updateUtilityClock();
  window.setInterval(updateUtilityClock, 1000);
}

function updateUtilityClock() {
  if (!els.utilityClock) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  els.utilityClock.textContent = `${hh}:${mm}`;
}

function toggleTheme() {
  const current = localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, next);
  applyTheme();
}

function applyTheme() {
  const theme = localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  document.body.classList.toggle('light', theme === 'light');
}

function setQuickPreset(value) {
  const next = clamp(Number(value) || 0, 0, 900);
  if (els.quickRestSeconds) {
    els.quickRestSeconds.value = String(next);
  }
  quickStartState.preset = next;
  if (!quickStartState.running) {
    quickStartState.remaining = next;
  }
  renderQuickStart();
}

function handleStepperClick(stepper, action) {
  const targetId = stepper.dataset.target;
  const input = document.getElementById(targetId);
  if (!input) return;

  const step = Number(stepper.dataset.step) || 1;
  const min = Number(stepper.dataset.min);
  const max = Number(stepper.dataset.max);
  const current = Number(input.value) || 0;
  const next = clamp(current + (action === 'increment' ? step : -step), min, max);

  input.value = String(next);

  if (targetId === 'quickRestSeconds') {
    quickStartState.preset = next;
    if (!quickStartState.running && !quickStartState.paused) {
      quickStartState.remaining = next;
    }
    renderQuickStart();
    return;
  }

  if (targetId === 'blockRounds' || targetId === 'blockRest') {
    renderFullWorkoutFlow();
  }
}

function formatSetLabel(count, uppercase = false) {
  const base = `${count} ${count === 1 ? 'Set' : 'Sets'}`;
  return uppercase ? base.toUpperCase() : base;
}

function startQuickStartFlow() {
  unlockAudio();
  clearQuickTimerInterval();
  quickStartState.running = false;
  quickStartState.paused = false;
  quickStartState.remaining = quickStartState.preset;
  navigateTo('quickTimer');
}

function handleQuickRestPress() {
  if (quickStartState.running) return;

  unlockAudio();
  quickStartState.completedSets += 1;
  quickStartState.remaining = quickStartState.preset;
  quickStartState.running = true;
  quickStartState.paused = false;

  clearQuickTimerInterval();
  renderQuickStart();

  quickTimerInterval = window.setInterval(() => {
    quickStartState.remaining -= 1;

    if (quickStartState.remaining <= 0) {
      quickStartState.remaining = 0;
      clearQuickTimerInterval();
      quickStartState.running = false;
      quickStartState.paused = false;
      playBeep();
      renderQuickStart();
      return;
    }

    renderQuickStart();
  }, 1000);
}

function toggleQuickPause() {
  if (!quickStartState.running && !quickStartState.paused) return;

  if (quickStartState.running) {
    clearQuickTimerInterval();
    quickStartState.running = false;
    quickStartState.paused = true;
  } else {
    unlockAudio();
    quickStartState.running = true;
    quickStartState.paused = false;
    clearQuickTimerInterval();
    quickTimerInterval = window.setInterval(() => {
      quickStartState.remaining -= 1;
      if (quickStartState.remaining <= 0) {
        quickStartState.remaining = 0;
        clearQuickTimerInterval();
        quickStartState.running = false;
        quickStartState.paused = false;
        playBeep();
      }
      renderQuickStart();
    }, 1000);
  }

  renderQuickStart();
}

function resetQuickStart() {
  clearQuickTimerInterval();
  quickStartState = createQuickStartState();
  renderQuickStart();
}

function resetQuickStartFromTimer() {
  clearQuickTimerInterval();
  quickStartState.completedSets = 0;
  quickStartState.remaining = quickStartState.preset;
  quickStartState.running = false;
  quickStartState.paused = false;
  renderQuickStart();
}

function stopQuickTimerIfHidden() {
  if (currentScreen !== 'quickTimer' && quickStartState.running) {
    clearQuickTimerInterval();
    quickStartState.running = false;
    quickStartState.paused = true;
  }
}

function clearQuickTimerInterval() {
  if (quickTimerInterval) {
    clearInterval(quickTimerInterval);
    quickTimerInterval = null;
  }
}

function renderQuickStart() {
  if (els.quickRestSeconds) {
    els.quickRestSeconds.value = String(quickStartState.preset);
  }
  if (els.quickSetupSelectedLabel) {
    els.quickSetupSelectedLabel.textContent = `${quickStartState.preset}s`;
  }
  if (els.quickPresetButtons) {
    els.quickPresetButtons.forEach((button) => {
      const isSelected = Number(button.dataset.quickPreset) === quickStartState.preset;
      button.classList.toggle('primary-btn', isSelected);
      button.classList.toggle('secondary-btn', !isSelected);
      button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
  }
  if (els.quickSetsLabel) {
    els.quickSetsLabel.textContent = formatSetLabel(quickStartState.completedSets);
  }
  if (els.quickPresetLabel) {
    els.quickPresetLabel.textContent = formatSeconds(quickStartState.preset);
  }
  if (els.quickStepLabel) {
    els.quickStepLabel.textContent = quickStartState.running ? 'Rest running' : 'Ready';
  }
  if (els.quickTimerPhase) {
    els.quickTimerPhase.textContent = quickStartState.running ? 'Rest' : 'Ready';
  }
  if (els.quickTimerDisplay) {
    els.quickTimerDisplay.textContent = formatSeconds(quickStartState.remaining);
  }
  if (els.quickTimerSubtext) {
    els.quickTimerSubtext.textContent = quickStartState.running ? 'Rest running.' : 'Ready';
  }
  if (els.quickTimerCard) {
    els.quickTimerCard.classList.toggle('resting', quickStartState.running);
    els.quickTimerCard.classList.toggle('active', !quickStartState.running && quickStartState.completedSets > 0);
    els.quickTimerCard.classList.toggle('idle', !quickStartState.running && quickStartState.completedSets === 0);
  }
  if (els.quickRestBtn) {
    els.quickRestBtn.disabled = quickStartState.running;
  }
}

function renderSetCounter() {
  if (els.setCounterValue) {
    els.setCounterValue.textContent = String(setCounterState.completedSets);
  }
  if (els.setCounterText) {
    els.setCounterText.textContent = formatSetLabel(setCounterState.completedSets, true);
  }
}

function handleAddBlock(event) {
  event.preventDefault();

  appState.session.blocks.push({
    id: `block-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type: 'sets',
    rounds: clamp(Number(els.blockRounds?.value), 1, 20),
    rest: clamp(Number(els.blockRest?.value), 0, 900)
  });

  saveState();
  renderFullWorkout();
}

function clearWorkout() {
  clearFullWorkoutTimer();
  appState = createDefaultState();
  fullWorkoutRemaining = 0;
  fullWorkoutIsRunning = false;
  fullWorkoutIsPaused = false;
  saveState();
  renderFullWorkout();
}

function resetFullWorkoutFlowOnly() {
  clearFullWorkoutTimer();
  appState.flow = createDefaultState().flow;
  fullWorkoutRemaining = 0;
  fullWorkoutIsRunning = false;
  fullWorkoutIsPaused = false;
  saveState();
  renderFullWorkout();
}

function getCurrentBlock() {
  return appState.session.blocks[appState.flow.currentBlockIndex] || null;
}

function handleFullWorkoutStartPause() {
  if (!appState.session.blocks.length) return;

  if (fullWorkoutIsRunning) {
    clearFullWorkoutTimer();
    fullWorkoutIsRunning = false;
    fullWorkoutIsPaused = true;
    renderFullWorkout();
    return;
  }

  const block = getCurrentBlock();
  if (!block) return;

  if (appState.flow.completed) {
    appState.flow = createDefaultState().flow;
  }

  if (!appState.flow.started) {
    appState.flow.started = true;
    appState.flow.currentBlockIndex = 0;
    appState.flow.currentRound = 0;
  }

  if (fullWorkoutRemaining <= 0) {
    fullWorkoutRemaining = block.rest;
  }

  fullWorkoutIsRunning = true;
  fullWorkoutIsPaused = false;
  saveState();
  startFullWorkoutCountdown();
}

function startFullWorkoutCountdown() {
  clearFullWorkoutTimer();
  unlockAudio();
  renderFullWorkoutFlow();

  fullWorkoutTimerInterval = window.setInterval(() => {
    fullWorkoutRemaining -= 1;
    if (fullWorkoutRemaining <= 0) {
      fullWorkoutRemaining = 0;
      finishFullWorkoutCountdown();
      return;
    }
    renderFullWorkoutFlow();
  }, 1000);
}

function finishFullWorkoutCountdown() {
  const block = getCurrentBlock();
  if (!block) return;

  clearFullWorkoutTimer();
  fullWorkoutIsRunning = false;
  fullWorkoutIsPaused = false;
  playBeep();

  if (appState.flow.currentRound < block.rounds) {
    appState.flow.currentRound += 1;
    fullWorkoutRemaining = block.rest;
    saveState();
    renderFullWorkout();
    return;
  }

  if (appState.flow.currentBlockIndex < appState.session.blocks.length - 1) {
    appState.flow.currentBlockIndex += 1;
    appState.flow.currentRound = 0;
    const nextBlock = getCurrentBlock();
    fullWorkoutRemaining = nextBlock ? nextBlock.rest : 0;
    saveState();
    renderFullWorkout();
    return;
  }

  appState.flow.completed = true;
  fullWorkoutRemaining = 0;
  saveState();
  renderFullWorkout();
}

function clearFullWorkoutTimer() {
  if (fullWorkoutTimerInterval) {
    clearInterval(fullWorkoutTimerInterval);
    fullWorkoutTimerInterval = null;
  }
}

function renderFullWorkout() {
  if (els.workoutName) {
    els.workoutName.value = appState.session.name || 'Workout A';
  }
  renderFullWorkoutHeader();
  renderBlocks();
  renderFullWorkoutFlow();
  renderSavedWorkouts();
}

function renderFullWorkoutHeader() {
  if (els.currentWorkoutTitle) {
    els.currentWorkoutTitle.textContent = appState.session.name || 'Workout A';
  }
}

function renderBlocks() {
  if (!els.blockList) return;

  els.blockList.innerHTML = '';
  if (!appState.session.blocks.length) {
    els.blockList.innerHTML = '<div class="block-item"><div class="block-meta">No blocks added yet.</div></div>';
    return;
  }

  appState.session.blocks.forEach((block, index) => {
    const item = document.createElement('div');
    item.className = 'block-item';
    if (appState.flow.started && index === appState.flow.currentBlockIndex && !appState.flow.completed) {
      item.classList.add('active-block');
    }

    item.innerHTML = `
      <div class="block-title">${index + 1}. Sets</div>
      <div class="block-meta">Sets: ${block.rounds} · Rest: ${formatSeconds(block.rest)}</div>
      <div class="block-item-actions">
        <button class="secondary-btn" type="button" data-action="up" data-id="${block.id}">Move Up</button>
        <button class="secondary-btn" type="button" data-action="down" data-id="${block.id}">Move Down</button>
        <button class="secondary-btn" type="button" data-action="delete" data-id="${block.id}">Delete</button>
      </div>
    `;

    item.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      handleBlockAction(button.dataset.action, button.dataset.id);
    });

    els.blockList.appendChild(item);
  });
}

function handleBlockAction(action, id) {
  const index = appState.session.blocks.findIndex((block) => block.id === id);
  if (index === -1) return;

  if (action === 'delete') {
    appState.session.blocks.splice(index, 1);
  }
  if (action === 'up' && index > 0) {
    [appState.session.blocks[index - 1], appState.session.blocks[index]] = [appState.session.blocks[index], appState.session.blocks[index - 1]];
  }
  if (action === 'down' && index < appState.session.blocks.length - 1) {
    [appState.session.blocks[index + 1], appState.session.blocks[index]] = [appState.session.blocks[index], appState.session.blocks[index + 1]];
  }

  clearFullWorkoutTimer();
  fullWorkoutRemaining = 0;
  fullWorkoutIsRunning = false;
  fullWorkoutIsPaused = false;
  appState.flow = createDefaultState().flow;
  saveState();
  renderFullWorkout();
}

function renderFullWorkoutFlow() {
  const block = getCurrentBlock();
  els.workoutComplete?.classList.toggle('hidden', !appState.flow.completed);

  if (!appState.session.blocks.length) {
    if (els.currentBlockLabel) els.currentBlockLabel.textContent = 'No blocks';
    if (els.currentProgressLabel) els.currentProgressLabel.textContent = '—';
    if (els.currentStepLabel) els.currentStepLabel.textContent = '—';
    setTimerCard(els.timerCard, els.timerPhase, els.timerDisplay, els.timerSubtext, 'Ready', '00:00', 'Build your workout, then press Start.', 'idle');
    if (els.startWorkoutBtn) els.startWorkoutBtn.textContent = 'Start';
    return;
  }

  if (appState.flow.completed || !block) {
    if (els.currentBlockLabel) els.currentBlockLabel.textContent = 'Complete';
    if (els.currentProgressLabel) els.currentProgressLabel.textContent = 'Finished';
    if (els.currentStepLabel) els.currentStepLabel.textContent = '—';
    setTimerCard(els.timerCard, els.timerPhase, els.timerDisplay, els.timerSubtext, 'Complete', '00:00', 'Workout complete.', 'active');
    if (els.startWorkoutBtn) els.startWorkoutBtn.textContent = 'Start';
    return;
  }

  if (els.currentBlockLabel) {
    els.currentBlockLabel.textContent = `Sets (${appState.flow.currentBlockIndex + 1} of ${appState.session.blocks.length})`;
  }
  if (els.currentProgressLabel) {
    els.currentProgressLabel.textContent = `${formatSetLabel(appState.flow.currentRound)} of ${block.rounds}`;
  }
  if (els.currentStepLabel) {
    els.currentStepLabel.textContent = fullWorkoutIsRunning ? 'Rest' : fullWorkoutIsPaused ? 'Paused' : 'Ready';
  }

  if (!appState.flow.started && !fullWorkoutIsRunning && !fullWorkoutIsPaused) {
    setTimerCard(els.timerCard, els.timerPhase, els.timerDisplay, els.timerSubtext, 'Ready', formatSeconds(block.rest), 'Press Start to begin your first rest.', 'idle');
  } else if (fullWorkoutIsRunning) {
    setTimerCard(els.timerCard, els.timerPhase, els.timerDisplay, els.timerSubtext, 'Rest', formatSeconds(fullWorkoutRemaining), 'Rest running.', 'resting');
  } else if (fullWorkoutIsPaused) {
    setTimerCard(els.timerCard, els.timerPhase, els.timerDisplay, els.timerSubtext, 'Paused', formatSeconds(fullWorkoutRemaining), 'Press Start to resume.', 'idle');
  } else {
    setTimerCard(els.timerCard, els.timerPhase, els.timerDisplay, els.timerSubtext, 'Ready', formatSeconds(fullWorkoutRemaining || block.rest), 'Press Start when you finish the next set.', 'active');
  }

  if (els.startWorkoutBtn) {
    els.startWorkoutBtn.textContent = fullWorkoutIsRunning ? 'Pause' : 'Start';
  }
}

function saveCurrentWorkout() {
  if (!appState.session.blocks.length) return;

  const copy = JSON.parse(JSON.stringify(appState.session));
  copy.id = `session-${Date.now()}`;

  const existingIndex = savedWorkouts.findIndex((item) => item.name === copy.name);
  if (existingIndex >= 0) {
    savedWorkouts[existingIndex] = copy;
  } else {
    savedWorkouts.unshift(copy);
  }

  saveSavedWorkouts();
  renderSavedWorkouts();
}

function renderSavedWorkouts() {
  if (!els.savedWorkouts) return;

  els.savedWorkouts.innerHTML = '';
  if (!savedWorkouts.length) {
    els.savedWorkouts.innerHTML = '<div class="saved-item"><div class="saved-meta">No saved workouts yet.</div></div>';
    return;
  }

  savedWorkouts.forEach((workout) => {
    const item = document.createElement('div');
    item.className = 'saved-item';
    item.innerHTML = `
      <div class="block-title">${escapeHtml(workout.name || 'Workout')}</div>
      <div class="saved-meta">${(workout.blocks || []).length} block(s)</div>
      <div class="saved-actions">
        <button class="secondary-btn" type="button" data-action="load" data-id="${workout.id}">Load</button>
        <button class="secondary-btn" type="button" data-action="delete" data-id="${workout.id}">Delete</button>
      </div>
    `;

    item.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      handleSavedWorkoutAction(button.dataset.action, button.dataset.id);
    });

    els.savedWorkouts.appendChild(item);
  });
}

function handleSavedWorkoutAction(action, id) {
  const index = savedWorkouts.findIndex((item) => item.id === id);
  if (index === -1) return;

  if (action === 'delete') {
    savedWorkouts.splice(index, 1);
    saveSavedWorkouts();
    renderSavedWorkouts();
    return;
  }

  if (action === 'load') {
    clearFullWorkoutTimer();
    fullWorkoutRemaining = 0;
    fullWorkoutIsRunning = false;
    fullWorkoutIsPaused = false;

    const loaded = JSON.parse(JSON.stringify(savedWorkouts[index]));
    loaded.blocks = (loaded.blocks || []).map((block) => ({
      id: block.id || `block-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      type: 'sets',
      rounds: clamp(Number(block.rounds) || 1, 1, 20),
      rest: clamp(Number(block.rest), 0, 900)
    }));

    appState.session = loaded;
    appState.flow = createDefaultState().flow;
    saveState();
    navigateTo('fullWorkout');
  }
}

function setTimerCard(card, phaseEl, displayEl, subtextEl, phase, display, subtext, mode) {
  if (phaseEl) phaseEl.textContent = phase;
  if (displayEl) displayEl.textContent = display;
  if (subtextEl) subtextEl.textContent = subtext;
  if (card) {
    card.classList.remove('idle', 'resting', 'active');
    card.classList.add(mode);
  }
}

function formatSeconds(value) {
  const safe = Math.max(0, Number(value) || 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function unlockAudio() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    audioContext = new AudioCtx();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
}

function playBeep() {
  unlockAudio();
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, now);

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.24);
}
