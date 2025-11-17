// Spiritual Quest System - Updated for new UserManager
let userManager = null;
let currentUserData = null;
let spiritualData = null; // stored in DB under spiritualTrainingData
let _spiritualSaveTimer = null; // debounce saver

function debouncedSaveUserData(delayMs = 250){
  try {
    if (_spiritualSaveTimer) clearTimeout(_spiritualSaveTimer);
    _spiritualSaveTimer = setTimeout(async ()=>{
      try { await userManager.saveUserData(); } catch(_) {}
    }, delayMs);
  } catch(_) {}
}

async function setSpiritualCounterFromState(){
  try {
    const s = spiritualData?.todaySession;
    if (!s) return;
    const completed = s.tasks.filter(t=>t.status==='done').length;
    const total = s.tasks.length;
    const data = userManager.getData();
    const game = data.gameData || {};
    game.spiritualQuests = `[${completed}/${total}]`;
    await userManager.updateUserData({ gameData: game });
    debouncedSaveUserData();
  } catch(_) {}
}

document.addEventListener("DOMContentLoaded", function() {
  console.log('Spiritual Quest page loaded');
  
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
});

// Initialize the quest page
async function initializeQuestPage() {
  try {
    // Keep UI minimal (no extra style injection)
    injectExerciseCardStyles();
    // Create user manager instance
    userManager = new UserManager();
    
    // Set the user ID and load data
    await userManager.setUserId(localStorage.getItem('playerName'));
    
    // Get current data
    currentUserData = userManager.getData();
    spiritualData = currentUserData.spiritualTrainingData || getDefaultSpiritualData();
    // Ensure structure exists for legacy users
    ensureSpiritualStructure();
    
    if (currentUserData && currentUserData.gameData) {
      console.log('User data loaded:', currentUserData.gameData);
      loadData(currentUserData.gameData);
    } else {
      console.log('No existing data, using defaults');
      loadData({});
    }
    
    // Show loading immediately, then generate or load today's simple session
    renderAISessionTasks();
    await ensureTodaySession();
    // Sync quiz completion from Islamic page and re-render
    await syncIslamicQuizStatus();
    renderAISessionTasks();
    // Also resync when returning to this tab/page
    window.addEventListener('focus', async ()=>{ await syncIslamicQuizStatus(); renderAISessionTasks(); });
    
  } catch (error) {
    console.error('Error initializing quest page:', error);
    // Fallback to default data
    loadData({});
    renderAISessionTasks();
  }
}

// Ensure Islamic Quiz task reflects daily quiz completion
async function syncIslamicQuizStatus(){
  try {
    const data = userManager?.getData?.();
    const last = data?.islamicTrainingData?.userProgress?.lastQuizDate;
    const today = new Date().toLocaleDateString();
    const s = spiritualData?.todaySession;
    if (!s) return;
    const quizTask = s.tasks.find(t=>t.id==='islamic_quiz');
    if (!quizTask) return;
    const shouldBeDone = last === today;
    if (shouldBeDone && quizTask.status !== 'done') {
      quizTask.status = 'done';
      await persistSpiritual();
    }
  } catch(_) {}
}

