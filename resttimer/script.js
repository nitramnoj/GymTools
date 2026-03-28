const STORAGE_KEY = 'gymToolsSetCounterState';
const SAVED_WORKOUTS_KEY = 'gymToolsSetCounterSavedWorkouts';
const THEME_KEY = 'gymToolsSetCounterTheme';

const BLOCK_CONFIG = {
  standard_set: { label: 'Standard Set', fixedSteps: 1, progressLabel: 'Set' },
  superset: { label: 'Superset', fixedSteps: 2, progressLabel: 'Round' },
  triset: { label: 'Triset', fixedSteps: 3, progressLabel: 'Round' },
  circuit: { label: 'Circuit', fixedSteps: null, minSteps: 3, maxSteps: 6, progressLabel: 'Round' }
};

const els = {
  workoutName: document.getElementById('workoutName'),
  blockForm: document.getElementById('blockForm'),
  blockType: document.getElementById('blockType'),
  blockRounds: document.getElementById('blockRounds'),
  blockRest: document.getElementById('blockRest'),
  blockSteps: document.getElementById('blockSteps'),
  stepsFieldWrap: document.getElementById('stepsFieldWrap'),
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
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  skipRestBtn: document.getElementById('skipRestBtn'),
  workoutComplete: document.getElementById('workoutComplete'),
  saveWorkoutBtn: document.getElementById('saveWorkoutBtn'),
  savedWorkouts: document.getElementById('savedWorkouts'),
  themeToggle: document.getElementById('themeToggle')
};

let appState = loadState();
let savedWorkouts = loadSavedWorkouts();
let timerInterval = null;
let restRemaining = 0;
let isResting = false;

applyTheme();
updateStepsField();
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
      currentRound: 1,
      currentStep: 1
    }
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
  els.blockType.addEventListener('change', updateStepsField);
  els.blockForm.addEventListener('submit', handleAddBlock);
  els.startWorkoutBtn.addEventListener('click', startWorkout);
  els.resetFlowBtn.addEventListener('click', resetFlowOnly);
  els.resetBuilderBtn.addEventListener('click', clearWorkout);
  els.nextBtn.addEventListener('click', advanceFlow);
  els.prevBtn.addEventListener('click', goBackStep);
  els.skipRestBtn.addEventListener('click', skipRest);
  els.saveWorkoutBtn.addEventListener('click', saveCurrentWorkout);
  els.themeToggle.addEventListener('click', toggleTheme);
  els.workoutName.addEventListener('input', (event) => {
    appState.session.name = event.target.value.trim() || 'Workout A';
    saveState();
    renderHeader();
    renderSavedWorkouts();
  });
}

function updateStepsField() {
  const config = BLOCK_CONFIG[els.blockType.value];
  if (config.fixedSteps) {
    els.blockSteps.value = config.fixedSteps;
    els.blockSteps.disabled = true;
    els.stepsFieldWrap.classList.add('hidden');
  } else {
    els.blockSteps.disabled = false;
    els.stepsFieldWrap.classList.remove('hidden');
    const current = Number(els.blockSteps.value) || 3;
    els.blockSteps.value = Math.min(Math.max(current, config.minSteps), config.maxSteps);
  }
}

