// Physical Quest System - Updated for new UserManager
let userManager = null;
let currentUserData = null;
let physicalData = null; // stored in DB under physicalTrainingData
let ptModalStyleInjected = false;

// Rest Timer System
let restTimer = null;
let currentRestTime = 0;
let restTimerInterval = null;
let currentExercise = null;
let currentSetIndex = 0;
let restTimerStartTime = 0;
let restTimerExtensions = 0;
let restTimerWasSkipped = false;

// Feedback System
let feedbackModal = null;

document.addEventListener("DOMContentLoaded", function() {
  console.log('Physical Quest page loaded');
  
  // Check if we have a player name
  const playerName = localStorage.getItem('playerName');
  if (!playerName) {
    console.log('No player found, redirecting to alarm page');
    setTimeout(() => {
      window.location.href = 'alarm.html';
    }, 1000);
    return;
  }
  
  // Initialize user manager and load data
  initializeQuestPage();
  
  // Initialize feedback system
  initializeFeedbackSystem();
  
  // Process unanalyzed feedback notes
  processUnanalyzedFeedback();
  
  // Set up periodic analysis every 30 seconds
  setInterval(processUnanalyzedFeedback, 30000);
});

// Initialize the quest page
async function initializeQuestPage() {
  try {
    // Create user manager instance
    userManager = new UserManager();
    
    // Set the user ID and load data
    await userManager.setUserId(localStorage.getItem('playerName'));
    
    // Get current data
    currentUserData = userManager.getData();
    physicalData = currentUserData.physicalTrainingData || getDefaultPhysicalData();
    // Ensure structure exists for legacy users
    ensurePhysicalStructure();
    
    if (currentUserData && currentUserData.gameData) {
      console.log('User data loaded:', currentUserData.gameData);
      loadData(currentUserData.gameData);
    } else {
      console.log('No existing data, using defaults');
      loadData({});
    }
    
    // Decide whether to show a brief preparing overlay to avoid flashing yesterday's session
    const todayStr = new Date().toISOString().split('T')[0];
    const isNewDay = physicalData.lastSessionDate !== todayStr;

    if (isNewDay) {
      // Use existing loading state by clearing today's session first
      physicalData.todaySession = null;
      renderAISessionExercises();
      await ensureTodaySession();
      renderAISessionExercises();
    } else {
      // Same day, render immediately
      renderAISessionExercises();
    }
    
  } catch (error) {
    console.error('Error initializing quest page:', error);
    // Fallback to default data
    loadData({});
    renderAISessionExercises();
  }
}

// (Removed retry helper used during debugging)

function getDefaultPhysicalData() {
  return {
    currentProgram: { split: ['D1','D2','D3','D4'], dayIndex: 0, week: 1, mesoPhase: 1 },
    todaySession: null,
    workoutHistory: [],
    personalRecords: {},
    lastSessionDate: null,
    sessionCompleted: false
  };
}

// Ensure physicalData has expected shape (self-heal legacy data)
function ensurePhysicalStructure(){
  try {
    if (!physicalData || typeof physicalData !== 'object') {
      physicalData = getDefaultPhysicalData();
      return;
    }
    if (!physicalData.currentProgram || typeof physicalData.currentProgram !== 'object') {
      physicalData.currentProgram = { split: ['D1','D2','D3','D4'], dayIndex: 0, week: 1, mesoPhase: 1 };
    }
    const cp = physicalData.currentProgram;
    if (!Array.isArray(cp.split) || cp.split.length !== 4) cp.split = ['D1','D2','D3','D4'];
    if (typeof cp.dayIndex !== 'number' || isNaN(cp.dayIndex)) cp.dayIndex = 0;
    cp.dayIndex = (Number(cp.dayIndex)||0) % 4;
    if (!Array.isArray(physicalData.workoutHistory)) physicalData.workoutHistory = [];
    if (!physicalData.personalRecords || typeof physicalData.personalRecords !== 'object') physicalData.personalRecords = {};
    if (typeof physicalData.sessionCompleted !== 'boolean') physicalData.sessionCompleted = false;
  } catch(_) {}
}

// Best-effort JSON parser to handle model responses with minor formatting issues
function parseJsonLoosely(text) {
  try { return JSON.parse(text); } catch (_) {}
  try {
    let t = String(text);
    // Strip code fences if present
    t = t.replace(/^```[a-zA-Z]*\n?/m, '').replace(/```$/m, '');
    // Take substring from first { to last }
    const first = t.indexOf('{');
    const last = t.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) t = t.slice(first, last + 1);
    // Remove comments and trailing commas
    t = t.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
    t = t.replace(/,\s*([}\]])/g, '$1');
    // Convert single-quoted strings to double-quoted
    t = t.replace(/'([^'\\]|\\.)*'/g, (m) => '"' + m.slice(1, -1).replace(/"/g, '\\"') + '"');
    // Quote unquoted keys
    t = t.replace(/([,{\s])([A-Za-z0-9_]+)\s*:/g, '$1"$2":');
    return JSON.parse(t);
  } catch (e) {
    console.warn('Loose JSON parse failed', e);
    throw e;
  }
}

async function persistPhysical() {
  try {
    const doc = userManager.getData() || {};
    doc.physicalTrainingData = physicalData;
    await userManager.updateUserData({ physicalTrainingData: physicalData });
    await userManager.forceSaveUserData();
  } catch (e) { console.warn('Failed to persist physicalTrainingData', e); }
}

function rotateDayIndex() {
  if (!physicalData || !physicalData.currentProgram) {
    console.warn('currentProgram missing; repairing structure');
    ensurePhysicalStructure();
  }
  const cp = physicalData.currentProgram;
  cp.dayIndex = (Number(cp.dayIndex)||0) % 4;
  cp.dayIndex = (cp.dayIndex + 1) % 4;
  console.log(`🔄 Rotated to Day ${cp.dayIndex}: ${getDayName(cp.dayIndex)}`);
}

function getDayName(dayIndex) {
  const dayNames = ['Chest/Back/Upper Trapeze','Legs and Core','Arms and Shoulders','Rest Day - Recovery'];
  return dayNames[dayIndex] || dayNames[0];
}

async function ensureTodaySession() {
  const todayStr = new Date().toISOString().split('T')[0]; // Use same format as main system
  if (physicalData.lastSessionDate !== todayStr || !physicalData.todaySession) {
    console.log('🔄 New day detected, generating new physical training session');
    // Guard structure before operations
    ensurePhysicalStructure();
    
    // Only rotate day index if this is NOT a new user (has previous session data)
    if (physicalData.lastSessionDate !== null) {
      console.log('🔄 Existing user - rotating to next day');
      rotateDayIndex();
    } else {
      console.log('🆕 New user - starting with Day 0 (Chest/Back/Traps)');
    }
    
    const session = await generateAISession();
    if (!session) {
      // Keep lastSessionDate unchanged and todaySession null; show retry UI
      console.warn('❌ AI session not generated. Will keep loader and allow retry.');
      return;
    }
    physicalData.todaySession = session;
    physicalData.lastSessionDate = todayStr;
    physicalData.sessionTotal = (physicalData.todaySession?.exercises || []).length || 0;
    physicalData.sessionCompleted = false;
    await persistPhysical();
  }
}

async function generateAISession() {
  try {
    // Ensure structure before reading program
    ensurePhysicalStructure();
    const GEMINI_API_KEY = 'AIzaSyAtL-nZJQ_rBdK72qvn5ocgbf6bgUPlgNo';
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';
    const dayNames = ['Chest/Back/Upper Trapeze','Legs and Core','Arms and Shoulders','Rest Day - Recovery'];
    const cp = physicalData.currentProgram;
    const dayIndex = cp.dayIndex;
    const sessionName = dayNames[dayIndex] || dayNames[0];
    const minRules = dayIndex === 0 ? 'Chest: >=3, Back: >=3, Upper Traps: >=1' : (dayIndex === 1 ? 'Legs: >=3, Core: >=2' : (dayIndex === 2 ? 'Shoulders: >=3, Arms (Biceps/Triceps): each >=2, Forearms: >=1' : 'Recovery activities: >=3, focus on gentle movements, breathing, meditation, light stretching, walking, or mobility work. All activities should be low intensity (RPE 1-3) and promote healing and restoration.'));
    // Get AI-analyzed player preferences for personalized generation
    const preferences = currentUserData.architectPreferences || {};
    
    // Build AI preference context from all analyzed feedback
    let preferenceContext = '';
    const allContexts = Object.keys(preferences);
    
    if (allContexts.length > 0) {
      preferenceContext += '\nPlayer Preferences (AI-analyzed from feedback):';
      
      allContexts.forEach(context => {
        const contextPrefs = preferences[context] || [];
        if (contextPrefs.length > 0) {
          const recentPrefs = contextPrefs.slice(-2); // Last 2 preferences per context
          const prefSummary = recentPrefs.map(p => {
            const prefs = p.preferences || [];
            const insights = p.insights || [];
            return prefs.map(pr => `${pr.type}: ${pr.reason}`).concat(
              insights.map(i => `insight: ${i.description}`)
            ).join(', ');
          }).join('; ');
          
          if (prefSummary) {
            preferenceContext += `\n- ${context}: ${prefSummary}`;
          }
        }
      });
    }

    const prompt = `Create a smart ${dayIndex === 3 ? 'recovery and rest' : 'gym'} session for today based on this split day: ${sessionName}. Equipment available: barbell, dumbbells, machines, bodyweight. ${dayIndex === 3 ? 'Focus on gentle recovery activities that promote healing, mental restoration, and passive benefits. All activities should be low intensity (RPE 1-3).' : 'Respect minimum exercise counts per muscle group:'} ${minRules}. For each exercise include rewards and costs.${preferenceContext} Return JSON:
{
  "date": "YYYY-MM-DD",
  "sessionType": "D${dayIndex+1}",
  "name": "${sessionName}",
  "exercises": [
    {
      "name": "...",
      "muscleGroup": "${dayIndex === 3 ? 'Recovery|Mobility|Breathing|Meditation|Stretching|Walking' : 'Chest|Back|Shoulders|Legs|Biceps|Triceps|Core|Upper Traps'}",
      "equipment": "barbell|dumbbells|machines|bodyweight",
      "targetScheme": { "sets": ${dayIndex === 3 ? '1' : '3'}, "repsLow": ${dayIndex === 3 ? '10' : '6'}, "repsHigh": ${dayIndex === 3 ? '20' : '10'}, "rpeTarget": ${dayIndex === 3 ? '2' : '8'} },
      "rewards": { "xp": ${dayIndex === 3 ? '15' : '20'}, "attributes": { ${dayIndex === 3 ? '"VIT": 1, "PER": 1' : '"STR": 1, "AGI": 1'} } },
      "costs": { "stm": ${dayIndex === 3 ? '2' : '-5'}, "fatigue": ${dayIndex === 3 ? '-5' : '6'} }
    }
  ]
}
${dayIndex === 3 ? 'Focus on gentle, restorative activities that promote healing and mental well-being. Keep names descriptive and calming.' : 'Ensure exercises meet the minimum counts for each involved muscle group and keep names standard and professional.'}`;

    const payload = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } };
    const resp = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!resp.ok) {
      throw new Error(`Gemini API error: ${resp.status} ${resp.statusText}`);
    }
    const json = await resp.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || typeof text !== 'string') {
      throw new Error('Gemini API returned empty content');
    }
    const data = parseJsonLoosely(text);
    // sanitize
    let exercises = (data.exercises||[]).map(e => {
      // Determine rewards based on day and muscle group
      let defaultRewards;
      if (dayIndex === 3) {
        // Rest day - focus on VIT and PER
        defaultRewards = {xp:15, attributes:{VIT:1, PER:1}};
      } else {
        // Workout days - vary by muscle group
        const muscleGroup = (e.muscleGroup || '').toLowerCase();
        if (muscleGroup.includes('chest') || muscleGroup.includes('back') || muscleGroup.includes('shoulder')) {
          defaultRewards = {xp:20, attributes:{STR:1, AGI:1}}; // Upper body strength + agility
        } else if (muscleGroup.includes('leg') || muscleGroup.includes('core')) {
          defaultRewards = {xp:20, attributes:{STR:1, VIT:1}}; // Lower body strength + vitality
        } else if (muscleGroup.includes('bicep') || muscleGroup.includes('tricep')) {
          defaultRewards = {xp:18, attributes:{STR:1, AGI:1}}; // Arm strength + agility
        } else {
          defaultRewards = {xp:20, attributes:{STR:1, AGI:1}}; // Default physical
        }
      }
      
      return {
        id: slugify(e.name), 
        name: e.name, 
        muscleGroup: e.muscleGroup, 
        equipment: e.equipment, 
        targetScheme: e.targetScheme, 
        rewards: e.rewards || defaultRewards, 
        costs: e.costs || (dayIndex === 3 ? {stm:2,fatigue:-5} : {stm:-5,fatigue:6}), 
        sets: [], 
        completed: false 
      };
    });
    
    console.log('🤖 AI Generated exercises:', exercises.map(e => `${e.name} (${e.muscleGroup})`));
    const session = {
      date: Date.now(),
      sessionType: data.sessionType || `D${dayIndex+1}`,
      name: data.name || sessionName,
      exercises
    };
    
    console.log('🏋️ Final exercise list:', exercises.map(e => `${e.name} (${e.muscleGroup})`));
    return session;
  } catch (e) {
    console.warn('AI session generation failed:', e);
    return null;
  }
}