function injectExerciseCardStyles() {
  // Add exercise card styles immediately on page load
  if (!document.getElementById('spiritual-exercise-styles')) {
    const style = document.createElement('style');
    style.id = 'spiritual-exercise-styles';
    style.textContent = `
      /* Exercise Card Styles (matching Physical page) - Override existing CSS */
      .exercise-card {
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)) !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        border-radius: 12px !important;
        padding: 16px !important;
        margin-bottom: 12px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        transition: all 0.3s ease !important;
        backdrop-filter: blur(10px) !important;
      }
      
      .exercise-card:hover {
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04)) !important;
        border-color: rgba(139, 92, 246, 0.3) !important;
        transform: translateY(-2px) !important;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3) !important;
      }
      
      .exercise-card.completed {
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05)) !important;
        border-color: rgba(16, 185, 129, 0.3) !important;
      }
      
      .exercise-info {
        display: flex !important;
        align-items: center !important;
        gap: 16px !important;
        flex: 1 !important;
      }
      
      .exercise-number {
        background: linear-gradient(135deg, #8b5cf6, #a855f7) !important;
        color: #fff !important;
        width: 32px !important;
        height: 32px !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-weight: 700 !important;
        font-size: 0.9rem !important;
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3) !important;
      }
      
      .exercise-name {
        font-size: 1.1rem !important;
        font-weight: 600 !important;
        color: #fff !important;
        text-shadow: 0 0 8px rgba(255, 255, 255, 0.3) !important;
      }
      
      .exercise-status {
        font-size: 1.2rem !important;
        color: #8b5cf6 !important;
      }
      
      .exercise-status .fa-check-circle {
        color: #10b981 !important;
        text-shadow: 0 0 10px rgba(16, 185, 129, 0.5) !important;
      }
      
      .log-button {
        background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
        color: #fff !important;
        border: none !important;
        border-radius: 8px !important;
        padding: 10px 16px !important;
        cursor: pointer !important;
        font-size: 0.9rem !important;
        font-weight: 600 !important;
        transition: all 0.3s ease !important;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3) !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
      }

      /* Soft button for Islamic Quiz */
      .soft-button {
        background: rgba(139, 92, 246, 0.15) !important;
        color: #e9e7ff !important;
        border: 1px solid rgba(139, 92, 246, 0.35) !important;
        border-radius: 8px !important;
        padding: 8px 14px !important;
        cursor: pointer !important;
        font-size: 0.9rem !important;
        transition: all 0.2s ease !important;
      }

      .soft-button:hover {
        background: rgba(139, 92, 246, 0.25) !important;
        border-color: rgba(139, 92, 246, 0.55) !important;
      }

      .soft-button.completed {
        background: rgba(16, 185, 129, 0.15) !important;
        border-color: rgba(16, 185, 129, 0.45) !important;
        color: #a7f3d0 !important;
        cursor: default !important;
      }
      
      .log-button:hover {
        background: linear-gradient(135deg, #5b5cf0, #7c3aed) !important;
        transform: translateY(-2px) !important;
        box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4) !important;
      }
      
      .log-button:active {
        transform: translateY(0) !important;
        box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3) !important;
      }
      
      .view-button {
        background: linear-gradient(135deg, #6b7280, #4b5563) !important;
        box-shadow: 0 4px 12px rgba(107, 114, 128, 0.3) !important;
      }
      
      .view-button:hover {
        background: linear-gradient(135deg, #5b5cf0, #7c3aed) !important;
        box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4) !important;
      }
      
      .session-completed {
        text-align: center !important;
        padding: 40px 20px !important;
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05)) !important;
        border: 2px solid rgba(16, 185, 129, 0.3) !important;
        border-radius: 12px !important;
        color: #10b981 !important;
        font-size: 1.2rem !important;
        font-weight: 600 !important;
      }
      
      .session-completed i {
        font-size: 2rem !important;
        margin-bottom: 12px !important;
        display: block !important;
        text-shadow: 0 0 15px rgba(16, 185, 129, 0.5) !important;
      }
      
      .loading-spinner {
        text-align: center !important;
        padding: 40px 20px !important;
        color: #8b5cf6 !important;
      }
      
      .loading-spinner i {
        font-size: 2rem !important;
        margin-bottom: 12px !important;
        display: block !important;
        animation: spin 1s linear infinite !important;
      }
      
      .loading-spinner p {
        font-size: 1.1rem !important;
        font-weight: 600 !important;
        margin: 0 !important;
      }
      
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}

function getDefaultSpiritualData() {
  return {
    memorizationProgress: {
      totalVersesMemorized: 0,
      currentSurah: 1,
      currentVerse: 1,
      lastMemorizationDate: null,
      surahProgress: {} // Track progress per surah
    },
    revisionCycle: {
      cycleDay: 1, // 1, 2, or 3
      totalVersesForRevision: 0,
      segment1: { startVerse: 1, endVerse: 0 },
      segment2: { startVerse: 1, endVerse: 0 },
      segment3: { startVerse: 1, endVerse: 0 },
      lastCycleUpdate: null
    },
    todaySession: null,
    lastSessionDate: null,
    sessionCompleted: false
  };
}

// Ensure spiritualData has expected shape (self-heal legacy data)
function ensureSpiritualStructure(){
  try {
    if (!spiritualData || typeof spiritualData !== 'object') {
      spiritualData = getDefaultSpiritualData();
      return;
    }
    if (!spiritualData.memorizationProgress || typeof spiritualData.memorizationProgress !== 'object') {
      spiritualData.memorizationProgress = { totalVersesMemorized: 0, currentSurah: 1, currentVerse: 1, lastMemorizationDate: null, surahProgress: {} };
    }
    if (!spiritualData.memorizationProgress.surahProgress || typeof spiritualData.memorizationProgress.surahProgress !== 'object') {
      spiritualData.memorizationProgress.surahProgress = {};
    }
    if (!spiritualData.revisionCycle || typeof spiritualData.revisionCycle !== 'object') {
      spiritualData.revisionCycle = { cycleDay: 1, totalVersesForRevision: 0, segment1: {startVerse:1,endVerse:0}, segment2: {startVerse:1,endVerse:0}, segment3: {startVerse:1,endVerse:0}, lastCycleUpdate: null };
    }
    if (!spiritualData.todaySession) spiritualData.todaySession = null;
    if (typeof spiritualData.sessionCompleted !== 'boolean') spiritualData.sessionCompleted = false;
  } catch(_) {}
}

function generateSurahProgressHTML(task) {
  if (task.type === 'memorization') {
    return `
      <div class="surah-progress-section">
        <h4><i class="fas fa-book-quran"></i> Memorization Progress</h4>
        <div class="surah-selector">
          <label for="surah-select">Select Surah:</label>
          <select id="surah-select" class="surah-dropdown">
            ${generateSurahOptions()}
          </select>
        </div>
        <div class="verse-inputs">
          <div class="input-group">
            <label for="start-verse">Starting Verse:</label>
            <input type="number" id="start-verse" class="verse-input" min="1" value="${task.verseStart || 1}">
          </div>
          <div class="input-group">
            <label for="end-verse">Ending Verse:</label>
            <input type="number" id="end-verse" class="verse-input" min="1" value="${(task.verseStart || 1) + (task.verseCount || 18) - 1}">
          </div>
        </div>
        <div class="progress-summary">
          <div class="summary-item">Total Verses: <span id="verse-count">${task.verseCount || 18}</span></div>
          <div class="summary-item">Total Memorized: <span id="total-memorized">${spiritualData.memorizationProgress.totalVersesMemorized}</span></div>
        </div>
        <div class="manual-progress">
          <h5>Manual Progress Update</h5>
          <p>If you've memorized content outside this system, you can update your progress here:</p>
          <div class="manual-inputs">
            <div class="input-group">
              <label for="manual-surah">Surah:</label>
              <select id="manual-surah" class="surah-dropdown">
                ${generateSurahOptions()}
              </select>
            </div>
            <div class="input-group">
              <label for="manual-verses">Verses Memorized:</label>
              <input type="number" id="manual-verses" class="verse-input" min="0" placeholder="e.g., 15">
            </div>
            <button id="update-manual-progress" class="spiritual-btn">Update Progress</button>
          </div>
        </div>
      </div>
    `;
  } else if (task.type === 'revision') {
    return `
      <div class="revision-progress-section">
        <h4><i class="fas fa-sync-alt"></i> Revision Progress</h4>
        <div class="revision-info">
          <div class="info-item">Cycle Day: <span class="highlight">${task.segmentDay || 1}</span></div>
          <div class="info-item">Verse Range: <span class="highlight">${task.verseRange || '1-0'}</span></div>
          <div class="info-item">Total for Revision: <span class="highlight">${spiritualData.revisionCycle.totalVersesForRevision}</span></div>
        </div>
        <div class="revision-surahs">
          <h5>Memorized Surahs Overview</h5>
          <div class="surah-list">
            ${generateSurahListHTML()}
          </div>
        </div>
      </div>
    `;
  } else {
    return `
      <div class="knowledge-section">
        <h4><i class="fas fa-graduation-cap"></i> Islamic Knowledge</h4>
        <p>Click the button below to access the Islamic Knowledge Training page for daily quizzes and learning.</p>
      </div>
    `;
  }
}

function generateSurahOptions() {
  const surahs = [
    { num: 1, name: 'Al-Fatiha', verses: 7 },
    { num: 2, name: 'Al-Baqarah', verses: 286 },
    { num: 3, name: 'Ali Imran', verses: 200 },
    { num: 4, name: 'An-Nisa', verses: 176 },
    { num: 5, name: 'Al-Maidah', verses: 120 },
    { num: 6, name: 'Al-An\'am', verses: 165 },
    { num: 7, name: 'Al-A\'raf', verses: 206 },
    { num: 8, name: 'Al-Anfal', verses: 75 },
    { num: 9, name: 'At-Tawbah', verses: 129 },
    { num: 10, name: 'Yunus', verses: 109 },
    { num: 11, name: 'Hud', verses: 123 },
    { num: 12, name: 'Yusuf', verses: 111 },
    { num: 13, name: 'Ar-Ra\'d', verses: 43 },
    { num: 14, name: 'Ibrahim', verses: 52 },
    { num: 15, name: 'Al-Hijr', verses: 99 },
    { num: 16, name: 'An-Nahl', verses: 128 },
    { num: 17, name: 'Al-Isra', verses: 111 },
    { num: 18, name: 'Al-Kahf', verses: 110 },
    { num: 19, name: 'Maryam', verses: 98 },
    { num: 20, name: 'Taha', verses: 135 },
    { num: 21, name: 'Al-Anbiya', verses: 112 },
    { num: 22, name: 'Al-Hajj', verses: 78 },
    { num: 23, name: 'Al-Mu\'minun', verses: 118 },
    { num: 24, name: 'An-Nur', verses: 64 },
    { num: 25, name: 'Al-Furqan', verses: 77 },
    { num: 26, name: 'Ash-Shu\'ara', verses: 227 },
    { num: 27, name: 'An-Naml', verses: 93 },
    { num: 28, name: 'Al-Qasas', verses: 88 },
    { num: 29, name: 'Al-Ankabut', verses: 69 },
    { num: 30, name: 'Ar-Rum', verses: 60 },
    { num: 31, name: 'Luqman', verses: 34 },
    { num: 32, name: 'As-Sajdah', verses: 30 },
    { num: 33, name: 'Al-Ahzab', verses: 73 },
    { num: 34, name: 'Saba', verses: 54 },
    { num: 35, name: 'Fatir', verses: 45 },
    { num: 36, name: 'Ya-Sin', verses: 83 },
    { num: 37, name: 'As-Saffat', verses: 182 },
    { num: 38, name: 'Sad', verses: 88 },
    { num: 39, name: 'Az-Zumar', verses: 75 },
    { num: 40, name: 'Ghafir', verses: 85 },
    { num: 41, name: 'Fussilat', verses: 54 },
    { num: 42, name: 'Ash-Shura', verses: 53 },
    { num: 43, name: 'Az-Zukhruf', verses: 89 },
    { num: 44, name: 'Ad-Dukhan', verses: 59 },
    { num: 45, name: 'Al-Jathiyah', verses: 37 },
    { num: 46, name: 'Al-Ahqaf', verses: 35 },
    { num: 47, name: 'Muhammad', verses: 38 },
    { num: 48, name: 'Al-Fath', verses: 29 },
    { num: 49, name: 'Al-Hujurat', verses: 18 },
    { num: 50, name: 'Qaf', verses: 45 },
    { num: 51, name: 'Adh-Dhariyat', verses: 60 },
    { num: 52, name: 'At-Tur', verses: 49 },
    { num: 53, name: 'An-Najm', verses: 62 },
    { num: 54, name: 'Al-Qamar', verses: 55 },
    { num: 55, name: 'Ar-Rahman', verses: 78 },
    { num: 56, name: 'Al-Waqi\'ah', verses: 96 },
    { num: 57, name: 'Al-Hadid', verses: 29 },
    { num: 58, name: 'Al-Mujadilah', verses: 22 },
    { num: 59, name: 'Al-Hashr', verses: 24 },
    { num: 60, name: 'Al-Mumtahanah', verses: 13 },
    { num: 61, name: 'As-Saff', verses: 14 },
    { num: 62, name: 'Al-Jumu\'ah', verses: 11 },
    { num: 63, name: 'Al-Munafiqun', verses: 11 },
    { num: 64, name: 'At-Taghabun', verses: 18 },
    { num: 65, name: 'At-Talaq', verses: 12 },
    { num: 66, name: 'At-Tahrim', verses: 12 },
    { num: 67, name: 'Al-Mulk', verses: 30 },
    { num: 68, name: 'Al-Qalam', verses: 52 },
    { num: 69, name: 'Al-Haqqah', verses: 52 },
    { num: 70, name: 'Al-Ma\'arij', verses: 44 },
    { num: 71, name: 'Nuh', verses: 28 },
    { num: 72, name: 'Al-Jinn', verses: 28 },
    { num: 73, name: 'Al-Muzzammil', verses: 20 },
    { num: 74, name: 'Al-Muddaththir', verses: 56 },
    { num: 75, name: 'Al-Qiyamah', verses: 40 },
    { num: 76, name: 'Al-Insan', verses: 31 },
    { num: 77, name: 'Al-Mursalat', verses: 50 },
    { num: 78, name: 'An-Naba', verses: 40 },
    { num: 79, name: 'An-Nazi\'at', verses: 46 },
    { num: 80, name: 'Abasa', verses: 42 },
    { num: 81, name: 'At-Takwir', verses: 29 },
    { num: 82, name: 'Al-Infitar', verses: 19 },
    { num: 83, name: 'Al-Mutaffifin', verses: 36 },
    { num: 84, name: 'Al-Inshiqaq', verses: 25 },
    { num: 85, name: 'Al-Buruj', verses: 22 },
    { num: 86, name: 'At-Tariq', verses: 17 },
    { num: 87, name: 'Al-A\'la', verses: 19 },
    { num: 88, name: 'Al-Ghashiyah', verses: 26 },
    { num: 89, name: 'Al-Fajr', verses: 30 },
    { num: 90, name: 'Al-Balad', verses: 20 },
    { num: 91, name: 'Ash-Shams', verses: 15 },
    { num: 92, name: 'Al-Layl', verses: 21 },
    { num: 93, name: 'Ad-Duha', verses: 11 },
    { num: 94, name: 'Ash-Sharh', verses: 8 },
    { num: 95, name: 'At-Tin', verses: 8 },
    { num: 96, name: 'Al-Alaq', verses: 19 },
    { num: 97, name: 'Al-Qadr', verses: 5 },
    { num: 98, name: 'Al-Bayyinah', verses: 8 },
    { num: 99, name: 'Az-Zalzalah', verses: 8 },
    { num: 100, name: 'Al-Adiyat', verses: 11 },
    { num: 101, name: 'Al-Qari\'ah', verses: 11 },
    { num: 102, name: 'At-Takathur', verses: 8 },
    { num: 103, name: 'Al-Asr', verses: 3 },
    { num: 104, name: 'Al-Humazah', verses: 9 },
    { num: 105, name: 'Al-Fil', verses: 5 },
    { num: 106, name: 'Quraysh', verses: 4 },
    { num: 107, name: 'Al-Ma\'un', verses: 7 },
    { num: 108, name: 'Al-Kawthar', verses: 3 },
    { num: 109, name: 'Al-Kafirun', verses: 6 },
    { num: 110, name: 'An-Nasr', verses: 3 },
    { num: 111, name: 'Al-Masad', verses: 5 },
    { num: 112, name: 'Al-Ikhlas', verses: 4 },
    { num: 113, name: 'Al-Falaq', verses: 5 },
    { num: 114, name: 'An-Nas', verses: 6 }
  ];
  
  return surahs.map(surah => 
    `<option value="${surah.num}">${surah.num}. ${surah.name} (${surah.verses} verses)</option>`
  ).join('');
}

function generateSurahListHTML() {
  const surahProgress = spiritualData.memorizationProgress.surahProgress || {};
  const surahs = [
    { num: 1, name: 'Al-Fatiha', verses: 7 },
    { num: 2, name: 'Al-Baqarah', verses: 286 },
    { num: 3, name: 'Ali Imran', verses: 200 },
    { num: 4, name: 'An-Nisa', verses: 176 },
    { num: 5, name: 'Al-Maidah', verses: 120 },
    { num: 6, name: 'Al-An\'am', verses: 165 },
    { num: 7, name: 'Al-A\'raf', verses: 206 },
    { num: 8, name: 'Al-Anfal', verses: 75 },
    { num: 9, name: 'At-Tawbah', verses: 129 },
    { num: 10, name: 'Yunus', verses: 109 },
    { num: 18, name: 'Al-Kahf', verses: 110 },
    { num: 19, name: 'Maryam', verses: 98 },
    { num: 20, name: 'Taha', verses: 135 },
    { num: 36, name: 'Ya-Sin', verses: 83 },
    { num: 55, name: 'Ar-Rahman', verses: 78 },
    { num: 67, name: 'Al-Mulk', verses: 30 },
    { num: 78, name: 'An-Naba', verses: 40 },
    { num: 112, name: 'Al-Ikhlas', verses: 4 },
    { num: 113, name: 'Al-Falaq', verses: 5 },
    { num: 114, name: 'An-Nas', verses: 6 }
  ];
  
  return surahs.map(surah => {
    const progress = surahProgress[surah.num] || 0;
    const percentage = Math.round((progress / surah.verses) * 100);
    const statusClass = percentage === 100 ? 'completed' : percentage > 0 ? 'in-progress' : 'not-started';
    
    return `
      <div class="surah-item ${statusClass}">
        <div class="surah-name">${surah.num}. ${surah.name}</div>
        <div class="surah-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${percentage}%"></div>
          </div>
          <div class="progress-text">${progress}/${surah.verses} (${percentage}%)</div>
        </div>
      </div>
    `;
  }).join('');
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

async function persistSpiritual() {
  try {
    const doc = userManager.getData() || {};
    doc.spiritualTrainingData = spiritualData;
    await userManager.updateUserData({ spiritualTrainingData: spiritualData });
    await userManager.forceSaveUserData();
  } catch (e) { console.warn('Failed to persist spiritualTrainingData', e); }
}

async function ensureTodaySession() {
  const todayStr = new Date().toISOString().split('T')[0];
  if (spiritualData.lastSessionDate !== todayStr || !spiritualData.todaySession) {
    console.log('🔄 New day detected, generating new spiritual training session');
    
    // Build a minimal static session (no complex UI)
    const session = {
      date: Date.now(),
      sessionType: 'Spiritual',
      name: 'Quran Memorization & Revision',
      tasks: [
        {
          id: 'memorization',
          name: 'Quran Memorization',
          type: 'memorization',
          description: 'Memorize for 20 minutes. Focus on clarity and tajweed.',
          target: '20 minutes focused memorization',
          rewards: { xp: 25, attributes: { WIS: 2, INT: 1 } },
          costs: { mp: -10, fatigue: 5 },
          status: 'pending'
        },
        {
          id: 'revision',
          name: 'Quran Revision',
          type: 'revision',
          description: 'Revise previously memorized content for 15 minutes.',
          target: '15 minutes calm revision',
          rewards: { xp: 20, attributes: { WIS: 1, PER: 1 } },
          costs: { mp: -5, fatigue: 3 },
          status: 'pending'
        },
        {
          id: 'islamic_quiz',
          name: 'Islamic Quiz',
          type: 'knowledge',
          description: 'Quick daily review to reinforce core knowledge.',
          target: '5 quick questions',
          rewards: { xp: 10, attributes: { WIS: 1 } },
          costs: { mp: -2, fatigue: 1 },
          status: 'pending'
        }
      ]
    };
    spiritualData.todaySession = session;
    spiritualData.lastSessionDate = todayStr;
    spiritualData.sessionTotal = (spiritualData.todaySession?.tasks || []).length || 0;
    spiritualData.sessionCompleted = false;
    await persistSpiritual();
  } else {
    // Migrate any legacy third task to Islamic Quiz
    try {
      const tasks = spiritualData.todaySession?.tasks || [];
      const idx = tasks.findIndex(t => t.id === 'reflection');
      if (idx !== -1) {
        tasks[idx] = {
          id: 'islamic_quiz',
          name: 'Islamic Quiz',
          type: 'knowledge',
          description: 'Quick daily review to reinforce core knowledge.',
          target: '5 quick questions',
          rewards: { xp: 10, attributes: { WIS: 1 } },
          costs: { mp: -2, fatigue: 1 },
          status: tasks[idx].status || 'pending'
        };
        spiritualData.todaySession.tasks = tasks;
        await persistSpiritual();
      }
    } catch (_) {}
  }
}

async function updateRevisionCycle() {
  const todayStr = new Date().toISOString().split('T')[0];
  const lastUpdate = spiritualData.revisionCycle.lastCycleUpdate;
  
  if (lastUpdate !== todayStr) {
    // Calculate new segments based on total memorized verses
    const totalVerses = spiritualData.memorizationProgress.totalVersesMemorized;
    
    if (totalVerses > 0) {
      const segmentSize = Math.ceil(totalVerses / 3);
      spiritualData.revisionCycle.segment1 = { startVerse: 1, endVerse: segmentSize };
      spiritualData.revisionCycle.segment2 = { startVerse: segmentSize + 1, endVerse: segmentSize * 2 };
      spiritualData.revisionCycle.segment3 = { startVerse: (segmentSize * 2) + 1, endVerse: totalVerses };
      spiritualData.revisionCycle.totalVersesForRevision = totalVerses;
    }
    
    // Advance cycle day (1 -> 2 -> 3 -> 1)
    spiritualData.revisionCycle.cycleDay = ((spiritualData.revisionCycle.cycleDay || 1) % 3) + 1;
    spiritualData.revisionCycle.lastCycleUpdate = todayStr;
    
    console.log(`🔄 Revision cycle updated: Day ${spiritualData.revisionCycle.cycleDay}, Total verses: ${totalVerses}`);
  }
}

async function generateAISession() {
  // AI generation disabled for simplified minimal spiritual page
  return null;
}

function slugify(s){return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');}

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

function renderAISessionTasks() {
  const goalItemsDiv = document.getElementById('goal-items');
  if (!goalItemsDiv) return;
  
  const s = spiritualData.todaySession;
  if (spiritualData.sessionCompleted) {
    // Show completion tick UI
    goalItemsDiv.innerHTML = '<div class="session-completed"><i class="fas fa-trophy"></i> Session completed. Great work!</div>';
    const completeCheckbox = document.getElementById('complete');
    if (completeCheckbox) { completeCheckbox.checked = true; completeCheckbox.disabled = true; const label = completeCheckbox.nextElementSibling; if (label) { label.classList.remove('animate'); void label.offsetWidth; label.classList.add('animate'); } }
    return;
  }
  if (!s) { 
    goalItemsDiv.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i><p>Preparing today\'s session...</p></div>'; 
        return;
    }

  // Minimal layout like mental page
  goalItemsDiv.innerHTML = '';
  s.tasks.forEach((task) => {
    const taskDiv = document.createElement('div');
    taskDiv.classList.add('goal-item');
    const isDone = task.status === 'done';
    const inProgress = task.status === 'in_progress';
    const shortTarget = String(task.target || '').replace(/minutes?/gi, 'min').replace(/\s+/g, ' ').trim();

    if (task.id === 'memorization' || task.id === 'revision') {
      // Simple completion toggle, no Start button
            taskDiv.innerHTML = `
                <span class="task-name">${task.name}</span>
        <label class="mini-toggle">
          <input type="checkbox" class="task-check" data-task-id="${task.id}" ${isDone ? 'checked' : ''}>
          <span>Done</span>
        </label>
            `;
        } else {
      // Islamic Quiz button reflects completion either by task status or today's quiz date
      const today = new Date().toLocaleDateString();
      const last = window.userManager?.getData?.()?.islamicTrainingData?.userProgress?.lastQuizDate;
      const quizCompleted = (task.status === 'done') || (last === today);
            taskDiv.innerHTML = `
                <span class="task-name">${task.name}</span>
        <button class="${quizCompleted ? 'soft-button completed' : 'soft-button'}" data-task-id="${task.id}">${quizCompleted ? 'Completed' : 'Start'}</button>
            `;
        }
        goalItemsDiv.appendChild(taskDiv);
    });

  // Attach toggle handlers for first two tasks
  goalItemsDiv.querySelectorAll('input.task-check').forEach(input => {
    input.addEventListener('change', async (e) => {
      const id = e.currentTarget.getAttribute('data-task-id');
      const task = spiritualData.todaySession.tasks.find(t=>t.id===id);
      if (!task) return;
      const checked = e.currentTarget.checked;
      task.status = checked ? 'done' : 'pending';
      if (checked) { await applyTaskRewards(task); }
      await persistSpiritual();
      // Update daily quests counter immediately (debounced save)
      await setSpiritualCounterFromState();
      renderAISessionTasks();
    });
  });

  // Attach start handlers for remaining tasks (if any)
  goalItemsDiv.querySelectorAll('button.soft-button').forEach(btn => {
    btn.addEventListener('click', async (e)=>{
      const id = e.currentTarget.getAttribute('data-task-id');
      const task = spiritualData.todaySession.tasks.find(t=>t.id===id);
      if (!task) return;
      if (id === 'islamic_quiz') {
        const d = window.userManager?.getData?.();
        const last = d?.islamicTrainingData?.userProgress?.lastQuizDate;
        const today = new Date().toLocaleDateString();
        if (last === today) {
          e.currentTarget.textContent = 'Completed';
          e.currentTarget.classList.add('completed');
          const quizTask = spiritualData.todaySession.tasks.find(t=>t.id==='islamic_quiz');
          if (quizTask) {
            quizTask.status = 'done';
            await persistSpiritual();
          }
          return;
        }
        window.location.href = 'islamic-training.html';
        return;
      }
      // Toggle status: pending -> in_progress -> done
      if (!task.status || task.status === 'pending') task.status = 'in_progress';
      else if (task.status === 'in_progress') task.status = 'done';
      await persistSpiritual();
      await setSpiritualCounterFromState();
      renderAISessionTasks();
    });
  });

  // If quiz already completed today, sync its task status to done (without forcing completion prematurely)
  try {
    const today = new Date().toLocaleDateString();
    const last = window.userManager?.getData?.()?.islamicTrainingData?.userProgress?.lastQuizDate;
    if (last === today) {
      const quizTask = s.tasks.find(t => t.id === 'islamic_quiz');
      if (quizTask && quizTask.status !== 'done') {
        quizTask.status = 'done';
        persistSpiritual();
        setSpiritualCounterFromState();
      }
    }
  } catch(_) {}

  // Complete session when all done
  const requiredIds = ['memorization','revision','islamic_quiz'];
  const allRequiredPresent = requiredIds.every(id => s.tasks.some(t => t.id === id));
  if (allRequiredPresent && requiredIds.every(id => s.tasks.find(t => t.id === id)?.status === 'done')) {
    completeAISession();
  }
}

function openSpiritualModal(taskId) {
  const task = spiritualData.todaySession?.tasks.find(t => t.id === taskId);
  if (!task) return;
  
  const isCompleted = task.completed;
  const overlay = document.createElement('div');
  overlay.className = 'spiritual-modal-overlay';
  
  // Generate Surah progress content
  const surahProgressHTML = generateSurahProgressHTML(task);
  
  const actionsHTML = isCompleted 
    ? '<div class="spiritual-actions"><button id="spiritual-close-btn" class="spiritual-btn">Close</button></div>'
    : `<div class="spiritual-actions">
         <button id="spiritual-complete" class="spiritual-btn">Complete Task</button>
         <button id="spiritual-save" class="spiritual-btn">Save Progress</button>
       </div>`;
  
  overlay.innerHTML = `
    <div class="spiritual-modal" data-task-id="${task.id}">
      <div class="spiritual-header">
        <div class="spiritual-title">${task.name} ${isCompleted ? '<i class="fas fa-check-circle" style="color: #00ff00; margin-left: 8px;"></i>' : ''}</div>
        <button class="spiritual-close">×</button>
      </div>
      <div class="spiritual-body">
        <div class="spiritual-description">${task.description}</div>
        <div class="spiritual-target">Target: ${task.target}</div>
        
        ${surahProgressHTML}
        
        <div class="spiritual-rewards">
          <div class="reward-item">XP: +${task.rewards?.xp || 0}</div>
          <div class="reward-item">WIS: +${task.rewards?.attributes?.WIS || 0}</div>
          <div class="reward-item">INT: +${task.rewards?.attributes?.INT || 0}</div>
          <div class="reward-item">PER: +${task.rewards?.attributes?.PER || 0}</div>
        </div>
      </div>
      ${actionsHTML}
    </div>
  `;
  
  // Add modal styles
  if (!document.getElementById('spiritual-modal-styles')) {
    const style = document.createElement('style');
    style.id = 'spiritual-modal-styles';
    style.textContent = `
      /* Surah Progress Styles */
      .surah-progress-section, .revision-progress-section, .knowledge-section {
        margin: 20px 0;
        padding: 20px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
      }
      
      .surah-progress-section h4, .revision-progress-section h4, .knowledge-section h4 {
        color: #8b5cf6;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1.2rem;
      }
      
      .surah-selector, .verse-inputs, .manual-inputs {
        margin-bottom: 16px;
      }
      
      .input-group {
        margin-bottom: 12px;
      }
      
      .input-group label {
        display: block;
        color: #e5e7eb;
        margin-bottom: 6px;
        font-weight: 600;
        font-size: 0.9rem;
      }
      
      .surah-dropdown, .verse-input {
        width: 100%;
        padding: 10px 12px;
        background: rgba(13, 18, 28, 0.9);
        border: 1px solid rgba(176, 224, 255, 0.25);
        border-radius: 8px;
        color: #e5e7eb;
        font-size: 0.95rem;
        transition: all 0.3s ease;
      }
      
      .surah-dropdown:focus, .verse-input:focus {
        outline: none;
        border-color: rgba(139, 92, 246, 0.6);
        background: rgba(13, 18, 28, 0.95);
        box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.2);
        color: #ffffff;
      }
      
      /* Ensure native dropdown panel uses dark theme */
      .surah-dropdown option, .surah-dropdown optgroup {
        background-color: #0b0f1a;
        color: #e5e7eb;
      }
      
      /* Firefox selects */
      .surah-dropdown:-moz-focusring {
        color: transparent;
        text-shadow: 0 0 0 #e5e7eb;
      }
      
      .verse-inputs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      
      .progress-summary {
        display: flex;
        gap: 20px;
        margin-bottom: 20px;
        padding: 12px;
        background: rgba(139, 92, 246, 0.1);
        border-radius: 8px;
        border: 1px solid rgba(139, 92, 246, 0.2);
      }
      
      .summary-item {
        color: #8b5cf6;
        font-weight: 600;
      }
      
      .manual-progress {
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        padding-top: 16px;
      }
      
      .manual-progress h5 {
        color: #e5e7eb;
        margin-bottom: 8px;
        font-size: 1rem;
      }
      
      .manual-progress p {
        color: #9ca3af;
        font-size: 0.9rem;
        margin-bottom: 16px;
        line-height: 1.4;
      }
      
      .revision-info {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 20px;
        padding: 12px;
        background: rgba(59, 130, 246, 0.1);
        border-radius: 8px;
        border: 1px solid rgba(59, 130, 246, 0.2);
      }
      
      .info-item {
        color: #3b82f6;
        font-weight: 600;
      }
      
      .highlight {
        color: #fff;
        background: rgba(59, 130, 246, 0.2);
        padding: 2px 6px;
        border-radius: 4px;
      }
      
      .surah-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      .surah-item {
        padding: 12px;
        background: rgba(13, 18, 28, 0.6);
        border: 1px solid rgba(176, 224, 255, 0.2);
        border-radius: 8px;
        transition: all 0.3s ease;
      }
      
      .surah-item.completed {
        background: rgba(16, 185, 129, 0.1);
        border-color: rgba(16, 185, 129, 0.3);
      }
      
      .surah-item.in-progress {
        background: rgba(59, 130, 246, 0.1);
        border-color: rgba(59, 130, 246, 0.3);
      }
      
      .surah-name {
        color: #eaf6ff !important;
        font-weight: 700;
        margin-bottom: 6px;
        font-size: 1rem;
      }
      
      .surah-progress {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .progress-bar {
        flex: 1;
        height: 8px;
        background: rgba(176, 224, 255, 0.1);
        border-radius: 4px;
        overflow: hidden;
      }
      
      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #8b5cf6, #a855f7);
        border-radius: 4px;
        transition: width 0.3s ease;
      }
      
      .surah-item.completed .progress-fill {
        background: linear-gradient(90deg, #10b981, #059669);
      }
      
      .surah-item.in-progress .progress-fill {
        background: linear-gradient(90deg, #3b82f6, #2563eb);
      }
      
      .progress-text {
        color: #9ca3af;
        font-size: 0.85rem;
        font-weight: 600;
        min-width: 80px;
        text-align: right;
      }
      
      @media (max-width: 768px) {
        .verse-inputs {
          grid-template-columns: 1fr;
        }
        
        .progress-summary {
          flex-direction: column;
          gap: 8px;
        }
        
        .revision-info {
          gap: 6px;
        }
      }
      
      .spiritual-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(4px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
        padding: 20px;
        box-sizing: border-box;
      }
      
      .spiritual-modal {
        width: 95%;
        max-width: 600px;
        max-height: 90vh;
        background: linear-gradient(135deg, #0b0f1a, #1a1a2e);
        border: 2px solid rgba(139, 92, 246, 0.6);
        border-radius: 12px;
        color: #fff;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(139, 92, 246, 0.2);
        overflow: hidden;
        position: relative;
        z-index: 1001;
        animation: slideIn 0.3s ease;
        display: flex;
        flex-direction: column;
      }
      
      .spiritual-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        background: linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(168, 85, 247, 0.25));
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .spiritual-title {
        font-weight: 700;
        font-size: 1.3rem;
        text-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
      }
      
      .spiritual-close {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        color: #fff;
        font-size: 18px;
        cursor: pointer;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
      }
      
      .spiritual-close:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.1);
      }
      
      .spiritual-body {
        padding: 24px;
        overflow-y: auto;
        flex: 1;
        max-height: calc(90vh - 120px);
      }
      
      .spiritual-body::-webkit-scrollbar {
        width: 8px;
      }
      
      .spiritual-body::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
      }
      
      .spiritual-body::-webkit-scrollbar-thumb {
        background: rgba(139, 92, 246, 0.6);
        border-radius: 4px;
      }
      
      .spiritual-body::-webkit-scrollbar-thumb:hover {
        background: rgba(139, 92, 246, 0.8);
      }
      
      .spiritual-description {
        font-size: 1.1rem;
        margin-bottom: 16px;
        color: #e5e7eb;
        line-height: 1.5;
      }
      
      .spiritual-target {
        background: rgba(139, 92, 246, 0.1);
        border: 1px solid rgba(139, 92, 246, 0.3);
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 20px;
        font-weight: 600;
        color: #8b5cf6;
      }
      
      .spiritual-details {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
      }
      
      .detail-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 0.95rem;
      }
      
      .detail-item:last-child {
        margin-bottom: 0;
      }
      
      .spiritual-rewards {
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1));
        border: 1px solid rgba(16, 185, 129, 0.3);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
      }
      
      .reward-item {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-weight: 600;
        color: #10b981;
      }
      
      .reward-item:last-child {
        margin-bottom: 0;
      }
      
      .spiritual-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        padding: 20px 24px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .spiritual-btn {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 12px 20px;
        cursor: pointer;
        font-size: 1rem;
        font-weight: 600;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      }
      
      .spiritual-btn:hover {
        background: linear-gradient(135deg, #5b5cf0, #7c3aed);
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
      }
      
      .spiritual-btn:active {
        transform: translateY(0);
        box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes slideIn {
        from { transform: scale(0.9) translateY(-20px); opacity: 0; }
        to { transform: scale(1) translateY(0); opacity: 1; }
      }
      
      @media (max-width: 768px) {
        .spiritual-modal-overlay {
          padding: 15px;
        }
        
        .spiritual-modal {
          max-width: 100%;
        }
        
        .spiritual-actions {
          flex-direction: column;
          gap: 12px;
        }
        
        .spiritual-btn {
          width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(overlay);
  
  // Add event listeners
  overlay.querySelector('.spiritual-close').addEventListener('click', () => {
    document.body.removeChild(overlay);
  });
  
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
  
  if (isCompleted) {
    overlay.querySelector('#spiritual-close-btn').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });
  } else {
    overlay.querySelector('#spiritual-complete').addEventListener('click', async () => {
      await completeSpiritualTask(task);
      document.body.removeChild(overlay);
      renderAISessionTasks();
    });
    
    overlay.querySelector('#spiritual-save').addEventListener('click', async () => {
      // Save progress without completing
      await persistSpiritual();
      showNotification('Progress saved!', 'success');
      document.body.removeChild(overlay);
    });
    
    // Add event listeners for manual progress update
    const updateManualBtn = overlay.querySelector('#update-manual-progress');
    if (updateManualBtn) {
      updateManualBtn.addEventListener('click', async () => {
        await updateManualProgress(overlay);
      });
    }
    
    // Add event listeners for verse count calculation
    const startVerseInput = overlay.querySelector('#start-verse');
    const endVerseInput = overlay.querySelector('#end-verse');
    const verseCountSpan = overlay.querySelector('#verse-count');
    
    if (startVerseInput && endVerseInput && verseCountSpan) {
      const updateVerseCount = () => {
        const start = parseInt(startVerseInput.value) || 1;
        const end = parseInt(endVerseInput.value) || 1;
        const count = Math.max(1, end - start + 1);
        verseCountSpan.textContent = count;
      };
      
      startVerseInput.addEventListener('input', updateVerseCount);
      endVerseInput.addEventListener('input', updateVerseCount);
      updateVerseCount(); // Initial calculation
    }
  }
}

async function updateManualProgress(overlay) {
  try {
    const manualSurahSelect = overlay.querySelector('#manual-surah');
    const manualVersesInput = overlay.querySelector('#manual-verses');
    
    if (!manualSurahSelect || !manualVersesInput) return;
    
    const surahNum = parseInt(manualSurahSelect.value);
    const versesMemorized = parseInt(manualVersesInput.value);
    
    if (!surahNum || versesMemorized < 0) {
      showNotification('Please enter valid values', 'error');
      return;
    }
    
    // Update surah progress
    if (!spiritualData.memorizationProgress.surahProgress) {
      spiritualData.memorizationProgress.surahProgress = {};
    }
    
    const oldProgress = spiritualData.memorizationProgress.surahProgress[surahNum] || 0;
    spiritualData.memorizationProgress.surahProgress[surahNum] = versesMemorized;
    
    // Update total memorized verses
    const progressDiff = versesMemorized - oldProgress;
    spiritualData.memorizationProgress.totalVersesMemorized += progressDiff;
    
    // Update current position if this is ahead of current progress
    if (surahNum > spiritualData.memorizationProgress.currentSurah || 
        (surahNum === spiritualData.memorizationProgress.currentSurah && versesMemorized > spiritualData.memorizationProgress.currentVerse)) {
      spiritualData.memorizationProgress.currentSurah = surahNum;
      spiritualData.memorizationProgress.currentVerse = versesMemorized + 1;
    }
    
    // Update the total memorized display
    const totalMemorizedSpan = overlay.querySelector('#total-memorized');
    if (totalMemorizedSpan) {
      totalMemorizedSpan.textContent = spiritualData.memorizationProgress.totalVersesMemorized;
    }
    
    // Save progress
    await persistSpiritual();
    
    showNotification(`✅ Progress updated! Surah ${surahNum}: ${versesMemorized} verses memorized`, 'success');
    
    // Clear the input
    manualVersesInput.value = '';
    
  } catch (error) {
    console.error('Error updating manual progress:', error);
    showNotification('❌ Error updating progress', 'error');
  }
}

async function completeSpiritualTask(task) {
  try {
    task.status = 'done';
    await applyTaskRewards(task);
    await persistSpiritual();
    showNotification(`✅ ${task.name} completed! +${task.rewards?.xp || 0} XP`, 'success');
  } catch (error) {
    console.error('Error completing task:', error);
    showNotification('❌ Error completing task', 'error');
  }
}

async function applyTaskRewards(task) {
  try {
    const data = userManager.getData();
    const game = data.gameData || {};
    const rewards = task.rewards || { xp: 20, attributes: { WIS: 1 } };
    const costs = task.costs || { mp: -5, fatigue: 3 };
    
    if (rewards.xp) game.exp = Number(game.exp || 0) + Number(rewards.xp || 0);
    if (rewards.attributes) {
      game.stackedAttributes = game.stackedAttributes || {};
      Object.entries(rewards.attributes).forEach(([k, v]) => {
        game.stackedAttributes[k] = Number(game.stackedAttributes[k] || 0) + Number(v || 0);
      });
    }
    if (typeof costs.mp === 'number') game.mp = Math.max(0, Number(game.mp || 100) + Number(costs.mp));
    if (typeof costs.fatigue === 'number') game.fatigue = Math.min(100, Number(game.fatigue || 0) + Number(costs.fatigue));
    
    await userManager.updateUserData({ gameData: game });
    await userManager.saveUserData();
    console.log(`Task rewards applied for ${task.name}`);
  } catch (e) {
    console.warn('Failed to apply task rewards', e);
  }
}

async function completeAISession() {
  const s = spiritualData.todaySession;
  if (!s) return;
  
  const allCompleted = s.tasks.every(task => task.status === 'done');
  if (!allCompleted) {
    console.log('Please complete all tasks first.');
    return;
  }
  
  // Flip UI immediately to avoid perceived delay
  spiritualData.sessionCompleted = true;
  spiritualData.sessionTotal = (s.tasks || []).length || 0;
  renderAISessionTasks();
  // Fire-and-wait persistence/rewards
  await persistSpiritual();
  await applyAISessionRewards(s);
}

async function applyAISessionRewards(session) {
  try {
    const data = userManager.getData();
    const game = data.gameData || {};
    
    // Calculate total rewards from all completed tasks
    const totalXP = session.tasks.reduce((sum, task) => sum + (task.rewards?.xp || 0), 0);
    const totalWIS = session.tasks.reduce((sum, task) => sum + (task.rewards?.attributes?.WIS || 0), 0);
    const totalINT = session.tasks.reduce((sum, task) => sum + (task.rewards?.attributes?.INT || 0), 0);
    const totalPER = session.tasks.reduce((sum, task) => sum + (task.rewards?.attributes?.PER || 0), 0);
    
    game.exp = Number(game.exp || 0) + totalXP;
    game.stackedAttributes = game.stackedAttributes || {};
    game.stackedAttributes.WIS = Number(game.stackedAttributes.WIS || 0) + totalWIS;
    game.stackedAttributes.INT = Number(game.stackedAttributes.INT || 0) + totalINT;
    game.stackedAttributes.PER = Number(game.stackedAttributes.PER || 0) + totalPER;
    
    userManager.setData('gameData', game);
    await userManager.saveUserData();
    console.log(`🏛️ Spiritual session rewards applied: +${totalXP} XP, +${totalWIS} WIS, +${totalINT} INT, +${totalPER} PER`);
  } catch (e) {
    console.warn('Failed to apply session rewards', e);
    }
}

// Modified updateCompleteCheckbox function
function updateCompleteCheckbox() {
    const s = spiritualData.todaySession;
    const allCompleted = s ? s.tasks.every(task => task.completed) : false;
    const completeCheckbox = document.getElementById("complete");

    if (completeCheckbox) {
        // Also honor persisted completion from saved data
        let alreadyCompleted = false;
        try {
            if (window.userManager) {
                const gd = userManager.getData()?.gameData || {};
                alreadyCompleted = gd.spiritualQuests === "[3/3]";
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
            console.log('All spiritual tasks completed!');
            
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
                window.location.href = 'Quest_Rewards.html?data=spiritual';
            }, 1000);

            // After completion, lock all task checkboxes
            disableAllSpiritualTaskCheckboxes();
        }
    }
}

