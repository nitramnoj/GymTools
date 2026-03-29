const STORAGE_KEY = 'gymToolsSetCounterState';
const SAVED_WORKOUTS_KEY = 'gymToolsSetCounterSavedWorkouts';
const THEME_KEY = 'gymToolsTheme';

const BLOCK_CONFIG = {
  sets: { label: 'Sets', progressLabel: 'Set' },
  quick_rest: { label: 'Quick Rest', progressLabel: 'Cycle' }
};

const MODE_VALUES = {
  QUICK_REST: 'quick_rest',
  SETS: 'sets',
  SET_COUNTER: 'set_counter'
};

const els = {
  workoutName: document.getElementById('workoutName'),
  blockForm: document.getElementById('blockForm'),
  blockType: document.getElementById('blockType'),
  blockRounds: document.getElementById('blockRounds'),
  blockRest: document.getElementById('blockRest'),
  roundsFieldWrap: document.getElementById('roundsFieldWrap'),
  roundsLabel: document.getElementById('roundsLabel'),
  addBlockBtn: document.getElementById('addBlockBtn'),
  currentBlocksPanel: document.getElementById('currentBlocksPanel'),
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
  resetBuilderBtn: document.getElementById('resetBuilderBtn'),
  workoutComplete: document.getElementById('workoutComplete'),
  saveWorkoutBtn: document.getElementById('saveWorkoutBtn'),
  savedWorkouts: document.getElementById('savedWorkouts'),
  themeToggle: document.getElementById('themeToggle'),

  modeQuickRest: document.getElementById('modeQuickRest'),
  modeSets: document.getElementById('modeSets'),
  modeSetCounter: document.getElementById('modeSetCounter'),
  modeButtonsWrap: document.getElementById('modeButtons'),

  builderPanelWrap: document.getElementById('builderPanelWrap'),
  timerPanelWrap: document.getElementById('timerPanelWrap'),
  savedWorkoutsPanel: document.getElementById('savedWorkoutsPanel')
};

let appState = loadState();
let savedWorkouts = loadSavedWorkouts();
let timerInterval = null;
let restRemaining = 0;
let isRunning = false;
let isPaused = false;
let audioContext = null;
let quickRestState = createQuickRestState();
let setCounterState = createSetCounterState();
let currentMode = getInitialMode();

migrateLegacyState();
applyTheme();
syncLegacySelectorToMode();
updateBuilderFields();
renderAll();
bindEvents();

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
      currentRound: 1
    }
  };
}

function createQuickRestState() {
  const preset = clamp(Number(els.blockRest?.value), 0, 900);
  return {
    active: false,
    preset,
    remaining: preset,
    hasCompleted: false,
    currentRound: 1
  };
}

function createSetCounterState() {
  return {
    current: 1,
    active: false
  };
}