function slugify(s){return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');}

// ===== REST TIMER SYSTEM =====

// Calculate actual rest time taken
function calculateActualRestTime(exercise, setIndex) {
  const set = exercise.sets[setIndex];
  if (!set || !set.restTimerData) return 0;
  
  const plannedTime = set.restTimerData.plannedRestTime;
  const actualTime = set.restTimerData.actualRestTime;
  const wasSkipped = set.restTimerData.wasSkipped;
  const wasExtended = set.restTimerData.wasExtended;
  const extensions = set.restTimerData.extensions;
  
  return {
    planned: plannedTime,
    actual: actualTime,
    wasSkipped: wasSkipped,
    wasExtended: wasExtended,
    extensions: extensions,
    efficiency: wasSkipped ? 0 : (actualTime / plannedTime) * 100
  };
}

// Start rest timer after completing a set
function startRestTimer(exercise, setIndex) {
  // Clear any existing timer
  clearRestTimer();
  
  currentExercise = exercise;
  currentSetIndex = setIndex;
  restTimerStartTime = Date.now();
  restTimerExtensions = 0;
  restTimerWasSkipped = false;
  
  // Calculate rest time based on exercise type and RPE
  const lastSet = exercise.sets[setIndex - 1];
  const rpe = lastSet?.rpe || 8;
  const muscleGroup = exercise.muscleGroup?.toLowerCase() || '';
  
  // Base rest time calculation
  let baseRestTime = 90; // Default 90 seconds
  
  // Adjust based on muscle group
  if (muscleGroup.includes('chest') || muscleGroup.includes('back') || muscleGroup.includes('legs')) {
    baseRestTime = 120; // 2 minutes for big muscle groups
  } else if (muscleGroup.includes('shoulder') || muscleGroup.includes('arm')) {
    baseRestTime = 90; // 1.5 minutes for smaller muscle groups
  } else if (muscleGroup.includes('core')) {
    baseRestTime = 60; // 1 minute for core
  }
  
  // Adjust based on RPE (higher RPE = longer rest)
  if (rpe >= 9) {
    baseRestTime += 30; // Add 30 seconds for high RPE
  } else if (rpe >= 8) {
    baseRestTime += 15; // Add 15 seconds for medium-high RPE
  }
  
  currentRestTime = baseRestTime;
  
  // Store planned rest time in the set
  if (lastSet) {
    lastSet.plannedRestTime = baseRestTime;
  }
  
  console.log(`⏱️ Starting rest timer: ${currentRestTime}s for ${exercise.name} (RPE: ${rpe})`);
  
  // Show rest timer in modal
  showRestTimerInModal();
  
  // Start countdown
  restTimerInterval = setInterval(() => {
    currentRestTime--;
    updateRestTimerDisplay();
    
    if (currentRestTime <= 0) {
      completeRestTimer();
    }
  }, 1000);
}

// Clear rest timer
function clearRestTimer() {
  if (restTimerInterval) {
    clearInterval(restTimerInterval);
    restTimerInterval = null;
  }
  currentRestTime = 0;
  currentExercise = null;
  currentSetIndex = 0;
  restTimerStartTime = 0;
  restTimerExtensions = 0;
  restTimerWasSkipped = false;
  hideRestTimerInModal();
}

// Update modal UI to show finish button when exercise is completed
function updateModalUI() {
  const modal = document.querySelector('.pt-modal');
  if (!modal) return;
  
  const exId = modal.getAttribute('data-ex-id');
  if (!exId) return;
  
  const ex = physicalData.todaySession?.exercises.find(e => e.id === exId);
  if (!ex) return;
  
  // Only update the finish button visibility, don't recreate the entire actions section
  const finishBtn = modal.querySelector('#pt-finish');
  if (finishBtn) {
    if (ex.completed) {
      finishBtn.style.display = 'block';
    } else {
      finishBtn.style.display = 'none';
    }
  } else if (ex.completed) {
    // Add finish button if it doesn't exist and exercise is completed
    const actionsEl = modal.querySelector('.pt-actions');
    if (actionsEl) {
      const addBtn = actionsEl.querySelector('#pt-add');
      if (addBtn) {
        const finishBtn = document.createElement('button');
        finishBtn.id = 'pt-finish';
        finishBtn.className = 'pt-btn finish-btn';
        finishBtn.textContent = 'Finish Exercise';
        finishBtn.addEventListener('click', async () => {
          document.body.removeChild(modal.closest('.pt-modal-overlay'));
          renderAISessionExercises();
        });
        addBtn.parentNode.insertBefore(finishBtn, addBtn.nextSibling);
      }
    }
  }
}

// Skip rest timer
function skipRestTimer() {
  if (currentExercise && currentSetIndex > 0) {
    const setIndex = currentSetIndex - 1;
    const set = currentExercise.sets[setIndex];
    if (set) {
      const actualRestTime = Math.max(0, Math.floor((Date.now() - restTimerStartTime) / 1000));
      set.actualRestTime = actualRestTime;
      set.restTimerData = {
        plannedRestTime: set.plannedRestTime || 0,
        actualRestTime: actualRestTime,
        wasSkipped: true,
        wasExtended: restTimerExtensions > 0,
        extensions: restTimerExtensions,
        timestamp: Date.now()
      };
      
      console.log(`⏭️ Rest skipped: Planned ${set.restTimerData.plannedRestTime}s, Actual ${actualRestTime}s`);
    }
  }
  
  restTimerWasSkipped = true;
  completeRestTimer();
  updateModalUI();
}

// Extend rest timer
function extendRestTimer() {
  currentRestTime += 30;
  restTimerExtensions++;
  updateRestTimerDisplay();
  console.log(`⏱️ Rest extended by 30s (${restTimerExtensions} extensions)`);
}

// Show rest timer in the modal
function showRestTimerInModal() {
  const modal = document.querySelector('.pt-modal');
  if (!modal) return;
  
  let timerEl = modal.querySelector('.rest-timer');
  if (!timerEl) {
    timerEl = document.createElement('div');
    timerEl.className = 'rest-timer';
    timerEl.innerHTML = `
      <div class="rest-timer-content">
        <div class="rest-timer-header">
          <i class="fas fa-clock"></i>
          <span>Rest Timer</span>
          <button class="rest-timer-close">×</button>
        </div>
        <div class="rest-timer-body">
          <div class="rest-timer-display">
            <span class="rest-time">${currentRestTime}</span>
            <span class="rest-unit">seconds</span>
          </div>
          <div class="rest-timer-progress">
            <div class="rest-timer-bar"></div>
          </div>
          <div class="rest-timer-actions">
            <button class="rest-timer-skip">Skip Rest</button>
            <button class="rest-timer-extend">+30s</button>
          </div>
        </div>
      </div>
    `;
    
    // Add timer styles
    const style = document.createElement('style');
    style.textContent = `
      .rest-timer {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1a1a2e, #16213e);
        border: 2px solid #8b5cf6;
        border-radius: 12px;
        padding: 20px;
        z-index: 10001;
        min-width: 300px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8);
        animation: timerSlideIn 0.3s ease;
      }
      .rest-timer-content {
        text-align: center;
        color: #fff;
      }
      .rest-timer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid rgba(139, 92, 246, 0.3);
      }
      .rest-timer-header i {
        color: #8b5cf6;
        margin-right: 8px;
      }
      .rest-timer-close {
        background: none;
        border: none;
        color: #fff;
        font-size: 18px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: background 0.3s ease;
      }
      .rest-timer-close:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      .rest-timer-display {
        margin-bottom: 16px;
      }
      .rest-time {
        font-size: 3rem;
        font-weight: bold;
        color: #8b5cf6;
        text-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
      }
      .rest-unit {
        font-size: 1rem;
        color: #e5e7eb;
        margin-left: 8px;
      }
      .rest-timer-progress {
        width: 100%;
        height: 8px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 16px;
      }
      .rest-timer-bar {
        height: 100%;
        background: linear-gradient(90deg, #8b5cf6, #a855f7);
        border-radius: 4px;
        transition: width 1s linear;
        width: 100%;
      }
      .rest-timer-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
      }
      .rest-timer-actions button {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: #fff;
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 600;
        transition: all 0.3s ease;
      }
      .rest-timer-actions button:hover {
        background: linear-gradient(135deg, #5b5cf0, #7c3aed);
        transform: translateY(-1px);
      }
      @keyframes timerSlideIn {
        from { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
        to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      }
    `;
    
    if (!document.querySelector('#rest-timer-styles')) {
      style.id = 'rest-timer-styles';
      document.head.appendChild(style);
    }
    
    modal.appendChild(timerEl);
  }
  
  // Add event listeners
  timerEl.querySelector('.rest-timer-close').addEventListener('click', clearRestTimer);
  timerEl.querySelector('.rest-timer-skip').addEventListener('click', skipRestTimer);
  timerEl.querySelector('.rest-timer-extend').addEventListener('click', extendRestTimer);
  
  updateRestTimerDisplay();
}

// Update rest timer display
function updateRestTimerDisplay() {
  const timerEl = document.querySelector('.rest-timer');
  if (!timerEl) return;
  
  const timeEl = timerEl.querySelector('.rest-time');
  const barEl = timerEl.querySelector('.rest-timer-bar');
  
  if (timeEl) {
    timeEl.textContent = currentRestTime;
  }
  
  if (barEl && currentExercise) {
    // Calculate the total rest time based on the exercise and RPE
    const lastSet = currentExercise.sets[currentSetIndex - 1];
    const rpe = lastSet?.rpe || 8;
    const muscleGroup = currentExercise.muscleGroup?.toLowerCase() || '';
    
    let totalTime = 90; // Default
    if (muscleGroup.includes('chest') || muscleGroup.includes('back') || muscleGroup.includes('legs')) {
      totalTime = 120;
    } else if (muscleGroup.includes('shoulder') || muscleGroup.includes('arm')) {
      totalTime = 90;
    } else if (muscleGroup.includes('core')) {
      totalTime = 60;
    }
    
    if (rpe >= 9) totalTime += 30;
    else if (rpe >= 8) totalTime += 15;
    
    const progress = (currentRestTime / totalTime) * 100;
    barEl.style.width = `${Math.max(0, progress)}%`;
  }
}

// Hide rest timer
function hideRestTimerInModal() {
  const timerEl = document.querySelector('.rest-timer');
  if (timerEl) {
    timerEl.remove();
  }
}

// Add event listeners for set buttons
function addSetEventListeners(rowsEl, ex) {
  // Delete button listeners
  rowsEl.querySelectorAll('.pt-del').forEach(b=>b.addEventListener('click',e=>{ 
    const i=Number(e.currentTarget.closest('.pt-row').getAttribute('data-idx')); 
    ex.sets.splice(i,1); 
    // Re-render the modal
    const modal = document.querySelector('.pt-modal');
    if (modal) {
      const rowsEl = modal.querySelector('#pt-rows');
      if (rowsEl) {
        rowsEl.innerHTML = ex.sets.map((s,i)=>`
          <div class="pt-row" data-idx="${i}">
            <div>Set ${i+1}</div>
            <input class="pt-input pt-w" type="number" placeholder="kg" value="${Number(s.weight??'')}">
            <input class="pt-input pt-r" type="number" placeholder="reps" value="${Number(s.reps??'')}">
            <input class="pt-input pt-e" step="0.5" type="number" placeholder="RPE" value="${Number(s.rpe??'')}">
            ${s.completed ? '<button class="pt-completed-set"><i class="fas fa-check"></i> Completed</button>' : '<button class="pt-complete-set" data-set="' + i + '">Complete Set</button>'}
            <button class="pt-del">✕</button>
          </div>`).join('') || '<div class="pt-chip">No sets yet.</div>';
        addSetEventListeners(rowsEl, ex);
      }
    }
  }));
  
  // Complete set button listeners
  rowsEl.querySelectorAll('.pt-complete-set').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const setIndex = Number(e.currentTarget.getAttribute('data-set'));
      const row = e.currentTarget.closest('.pt-row');
      
      // Get set data
      const weight = Number(row.querySelector('.pt-w').value) || 0;
      const reps = Number(row.querySelector('.pt-r').value) || 0;
      const rpe = Number(row.querySelector('.pt-e').value) || 8;
      
      if (reps === 0) {
        showNotification('Please enter reps for this set', 'error');
        return;
      }
      
      // Update the set data and mark as completed
      ex.sets[setIndex] = { weight, reps, rpe, restTime: 0, completed: true };
      
      // Start rest timer for ALL sets (unlimited sets allowed)
      startRestTimer(ex, setIndex + 1);
      
      // Check if exercise meets minimum completion requirement (3 sets)
      if (ex.sets.length >= 3 && !ex.completed) {
        ex.completed = true;
        await applyExerciseRewards(ex);
        await triggerArchitectAnalysis(ex);
        await persistPhysical();
        // Don't close modal - let player continue with more sets
        showNotification('🎉 Exercise minimum completed! You can continue with more sets or close when ready.', 'success');
        
        // Update the modal to show the finish button
        const modal = document.querySelector('.pt-modal');
        if (modal) {
          const actionsEl = modal.querySelector('.pt-actions');
          if (actionsEl) {
            const newActionsHTML = `<div class="pt-actions">
              <button id="pt-add" class="pt-btn">Add Set</button>
              <button id="pt-finish" class="pt-btn finish-btn">Finish Exercise</button>
              <button id="pt-save" class="pt-btn">Save</button>
            </div>`;
            actionsEl.outerHTML = newActionsHTML;
            
            // Re-add event listeners
            const newAddBtn = modal.querySelector('#pt-add');
            if (newAddBtn) {
              newAddBtn.addEventListener('click', () => {
                const last = ex.sets?.[ex.sets.length-1] || {weight: 0, reps: ex.targetScheme.repsLow, rpe: ex.targetScheme.rpeTarget, restTime: 0};
                ex.sets = ex.sets || [];
                ex.sets.push({weight: last.weight, reps: last.reps, rpe: last.rpe, restTime: 0});
                // Re-render the modal content
                const rowsEl = modal.querySelector('#pt-rows');
                if (rowsEl) {
                  rowsEl.innerHTML = ex.sets.map((s,i)=>`
                    <div class="pt-row" data-idx="${i}">
                      <div>Set ${i+1}</div>
                      <input class="pt-input pt-w" type="number" placeholder="kg" value="${Number(s.weight??'')}">
                      <input class="pt-input pt-r" type="number" placeholder="reps" value="${Number(s.reps??'')}">
                      <input class="pt-input pt-e" step="0.5" type="number" placeholder="RPE" value="${Number(s.rpe??'')}">
                      ${s.completed ? '<button class="pt-completed-set"><i class="fas fa-check"></i> Completed</button>' : '<button class="pt-complete-set" data-set="' + i + '">Complete Set</button>'}
                      <button class="pt-del">✕</button>
                    </div>`).join('') || '<div class="pt-chip">No sets yet.</div>';
                  addSetEventListeners(rowsEl, ex);
                }
              });
            }
            
            const newFinishBtn = modal.querySelector('#pt-finish');
            if (newFinishBtn) {
              newFinishBtn.addEventListener('click', async () => {
                document.body.removeChild(modal.closest('.pt-modal-overlay'));
                renderAISessionExercises();
              });
            }
            
            const newSaveBtn = modal.querySelector('#pt-save');
            if (newSaveBtn) {
              newSaveBtn.addEventListener('click', async () => {
                if (ex.sets && ex.sets.length > 0) {
                  document.body.removeChild(modal.closest('.pt-modal-overlay'));
                  renderAISessionExercises();
                } else {
                  showNotification('Please complete at least one set', 'error');
                }
              });
            }
          }
        }
      }
      
      // Re-render to show updated data
      const modal = document.querySelector('.pt-modal');
      if (modal) {
        const rowsEl = modal.querySelector('#pt-rows');
        if (rowsEl) {
          rowsEl.innerHTML = ex.sets.map((s,i)=>`
            <div class="pt-row" data-idx="${i}">
              <div>Set ${i+1}</div>
              <input class="pt-input pt-w" type="number" placeholder="kg" value="${Number(s.weight??'')}">
              <input class="pt-input pt-r" type="number" placeholder="reps" value="${Number(s.reps??'')}">
              <input class="pt-input pt-e" step="0.5" type="number" placeholder="RPE" value="${Number(s.rpe??'')}">
              ${s.completed ? '<button class="pt-completed-set"><i class="fas fa-check"></i> Completed</button>' : '<button class="pt-complete-set" data-set="' + i + '">Complete Set</button>'}
              <button class="pt-del">✕</button>
            </div>`).join('') || '<div class="pt-chip">No sets yet.</div>';
          addSetEventListeners(rowsEl, ex);
        }
      }
    });
  });
}