function handleAddBlock(event) {
  event.preventDefault();
  const type = els.blockType.value;
  const config = BLOCK_CONFIG[type];
  const rounds = clamp(Number(els.blockRounds.value), 1, 20);
  const rest = clamp(Number(els.blockRest.value), 0, 900);
  const steps = config.fixedSteps || clamp(Number(els.blockSteps.value), config.minSteps, config.maxSteps);

  appState.session.blocks.push({
    id: `block-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    type,
    rounds,
    rest,
    steps
  });

  saveState();
  renderAll();
}

function renderAll() {
  els.workoutName.value = appState.session.name || 'Workout A';
  renderHeader();
  renderBlocks();
  renderFlow();
  renderSavedWorkouts();
}

function renderHeader() {
  els.currentWorkoutTitle.textContent = appState.session.name || 'Workout A';
}

function renderBlocks() {
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

    item.innerHTML = `
      <div class="block-title">${index + 1}. ${config.label}</div>
      <div class="block-meta">${config.progressLabel}s: ${block.rounds} · Rest: ${formatSeconds(block.rest)} · Steps: ${block.steps}</div>
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

  resetTimer();
  appState.flow = createDefaultState().flow;
  saveState();
  renderAll();
}

function getCurrentBlock() {
  return appState.session.blocks[appState.flow.currentBlockIndex] || null;
}

function renderFlow() {
  const block = getCurrentBlock();
  els.workoutComplete.classList.toggle('hidden', !appState.flow.completed);

  if (!appState.session.blocks.length) {
    els.currentBlockLabel.textContent = 'No blocks';
    els.currentProgressLabel.textContent = '—';
    els.currentStepLabel.textContent = '—';
    setTimerDisplay('Ready', '00:00', 'Build your workout, then press Start.', 'idle');
    return;
  }

  if (!appState.flow.started) {
    els.currentBlockLabel.textContent = 'Not started';
    els.currentProgressLabel.textContent = '—';
    els.currentStepLabel.textContent = '—';
    setTimerDisplay('Ready', '00:00', 'Press Start to begin the first block.', 'idle');
    return;
  }

  if (appState.flow.completed || !block) {
    els.currentBlockLabel.textContent = 'Complete';
    els.currentProgressLabel.textContent = 'Finished';
    els.currentStepLabel.textContent = '—';
    setTimerDisplay('Complete', '00:00', 'Workout complete.', 'idle');
    return;
  }

  const config = BLOCK_CONFIG[block.type];
  els.currentBlockLabel.textContent = `${config.label} (${appState.flow.currentBlockIndex + 1} of ${appState.session.blocks.length})`;
  els.currentProgressLabel.textContent = `${config.progressLabel} ${appState.flow.currentRound} of ${block.rounds}`;
  els.currentStepLabel.textContent = getStepLabel(block, appState.flow.currentStep);

  if (!isResting) {
    setTimerDisplay('Work', '00:00', 'Complete the current step when ready.', 'active');
  }
}

function getStepLabel(block, stepNumber) {
  if (block.type === 'standard_set') return 'Set effort';
  if (block.type === 'superset') return stepNumber === 1 ? 'Exercise A' : 'Exercise B';
  if (block.type === 'triset') return ['Exercise A', 'Exercise B', 'Exercise C'][stepNumber - 1] || `Exercise ${stepNumber}`;
  return `Station ${stepNumber}`;
}

function startWorkout() {
  if (!appState.session.blocks.length) return;
  if (!appState.flow.started || appState.flow.completed) {
    appState.flow = {
      started: true,
      completed: false,
      currentBlockIndex: 0,
      currentRound: 1,
      currentStep: 1
    };
    resetTimer();
    saveState();
    renderAll();
  }
}

function resetFlowOnly() {
  resetTimer();
  appState.flow = createDefaultState().flow;
  saveState();
  renderAll();
}

function clearWorkout() {
  resetTimer();
  appState = createDefaultState();
  saveState();
  renderAll();
}

function advanceFlow() {
  if (!appState.flow.started || appState.flow.completed) return;
  if (isResting) return;

  const block = getCurrentBlock();
  if (!block) return;

  if (appState.flow.currentStep < block.steps) {
    appState.flow.currentStep += 1;
    saveState();
    renderAll();
    return;
  }

  if (block.rest > 0) {
    startRest(block.rest);
  } else {
    moveToNextRoundOrBlock();
  }
}

function goBackStep() {
  if (!appState.flow.started || appState.flow.completed || isResting) return;
  const block = getCurrentBlock();
  if (!block) return;

  if (appState.flow.currentStep > 1) {
    appState.flow.currentStep -= 1;
  } else if (appState.flow.currentRound > 1) {
    appState.flow.currentRound -= 1;
    appState.flow.currentStep = block.steps;
  } else if (appState.flow.currentBlockIndex > 0) {
    appState.flow.currentBlockIndex -= 1;
    const prevBlock = getCurrentBlock();
    appState.flow.currentRound = prevBlock.rounds;
    appState.flow.currentStep = prevBlock.steps;
  }

  saveState();
  renderAll();
}

function startRest(seconds) {
  resetTimer();
  isResting = true;
  restRemaining = seconds;
  updateRestDisplay();
  timerInterval = window.setInterval(() => {
    restRemaining -= 1;
    if (restRemaining <= 0) {
      resetTimer();
      moveToNextRoundOrBlock();
      return;
    }
    updateRestDisplay();
  }, 1000);
}

function updateRestDisplay() {
  setTimerDisplay('Rest', formatSeconds(restRemaining), 'Rest timer running.', 'resting');
}

function skipRest() {
  if (!isResting) return;
  resetTimer();
  moveToNextRoundOrBlock();
}

function moveToNextRoundOrBlock() {
  const block = getCurrentBlock();
  if (!block) return;

  if (appState.flow.currentRound < block.rounds) {
    appState.flow.currentRound += 1;
    appState.flow.currentStep = 1;
  } else if (appState.flow.currentBlockIndex < appState.session.blocks.length - 1) {
    appState.flow.currentBlockIndex += 1;
    appState.flow.currentRound = 1;
    appState.flow.currentStep = 1;
  } else {
    appState.flow.completed = true;
  }

  saveState();
  renderAll();
}

function resetTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  isResting = false;
  restRemaining = 0;
}

function setTimerDisplay(phase, display, subtext, mode) {
  els.timerPhase.textContent = phase;
  els.timerDisplay.textContent = display;
  els.timerSubtext.textContent = subtext;
  els.timerCard.classList.remove('idle', 'resting', 'active');
  els.timerCard.classList.add(mode);
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
      <div class="saved-meta">${workout.blocks.length} block(s)</div>
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
    resetTimer();
    appState.session = JSON.parse(JSON.stringify(savedWorkouts[index]));
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