function getInitialMode() {
  const legacyValue = els.blockType?.value;
  if (
    legacyValue === MODE_VALUES.SETS ||
    legacyValue === MODE_VALUES.SET_COUNTER ||
    legacyValue === MODE_VALUES.QUICK_REST
  ) {
    return legacyValue;
  }
  return MODE_VALUES.QUICK_REST;
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

function migrateLegacyState() {
  let changed = false;
  const validTypes = new Set(['sets', 'quick_rest']);

  appState.session.blocks = (appState.session.blocks || []).reduce((acc, block) => {
    if (!block || typeof block !== 'object') return acc;

    let type = block.type;
    let rounds = Number(block.rounds) || 1;
    const rest = clamp(Number(block.rest), 1, 900);

    if (type === 'standard_set' || type === 'superset' || type === 'triset') {
      type = 'sets';
      changed = true;
    } else if (type === 'circuit') {
      changed = true;
      return acc;
    }

    if (!validTypes.has(type)) {
      changed = true;
      return acc;
    }

    if (type === 'quick_rest') {
      rounds = 1;
    }

    acc.push({
      id: block.id || `block-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      type,
      rounds: clamp(rounds, 1, 20),
      rest
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

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
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

function saveSavedWorkouts() {
  localStorage.setItem(SAVED_WORKOUTS_KEY, JSON.stringify(savedWorkouts));
}

function bindEvents() {
  els.blockType?.addEventListener('change', handleModeChangeFromSelector);
  els.blockForm?.addEventListener('submit', handleAddBlock);
  els.startWorkoutBtn?.addEventListener('click', handleStartPause);
  els.resetFlowBtn?.addEventListener('click', resetFlowOnly);
  els.resetBuilderBtn?.addEventListener('click', clearWorkout);
  els.saveWorkoutBtn?.addEventListener('click', handleSaveOrExit);
  els.themeToggle?.addEventListener('click', toggleTheme);

  els.workoutName?.addEventListener('input', (event) => {
    appState.session.name = event.target.value.trim() || 'Workout A';
    saveState();
    renderHeader();
    renderSavedWorkouts();
  });

  els.modeQuickRest?.addEventListener('click', () => setMode(MODE_VALUES.QUICK_REST));
  els.modeSets?.addEventListener('click', () => setMode(MODE_VALUES.SETS));
  els.modeSetCounter?.addEventListener('click', () => setMode(MODE_VALUES.SET_COUNTER));

  document.querySelectorAll('.stepper').forEach((stepper) => {
    stepper.addEventListener('click', (event) => {
      const button = event.target.closest('[data-stepper-action]');
      if (!button) return;
      handleStepperClick(stepper, button.dataset.stepperAction);
    });
  });
}

function syncLegacySelectorToMode() {
  if (els.blockType) {
    els.blockType.value = currentMode;
  }
}

function setMode(mode) {
  if (!Object.values(MODE_VALUES).includes(mode)) {
    mode = MODE_VALUES.QUICK_REST;
  }

  resetTimerState();
  currentMode = mode;
  syncLegacySelectorToMode();

  if (isSetCounterModeSelected()) {
    setCounterState = createSetCounterState();
    setCounterState.active = true;
  } else {
    setCounterState.active = false;
    quickRestState = createQuickRestState();
  }

  updateBuilderFields();
  renderAll();
}

function handleModeChangeFromSelector() {
  setMode(els.blockType?.value || MODE_VALUES.QUICK_REST);
}

function getSelectedMode() {
  return currentMode;
}

function isQuickRestModeSelected() {
  return getSelectedMode() === MODE_VALUES.QUICK_REST;
}

function isSetsModeSelected() {
  return getSelectedMode() === MODE_VALUES.SETS;
}

function isSetCounterModeSelected() {
  return getSelectedMode() === MODE_VALUES.SET_COUNTER;
}

function updateModeButtons() {
  const buttonMap = [
    [els.modeQuickRest, MODE_VALUES.QUICK_REST],
    [els.modeSets, MODE_VALUES.SETS],
    [els.modeSetCounter, MODE_VALUES.SET_COUNTER]
  ];

  buttonMap.forEach(([button, mode]) => {
    if (!button) return;
    const isActive = currentMode === mode;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function updateBuilderFields() {
  const isQuickRest = isQuickRestModeSelected();
  const isSetCounter = isSetCounterModeSelected();

  els.roundsFieldWrap?.classList.toggle('hidden', isQuickRest || isSetCounter);
  els.addBlockBtn?.classList.toggle('hidden', isQuickRest || isSetCounter);
  els.currentBlocksPanel?.classList.toggle('hidden', isQuickRest || isSetCounter);

  if (els.saveWorkoutBtn) {
    els.saveWorkoutBtn.disabled = false;
  }

  if (els.roundsLabel) {
    els.roundsLabel.textContent = 'Number of sets';
  }

  if (els.savedWorkoutsPanel) {
    els.savedWorkoutsPanel.classList.toggle('hidden', isSetCounter);
  }

  updateModeButtons();
}

function handleStepperClick(stepper, action) {
  const targetId = stepper.dataset.target;
  const input = document.getElementById(targetId);
  if (!input) return;

  const step = Number(stepper.dataset.step) || 1;
  const min = Number(stepper.dataset.min);
  const max = Number(stepper.dataset.max);
  const current = Number(input.value) || 0;
  const delta = action === 'increment' ? step : -step;
  const next = clamp(current + delta, min, max);

  input.value = String(next);

  if (targetId === 'blockRest') {
    handleRestValueChanged(next);
  }

  if (targetId === 'blockRounds' && !isQuickRestModeSelected() && !isSetCounterModeSelected()) {
    renderFlow();
  }
}

function handleRestValueChanged(nextValue) {
  const safeValue = clamp(Number(nextValue), 0, 900);

  if (isQuickRestModeSelected()) {
    quickRestState.preset = safeValue;
    if (!quickRestState.active || !isRunning) {
      quickRestState.remaining = safeValue;
    }
    if (!isRunning) {
      quickRestState.hasCompleted = false;
    }
    renderFlow();
    renderControlButtons();
  }
}

function handleAddBlock(event) {
  event.preventDefault();
  const type = getSelectedMode();

  if (type === MODE_VALUES.QUICK_REST || type === MODE_VALUES.SET_COUNTER) {
    return;
  }

  const rounds = clamp(Number(els.blockRounds?.value), 1, 20);
  const rest = clamp(Number(els.blockRest?.value), 0, 900);

  appState.session.blocks.push({
    id: `block-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    rounds,
    rest
  });

  saveState();
  renderAll();
}

function renderAll() {
  if (els.workoutName) {
    els.workoutName.value = appState.session.name || 'Workout A';
  }

  renderHeader();
  renderBlocks();
  renderFlow();
  renderSavedWorkouts();
  renderControlButtons();
  updateBuilderFields();
}

function renderHeader() {
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
    const config = BLOCK_CONFIG[block.type];
    const item = document.createElement('div');
    item.className = 'block-item';

    if (appState.flow.started && index === appState.flow.currentBlockIndex && !appState.flow.completed) {
      item.classList.add('active-block');
    }

    const meta = block.type === 'sets'
      ? `${config.progressLabel}s: ${block.rounds} · Rest: ${formatSeconds(block.rest)}`
      : `Rest: ${formatSeconds(block.rest)} · Manual restart`;

    item.innerHTML = `
      <div class="block-title">${index + 1}. ${config.label}</div>
      <div class="block-meta">${meta}</div>
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
  const idx = appState.session.blocks.findIndex((block) => block.id === id);
  if (idx === -1) return;

  if (action === 'delete') {
    appState.session.blocks.splice(idx, 1);
  }
  if (action === 'up' && idx > 0) {
    [appState.session.blocks[idx - 1], appState.session.blocks[idx]] = [appState.session.blocks[idx], appState.session.blocks[idx - 1]];
  }
  if (action === 'down' && idx < appState.session.blocks.length - 1) {
    [appState.session.blocks[idx + 1], appState.session.blocks[idx]] = [appState.session.blocks[idx], appState.session.blocks[idx + 1]];
  }

  resetTimerState();
  appState.flow = createDefaultState().flow;
  saveState();
  renderAll();
}

function getCurrentBlock() {
  return appState.session.blocks[appState.flow.currentBlockIndex] || null;
}

function renderFlow() {
  if (isSetCounterModeSelected()) {
    renderSetCounterFlow();
    return;
  }

  if (isQuickRestModeSelected()) {
    renderQuickRestFlow();
    return;
  }

  const block = getCurrentBlock();
  els.workoutComplete?.classList.toggle('hidden', !appState.flow.completed);

  if (!appState.session.blocks.length) {
    if (els.currentBlockLabel) els.currentBlockLabel.textContent = 'No blocks';
    if (els.currentProgressLabel) els.currentProgressLabel.textContent = '—';
    if (els.currentStepLabel) els.currentStepLabel.textContent = '—';
    setTimerDisplay('Ready', '00:00', 'Build your workout, then press Start.', 'idle');
    return;
  }

  if (appState.flow.completed || !block) {
    if (els.currentBlockLabel) els.currentBlockLabel.textContent = 'Complete';
    if (els.currentProgressLabel) els.currentProgressLabel.textContent = 'Finished';
    if (els.currentStepLabel) els.currentStepLabel.textContent = '—';
    setTimerDisplay('Complete', '00:00', 'Workout complete.', 'idle');
    return;
  }

  const config = BLOCK_CONFIG[block.type];

  if (els.currentBlockLabel) {
    els.currentBlockLabel.textContent = `${config.label} (${appState.flow.currentBlockIndex + 1} of ${appState.session.blocks.length})`;
  }

  if (els.currentProgressLabel) {
    els.currentProgressLabel.textContent = block.type === 'sets'
      ? `${config.progressLabel} ${appState.flow.currentRound} of ${block.rounds}`
      : 'Single countdown';
  }

  if (els.currentStepLabel) {
    els.currentStepLabel.textContent = block.type === 'sets' ? 'Rest' : 'Quick Rest';
  }

  if (!appState.flow.started && !isRunning && !isPaused) {
    const readyDisplay = block.rest > 0 ? formatSeconds(block.rest) : '00:00';
    const readyText = block.type === 'quick_rest'
      ? 'Press Start to begin Quick Rest.'
      : 'Press Start to begin your set timer.';
    setTimerDisplay('Ready', readyDisplay, readyText, 'idle');
    return;
  }

  if (isPaused) {
    setTimerDisplay('Paused', formatSeconds(restRemaining), 'Press Start to resume.', 'idle');
    return;
  }

  if (!isRunning) {
    const idleText = block.type === 'quick_rest'
      ? 'Ready for the next manual Quick Rest.'
      : 'Press Start to continue from the current block.';
    setTimerDisplay('Ready', formatSeconds(restRemaining || block.rest), idleText, 'idle');
  }
}

function renderQuickRestFlow() {
  els.workoutComplete?.classList.add('hidden');

  const preset = clamp(Number(els.blockRest?.value), 0, 900);
  if (!isRunning && !quickRestState.active) {
    quickRestState.preset = preset;
    quickRestState.remaining = preset;
  }

  if (els.currentBlockLabel) els.currentBlockLabel.textContent = 'Quick Rest';
  if (els.currentProgressLabel) els.currentProgressLabel.textContent = `Set ${quickRestState.currentRound}`;
  if (els.currentStepLabel) els.currentStepLabel.textContent = 'Quick Rest';

  if (isPaused) {
    setTimerDisplay('Paused', formatSeconds(quickRestState.remaining), 'Press Start to resume Quick Rest.', 'idle');
    return;
  }

  if (isRunning) {
    setTimerDisplay('Rest', formatSeconds(quickRestState.remaining), 'Quick Rest running.', 'resting');
    return;
  }

  const subtext = quickRestState.hasCompleted
    ? 'Quick Rest complete. Press Start for the next rest.'
    : 'Press Start to begin Quick Rest.';
  setTimerDisplay('Ready', formatSeconds(quickRestState.remaining), subtext, 'idle');
}

function renderSetCounterFlow() {
  els.workoutComplete?.classList.add('hidden');

  if (els.currentBlockLabel) els.currentBlockLabel.textContent = 'Set Counter';
  if (els.currentProgressLabel) els.currentProgressLabel.textContent = `Set ${setCounterState.current}`;
  if (els.currentStepLabel) els.currentStepLabel.textContent = 'Tap Next Set';

  setTimerDisplay(
    'Set Counter',
    String(setCounterState.current),
    'Tap Next Set to continue',
    'active'
  );
}

function renderControlButtons() {
  if (!els.startWorkoutBtn || !els.resetFlowBtn || !els.saveWorkoutBtn) return;

  if (isSetCounterModeSelected()) {
    els.startWorkoutBtn.disabled = false;
    els.startWorkoutBtn.textContent = 'Next Set';

    els.resetFlowBtn.disabled = false;
    els.resetFlowBtn.textContent = 'Reset';

    els.saveWorkoutBtn.disabled = false;
    els.saveWorkoutBtn.textContent = 'Exit';
    return;
  }

  els.startWorkoutBtn.disabled = false;
  els.startWorkoutBtn.textContent = isRunning ? 'Pause' : 'Start';

  els.resetFlowBtn.disabled = false;
  els.resetFlowBtn.textContent = 'Reset Flow';

  els.saveWorkoutBtn.disabled = isQuickRestModeSelected() || !appState.session.blocks.length;
  els.saveWorkoutBtn.textContent = 'Save Workout';
}

function handleStartPause() {
  if (isSetCounterModeSelected()) {
    handleSetCounterNext();
    return;
  }

  if (isQuickRestModeSelected()) {
    handleQuickRestStartPause();
    return;
  }

  if (!appState.session.blocks.length) return;

  if (isRunning) {
    pauseTimer();
    return;
  }

  const block = getCurrentBlock();
  if (!block) return;

  if (appState.flow.completed) {
    appState.flow = {
      started: true,
      completed: false,
      currentBlockIndex: 0,
      currentRound: 1
    };
  }

  if (!appState.flow.started) {
    appState.flow.started = true;
    appState.flow.currentBlockIndex = Math.min(
      appState.flow.currentBlockIndex,
      Math.max(appState.session.blocks.length - 1, 0)
    );
    appState.flow.currentRound = 1;
  }

  if (!restRemaining || restRemaining <= 0) {
    restRemaining = block.rest;
  }

  saveState();
  startCurrentCountdown();
}

function handleQuickRestStartPause() {
  if (isRunning) {
    pauseTimer();
    return;
  }

  quickRestState.preset = clamp(Number(els.blockRest?.value), 0, 900);

  if (!quickRestState.active || quickRestState.remaining < 0 || quickRestState.remaining > 900) {
    quickRestState.remaining = quickRestState.preset;
  }

  quickRestState.active = true;
  quickRestState.hasCompleted = false;
  startQuickRestCountdown();
}

function startQuickRestCountdown() {
  clearTimerInterval();
  unlockAudio();
  isRunning = true;
  isPaused = false;
  renderControlButtons();
  setTimerDisplay('Rest', formatSeconds(quickRestState.remaining), 'Quick Rest running.', 'resting');

  timerInterval = window.setInterval(() => {
    quickRestState.remaining -= 1;

    if (quickRestState.remaining <= 0) {
      quickRestState.remaining = 0;
      setTimerDisplay('Rest', formatSeconds(quickRestState.remaining), 'Quick Rest running.', 'resting');
      finishQuickRestCountdown();
      return;
    }

    setTimerDisplay('Rest', formatSeconds(quickRestState.remaining), 'Quick Rest running.', 'resting');
  }, 1000);
}

function startCurrentCountdown() {
  const block = getCurrentBlock();
  if (!block) return;

  clearTimerInterval();
  unlockAudio();
  isRunning = true;
  isPaused = false;
  renderControlButtons();
  setTimerDisplay(
    'Rest',
    formatSeconds(restRemaining),
    block.type === 'quick_rest' ? 'Quick Rest running.' : 'Set timer running.',
    'resting'
  );

  timerInterval = window.setInterval(() => {
    restRemaining -= 1;

    if (restRemaining <= 0) {
      restRemaining = 0;
      updateRunningDisplay();
      finishCountdown();
      return;
    }

    updateRunningDisplay();
  }, 1000);
}

function updateRunningDisplay() {
  const block = getCurrentBlock();
  if (!block) return;
  const subtext = block.type === 'quick_rest' ? 'Quick Rest running.' : 'Set timer running.';
  setTimerDisplay('Rest', formatSeconds(restRemaining), subtext, 'resting');
}

function finishQuickRestCountdown() {
  clearTimerInterval();
  isRunning = false;
  isPaused = false;
  quickRestState.active = false;
  quickRestState.hasCompleted = true;
  quickRestState.preset = clamp(Number(els.blockRest?.value), 0, 900);
  quickRestState.remaining = quickRestState.preset;
  quickRestState.currentRound += 1;
  playBeep();
  renderAll();
}

function finishCountdown() {
  const block = getCurrentBlock();
  if (!block) return;

  clearTimerInterval();
  isRunning = false;
  isPaused = false;
  playBeep();

  if (block.type === 'quick_rest') {
    restRemaining = block.rest;
    appState.flow.started = true;
    saveState();
    renderAll();
    setTimerDisplay('Ready', formatSeconds(block.rest), 'Quick Rest complete. Press Start for the next rest.', 'idle');
    return;
  }

  if (appState.flow.currentRound < block.rounds) {
    appState.flow.currentRound += 1;
    restRemaining = block.rest;
    saveState();
    renderAll();
    setTimerDisplay('Ready', formatSeconds(block.rest), 'Set complete. Press Start for the next set.', 'idle');
    return;
  }

  if (appState.flow.currentBlockIndex < appState.session.blocks.length - 1) {
    appState.flow.currentBlockIndex += 1;
    appState.flow.currentRound = 1;
    const nextBlock = getCurrentBlock();
    restRemaining = nextBlock ? nextBlock.rest : 0;
    saveState();
    renderAll();

    if (nextBlock) {
      const nextText = nextBlock.type === 'quick_rest'
        ? 'Quick Rest is ready. Press Start to begin.'
        : 'Next block ready. Press Start to begin.';
      setTimerDisplay('Ready', formatSeconds(nextBlock.rest), nextText, 'idle');
    }
    return;
  }

  appState.flow.completed = true;
  restRemaining = 0;
  saveState();
  renderAll();
}

function pauseTimer() {
  clearTimerInterval();
  isRunning = false;
  isPaused = true;
  renderAll();
}

function handleSetCounterNext() {
  if (!isSetCounterModeSelected()) return;
  setCounterState.current += 1;
  setCounterState.active = true;
  renderAll();
}

function resetSetCounter() {
  setCounterState.current = 1;
  setCounterState.active = isSetCounterModeSelected();
  renderAll();
}

function handleSetCounterExit() {
  setCounterState = createSetCounterState();
  setMode(MODE_VALUES.QUICK_REST);
}

function resetFlowOnly() {
  clearTimerInterval();

  if (isSetCounterModeSelected()) {
    resetSetCounter();
    return;
  }

  if (isQuickRestModeSelected()) {
    quickRestState = createQuickRestState();
    restRemaining = 0;
    isRunning = false;
    isPaused = false;
    renderAll();
    return;
  }

  appState.flow = createDefaultState().flow;
  restRemaining = 0;
  isRunning = false;
  isPaused = false;
  saveState();
  renderAll();
}

function clearWorkout() {
  clearTimerInterval();
  appState = createDefaultState();
  quickRestState = createQuickRestState();
  setCounterState = createSetCounterState();
  restRemaining = 0;
  isRunning = false;
  isPaused = false;
  saveState();
  renderAll();
}

function resetTimerState() {
  clearTimerInterval();
  restRemaining = 0;
  isRunning = false;
  isPaused = false;
}

function clearTimerInterval() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function setTimerDisplay(phase, display, subtext, mode) {
  if (els.timerPhase) els.timerPhase.textContent = phase;
  if (els.timerDisplay) els.timerDisplay.textContent = display;
  if (els.timerSubtext) els.timerSubtext.textContent = subtext;

  if (els.timerCard) {
    els.timerCard.classList.remove('idle', 'resting', 'active');
    els.timerCard.classList.add(mode);
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

function handleSaveOrExit() {
  if (isSetCounterModeSelected()) {
    handleSetCounterExit();
    return;
  }

  saveCurrentWorkout();
}

function saveCurrentWorkout() {
  if (isQuickRestModeSelected() || isSetCounterModeSelected() || !appState.session.blocks.length) return;

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
  renderControlButtons();
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
    renderControlButtons();
    return;
  }

  if (action === 'load') {
    resetTimerState();
    quickRestState = createQuickRestState();
    setCounterState = createSetCounterState();

    const loaded = JSON.parse(JSON.stringify(savedWorkouts[index]));
    loaded.blocks = (loaded.blocks || []).map((block) => {
      if (block.type === 'standard_set' || block.type === 'superset' || block.type === 'triset') {
        return {
          ...block,
          type: 'sets',
          rounds: clamp(Number(block.rounds) || 1, 1, 20),
          rest: clamp(Number(block.rest), 0, 900)
        };
      }

      if (block.type === 'quick_rest') {
        return {
          ...block,
          type: 'quick_rest',
          rounds: 1,
          rest: clamp(Number(block.rest), 0, 900)
        };
      }

      return {
        ...block,
        type: 'sets',
        rounds: clamp(Number(block.rounds) || 1, 1, 20),
        rest: clamp(Number(block.rest), 0, 900)
      };
    }).filter((block) => block.type !== 'circuit');

    appState.session = loaded;
    appState.flow = createDefaultState().flow;
    saveState();
    renderAll();
  }
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

function unlockAudio() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
  } catch (error) {
    console.warn('Audio init failed', error);
  }
}

function playBeep() {
  try {
    unlockAudio();
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);

    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.2);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.22);
  } catch (error) {
    console.warn('Beep failed', error);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}