// Complete rest timer and move to next set
function completeRestTimer() {
  console.log('⏱️ Rest timer completed! Ready for next set.');
  
  // Store rest timer data for Architect analysis
  if (currentExercise && currentSetIndex > 0) {
    const setIndex = currentSetIndex - 1;
    const set = currentExercise.sets[setIndex];
    if (set) {
      // Calculate actual rest time taken
      const actualRestTime = Math.max(0, Math.floor((Date.now() - restTimerStartTime) / 1000));
      set.actualRestTime = actualRestTime;
      set.restTimerData = {
        plannedRestTime: set.plannedRestTime || 0,
        actualRestTime: actualRestTime,
        wasSkipped: restTimerWasSkipped,
        wasExtended: restTimerExtensions > 0,
        extensions: restTimerExtensions,
        timestamp: Date.now()
      };
      
      console.log(`📊 Rest data stored: Planned ${set.restTimerData.plannedRestTime}s, Actual ${actualRestTime}s, Skipped: ${restTimerWasSkipped}, Extensions: ${restTimerExtensions}`);
    }
  }
  
  clearRestTimer();
  
  // Show notification
  showNotification('⏱️ Rest complete! Ready for next set.', 'success');
  
  // Auto-add next set for ALL sets (unlimited)
  if (currentExercise) {
    const modal = document.querySelector('.pt-modal');
    if (modal) {
      const addBtn = modal.querySelector('#pt-add');
      if (addBtn) {
        addBtn.click(); // Automatically add next set
      }
    }
  }
  
  // Update modal UI to show finish button if exercise is completed
  updateModalUI();
  
  // Re-render to update button states
  const modal = document.querySelector('.pt-modal');
  if (modal) {
    const rowsEl = modal.querySelector('#pt-rows');
    if (rowsEl) {
      // Re-render the exercise rows to update button states
      const ex = currentExercise;
      if (ex) {
        rowsEl.innerHTML = ex.sets.map((s,i)=>`
          <div class="pt-row" data-idx="${i}">
            <div>Set ${i+1}</div>
            <input class="pt-input pt-w" type="number" placeholder="kg" value="${Number(s.weight??'')}">
            <input class="pt-input pt-r" type="number" placeholder="reps" value="${Number(s.reps??'')}">
            <input class="pt-input pt-e" step="0.5" type="number" placeholder="RPE" value="${Number(s.rpe??'')}">
            ${s.completed ? '<button class="pt-completed-set"><i class="fas fa-check"></i> Completed</button>' : '<button class="pt-complete-set" data-set="' + i + '">Complete Set</button>'}
            <button class="pt-del">✕</button>
          </div>`).join('') || '<div class="pt-chip">No sets yet.</div>';
        
        // Re-add event listeners
        addSetEventListeners(rowsEl, ex);
      }
    }
  }
}

