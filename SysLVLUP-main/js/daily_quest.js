// Daily Quest System - Updated Protocol
let userManager = null;
let currentUserData = null;
let hasRedirectedAfterCompletion = false;

// Subtask definitions
const SUBTASKS = {
  mental: ['mental-geo', 'mental-history', 'mental-study1', 'mental-study2', 'mental-study3', 'mental-study4'],
  physical: ['physical-workout'],
  spiritual: ['spiritual-morning', 'spiritual-evening', 'spiritual-witr']
};

document.addEventListener("DOMContentLoaded", function() {
  console.log('Daily quest page DOM loaded');
  checkForUserData();

  document.addEventListener('visibilitychange', function() {
    if (!document.hidden && currentUserData) {
      loadSubtaskState();
      recalcAllCounters();
    }
  });

  window.addEventListener('focus', function() {
    if (currentUserData) {
      loadSubtaskState();
      recalcAllCounters();
    }
  });
});

// ---- User data loading (unchanged logic) ----
async function checkForUserData() {
  const playerName = localStorage.getItem('playerName');
  if (playerName) {
    await initializeUserManager();
  } else {
    setTimeout(() => { window.location.href = 'alarm.html'; }, 1000);
  }
}

async function initializeUserManager() {
  try {
    userManager = new UserManager();
    const result = await userManager.setUserId(localStorage.getItem('playerName'));
    currentUserData = userManager.getData();

    if (result.dataFound && currentUserData && currentUserData.gameData) {
      await checkAndPerformDailyReset();
    }
    
    // Load saved subtask state & wire up listeners
    loadSubtaskState();
    setupSubtaskListeners();
    recalcAllCounters();
  } catch (error) {
    console.error('Error initializing user manager:', error);
    loadSubtaskState();
    setupSubtaskListeners();
    recalcAllCounters();
  }
}

// ---- Daily reset (updated default counts) ----
async function checkAndPerformDailyReset() {
  try {
    const currentData = userManager.getData();
    if (!currentData || !currentData.gameData) return;

    const todayString = new Date().toISOString().split('T')[0];
    let lastResetDate = currentData.lastResetDate;
    let lastResetDateObj = null;

    if (lastResetDate) {
      if (lastResetDate.includes('-')) {
        lastResetDateObj = new Date(lastResetDate);
      } else {
        const parts = lastResetDate.split('/');
        if (parts.length === 3) lastResetDateObj = new Date(parts[2], parts[1] - 1, parts[0]);
      }
    }

    const lastResetString = lastResetDateObj ? lastResetDateObj.toISOString().split('T')[0] : null;

    const sessionKey = `dailyResetChecked:${currentData.userId || localStorage.getItem('playerName') || 'anonymous'}`;
    if (sessionStorage.getItem(sessionKey) === todayString) return;

    if (!lastResetString) {
      currentData.lastResetDate = todayString;
      userManager.setData('lastResetDate', todayString);
      userManager.lastLoadTime = 0;
      await userManager.saveUserData();
      sessionStorage.setItem(sessionKey, todayString);
      return;
    }

    if (lastResetString !== todayString) {
      await performDailyReset();
    }

    sessionStorage.setItem(sessionKey, todayString);
  } catch (error) {
    console.error('Error during daily reset check:', error);
  }
}

async function performDailyReset() {
  try {
    const currentData = userManager.getData();
    const gameData = currentData.gameData;

    gameData.hp = 100;
    gameData.mp = 100;
    gameData.stm = 100;
    gameData.fatigue = 0;

    // Updated default counts
    gameData.physicalQuests = "[0/1]";
    gameData.mentalQuests = "[0/6]";
    gameData.spiritualQuests = "[0/3]";
    gameData.questCostsApplied = { physical: false, mental: false, spiritual: false };

    // Clear subtask state
    gameData.dailySubtasks = {};

    // Reset training session flags
    try {
      const allData = userManager.getData();
      allData.physicalTrainingData = allData.physicalTrainingData || {};
      allData.physicalTrainingData.sessionCompleted = false;
      allData.physicalTrainingData.sessionTotal = 0;
      allData.physicalTrainingData.todaySession = null;

      allData.spiritualTrainingData = allData.spiritualTrainingData || {};
      allData.spiritualTrainingData.sessionCompleted = false;
      allData.spiritualTrainingData.sessionTotal = 0;
      allData.spiritualTrainingData.todaySession = null;

      allData.mentalTrainingData = allData.mentalTrainingData || {};
      allData.mentalTrainingData.sessionCompleted = false;
      allData.mentalTrainingData.sessionTotal = 0;
      allData.mentalTrainingData.currentSession = null;

      userManager.updateData({ physicalTrainingData: allData.physicalTrainingData, spiritualTrainingData: allData.spiritualTrainingData, mentalTrainingData: allData.mentalTrainingData, gameData });
    } catch (_) {}

    currentData.lastResetDate = new Date().toISOString().split('T')[0];
    await userManager.saveUserData();

    showDailyResetNotification();
  } catch (error) {
    console.error('Error performing daily reset:', error);
  }
}