// Disable all task checkboxes (make them untickable after completion)
function disableAllSpiritualTaskCheckboxes() {
    try {
        const goalItemsDiv = document.getElementById("goal-items");
        if (!goalItemsDiv) return;
        const inputs = goalItemsDiv.querySelectorAll('input[type="checkbox"]');
        inputs.forEach(input => { input.disabled = true; });
    } catch (_) {}
}

// Update spiritual quest progress in user data (FULL QUEST COMPLETION)
async function updateSpiritualQuestProgress() {
    if (!userManager) {
        console.warn('User manager not available');
        return;
    }
    
    try {
        // Get current user data
        const userData = userManager.getData();
        const gameData = userData.gameData || {};
        
        // Check if spiritual quests are already completed to prevent double execution
        if (gameData.spiritualQuests === "[3/3]") {
            console.log('⚠️ Spiritual quests already completed, skipping...');
            return;
        }
        
        console.log('🎉 ALL SPIRITUAL QUESTS COMPLETED! Applying final rewards and costs...');
        
        // Apply costs for completing ALL spiritual quests
        const currentMP = Math.max(0, parseInt(gameData.mp) || 100);
        gameData.mp = Math.max(0, currentMP - 20);
        console.log(`🎯 SPIRITUAL QUEST COMPLETION: MP decreased from ${currentMP} to ${gameData.mp} (-20 MP)`);
        
        const currentSTM = Math.max(0, parseInt(gameData.stm) || 100);
        gameData.stm = Math.max(0, currentSTM - 10);
        console.log(`STM decreased from ${currentSTM} to ${gameData.stm}`);
        
        const currentFatigue = parseInt(gameData.fatigue) || 0;
        gameData.fatigue = currentFatigue + 20;
        console.log(`Fatigue increased from ${currentFatigue} to ${gameData.fatigue}`);
        
        // Update spiritual quest progress to completed
                    gameData.spiritualQuests = "[3/3]";
        
        // Update user data
        userManager.setData('gameData', gameData);
        
        // Save to database
        const result = await userManager.saveUserData();
        if (result.success) {
            console.log('Spiritual quest completion saved successfully');
            showNotification(`🎉 All Spiritual Quests Complete! -20 MP, -10 STM, +20 Fatigue`, 'success');
        } else {
            console.error('Error saving spiritual quest completion:', result.error);
            showNotification('❌ Error saving quest completion', 'error');
        }
        
    } catch (error) {
        console.error('Error updating spiritual quest progress:', error);
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
async function completeSpiritualQuest(taskName) {
    const task = spiritualTasks.find(t => t.name === taskName);

    if (task && !task.completed) {
        try {
            // Mark task as completed locally
            task.completed = true;
            console.log(`Quest completed: ${taskName}`);
            
            // Get current game data from userManager to ensure we have the latest data
            const userData = userManager.getData();
            const gameData = userData.gameData;
            
            // Parse current quest progress
            const currentProgress = gameData.spiritualQuests || "[0/2]";
            const match = currentProgress.match(/\[(\d+)\/(\d+)\]/);
            const currentCompleted = match ? parseInt(match[1]) : 0;
            const totalQuests = match ? parseInt(match[2]) : 2;
            
            // Update quest progress
            const newCompleted = Math.min(currentCompleted + 1, totalQuests);
            gameData.spiritualQuests = `[${newCompleted}/${totalQuests}]`;
            
            // Add EXP for completing the quest
            gameData.exp = (gameData.exp || 0) + 5;
            console.log(`EXP gained: +5 (Total: ${gameData.exp})`);
            
            // Add stacked attributes for spiritual training
            if (!gameData.stackedAttributes) {
                gameData.stackedAttributes = { STR: 0, VIT: 0, AGI: 0, INT: 0, PER: 0, WIS: 0 };
            }
            gameData.stackedAttributes.WIS += 3;  // Wisdom from spiritual training
            gameData.stackedAttributes.INT += 1;  // Intelligence from spiritual training
            
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
                showNotification(`✅ Quest completed! +5 EXP, +3 WIS, +1 INT`, 'success');
            } else {
                console.error('Error saving quest completion:', result.error);
                showNotification('❌ Error saving quest completion', 'error');
            }
            
            // Update the task display
            renderAISessionTasks();
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

// Function to update the Spiritual Status Card (display user XP and stats)
function updateSpiritualStatusCard() {
    if (currentUserData && currentUserData.gameData) {
        const exp = currentUserData.gameData.exp || 0;
        const wis = currentUserData.gameData.Attributes?.WIS || 10;
        console.log(`Current XP: ${exp}`);
        console.log(`Stats: WIS - ${wis}`);
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
        if (strElement) strElement.textContent = `STR: ${gameData.Attributes.STR}`;
        
        const vitElement = document.getElementById("vit");
        if (vitElement) vitElement.textContent = `VIT: ${gameData.Attributes.VIT}`;
        
        const agiElement = document.getElementById("agi");
        if (agiElement) agiElement.textContent = `AGI: ${gameData.Attributes.AGI}`;
        
        const intElement = document.getElementById("int");
        if (intElement) intElement.textContent = `INT: ${gameData.Attributes.INT}`;
        
        const perElement = document.getElementById("per");
        if (perElement) perElement.textContent = `PER: ${gameData.Attributes.PER}`;
        
        const wisElement = document.getElementById("wis");
        if (wisElement) wisElement.textContent = `WIS: ${gameData.Attributes.WIS}`;
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
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Auto-redirect to penalty page after 2 hours (7200000 ms)
setTimeout(function() {
    console.log('Auto-redirecting to penalty page');
    window.location.href = 'Penalty_Quest.html';
}, 7200000); 