function injectPtModalStyles(){
  if(ptModalStyleInjected) return; ptModalStyleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .pt-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);backdrop-filter:blur(4px);z-index:10000;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s ease}
    .pt-modal{width:95%;max-width:700px;background:#0b0f1a;border:2px solid rgba(255,255,255,.2);border-radius:8px;color:#fff;box-shadow:0 20px 40px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.1);overflow:hidden;position:relative;z-index:1001}
    .pt-header{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;background:linear-gradient(135deg,rgba(139,92,246,.3),rgba(168,85,247,.25));border-bottom:1px solid rgba(255,255,255,.1)}
    .pt-title{font-weight:700;font-size:1.3rem;text-shadow:0 0 8px rgba(255,255,255,.3)}
    .pt-close{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:6px;color:#fff;font-size:18px;cursor:pointer;width:32px;height:32px;display:flex;align-items:center;justify-content:center;transition:all 0.3s ease}
    .pt-close:hover{background:rgba(255,255,255,.2);transform:scale(1.1)}
    .pt-body{padding:24px}
    .pt-row{display:grid;grid-template-columns:1fr 100px 100px 100px 120px 40px;gap:12px;align-items:center;margin-bottom:12px;padding:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:8px}
    .pt-row-readonly{grid-template-columns:1fr 100px 100px 100px 100px;gap:12px;align-items:center;margin-bottom:12px;padding:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px}
    .pt-value{color:#fff;font-weight:600;text-align:center;font-size:1rem}
    .pt-chip{opacity:.9;font-size:1rem;margin-bottom:16px;padding:8px 12px;background:rgba(255,255,255,.05);border-radius:6px;border:1px solid rgba(255,255,255,.1)}
    .pt-input{background:rgba(255,255,255,.1);color:#fff;border:2px solid rgba(255,255,255,.2);border-radius:8px;padding:12px;font-size:1rem;font-weight:500;transition:all 0.3s ease}
    .pt-input:focus{background:rgba(255,255,255,.15);border-color:rgba(139,92,246,.5);outline:none;box-shadow:0 0 0 3px rgba(139,92,246,.2)}
    .pt-del{border:none;background:rgba(220,38,38,.8);color:#fff;border-radius:8px;height:40px;width:40px;cursor:pointer;font-size:16px;font-weight:bold;transition:all 0.3s ease}
    .pt-del:hover{background:rgba(220,38,38,1);transform:scale(1.1)}
    .pt-complete-set{background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:0.9rem;font-weight:600;transition:all 0.3s ease;height:40px}
    .pt-complete-set:hover{background:linear-gradient(135deg,#0d9b6b,#047857);transform:translateY(-1px);box-shadow:0 4px 12px rgba(16,185,129,.3)}
    .pt-complete-set:active{transform:translateY(0);box-shadow:0 2px 8px rgba(16,185,129,.3)}
    .pt-completed-set{background:linear-gradient(135deg,#6b7280,#4b5563);color:#fff;border:none;border-radius:8px;padding:8px 12px;cursor:default;font-size:0.9rem;font-weight:600;height:40px;opacity:0.8}
    .pt-completed-set i{margin-right:6px;color:#10b981}
    .pt-actions{display:flex;gap:12px;justify-content:flex-end;padding:20px 24px;border-top:1px solid rgba(255,255,255,.1)}
    .pt-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:8px;padding:12px 20px;cursor:pointer;font-size:1rem;font-weight:600;transition:all 0.3s ease;box-shadow:0 4px 12px rgba(99,102,241,.3)}
    .pt-btn:hover{background:linear-gradient(135deg,#5b5cf0,#7c3aed);transform:translateY(-2px);box-shadow:0 6px 16px rgba(99,102,241,.4)}
    .pt-btn:active{transform:translateY(0);box-shadow:0 2px 8px rgba(99,102,241,.3)}
    .finish-btn{background:linear-gradient(135deg,#10b981,#059669) !important;box-shadow:0 4px 12px rgba(16,185,129,.3) !important}
    .finish-btn:hover{background:linear-gradient(135deg,#0d9b6b,#047857) !important;box-shadow:0 6px 16px rgba(16,185,129,.4) !important}
    .pt-architect-insights{margin-top:16px;padding:16px;background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.2);border-radius:8px}
    .pt-architect-insights.hidden{display:none}
    .pt-architect-header{display:flex;align-items:center;gap:8px;font-weight:700;color:#8b5cf6;margin-bottom:12px;font-size:1.1rem}
    .pt-struggle-warning{display:flex;align-items:center;gap:8px;color:#f59e0b;background:rgba(245,158,11,.1);padding:8px 12px;border-radius:6px;margin-bottom:8px;border:1px solid rgba(245,158,11,.2)}
    .pt-success-message{display:flex;align-items:center;gap:8px;color:#10b981;background:rgba(16,185,129,.1);padding:8px 12px;border-radius:6px;margin-bottom:8px;border:1px solid rgba(16,185,129,.2)}
    .pt-insight{color:#e5e7eb;margin:4px 0;padding-left:12px;font-size:0.9rem}
    .pt-rest-insights{margin-top:12px;padding:12px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.2);border-radius:6px}
    .pt-insight-title{display:flex;align-items:center;gap:8px;font-weight:600;color:#3b82f6;margin-bottom:8px;font-size:1rem}
    .pt-insight.warning{color:#fbbf24;background:rgba(251,191,36,.1);padding:4px 8px;border-radius:4px;margin:4px 0}
    .pt-insight.success{color:#10b981;background:rgba(16,185,129,.1);padding:4px 8px;border-radius:4px;margin:4px 0}
    
    /* Rest Day Styling */
    .rest-day-header{text-align:center;padding:24px;background:linear-gradient(135deg,rgba(59,130,246,.1),rgba(147,51,234,.1));border:2px solid rgba(59,130,246,.2);border-radius:12px;margin-bottom:20px}
    .rest-day-icon{font-size:3rem;margin-bottom:16px;animation:gentle-pulse 2s ease-in-out infinite}
    .rest-day-header h3{color:#3b82f6;font-size:1.5rem;font-weight:700;margin-bottom:8px;text-shadow:0 0 8px rgba(59,130,246,.3)}
    .rest-day-header p{color:#e5e7eb;font-size:1rem;margin-bottom:20px;opacity:0.9}
    .rest-day-benefits{display:flex;justify-content:center;gap:20px;flex-wrap:wrap;margin-top:16px}
    .benefit-item{display:flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.2);border-radius:8px;color:#3b82f6;font-weight:600;font-size:0.9rem}
    .benefit-item i{color:#60a5fa;font-size:1.1rem}
    .rest-day-exercise{background:linear-gradient(135deg,rgba(59,130,246,.05),rgba(147,51,234,.05)) !important;border:1px solid rgba(59,130,246,.2) !important}
    .rest-day-exercise .exercise-name{color:#3b82f6 !important;font-weight:600}
    .rest-day-exercise .log-button{background:linear-gradient(135deg,#3b82f6,#8b5cf6) !important;box-shadow:0 4px 12px rgba(59,130,246,.3) !important}
    .rest-day-exercise .log-button:hover{background:linear-gradient(135deg,#2563eb,#7c3aed) !important;box-shadow:0 6px 16px rgba(59,130,246,.4) !important}
    
    @keyframes gentle-pulse{0%,100%{transform:scale(1);opacity:0.8}50%{transform:scale(1.05);opacity:1}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes slideIn{from{transform:scale(0.9) translateY(-20px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
    .pt-modal{animation:slideIn 0.3s ease}
  `;
  document.head.appendChild(style);
}

function renderAISessionExercises(){
  const goalItemsDiv = document.getElementById('goal-items');
  if (!goalItemsDiv) return;
  const s = physicalData.todaySession;
  if (physicalData.sessionCompleted) {
    // Show completion tick UI
    goalItemsDiv.innerHTML = '<div class="session-completed"><i class="fas fa-trophy"></i> Session completed. Great work!</div>';
    const completeCheckbox = document.getElementById('complete');
    if (completeCheckbox) { completeCheckbox.checked = true; completeCheckbox.disabled = true; const label = completeCheckbox.nextElementSibling; if (label) { label.classList.remove('animate'); void label.offsetWidth; label.classList.add('animate'); } }
    return;
  }
  if (!s){ 
    goalItemsDiv.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i><p>Preparing today\'s session...</p></div>'; 
    return; 
  }
  
  // Check if this is a rest day
  const isRestDay = s.sessionType === 'D4' || s.name.includes('Rest Day');
  
  if (isRestDay) {
    // Special rest day message
    goalItemsDiv.innerHTML = `
      <div class="rest-day-header">
        <div class="rest-day-icon">🛌</div>
        <h3>Rest Day - Recovery</h3>
        <p>Today is your recovery day. Focus on gentle activities that promote healing and restoration.</p>
        <div class="rest-day-benefits">
          <div class="benefit-item">
            <i class="fas fa-heart"></i>
            <span>Passive HP Recovery</span>
          </div>
          <div class="benefit-item">
            <i class="fas fa-brain"></i>
            <span>Mental Restoration</span>
          </div>
          <div class="benefit-item">
            <i class="fas fa-moon"></i>
            <span>Fatigue Reduction</span>
          </div>
        </div>
      </div>
    `;
  }

  let html = '';
  s.exercises.forEach((ex, i)=>{
    const statusIcon = ex.completed ? '<i class="fas fa-check-circle"></i>' : '<i class="far fa-circle"></i>';
    const cardClass = ex.completed ? 'exercise-card completed' : 'exercise-card';
    const buttonText = ex.completed ? '<i class="fas fa-eye"></i> View' : (isRestDay ? '<i class="fas fa-leaf"></i> Practice' : '<i class="fas fa-dumbbell"></i> Log');
    const buttonClass = ex.completed ? 'log-button view-button' : 'log-button';
    
    // Special styling for rest day exercises
    const restDayClass = isRestDay ? ' rest-day-exercise' : '';
    
    html += `
      <div class="${cardClass}${restDayClass}">
        <div class="exercise-info">
          <div class="exercise-number">${i+1}</div>
          <div class="exercise-name">${ex.name}</div>
          <div class="exercise-status">${statusIcon}</div>
        </div>
        <button class="${buttonClass}" data-ex="${ex.id}">${buttonText}</button>
      </div>
    `;
  });
  
  if (!isRestDay) {
    goalItemsDiv.innerHTML = html;
  } else {
    goalItemsDiv.innerHTML += html;
  }
  goalItemsDiv.querySelectorAll('.log-button[data-ex]').forEach(btn=>btn.addEventListener('click',()=>openPtModal(String(btn.getAttribute('data-ex')))));
  // Auto-complete when all exercises completed (minimum 3 sets each for regular days, 1 set for rest day)
  const minSets = isRestDay ? 1 : 3;
  if (s.exercises.length > 0 && s.exercises.every(e => e.completed && e.sets.length >= minSets)) {
    completeAISession();
  }
}

function openPtModal(exId){
  injectPtModalStyles();
  const ex = physicalData.todaySession.exercises.find(e=>e.id===exId); if(!ex) return;
  const isCompleted = ex.completed;
  const overlay = document.createElement('div'); overlay.className='pt-modal-overlay';
  
  // Different modal content for completed vs incomplete exercises
  const actionsHTML = isCompleted 
    ? '<div class="pt-actions"><button id="pt-close-btn" class="pt-btn">Close</button></div>'
    : `<div class="pt-actions">
         <button id="pt-add" class="pt-btn">Add Set</button>
         <button id="pt-finish" class="pt-btn finish-btn" style="display: none;">Finish Exercise</button>
         <button id="pt-save" class="pt-btn">Save</button>
       </div>`;
  
  overlay.innerHTML = `
    <div class="pt-modal" data-ex-id="${ex.id}">
      <div class="pt-header">
        <div class="pt-title">${ex.name} ${isCompleted ? '<i class="fas fa-check-circle" style="color: #00ff00; margin-left: 8px;"></i>' : ''}</div>
        <button class="pt-close">×</button>
      </div>
      <div class="pt-body">
        <div class="pt-chip">Target: ${ex.targetScheme.sets} x ${ex.targetScheme.repsLow}-${ex.targetScheme.repsHigh} • RPE ≤ ${ex.targetScheme.rpeTarget}</div>
        <div id="pt-rows"></div>
        <div id="pt-architect-insights" class="pt-architect-insights hidden"></div>
      </div>
      ${actionsHTML}
    </div>`;
  document.body.appendChild(overlay);
  const rowsEl = overlay.querySelector('#pt-rows');
  const insightsEl = overlay.querySelector('#pt-architect-insights');
  
  const render = ()=>{
    if (isCompleted) {
      // Read-only view for completed exercises
      rowsEl.innerHTML = (ex.sets||[]).map((s,i)=>`
        <div class="pt-row pt-row-readonly" data-idx="${i}">
          <div>Set ${i+1}</div>
          <div class="pt-value">${Number(s.weight||0)} kg</div>
          <div class="pt-value">${Number(s.reps||0)} reps</div>
          <div class="pt-value">RPE ${Number(s.rpe||0)}</div>
          <div class="pt-value">${Number(s.restTime||0)}s rest</div>
        </div>`).join('') || '<div class="pt-chip">No sets logged.</div>';
    } else {
      // Editable view for incomplete exercises
      rowsEl.innerHTML = (ex.sets||[]).map((s,i)=>`
        <div class="pt-row" data-idx="${i}">
          <div>Set ${i+1}</div>
          <input class="pt-input pt-w" type="number" placeholder="kg" value="${Number(s.weight??'')}">
          <input class="pt-input pt-r" type="number" placeholder="reps" value="${Number(s.reps??'')}">
          <input class="pt-input pt-e" step="0.5" type="number" placeholder="RPE" value="${Number(s.rpe??'')}">
          ${s.completed ? '<button class="pt-completed-set"><i class="fas fa-check"></i> Completed</button>' : '<button class="pt-complete-set" data-set="' + i + '">Complete Set</button>'}
          <button class="pt-del">✕</button>
        </div>`).join('') || '<div class="pt-chip">No sets yet.</div>';
      // Use the centralized event listener function
      addSetEventListeners(rowsEl, ex);
      
      // Update the finish button visibility
      const finishBtn = overlay.querySelector('#pt-finish');
      if (finishBtn) {
        if (ex.completed) {
          finishBtn.style.display = 'block';
        } else {
          finishBtn.style.display = 'none';
        }
      }
    }
    
    // Show AI insights for completed exercises
    if (isCompleted && ex.sets && ex.sets.length > 0) {
      showArchitectInsights(ex, insightsEl);
    }
  };
  
  render();
  overlay.querySelector('.pt-close').addEventListener('click',()=>{
    clearRestTimer(); // Clear any active timer
    document.body.removeChild(overlay);
  });
  overlay.addEventListener('click',e=>{ 
    if(e.target===overlay) {
      clearRestTimer(); // Clear any active timer
      document.body.removeChild(overlay);
    }
  });
  
  if (isCompleted) {
    // For completed exercises, just close button
    overlay.querySelector('#pt-close-btn').addEventListener('click',()=>{
      clearRestTimer(); // Clear any active timer
      document.body.removeChild(overlay);
    });
  } else {
    // For incomplete exercises, add and save functionality
    overlay.querySelector('#pt-add').addEventListener('click',()=>{ 
      const last=ex.sets?.[ex.sets.length-1]||{weight:0,reps:ex.targetScheme.repsLow,rpe:ex.targetScheme.rpeTarget,restTime:0}; 
      ex.sets=ex.sets||[]; 
      ex.sets.push({weight:last.weight,reps:last.reps,rpe:last.rpe,restTime:0}); 
      render(); 
    });
    overlay.querySelector('#pt-save').addEventListener('click', async ()=>{
      // This is now handled by individual "Complete Set" buttons
      // Just close the modal if there are sets logged
      if (ex.sets && ex.sets.length > 0) {
        document.body.removeChild(overlay);
        renderAISessionExercises();
      } else {
        showNotification('Please complete at least one set', 'error');
      }
    });
    
    // Add event listener for "Finish Exercise" button
    const finishBtn = overlay.querySelector('#pt-finish');
    if (finishBtn) {
      finishBtn.addEventListener('click', async () => {
        // Close modal and refresh
        document.body.removeChild(overlay);
        renderAISessionExercises();
      });
    }
  }
}

async function completeAISession(){
  const s = physicalData.todaySession; if(!s) return;
  const allLogged = s.exercises.every(ex=>(ex.sets||[]).length>0);
  if(!allLogged){ console.log('Please log at least one set for each exercise.'); return; }
  const session = JSON.parse(JSON.stringify(s));
  session.sessionVolume = session.exercises.reduce((acc, ex)=> acc + (ex.sets||[]).reduce((a,ss)=> a + Number(ss.weight)*Number(ss.reps), 0), 0);
  physicalData.workoutHistory.push(session);
  physicalData.sessionCompleted = true;
  physicalData.sessionTotal = (s.exercises || []).length || physicalData.sessionTotal || 0;
  await persistPhysical();
  await applyAISessionRewards(session);
  renderAISessionExercises();
}

async function applyAISessionRewards(session){
  try {
    const data = userManager.getData(); const game = data.gameData||{};
    const isRestDay = session.sessionType === 'D4' || session.name.includes('Rest Day');
    
    if (isRestDay) {
      // Rest day benefits - recovery focused
      const xp = 30; // Base XP for rest day
      game.exp = (Number(game.exp||0) + xp);
      game.stackedAttributes = game.stackedAttributes || {};
      game.stackedAttributes.VIT = (Number(game.stackedAttributes.VIT||0) + 2); // Extra vitality
      game.stackedAttributes.PER = (Number(game.stackedAttributes.PER||0) + 1); // Enhanced perception
      
      // Recovery benefits
      game.hp = Math.min(100, Number(game.hp||100) + 15); // Passive HP recovery
      game.mp = Math.min(100, Number(game.mp||100) + 10); // Mental restoration
      game.stm = Math.min(100, Number(game.stm||100) + 20); // Stamina recovery
      game.fatigue = Math.max(0, Number(game.fatigue||0) - 15); // Fatigue reduction
      
      userManager.setData('gameData', game);
      await userManager.saveUserData();
      console.log(`🛌 Rest day benefits applied: +${xp} XP, +15 HP, +10 MP, +20 STM, -15 Fatigue`);
    } else {
      // Regular workout rewards
      const volume = Number(session.sessionVolume||0);
      const xp = Math.min(300, Math.round(volume/50));
      game.exp = (Number(game.exp||0) + xp);
      game.stackedAttributes = game.stackedAttributes || {};
      game.stackedAttributes.STR = (Number(game.stackedAttributes.STR||0) + Math.min(5, Math.round(volume/1500)));
      game.stackedAttributes.VIT = (Number(game.stackedAttributes.VIT||0) + 1);
      game.stm = Math.max(0, Number(game.stm??100) - 10);
      game.fatigue = Math.min(100, Number(game.fatigue||0) + 10);
      userManager.setData('gameData', game);
      await userManager.saveUserData();
      console.log(`🏋️ Workout rewards applied: +${xp} XP`);
    }
  } catch(e){ console.warn('Failed to apply rewards', e); }
}

// ===== THE ARCHITECT'S AI-DRIVEN PHYSICAL TRAINING ANALYSIS =====

// Calculate struggle indicators for an exercise
function calculateStruggleIndicators(exercise) {
  const sets = exercise.sets || [];
  if (sets.length === 0) return { struggleLevel: 'none', indicators: [] };
  
  const indicators = [];
  let struggleScore = 0;
  
  // Analyze RPE patterns
  const avgRPE = sets.reduce((sum, s) => sum + (s.rpe || 0), 0) / sets.length;
  const maxRPE = Math.max(...sets.map(s => s.rpe || 0));
  const targetRPE = exercise.targetScheme?.rpeTarget || 8;
  
  if (avgRPE > targetRPE + 1) {
    indicators.push('high_average_rpe');
    struggleScore += 0.3;
  }
  if (maxRPE >= 10) {
    indicators.push('max_rpe_reached');
    struggleScore += 0.4;
  }
  
  // Analyze rep patterns
  const targetReps = exercise.targetScheme?.repsHigh || 10;
  const failedReps = sets.filter(s => (s.reps || 0) < targetReps).length;
  if (failedReps > sets.length * 0.5) {
    indicators.push('frequent_rep_failure');
    struggleScore += 0.3;
  }
  
  // Analyze rest time patterns (NEW: Using actual rest timer data)
  const restData = analyzeRestTimerData(sets);
  if (restData.excessiveRest) {
    indicators.push('excessive_rest_time');
    struggleScore += 0.2;
  }
  if (restData.frequentSkips) {
    indicators.push('frequent_rest_skips');
    struggleScore += 0.3;
  }
  if (restData.inconsistentRest) {
    indicators.push('inconsistent_rest_patterns');
    struggleScore += 0.2;
  }
  
  // Analyze weight progression
  const weights = sets.map(s => s.weight || 0);
  const weightDecreases = weights.filter((w, i) => i > 0 && w < weights[i-1]).length;
  if (weightDecreases > 0) {
    indicators.push('weight_reduction');
    struggleScore += 0.2;
  }
  
  // Determine struggle level
  let struggleLevel = 'none';
  if (struggleScore >= 0.7) struggleLevel = 'high';
  else if (struggleScore >= 0.4) struggleLevel = 'medium';
  else if (struggleScore >= 0.2) struggleLevel = 'low';
  
  return {
    struggleLevel,
    indicators,
    struggleScore,
    avgRPE,
    maxRPE,
    restData,
    failedReps,
    weightDecreases
  };
}

// Analyze rest timer data for patterns
function analyzeRestTimerData(sets) {
  const restData = {
    excessiveRest: false,
    frequentSkips: false,
    inconsistentRest: false,
    avgRestTime: 0,
    skipRate: 0,
    extensionRate: 0,
    restEfficiency: 0
  };
  
  const setsWithRestData = sets.filter(s => s.restTimerData);
  if (setsWithRestData.length === 0) return restData;
  
  // Calculate averages
  const totalPlanned = setsWithRestData.reduce((sum, s) => sum + (s.restTimerData.plannedRestTime || 0), 0);
  const totalActual = setsWithRestData.reduce((sum, s) => sum + (s.restTimerData.actualRestTime || 0), 0);
  const totalSkips = setsWithRestData.filter(s => s.restTimerData.wasSkipped).length;
  const totalExtensions = setsWithRestData.reduce((sum, s) => sum + (s.restTimerData.extensions || 0), 0);
  
  restData.avgRestTime = totalActual / setsWithRestData.length;
  restData.skipRate = (totalSkips / setsWithRestData.length) * 100;
  restData.extensionRate = (totalExtensions / setsWithRestData.length) * 100;
  restData.restEfficiency = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 100;
  
  // Identify patterns
  restData.excessiveRest = restData.avgRestTime > 180; // More than 3 minutes average
  restData.frequentSkips = restData.skipRate > 50; // More than 50% skips
  restData.inconsistentRest = restData.restEfficiency < 50 || restData.restEfficiency > 150; // Very inconsistent
  
  return restData;
}

// Trigger Architect analysis when exercise is completed
async function triggerArchitectAnalysis(exercise) {
  try {
    const struggleData = calculateStruggleIndicators(exercise);
    const sessionData = physicalData.todaySession;
    const playerData = userManager.getData();
    
    // Store struggle data for Architect analysis
    exercise.architectAnalysis = {
      timestamp: Date.now(),
      struggleData,
      sessionContext: {
        sessionType: sessionData.sessionType,
        totalExercises: sessionData.exercises.length,
        completedExercises: sessionData.exercises.filter(e => e.completed).length
      },
      playerState: {
        level: playerData.gameData?.level || 1,
        fatigue: playerData.gameData?.fatigue || 0,
        stm: playerData.gameData?.stm || 100
      }
    };
    
    // Trigger global Architect analysis
    if (window.globalArchitect) {
      await window.globalArchitect.analyzePhysicalTrainingData(exercise, sessionData, struggleData);
    }
    
    console.log(`🔮 ARCHITECT analyzed exercise: ${exercise.name} - Struggle: ${struggleData.struggleLevel}`);
  } catch (e) {
    console.warn('Failed to trigger Architect analysis:', e);
  }
}

// Show Architect insights in the modal
function showArchitectInsights(exercise, insightsEl) {
  if (!exercise.architectAnalysis) return;
  
  const analysis = exercise.architectAnalysis;
  const struggle = analysis.struggleData;
  
  let insightHTML = '<div class="pt-architect-header"><i class="fas fa-brain"></i> THE ARCHITECT\'S ANALYSIS</div>';
  
  if (struggle.struggleLevel !== 'none') {
    insightHTML += `<div class="pt-struggle-warning">
      <i class="fas fa-exclamation-triangle"></i>
      <strong>Struggle Detected:</strong> ${struggle.struggleLevel.toUpperCase()}
    </div>`;
    
    if (struggle.indicators.includes('high_average_rpe')) {
      insightHTML += '<div class="pt-insight">• RPE too high - consider reducing weight</div>';
    }
    if (struggle.indicators.includes('frequent_rep_failure')) {
      insightHTML += '<div class="pt-insight">• Frequent rep failures - adjust target reps</div>';
    }
    if (struggle.indicators.includes('excessive_rest_time')) {
      insightHTML += '<div class="pt-insight">• Long rest periods - check form and breathing</div>';
    }
    if (struggle.indicators.includes('frequent_rest_skips')) {
      insightHTML += '<div class="pt-insight">• Frequent rest skips - your body needs recovery time</div>';
    }
    if (struggle.indicators.includes('inconsistent_rest_patterns')) {
      insightHTML += '<div class="pt-insight">• Inconsistent rest patterns - establish a routine</div>';
    }
    if (struggle.indicators.includes('weight_reduction')) {
      insightHTML += '<div class="pt-insight">• Weight reduced mid-set - focus on technique</div>';
    }
  } else {
    insightHTML += '<div class="pt-success-message"><i class="fas fa-check-circle"></i> Excellent execution!</div>';
  }
  
  // Add rest timer insights
  if (struggle.restData) {
    const rest = struggle.restData;
    insightHTML += '<div class="pt-rest-insights">';
    insightHTML += '<div class="pt-insight-title"><i class="fas fa-clock"></i> Rest Analysis</div>';
    insightHTML += `<div class="pt-insight">• Average rest: ${Math.round(rest.avgRestTime)}s</div>`;
    insightHTML += `<div class="pt-insight">• Skip rate: ${Math.round(rest.skipRate)}%</div>`;
    insightHTML += `<div class="pt-insight">• Rest efficiency: ${Math.round(rest.restEfficiency)}%</div>`;
    
    if (rest.frequentSkips) {
      insightHTML += '<div class="pt-insight warning">⚠️ You\'re skipping rest too often - recovery is crucial!</div>';
    } else if (rest.excessiveRest) {
      insightHTML += '<div class="pt-insight warning">⚠️ Very long rest periods - consider reducing rest time</div>';
    } else {
      insightHTML += '<div class="pt-insight success">✅ Good rest discipline!</div>';
    }
    insightHTML += '</div>';
  }
  
  insightsEl.innerHTML = insightHTML;
  insightsEl.classList.remove('hidden');
}

async function applyExerciseRewards(ex){
  try {
    const data = userManager.getData(); const game = data.gameData||{};
    const rewards = ex.rewards || { xp: 20, attributes: { STR: 1 } };
    const costs = ex.costs || { stm: -5, fatigue: 6 };
    if (rewards.xp) game.exp = Number(game.exp||0) + Number(rewards.xp||0);
    if (rewards.attributes) {
      game.stackedAttributes = game.stackedAttributes || {};
      Object.entries(rewards.attributes).forEach(([k,v]) => {
        game.stackedAttributes[k] = Number(game.stackedAttributes[k]||0) + Number(v||0);
      });
    }
    if (typeof costs.stm === 'number') game.stm = Math.max(0, Number(game.stm??100) + Number(costs.stm));
    if (typeof costs.fatigue === 'number') game.fatigue = Math.min(100, Number(game.fatigue||0) + Number(costs.fatigue));
    await userManager.updateUserData({ gameData: game });
    await userManager.saveUserData();
    console.log(`Exercise rewards applied for ${ex.name}`);
  } catch(e){ console.warn('Failed to apply exercise rewards', e); }
}

// Load Data Function
function loadData(savedData) {
  if (savedData) {
    // Load saved data into UI
    const levelNumber = document.querySelector(".level-number");
    if (levelNumber) levelNumber.textContent = savedData.level || 1;
    
    const hpFill = document.getElementById("hp-fill");
    if (hpFill) hpFill.style.width = (savedData.hp || 100) + "%";
    
    const mpFill = document.getElementById("mp-fill");
    if (mpFill) mpFill.style.width = (savedData.mp || 100) + "%";
    
    const stmFill = document.getElementById("stm-fill");
    if (stmFill) stmFill.style.width = (savedData.stm || 100) + "%";
    
    const expFill = document.getElementById("exp-fill");
    if (expFill) expFill.style.width = (savedData.exp || 0) + "%";
    
    const fatValue = document.getElementById("Fatvalue");
    if (fatValue) fatValue.textContent = savedData.fatigue || 0;
    
    const jobText = document.getElementById("job-text");
    if (jobText) jobText.textContent = savedData.name || "Your Name";
    
    const pingText = document.getElementById("ping-text");
    if (pingText) pingText.textContent = savedData.ping || "60 ms";
    
    const guildText = document.getElementById("guild-text");
    if (guildText) guildText.textContent = savedData.guild || "Reaper";
    
    const raceText = document.getElementById("race-text");
    if (raceText) raceText.textContent = savedData.race || "Hunter";
    
    const titleText = document.getElementById("title-text");
    if (titleText) titleText.textContent = savedData.title || "None";
    
    const regionText = document.getElementById("region-text");
    if (regionText) regionText.textContent = savedData.region || "TN";
    
    const locationText = document.getElementById("location-text");
    if (locationText) locationText.textContent = savedData.location || "Hospital";
    
    // Load attributes if they exist
    if (savedData.Attributes) {
      const strElement = document.getElementById("str");
      if (strElement) strElement.textContent = `STR: ${savedData.Attributes.STR}`;
      
      const vitElement = document.getElementById("vit");
      if (vitElement) vitElement.textContent = `VIT: ${savedData.Attributes.VIT}`;
      
      const agiElement = document.getElementById("agi");
      if (agiElement) agiElement.textContent = `AGI: ${savedData.Attributes.AGI}`;
      
      const intElement = document.getElementById("int");
      if (intElement) intElement.textContent = `INT: ${savedData.Attributes.INT}`;
      
      const perElement = document.getElementById("per");
      if (perElement) perElement.textContent = `PER: ${savedData.Attributes.PER}`;
      
      const wisElement = document.getElementById("wis");
      if (wisElement) wisElement.textContent = `WIS: ${savedData.Attributes.WIS}`;
    }
  } else {
    resetData();
  }
}

// Reset Data Function
function resetData() {
  const defaultGameData = {
    level: 1,
    hp: 100,
    mp: 100,
    stm: 100,
    exp: 0,
    fatigue: 0,
    name: "Your Name",
    ping: "60",
    guild: "Reaper",
    race: "Hunter",
    title: "None",
    region: "TN",
    location: "Hospital",
    physicalQuests: "[0/4]",
    mentalQuests: "[0/3]",
    spiritualQuests: "[0/2]",
    Attributes: {
      STR: 10,
      VIT: 10,
      AGI: 10,
      INT: 10,
      PER: 10,
      WIS: 10,
    },
    stackedAttributes: {
      STR: 0,
      VIT: 0,
      AGI: 0,
      INT: 0,
      PER: 0,
      WIS: 0,
    },
  };
  
  if (userManager) {
    userManager.setData('gameData', defaultGameData);
  }
  
  loadData(defaultGameData);
}

// Save Data Function
async function saveData() {
  if (!userManager) {
    console.warn('User manager not available');
    return;
  }
  
  try {
    // Get current form data
    const newData = {
      level: parseInt(document.querySelector(".level-number")?.textContent) || 1,
      hp: parseInt(document.getElementById("hp-fill")?.style.width) || 100,
      mp: parseInt(document.getElementById("mp-fill")?.style.width) || 100,
      stm: parseInt(document.getElementById("stm-fill")?.style.width) || 100,
      exp: parseInt(document.getElementById("exp-fill")?.style.width) || 0,
      fatigue: parseInt(document.querySelector(".fatigue-value")?.textContent) || 0,
      name: document.getElementById("job-text")?.textContent || "Your Name",
      ping: document.getElementById("ping-text")?.textContent || "60 ms",
      guild: document.getElementById("guild-text")?.textContent || "Reaper",
      race: document.getElementById("race-text")?.textContent || "Hunter",
      title: document.getElementById("title-text")?.textContent || "None",
      region: document.getElementById("region-text")?.textContent || "TN",
      location: document.getElementById("location-text")?.textContent || "Hospital",
    };

    // Get existing data
    const existingData = userManager.getData();
    const gameData = existingData.gameData || {};

    // Merge existing data with updated data
    const mergedData = { ...gameData, ...newData };

    // Save the merged data via user manager
    if (userManager) {
      userManager.setData('gameData', mergedData);
      
      // Save to database
      const result = await userManager.saveUserData();
      if (result.success) {
        console.log('Data saved successfully');
      } else {
        console.error('Error saving data:', result.error);
      }
    }
  } catch (error) {
    console.error('Error saving data:', error);
  }
}

// Define the physical tasks that are the same every day
// Legacy static tasks kept for fallback only; not used when AI session exists
const physicalTasks = [];

// Function to render physical tasks
function renderPhysicalTasks() { renderAISessionExercises(); }

// Function to toggle the completion state of a physical task
async function completePhysicalTask(taskName) {
    const task = physicalTasks.find(t => t.name === taskName);
    if (task && !task.completed) {
        // Call the fixed quest completion function
        await completePhysicalQuest(taskName);
    } else if (task && task.completed) {
        // Uncomplete the task (for debugging/testing)
        task.completed = false;
        console.log(`Task ${taskName} uncompleted`);
        renderPhysicalTasks();
        updateCompleteCheckbox();
    }
}

// Modified updateCompleteCheckbox function
function updateCompleteCheckbox() {
    const allCompleted = physicalTasks.every(task => task.completed);
    const completeCheckbox = document.getElementById("complete");

    if (completeCheckbox) {
        // Also honor persisted completion from saved data
        let alreadyCompleted = false;
        try {
            if (window.userManager) {
                const gd = userManager.getData()?.gameData || {};
                alreadyCompleted = gd.physicalQuests === "[4/4]";
            }
        } catch (_) {}

        // Always non-interactive; we control it programmatically
        completeCheckbox.disabled = true;
        completeCheckbox.checked = allCompleted || alreadyCompleted;
        const label = completeCheckbox?.nextElementSibling;
        if (completeCheckbox.disabled && label) {
            label.style.opacity = '0.6';
            label.title = 'Already completed today';
        } else if (label) {
            label.style.opacity = '';
            label.removeAttribute('title');
        }

        // If all tasks are completed, trigger completion
        if (allCompleted && !alreadyCompleted) {
            console.log('All physical tasks completed!');
            
            // Costs and final progress will be applied on the Rewards page load
            
            // Trigger completion animation and redirect
            const label = completeCheckbox.nextElementSibling;
            if (label) {
                label.classList.remove('animate'); // Remove class if it exists
                void label.offsetWidth; // Trigger reflow to reset the animation
                label.classList.add('animate'); // Add class to trigger animation
            }
            
            // Redirect to reward page after animation
            setTimeout(function() {
                window.location.href = 'Quest_Rewards.html?data=physical';
            }, 1000);

            // After completion, lock all task checkboxes
            disableAllPhysicalTaskCheckboxes();
        }
    }
}

// Disable all task checkboxes (make them untickable after completion)
function disableAllPhysicalTaskCheckboxes() {
    try {
        const goalItemsDiv = document.getElementById("goal-items");
        if (!goalItemsDiv) return;
        const inputs = goalItemsDiv.querySelectorAll('input[type="checkbox"]');
        inputs.forEach(input => { input.disabled = true; });
    } catch (_) {}
}

// Update physical quest progress in user data (FULL QUEST COMPLETION)
async function updatePhysicalQuestProgress() {
    if (!userManager) {
        console.warn('User manager not available');
        return;
    }
    
    try {
        // Get current user data
        const userData = userManager.getData();
        const gameData = userData.gameData || {};
        
        // Check if physical quests are already completed to prevent double execution
        if (gameData.physicalQuests === "[4/4]") {
            console.log('⚠️ Physical quests already completed, skipping...');
            return;
        }
        
        console.log('🎉 ALL PHYSICAL QUESTS COMPLETED! Applying final rewards and costs...');
        
        // Apply costs for completing ALL physical quests
        const currentHP = Math.max(0, parseInt(gameData.hp) || 100);
        gameData.hp = Math.max(0, currentHP - 20);
        console.log(`HP decreased from ${currentHP} to ${gameData.hp}`);
        
        const currentSTM = Math.max(0, parseInt(gameData.stm) || 100);
        gameData.stm = Math.max(0, currentSTM - 20);
        console.log(`STM decreased from ${currentSTM} to ${gameData.stm}`);
        
        const currentFatigue = parseInt(gameData.fatigue) || 0;
        gameData.fatigue = currentFatigue + 20;
        console.log(`Fatigue increased from ${currentFatigue} to ${gameData.fatigue}`);
        
        // Update physical quest progress to completed
        gameData.physicalQuests = "[4/4]";
        
        // Update user data
        userManager.setData('gameData', gameData);
        
        // Save to database
        const result = await userManager.saveUserData();
        if (result.success) {
            console.log('Physical quest completion saved successfully');
            showNotification(`🎉 All Physical Quests Complete! -20 HP, -20 STM, +20 Fatigue`, 'success');
        } else {
            console.error('Error saving physical quest completion:', result.error);
            showNotification('❌ Error saving quest completion', 'error');
        }
        
    } catch (error) {
        console.error('Error updating physical quest progress:', error);
    }
}

// Handle level up when XP reaches 100
async function handleLevelUp(gameData) {
    console.log('🎉 LEVEL UP!');
    
    // Reset XP and increase level
    gameData.exp = gameData.exp - 100;
    gameData.level = parseInt(gameData.level || 1) + 1;
    
    console.log(`Level increased to ${gameData.level}, XP reset to ${gameData.exp}`);
    
    // Apply stacked attributes to base attributes
    if (gameData.stackedAttributes && gameData.Attributes) {
        console.log('Applying stacked attributes to base attributes...');
        
        for (let stat in gameData.stackedAttributes) {
            if (gameData.Attributes[stat] !== undefined) {
                const oldValue = gameData.Attributes[stat];
                gameData.Attributes[stat] += gameData.stackedAttributes[stat];
                console.log(`${stat}: ${oldValue} → ${gameData.Attributes[stat]} (+${gameData.stackedAttributes[stat]})`);
            }
        }
        
        // Reset stacked attributes
        for (let stat in gameData.stackedAttributes) {
            gameData.stackedAttributes[stat] = 0;
        }
        
        console.log('Stacked attributes reset to 0');
    }
    
    // Note: HP, MP, and STM are NOT automatically restored on level up
    // They should only be reset by daily reset system
    console.log('Level up complete - HP/MP/STM values preserved');
}

// Function to complete a quest and gain XP
async function completePhysicalQuest(taskName) {
    const task = physicalTasks.find(t => t.name === taskName);

    if (task && !task.completed) {
        try {
            // Mark task as completed locally
            task.completed = true;
            console.log(`Quest completed: ${taskName}`);
            
            // Get current game data from userManager to ensure we have the latest data
            const userData = userManager.getData();
            const gameData = userData.gameData;
            
            // Parse current quest progress
            const currentProgress = gameData.physicalQuests || "[0/4]";
            const match = currentProgress.match(/\[(\d+)\/(\d+)\]/);
            const currentCompleted = match ? parseInt(match[1]) : 0;
            const totalQuests = match ? parseInt(match[2]) : 4;
            
            // Update quest progress
            const newCompleted = Math.min(currentCompleted + 1, totalQuests);
            gameData.physicalQuests = `[${newCompleted}/${totalQuests}]`;
            
            // Add EXP for completing the quest
            gameData.exp = (gameData.exp || 0) + 5;
            console.log(`EXP gained: +5 (Total: ${gameData.exp})`);
            
            // Add stacked attributes for physical training
            if (!gameData.stackedAttributes) {
                gameData.stackedAttributes = { STR: 0, VIT: 0, AGI: 0, INT: 0, PER: 0, WIS: 0 };
            }
            gameData.stackedAttributes.STR += 2;  // Strength from physical training
            gameData.stackedAttributes.VIT += 1;  // Vitality from physical training
            gameData.stackedAttributes.AGI += 1;  // Agility from physical training
            
            console.log('Stacked attributes updated:', gameData.stackedAttributes);
            
            // Check for level up
            if (gameData.exp >= 100) {
                await handleLevelUp(gameData);
            }
            
            // Update user data
            userManager.setData('gameData', gameData);
            
            // Force save by temporarily clearing lastLoadTime
            userManager.lastLoadTime = 0;
            
            // Save to database
            const result = await userManager.saveUserData();
            if (result.success) {
                console.log('Quest completion saved successfully');
                console.log('Final saved data:', JSON.stringify(userManager.getData(), null, 2));
                showNotification(`✅ Quest completed! +5 EXP, +2 STR, +1 VIT, +1 AGI`, 'success');
            } else {
                console.error('Error saving quest completion:', result.error);
                showNotification('❌ Error saving quest completion', 'error');
            }
            
            // Update the task display
            renderPhysicalTasks();
            updateCompleteCheckbox();
            
            // Update currentUserData reference
            currentUserData = userManager.getData();
            
            // Update UI to reflect new stats
            updateUI(gameData);
            
        } catch (error) {
            console.error('Error completing quest:', error);
            showNotification('❌ Error completing quest', 'error');
        }
    }
}

// Function to update the Physical Status Card (display user XP and stats)
function updatePhysicalStatusCard() {
    if (currentUserData && currentUserData.gameData) {
        const exp = currentUserData.gameData.exp || 0;
        const str = currentUserData.gameData.Attributes?.STR || 10;
        const vit = currentUserData.gameData.Attributes?.VIT || 10;
        const agi = currentUserData.gameData.Attributes?.AGI || 10;
        console.log(`Current XP: ${exp}`);
        console.log(`Stats: STR - ${str}, VIT - ${vit}, AGI - ${agi}`);
    }
}

// Update UI function that safely updates only existing elements
function updateUI(gameData) {
    console.log('Updating UI with data:', gameData);
    
    // Update level if element exists
    const levelNumber = document.querySelector(".level-number");
    if (levelNumber) {
        levelNumber.textContent = gameData.level || 1;
        console.log('Updated level to:', gameData.level);
    }
    
    // Update HP if element exists
    const hpFill = document.getElementById("hp-fill");
    if (hpFill) {
        hpFill.style.width = (gameData.hp || 100) + "%";
        console.log('Updated HP to:', gameData.hp);
    }
    
    // Update MP if element exists
    const mpFill = document.getElementById("mp-fill");
    if (mpFill) {
        mpFill.style.width = (gameData.mp || 100) + "%";
        console.log('Updated MP to:', gameData.mp);
    }
    
    // Update STM if element exists
    const stmFill = document.getElementById("stm-fill");
    if (stmFill) {
        stmFill.style.width = (gameData.stm || 100) + "%";
        console.log('Updated STM to:', gameData.stm);
    }
    
    // Update EXP if element exists
    const expFill = document.getElementById("exp-fill");
    if (expFill) {
        expFill.style.width = (gameData.exp || 0) + "%";
        console.log('Updated EXP to:', gameData.exp);
    }
    
    // Update fatigue if element exists
    const fatValue = document.getElementById("Fatvalue");
    if (fatValue) {
        fatValue.textContent = gameData.fatigue || 0;
        console.log('Updated fatigue to:', gameData.fatigue);
    }
    
    // Update character info if elements exist
    const jobText = document.getElementById("job-text");
    if (jobText) jobText.textContent = gameData.name || "Your Name";
    
    const pingText = document.getElementById("ping-text");
    if (pingText) pingText.textContent = gameData.ping || "60 ms";
    
    const guildText = document.getElementById("guild-text");
    if (guildText) guildText.textContent = gameData.guild || "Reaper";
    
    const raceText = document.getElementById("race-text");
    if (raceText) raceText.textContent = gameData.race || "Hunter";
    
    const titleText = document.getElementById("title-text");
    if (titleText) titleText.textContent = gameData.title || "None";
    
    const regionText = document.getElementById("region-text");
    if (regionText) regionText.textContent = gameData.region || "TN";
    
    const locationText = document.getElementById("location-text");
    if (locationText) locationText.textContent = gameData.location || "Hospital";
    
    // Update attributes if they exist
    if (gameData.Attributes) {
        const strElement = document.getElementById("str");
        if (strElement) strElement.textContent = `STR: ${gameData.Attributes.STR || 0}`;
        
        const vitElement = document.getElementById("vit");
        if (vitElement) vitElement.textContent = `VIT: ${gameData.Attributes.VIT || 0}`;
        
        const agiElement = document.getElementById("agi");
        if (agiElement) agiElement.textContent = `AGI: ${gameData.Attributes.AGI || 0}`;
        
        const intElement = document.getElementById("int");
        if (intElement) intElement.textContent = `INT: ${gameData.Attributes.INT || 0}`;
        
        const perElement = document.getElementById("per");
        if (perElement) perElement.textContent = `PER: ${gameData.Attributes.PER || 0}`;
        
        const wisElement = document.getElementById("wis");
        if (wisElement) wisElement.textContent = `WIS: ${gameData.Attributes.WIS || 0}`;
    }
    
    console.log('UI update completed');
}

// Show notification function
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? 'linear-gradient(135deg, #4CAF50, #45a049)' : 
                         type === 'error' ? 'linear-gradient(135deg, #f44336, #da190b)' : 
                         'linear-gradient(135deg, #2196F3, #0b7dda)'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            z-index: 10000;
            font-weight: bold;
            text-align: center;
            animation: slideIn 0.3s ease-out;
            max-width: 300px;
        ">
            ${message}
        </div>
    `;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Remove notification after 15 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 15000);
}

// Auto-redirect to penalty page after 2 hours (7200000 ms)
setTimeout(function() {
    console.log('Auto-redirecting to penalty page');
    window.location.href = 'Penalty_Quest.html';
}, 7200000); 

// Test function for debugging unlimited sets system
window.testPhysicalTraining = function() {
  console.log('🧪 Testing Unlimited Sets System...');
  console.log('Physical Data:', physicalData);
  console.log('Today Session:', physicalData?.todaySession);
  console.log('Exercises:', physicalData?.todaySession?.exercises);
  
  if (physicalData?.todaySession?.exercises?.length > 0) {
    const ex = physicalData.todaySession.exercises[0];
    console.log('First Exercise:', ex);
    console.log('Sets:', ex.sets);
    console.log('Completed:', ex.completed);
    
    // Test opening modal
    openPtModal(ex.id);
    console.log('✅ Modal opened for exercise:', ex.name);
    console.log('');
    console.log('🎯 Test Instructions:');
    console.log('1. Complete Set 1 → Rest timer → Set 2 appears');
    console.log('2. Complete Set 2 → Rest timer → Set 3 appears');
    console.log('3. Complete Set 3 → "Exercise minimum completed!" → Finish button appears');
    console.log('4. Continue with Set 4, 5, 6... as many as you want!');
    console.log('5. Click "Finish Exercise" when done');
    console.log('');
    console.log('⏭️ You can skip rest timers and they will auto-add the next set');
  } else {
    console.log('❌ No exercises available - generate a session first');
  }
};

// ===== FEEDBACK SYSTEM =====

function initializeFeedbackSystem() {
  const feedbackBtn = document.getElementById('feedbackBtn');
  if (feedbackBtn) {
    feedbackBtn.addEventListener('click', openFeedbackModal);
  }
}

function openFeedbackModal() {
  if (feedbackModal) {
    feedbackModal.remove();
  }
  
  // Create modal overlay
  feedbackModal = document.createElement('div');
  feedbackModal.className = 'feedback-overlay';
  feedbackModal.innerHTML = `
    <div class="feedback-modal">
      <div class="feedback-header">
        <h3><i class="fas fa-comment-dots"></i> What's On Your Mind ?</h3>
        <button class="feedback-close">×</button>
      </div>
      <div class="feedback-body">
        <div class="feedback-message">
          <label for="feedbackMessage">Your Note:</label>
          <textarea id="feedbackMessage" placeholder="Share your thoughts, preferences, experiences, or suggestions with The Architect..."></textarea>
        </div>
        <div class="feedback-actions">
          <button class="feedback-submit">Proceed to Architecht</button>
          <button class="feedback-cancel">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  // Add enhanced styles
  if (!document.getElementById('feedback-styles')) {
    const style = document.createElement('style');
    style.id = 'feedback-styles';
    style.textContent = `
      .feedback-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.85);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        backdrop-filter: blur(8px);
        animation: feedbackFadeIn 0.3s ease-out;
        padding: 20px;
        box-sizing: border-box;
      }
      
      @keyframes feedbackFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .feedback-modal {
        background: linear-gradient(135deg, rgba(10, 27, 46, 0.98), rgba(20, 40, 60, 0.95));
        border: 2px solid rgba(139, 92, 246, 0.6);
        border-radius: 16px;
        width: 100%;
        max-width: 500px;
        max-height: 85vh;
        overflow: hidden;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(139, 92, 246, 0.2);
        animation: feedbackSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        position: relative;
        margin: 0 auto;
        box-sizing: border-box;
      }
      
      @keyframes feedbackSlideIn {
        from { 
          opacity: 0; 
          transform: scale(0.7) translateY(-30px) rotateX(15deg); 
        }
        to { 
          opacity: 1; 
          transform: scale(1) translateY(0) rotateX(0deg); 
        }
      }
      
      .feedback-modal::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.8), transparent);
        animation: shimmer 2s infinite;
      }
      
      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
      
      .feedback-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px 20px 28px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.15);
        background: linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(168, 85, 247, 0.2));
        position: relative;
        box-sizing: border-box;
      }
      
      .feedback-header::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.5), transparent);
      }
      
      .feedback-header h3 {
        margin: 0;
        color: #fff;
        font-size: 1.4rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 12px;
        text-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
        letter-spacing: 0.5px;
      }
      
      .feedback-close {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #fff;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        backdrop-filter: blur(10px);
      }
      
      .feedback-close:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.1) rotate(90deg);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }
      
      .feedback-body {
        padding: 24px 20px 28px 28px;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.01));
        box-sizing: border-box;
      }
      
      .feedback-message {
        margin-bottom: 28px;
      }
      
      .feedback-message label {
        display: block;
        color: #fff;
        margin-bottom: 12px;
        font-weight: 600;
        font-size: 1.1rem;
        text-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
        letter-spacing: 0.3px;
      }
      
      .feedback-message textarea {
        width: 100%;
        min-height: 140px;
        padding: 16px;
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
        font-size: 15px;
        resize: vertical;
        font-family: inherit;
        transition: all 0.3s ease;
        backdrop-filter: blur(10px);
        line-height: 1.5;
        box-sizing: border-box;
      }
      
      .feedback-message textarea:focus {
        outline: none;
        border-color: rgba(139, 92, 246, 0.6);
        background: rgba(255, 255, 255, 0.12);
        box-shadow: 0 0 20px rgba(139, 92, 246, 0.2);
        transform: translateY(-2px);
      }
      
      .feedback-message textarea::placeholder {
        color: rgba(255, 255, 255, 0.5);
        font-style: italic;
      }
      
      .feedback-actions {
        display: flex;
        gap: 16px;
        justify-content: flex-end;
        margin-top: 8px;
        width: 100%;
        box-sizing: border-box;
      }
      
      .feedback-submit, .feedback-cancel {
        padding: 14px 28px;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        font-size: 15px;
        font-weight: 600;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
        letter-spacing: 0.3px;
      }
      
      .feedback-submit {
        background: linear-gradient(135deg, #8b5cf6, #a855f7);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.3);
        box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);
      }
      
      .feedback-submit::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
        transition: left 0.5s;
      }
      
      .feedback-submit:hover::before {
        left: 100%;
      }
      
      .feedback-submit:hover {
        background: linear-gradient(135deg, #7c3aed, #9333ea);
        transform: translateY(-3px);
        box-shadow: 0 8px 25px rgba(139, 92, 246, 0.4);
      }
      
      .feedback-cancel {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.3);
        backdrop-filter: blur(10px);
      }
      
      .feedback-cancel:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
      }
      
      /* Responsive adjustments */
      @media (max-width: 768px) {
        .feedback-overlay {
          padding: 15px;
        }
        
        .feedback-modal {
          max-width: 100%;
          margin: 0;
        }
        
        .feedback-header {
          padding: 18px 20px 18px 24px;
        }
        
        .feedback-body {
          padding: 20px 16px 24px 20px;
        }
        
        .feedback-actions {
          flex-direction: column;
          gap: 12px;
        }
        
        .feedback-submit, .feedback-cancel {
          width: 100%;
          justify-content: center;
        }
      }
      
      @media (max-width: 480px) {
        .feedback-overlay {
          padding: 10px;
        }
        
        .feedback-header {
          padding: 16px 16px 16px 20px;
        }
        
        .feedback-body {
          padding: 16px 12px 20px 16px;
        }
        
        .feedback-header h3 {
          font-size: 1.2rem;
        }
        
        .feedback-message textarea {
          min-height: 120px;
          font-size: 14px;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(feedbackModal);
  
  // Add event listeners
  const closeBtn = feedbackModal.querySelector('.feedback-close');
  const cancelBtn = feedbackModal.querySelector('.feedback-cancel');
  const submitBtn = feedbackModal.querySelector('.feedback-submit');
  
  closeBtn.addEventListener('click', closeFeedbackModal);
  cancelBtn.addEventListener('click', closeFeedbackModal);
  submitBtn.addEventListener('click', submitFeedback);
  
  // Close on overlay click
  feedbackModal.addEventListener('click', (e) => {
    if (e.target === feedbackModal) {
      closeFeedbackModal();
    }
  });
  
  // Focus on textarea
  const textarea = feedbackModal.querySelector('#feedbackMessage');
  textarea.focus();
}

function closeFeedbackModal() {
  if (feedbackModal) {
    feedbackModal.remove();
    feedbackModal = null;
  }
}

async function submitFeedback() {
  const message = document.getElementById('feedbackMessage').value.trim();
  
  if (!message) {
    alert('Please enter a note for The Architect.');
    return;
  }
  
  try {
    // Store feedback for later AI analysis
    const feedbackData = {
      timestamp: Date.now(),
      message: message,
      page: 'physical_training',
      analyzed: false // Will be analyzed later by AI
    };
    
    // Add to user data
    if (!currentUserData.feedbackNotes) {
      currentUserData.feedbackNotes = [];
    }
    currentUserData.feedbackNotes.push(feedbackData);
    
    // Update local data
    userManager.updateData({ feedbackNotes: currentUserData.feedbackNotes });
    
    // Save to database
    const saveResult = await userManager.saveUserData();
    console.log('💾 Feedback note saved to database:', saveResult);
    
    // Show success message
    showNotification('Note saved! The Architect will analyze it later. 🧠', 'success');
    
    // Close modal
    closeFeedbackModal();
    
    // Trigger immediate analysis of the new feedback
    setTimeout(() => {
      processUnanalyzedFeedback();
    }, 1000); // Small delay to ensure data is saved
    
  } catch (error) {
    console.error('Error submitting feedback:', error);
    showNotification('Failed to save note. Please try again.', 'error');
  }
}

// Process unanalyzed feedback notes
let isProcessingFeedback = false;
async function processUnanalyzedFeedback() {
  try {
    if (isProcessingFeedback) {
      console.log('🔮 Feedback processing already in progress, skipping...');
      return;
    }
    
    if (!currentUserData || !currentUserData.feedbackNotes) return;
    
    // Find unanalyzed feedback notes
    const unanalyzedNotes = currentUserData.feedbackNotes.filter(note => !note.analyzed);
    
    if (unanalyzedNotes.length === 0) return;
    
    isProcessingFeedback = true;
    console.log(`🔮 Processing ${unanalyzedNotes.length} unanalyzed feedback notes`);
    
    // Process each unanalyzed note
    for (const note of unanalyzedNotes) {
      try {
        // Send to Architect for AI analysis
        if (window.globalArchitect) {
          await window.globalArchitect.analyzePlayerFeedback(note, currentUserData);
          
          // Mark as analyzed
          note.analyzed = true;
          
          // Update local data
          userManager.updateData({ feedbackNotes: currentUserData.feedbackNotes });
          
          // Save to database
          await userManager.saveUserData();
          
          console.log(`🔮 Analyzed feedback note: ${note.message.substring(0, 50)}...`);
        }
      } catch (e) {
        console.warn('🔮 Failed to analyze feedback note:', e);
      }
    }
    
  } catch (error) {
    console.warn('🔮 Error processing unanalyzed feedback:', error);
  } finally {
    isProcessingFeedback = false;
  }
}

// Debug function to check feedback notes in database
function checkFeedbackNotesInDatabase() {
  console.log('🔍 Checking feedback notes in database...');
  console.log('Current user data:', currentUserData);
  console.log('Feedback notes:', currentUserData?.feedbackNotes);
  console.log('Total notes:', currentUserData?.feedbackNotes?.length || 0);
  
  if (currentUserData?.feedbackNotes?.length > 0) {
    console.log('Recent notes:');
    currentUserData.feedbackNotes.slice(-3).forEach((note, index) => {
      console.log(`${index + 1}. ${note.message.substring(0, 50)}... (analyzed: ${note.analyzed})`);
    });
  }
}

// Manual trigger for feedback analysis (for testing)
function triggerFeedbackAnalysis() {
  console.log('🔮 Manually triggering feedback analysis...');
  processUnanalyzedFeedback();
}

// Expose debug functions to window for testing
window.checkFeedbackNotes = checkFeedbackNotesInDatabase;
window.triggerFeedbackAnalysis = triggerFeedbackAnalysis; 