function showDailyResetNotification() {
  const notification = document.createElement('div');
  notification.innerHTML = `
    <div style="
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; padding: 20px 30px; border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000;
      font-weight: bold; text-align: center; animation: slideDown 0.5s ease-out;
    ">
      <div style="font-size: 24px; margin-bottom: 10px;">🌅 Daily Reset Complete!</div>
      <div style="font-size: 16px; opacity: 0.9;">HP, MP, Stamina, Fatigue, and Daily Quests have been reset.</div>
    </div>
  `;
  const style = document.createElement('style');
  style.textContent = `@keyframes slideDown { from { transform: translateX(-50%) translateY(-100%); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }`;
  document.head.appendChild(style);
  document.body.appendChild(notification);
  setTimeout(() => { if (notification.parentNode) notification.parentNode.removeChild(notification); }, 5000);
}

// ---- Subtask state management ----
function getSubtaskState() {
  try {
    const data = userManager ? userManager.getData() : null;
    if (data && data.gameData && data.gameData.dailySubtasks) {
      return data.gameData.dailySubtasks;
    }
  } catch (_) {}
  // Fallback to localStorage
  try {
    return JSON.parse(localStorage.getItem('dailySubtasks') || '{}');
  } catch (_) { return {}; }
}

function saveSubtaskState(state) {
  // Save to localStorage as fallback
  localStorage.setItem('dailySubtasks', JSON.stringify(state));
  // Save to user manager
  try {
    if (userManager) {
      const data = userManager.getData();
      if (data && data.gameData) {
        data.gameData.dailySubtasks = state;
        userManager.saveUserData();
      }
    }
  } catch (_) {}
}

function loadSubtaskState() {
  const state = getSubtaskState();
  Object.keys(SUBTASKS).forEach(category => {
    SUBTASKS[category].forEach(id => {
      const cb = document.getElementById(id);
      if (cb) cb.checked = !!state[id];
    });
  });
}

function setupSubtaskListeners() {
  Object.keys(SUBTASKS).forEach(category => {
    SUBTASKS[category].forEach(id => {
      const cb = document.getElementById(id);
      if (cb) {
        cb.addEventListener('change', function() {
          const state = getSubtaskState();
          state[id] = this.checked;
          saveSubtaskState(state);
          recalcAllCounters();

          if (this.checked) {
            const label = this.parentElement ? this.parentElement.textContent.trim() : id;
            showNotification('✅ ' + label + ' completed!', 'success');
          }
        });
      }
    });
  });
}

// ---- Counter recalculation ----
function recalcAllCounters() {
  recalcCategory('mental', 'mentalQuests', 'mental-checkbox');
  recalcCategory('physical', 'physicalQuests', 'physical-checkbox');
  recalcCategory('spiritual', 'spiritualQuests', 'spiritual-checkbox');
  checkAllQuestsCompleted();

  // Sync counts back to gameData
  try {
    if (userManager) {
      const data = userManager.getData();
      if (data && data.gameData) {
        data.gameData.mentalQuests = document.getElementById('mentalQuests').textContent;
        data.gameData.physicalQuests = document.getElementById('physicalQuests').textContent;
        data.gameData.spiritualQuests = document.getElementById('spiritualQuests').textContent;
      }
    }
  } catch (_) {}
}

function recalcCategory(category, counterId, checkboxId) {
  const ids = SUBTASKS[category];
  const total = ids.length;
  let done = 0;
  ids.forEach(id => {
    const cb = document.getElementById(id);
    if (cb && cb.checked) done++;
  });

  const counterEl = document.getElementById(counterId);
  if (counterEl) counterEl.textContent = `[${done}/${total}]`;

  const mainCb = document.getElementById(checkboxId);
  if (mainCb) {
    const completed = done >= total;
    mainCb.checked = completed;
    mainCb.disabled = true;
    mainCb.style.opacity = completed ? '0.7' : '';
  }
}

function checkAllQuestsCompleted() {
  let allDone = true;
  Object.keys(SUBTASKS).forEach(category => {
    SUBTASKS[category].forEach(id => {
      const cb = document.getElementById(id);
      if (cb && !cb.checked) allDone = false;
    });
  });

  const completeCheckbox = document.getElementById('complete');
  if (completeCheckbox) {
    completeCheckbox.disabled = !allDone;
    completeCheckbox.checked = allDone;

    if (allDone && !hasRedirectedAfterCompletion) {
      showNotification('🎉 All daily quests completed!', 'success');
      hasRedirectedAfterCompletion = true;
      setTimeout(() => { window.location.href = 'status.html'; }, 2000);
    }
  }
}

// ---- Notification ----
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed; top: 20px; right: 20px; padding: 15px 20px;
    border-radius: 5px; color: white; font-weight: bold; z-index: 1000;
    animation: slideIn 0.3s ease-out;
  `;
  switch (type) {
    case 'success': notification.style.backgroundColor = '#4CAF50'; break;
    case 'warning': notification.style.backgroundColor = '#FF9800'; break;
    case 'error': notification.style.backgroundColor = '#F44336'; break;
    default: notification.style.backgroundColor = '#2196F3';
  }
  document.body.appendChild(notification);
  setTimeout(() => { if (notification.parentNode) notification.parentNode.removeChild(notification); }, 3000);
}

const style = document.createElement('style');
style.textContent = `@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
document.head.appendChild(style);
