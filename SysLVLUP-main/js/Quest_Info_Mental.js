// Mental Quest System - Updated for new UserManager
let userManager = null;
let currentUserData = null;

// Debounced save mechanism
let saveTimeout = null;

document.addEventListener("DOMContentLoaded", function() {
  console.log('Mental Quest page loaded');
  
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
  
  // Process unanalyzed feedback notes
  processUnanalyzedFeedback();
  
  // Set up periodic analysis every 30 seconds
  setInterval(processUnanalyzedFeedback, 30000);
});

// Initialize the quest page
async function initializeQuestPage() {
  try {
    // Show loading message immediately
    const goalItemsDiv = document.getElementById("goal-items");
    if (goalItemsDiv) {
      goalItemsDiv.innerHTML = '<div class="loading-message">🧠 Preparing today\'s mental tasks...</div>';
    }
    
    // Add CSS for task separators and note interface
    const style = document.createElement('style');
    style.textContent = `
        .task-separator {
            text-align: center;
            color: rgba(176, 224, 255, 0.3);
            font-size: 12px;
            margin: 8px 0;
            letter-spacing: 2px;
        }
        
    `;
    document.head.appendChild(style);
    
    // Create user manager instance
    userManager = new UserManager();
    
    // Set the user ID and load data
    await userManager.setUserId(localStorage.getItem('playerName'));
    
    // Get current data
    currentUserData = userManager.getData();
    
    // Load mental data
    mentalData = currentUserData?.mentalTrainingData || getDefaultMentalData();
    
    // Ensure currentBook exists (safety check for daily reset)
    if (!mentalData.currentBook) {
        mentalData.currentBook = { title: "", currentPage: 0, totalPages: 0, startDate: null };
    }
    
    if (currentUserData && currentUserData.gameData) {
      console.log('User data loaded:', currentUserData.gameData);
      loadData(currentUserData.gameData);
    } else {
      console.log('No existing data, using defaults');
      loadData({});
    }
    
    // Ensure today's session exists
    await ensureTodaySession();
    
    // Render the mental tasks
    renderMentalTasks();
    
  } catch (error) {
    console.error('Error initializing quest page:', error);
    // Fallback to default data
    loadData({});
    renderMentalTasks();
  }
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

// Mental Quest Data Structure
let mentalData = null;

// Task Pools for AI Generation
const taskPools = {
    mindfulness: [
        "Meditation (10 min)",
        "Journaling (10 min)", 
        "Gratitude Practice (5 min)",
        "Breathing Exercises (5 min)",
        "Mindfulness Walk (10 min)",
        "Reflection Writing (10 min)"
    ],
    learning: [
        "Book Reading (10 pages)",
        "Article Reading (2 articles)",
        "Language Learning (10 min)",
        "Documentary Watching (15 min)",
        "Podcast Listening (1 episode)"
    ],
    problemSolving: [
        "Puzzle Solving (Sudoku/Crossword)",
        "Brain Training (10 min app)",
        "Memory Games (10 min)",
        "Speed Reading (5 pages in 10 min)",
        "Trivia Challenge (20 questions)"
    ],
    criticalThinking: [
        "Philosophy Reading (1 article)",
        "Case Study Analysis (1 case)",
        "Research Deep Dive (investigate 1 topic)",
        "Debate Practice (watch/read debates)",
        "Memory Palace Practice (memorize 10 items)"
    ],
    creative: [
        "Creative Writing (300 words)",
        "Drawing/Sketching (10 min)",
        "Music Practice (10 min)",
        "Poetry Writing (1 poem)",
        "Storytelling Practice (tell 1 story)"
    ]
};

// Default mental data structure
function getDefaultMentalData() {
    return {
        currentSession: null,
        lastSessionDate: null,
        sessionCompleted: false,
        sessionTotal: 0,
        feedbackNotes: [],
        currentBook: {
            title: "",
            currentPage: 0,
            totalPages: 0,
            startDate: null
        }
    };
}

// Ensure today's session exists
async function ensureTodaySession() {
    const today = new Date().toDateString();
    
    // Check if we need a new session
    if (mentalData.lastSessionDate !== today) {
        console.log('🔄 New day detected, generating new mental training session');
        
        if (mentalData.lastSessionDate !== null) {
            console.log('🔄 Existing user - generating new session');
        } else {
            console.log('🔄 New user - generating first session');
        }
        
        // Generate new AI session with retry for vague tasks
        let newSession = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (!newSession && attempts < maxAttempts) {
            attempts++;
            console.log(`🔄 Attempt ${attempts}/${maxAttempts} to generate specific tasks...`);
            newSession = await generateAISession();
            
            if (!newSession) {
                console.warn(`❌ Attempt ${attempts} failed, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            }
        }
        
        if (newSession) {
            mentalData.currentSession = newSession;
            mentalData.lastSessionDate = today;
            mentalData.sessionCompleted = false;
            mentalData.sessionTotal = newSession.tasks.length;
            
            // Save the new session
            await persistMental();
            console.log('✅ New mental session generated and saved with specific tasks');
        } else {
            console.log('⚠️ Failed to generate new session, keeping existing');
        }
    } else {
        console.log('✅ Today\'s mental session already exists');
    }
}

// Extract any complete task objects from text
function extractAnyCompleteTasks(text) {
    try {
        // Find all task objects using regex
        const taskRegex = /\{[^{}]*"name"[^{}]*"description"[^{}]*"category"[^{}]*"duration"[^{}]*"rewards"[^{}]*\}/g;
        const matches = text.match(taskRegex);
        
        if (matches && matches.length > 0) {
            const tasks = [];
            for (const match of matches) {
                try {
                    const task = JSON.parse(match);
                    if (task.name && task.description && task.category && task.duration) {
                        tasks.push(task);
                    }
                } catch (e) {
                    // Skip invalid task objects
                }
            }
            
            if (tasks.length > 0) {
                console.log(`✅ Extracted ${tasks.length} complete tasks from any text`);
                return { tasks };
            }
        }
        
        return null;
    } catch (e) {
        console.warn('Failed to extract any complete tasks:', e);
        return null;
    }
}

// Extract complete tasks from truncated JSON
function extractCompleteTasksFromTruncatedJson(text) {
    try {
        // Find all complete task objects in the text
        const taskMatches = text.match(/\{[^{}]*"name"[^{}]*"description"[^{}]*"category"[^{}]*"duration"[^{}]*"rewards"[^{}]*\}/g);
        
        if (taskMatches && taskMatches.length > 0) {
            const tasks = [];
            for (const match of taskMatches) {
                try {
                    const task = JSON.parse(match);
                    if (task.name && task.description && task.category && task.duration) {
                        tasks.push(task);
                    }
                } catch (e) {
                    // Skip invalid task objects
                }
            }
            
            if (tasks.length > 0) {
                console.log(`✅ Extracted ${tasks.length} complete tasks from truncated JSON`);
                return { tasks };
            }
        }
        
        return null;
    } catch (e) {
        console.warn('Failed to extract tasks from truncated JSON:', e);
        return null;
    }
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
        t = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1');
        return JSON.parse(t);
    } catch (_) {
        // Try to handle truncated JSON by finding the last complete task
        try {
            let t = String(text);
            t = t.replace(/^```[a-zA-Z]*\n?/m, '').replace(/```$/m, '');
            const first = t.indexOf('{');
            if (first === -1) return null;
            
            // Find the last complete task by looking for complete objects
            let lastCompleteBrace = -1;
            let braceCount = 0;
            let inString = false;
            let escapeNext = false;
            
            for (let i = first; i < t.length; i++) {
                const char = t[i];
                if (escapeNext) {
                    escapeNext = false;
                    continue;
                }
                if (char === '\\') {
                    escapeNext = true;
                    continue;
                }
                if (char === '"' && !escapeNext) {
                    inString = !inString;
                    continue;
                }
                if (!inString) {
                    if (char === '{') braceCount++;
                    if (char === '}') {
                        braceCount--;
                        if (braceCount === 0) {
                            lastCompleteBrace = i;
                        }
                    }
                }
            }
            
            if (lastCompleteBrace > first) {
                const truncatedJson = t.slice(first, lastCompleteBrace + 1);
                const parsed = JSON.parse(truncatedJson);
                console.log('✅ Successfully parsed truncated JSON');
                return parsed;
            }
        } catch (e) {
            console.warn('Failed to parse truncated JSON:', e);
        }
        
        console.warn('Failed to parse JSON loosely:', text);
        return null;
    }
}

// Generate AI-powered mental training session
async function generateAISession() {
    try {
        console.log('🤖 Generating AI mental training session...');
        
        const GEMINI_API_KEY = 'AIzaSyAtL-nZJQ_rBdK72qvn5ocgbf6bgUPlgNo';
        const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';
        
        // Get player feedback for personalization (from currentUserData like physical training)
        const feedbackContext = currentUserData?.feedbackNotes
            ?.filter(note => !note.analyzed)
            ?.map(note => note.message)
            ?.join('; ') || 'No feedback yet';
        
        const playerLevel = currentUserData?.gameData?.level || 1;
        
        // Create AI prompt using task pools with book tracking
        const currentBook = mentalData.currentBook || { title: "", currentPage: 0, totalPages: 0 };
        const bookProgress = currentBook.title ? 
            `Current book: "${currentBook.title}" (page ${currentBook.currentPage}/${currentBook.totalPages})` : 
            "No current book - player can choose any book";
            
        const prompt = `Generate 3-4 daily mental tasks by customizing these base tasks with specific details:

BASE TASKS TO CUSTOMIZE:
${JSON.stringify(taskPools, null, 2)}

BOOK READING STRATEGY:
- ${bookProgress}
- If player has a current book: "Read 15-20 pages of your current book"
- If no current book: "Read 15-20 pages of any book you choose"
- NEVER specify book titles - let player choose
- Focus on consistent reading progress

INSTRUCTIONS:
- Pick 1 task from mindfulness + 2-3 from other categories
- Add specific details (topics, numbers, etc.) but NOT book names
- Vary durations: "5 min", "7 min", "10 min", "8 min", "6 min", "12 min", "15 min", "20 min"
- Make tasks actionable and specific
- ONLY use these 2 attributes: INT (Intelligence), WIS (Wisdom)
- NEVER use STR, AGI, VIT, CHA, DEX, CON, LCK, or any other attributes

ATTRIBUTE GUIDELINES:
- INT: Learning, reading, problem-solving, knowledge tasks
- WIS: Mindfulness, meditation, reflection, spiritual tasks

EXAMPLES:
- "Book Reading" → "Read 15-20 pages of your current book" (INT)
- "Meditation" → "Practice 7 minutes of mindful breathing" (WIS)
- "Memory Games" → "Play 3 rounds of memory card matching game" (INT)
- "Critical Thinking" → "Solve 1 logic puzzle or brain teaser" (INT)

Player level: ${playerLevel}
Feedback: ${feedbackContext || 'No feedback yet'}

Return JSON:
{
  "tasks": [
    {
      "name": "Customized specific task name",
      "description": "Clear instructions with specific details",
      "category": "mindfulness|learning|problemSolving|criticalThinking|creative",
      "duration": "7 min",
      "rewards": {
        "xp": 15,
        "attributes": {
          "INT": 1,
          "WIS": 1
        }
      }
    }
  ]
}`;

        const payload = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: 0.8,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 2048, // Back to original working value
            }
        };

        const resp = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!resp.ok) {
            throw new Error(`Gemini API error: ${resp.status} ${resp.statusText}`);
        }

        const json = await resp.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text || typeof text !== 'string') {
            throw new Error('Gemini API returned empty content');
        }

        console.log('AI Response text:', text);
        console.log('🔍 Full AI response for debugging:', JSON.stringify(text, null, 2));

        // Clean the response text - remove markdown code blocks if present
        let cleanText = text.trim();
        if (cleanText.startsWith('```json')) {
            cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        }
        if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        // Parse the JSON response using the robust parser
        let sessionData = parseJsonLoosely(cleanText);
        
        if (!sessionData) {
            // Try to extract complete tasks from truncated JSON
            sessionData = extractCompleteTasksFromTruncatedJson(cleanText);
        }
        
        if (!sessionData) {
            // Last resort: try to extract any complete task objects
            sessionData = extractAnyCompleteTasks(cleanText);
        }
        
        if (!sessionData) {
            throw new Error('Failed to parse AI response as JSON');
        }
        
        // Validate and sanitize the session
        if (sessionData.tasks && Array.isArray(sessionData.tasks)) {
            // Simple validation: just check if tasks have names and durations
            const hasInvalidTasks = sessionData.tasks.some(task => {
                return !task.name || !task.duration || !task.description;
            });
            
            if (hasInvalidTasks) {
                console.warn('🚨 AI generated incomplete tasks, rejecting...');
                throw new Error('Generated tasks are incomplete - regenerating');
            }
            
            sessionData.tasks.forEach(task => {
                // Ensure required fields
                task.name = task.name || 'Mental Task';
                task.description = task.description || 'Complete this mental exercise';
                task.category = task.category || 'learning';
                task.duration = task.duration || '5-10 min'; // Default duration
                task.completed = false;
                task.status = 'pending'; // Initialize status for daily quest counter
                
                // Ensure rewards structure with only existing attributes
                if (!task.rewards) {
                    task.rewards = { xp: 15, attributes: { INT: 1 } };
                }
                if (!task.rewards.attributes) {
                    task.rewards.attributes = { INT: 1 };
                }
                
                // Remove any physical attributes (STR, AGI, VIT) and other invalid attributes
                const validAttributes = ['INT', 'WIS'];
                const filteredAttributes = {};
                for (const [attr, value] of Object.entries(task.rewards.attributes)) {
                    if (validAttributes.includes(attr)) {
                        filteredAttributes[attr] = value;
                    }
                }
                task.rewards.attributes = filteredAttributes;
                
                console.log(`📋 Task: "${task.name}" - Duration: "${task.duration}"`);
            });
            
            console.log('✅ AI mental session generated successfully with specific tasks');
            return sessionData;
        } else {
            throw new Error('Invalid AI response structure - missing tasks array');
        }

    } catch (error) {
        console.error('Error generating AI mental session:', error);
        return null;
    }
}

// Persist mental data with debouncing
async function persistMental() {
    if (!userManager) {
        console.warn('User manager not available');
        return;
    }
    
    // Clear existing timeout
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
    // Set new timeout for debounced save
    saveTimeout = setTimeout(async () => {
        try {
            await userManager.updateUserData({
                mentalTrainingData: mentalData
            });
            console.log('Mental data persisted');
        } catch (error) {
            console.error('Error persisting mental data:', error);
        }
    }, 500); // 500ms debounce
}

// Force immediate save (for critical operations)
async function persistMentalImmediate() {
    if (!userManager) {
        console.warn('User manager not available');
        return;
    }
    
    // Clear any pending debounced save
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    
    try {
        await userManager.updateUserData({
            mentalTrainingData: mentalData
        });
        await userManager.forceSaveUserData();
        console.log('Mental data persisted immediately');
    } catch (error) {
        console.error('Error persisting mental data immediately:', error);
    }
}

// Function to render mental tasks
function renderMentalTasks() {
    const goalItemsDiv = document.getElementById("goal-items");
    if (!goalItemsDiv) {
        console.error('Goal items div not found');
        return;
    }

    goalItemsDiv.innerHTML = ''; // Clear existing tasks

    // Check if we have a current session
    if (!mentalData.currentSession || !mentalData.currentSession.tasks) {
        console.log('No current session, showing loading...');
        goalItemsDiv.innerHTML = '<div class="loading-message">🧠 Preparing today\'s mental tasks...</div>';
        return;
    }

    // Render AI-generated tasks
    mentalData.currentSession.tasks.forEach((task, index) => {
        const taskDiv = document.createElement("div");
        taskDiv.classList.add("goal-item");

        taskDiv.innerHTML = `
            <span class="task-name">${task.description}</span>
            <span class="task-reps">[${task.duration}]</span>
            <input type="checkbox" ${task.completed ? "checked" : ""} onchange="completeMentalTask('${task.name}')">
        `;
        goalItemsDiv.appendChild(taskDiv);
        
        // Add separator line between tasks (except after the last one)
        if (index < mentalData.currentSession.tasks.length - 1) {
            const separatorDiv = document.createElement("div");
            separatorDiv.classList.add("task-separator");
            separatorDiv.innerHTML = "────────────";
            goalItemsDiv.appendChild(separatorDiv);
        }
    });

    // Update completion status
    updateCompleteCheckbox();
    
    // Initialize feedback system
    initializeFeedbackSystem();
}

// Initialize feedback system (copied from physical training)
function initializeFeedbackSystem() {
    const feedbackBtn = document.getElementById('feedbackBtn');
    if (feedbackBtn) {
        feedbackBtn.addEventListener('click', openFeedbackModal);
    }
}

// Feedback modal system (copied from physical training)
let feedbackModal = null;

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
            }
            
            .feedback-modal {
                background: linear-gradient(135deg, rgba(13, 18, 28, 0.95), rgba(25, 35, 50, 0.95));
                border: 2px solid rgba(176, 224, 255, 0.3);
                border-radius: 16px;
                padding: 0;
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(79, 195, 247, 0.2);
                animation: feedbackModalAppear 0.3s ease-out;
                box-sizing: border-box;
            }
            
            @keyframes feedbackModalAppear {
                from {
                    opacity: 0;
                    transform: scale(0.8) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
            
            .feedback-header {
                background: linear-gradient(135deg, rgba(79, 195, 247, 0.2), rgba(176, 224, 255, 0.1));
                padding: 20px;
                border-bottom: 1px solid rgba(176, 224, 255, 0.2);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .feedback-header h3 {
                margin: 0;
                color: #b0e0ff;
                font-size: 1.3rem;
                text-shadow: 0 0 10px rgba(176, 224, 255, 0.5);
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .feedback-close {
                background: none;
                border: none;
                color: #b0e0ff;
                font-size: 24px;
                cursor: pointer;
                padding: 5px;
                border-radius: 4px;
                transition: all 0.2s ease;
            }
            
            .feedback-close:hover {
                background: rgba(255, 255, 255, 0.1);
                transform: scale(1.1);
            }
            
            .feedback-body {
                padding: 25px;
                box-sizing: border-box;
            }
            
            .feedback-message label {
                display: block;
                color: #b0e0ff;
                margin-bottom: 10px;
                font-weight: 500;
                text-shadow: 0 0 5px rgba(176, 224, 255, 0.3);
            }
            
            .feedback-message textarea {
                width: 100%;
                min-height: 120px;
                padding: 15px;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(176, 224, 255, 0.3);
                border-radius: 8px;
                color: #ffffff;
                font-size: 14px;
                resize: vertical;
                font-family: inherit;
                transition: all 0.3s ease;
                box-sizing: border-box;
            }
            
            .feedback-message textarea:focus {
                outline: none;
                border-color: #4fc3f7;
                box-shadow: 0 0 15px rgba(79, 195, 247, 0.3);
                background: rgba(0, 0, 0, 0.4);
            }
            
            .feedback-message textarea::placeholder {
                color: rgba(176, 224, 255, 0.5);
            }
            
            .feedback-actions {
                display: flex;
                gap: 15px;
                margin-top: 20px;
                justify-content: flex-end;
            }
            
            .feedback-submit, .feedback-cancel {
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .feedback-submit {
                background: linear-gradient(135deg, #4fc3f7, #29b6f6);
                color: white;
                box-shadow: 0 4px 15px rgba(79, 195, 247, 0.3);
            }
            
            .feedback-submit:hover {
                background: linear-gradient(135deg, #29b6f6, #0288d1);
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(79, 195, 247, 0.4);
            }
            
            .feedback-cancel {
                background: rgba(255, 255, 255, 0.1);
                color: #b0e0ff;
                border: 1px solid rgba(176, 224, 255, 0.3);
            }
            
            .feedback-cancel:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-1px);
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
    
    // Focus textarea
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
        alert('Please enter a message before submitting.');
        return;
    }
    
    try {
        // Add feedback to currentUserData (same as physical training)
        if (!currentUserData.feedbackNotes) {
            currentUserData.feedbackNotes = [];
        }
        
        const feedbackData = {
            message: message,
            timestamp: new Date().toISOString(),
            analyzed: false,
            source: 'mental' // Track that this came from mental training
        };
        
        currentUserData.feedbackNotes.push(feedbackData);
        
        // Update local data
        userManager.updateData({ feedbackNotes: currentUserData.feedbackNotes });
        
        // Save to database
        await userManager.saveUserData();
        
        // Show success message
        const submitBtn = feedbackModal.querySelector('.feedback-submit');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = '✅ Sent to Architect!';
        submitBtn.style.background = 'linear-gradient(135deg, #4caf50, #45a049)';
        
        setTimeout(() => {
            closeFeedbackModal();
        }, 1500);
        
        console.log("Mental feedback submitted:", message);
        
        // Process feedback after a short delay
        setTimeout(() => {
            processUnanalyzedFeedback();
        }, 1000);
        
    } catch (error) {
        console.error('Error submitting feedback:', error);
        alert('Failed to save feedback. Please try again.');
    }
}


// Process unanalyzed feedback notes (copied from physical training)
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

// Function to handle book reading progress
function updateBookProgress(pagesRead) {
    // Ensure currentBook exists
    if (!mentalData.currentBook) {
        mentalData.currentBook = { title: "", currentPage: 0, totalPages: 0 };
    }
    
    if (!mentalData.currentBook.title) {
        // No current book, player can start any book
        return;
    }
    
    mentalData.currentBook.currentPage += pagesRead;
    
    // Check if book is completed
    if (mentalData.currentBook.currentPage >= mentalData.currentBook.totalPages) {
        // Book completed!
        console.log(`🎉 Book completed: "${mentalData.currentBook.title}"`);
        
        // Reset for new book
        mentalData.currentBook = {
            title: "",
            currentPage: 0,
            totalPages: 0,
            startDate: null
        };
        
        // Could add celebration or achievement here
    }
    
    // Save progress
    persistMental();
}

// Function to toggle the completion state of a mental task
async function completeMentalTask(taskName) {
    if (!mentalData.currentSession || !mentalData.currentSession.tasks) {
        console.error('No current session available');
        return;
    }

    const task = mentalData.currentSession.tasks.find(t => t.name === taskName);
    
    if (!task) {
        console.error(`Task ${taskName} not found`);
        return;
    }

    if (!task.completed) {
        // Complete the task
        task.completed = true;
        task.status = 'done'; // Also set status for daily quest counter
        console.log(`Task ${taskName} completed`);
        
        // Handle book reading progress
        if (task.description && task.description.toLowerCase().includes('read') && task.description.includes('pages')) {
            // Extract page count from description (e.g., "Read 15-20 pages" -> use 17 as average)
            const pageMatch = task.description.match(/(\d+)-(\d+)\s*pages/);
            if (pageMatch) {
                const minPages = parseInt(pageMatch[1]);
                const maxPages = parseInt(pageMatch[2]);
                const avgPages = Math.round((minPages + maxPages) / 2);
                updateBookProgress(avgPages);
            }
        }
        
        // Apply task rewards
        await applyTaskRewards(task);
        
        // Check if all tasks are completed
        const allCompleted = mentalData.currentSession.tasks.every(t => t.completed);
        if (allCompleted) {
            await completeAISession();
        }
        
        // Save progress immediately (force save to bypass cooldown)
        await persistMentalImmediate();
        
        // Update UI
        renderMentalTasks();
    } else {
        // Uncomplete the task (for debugging/testing)
        task.completed = false;
        task.status = 'pending'; // Reset status for daily quest counter
        console.log(`Task ${taskName} uncompleted`);
        await persistMentalImmediate();
        renderMentalTasks();
    }
}

// Apply rewards for completing a task
async function applyTaskRewards(task) {
    try {
        const gameData = currentUserData.gameData;
        
        // Apply XP
        const xpGain = task.rewards.xp || 15;
        gameData.exp = (gameData.exp || 0) + xpGain;
        console.log(`EXP gained: +${xpGain} (Total: ${gameData.exp})`);
        
        // Apply attributes
        if (task.rewards.attributes) {
            if (!gameData.stackedAttributes) {
                gameData.stackedAttributes = { STR: 0, VIT: 0, AGI: 0, INT: 0, PER: 0, WIS: 0 };
            }
            
            Object.entries(task.rewards.attributes).forEach(([attr, value]) => {
                gameData.stackedAttributes[attr] = (gameData.stackedAttributes[attr] || 0) + value;
                console.log(`${attr} gained: +${value}`);
            });
        }
        
        // Update user data
        userManager.setData('gameData', gameData);
        
        // Save to database
        await userManager.saveUserData();
        
        console.log(`🎯 Task rewards applied for ${task.name}`);
        
    } catch (error) {
        console.error('Error applying task rewards:', error);
    }
}

// Complete the entire AI session
async function completeAISession() {
    try {
        console.log('🎉 ALL MENTAL TASKS COMPLETED!');
        
        // Mark session as completed
        mentalData.sessionCompleted = true;
        
        // Apply session completion rewards
        const gameData = currentUserData.gameData;
        const sessionRewards = calculateSessionRewards();
        
        // Apply XP
        gameData.exp = (gameData.exp || 0) + sessionRewards.xp;
        console.log(`Session XP gained: +${sessionRewards.xp}`);
        
        // Apply attributes
        if (!gameData.stackedAttributes) {
            gameData.stackedAttributes = { STR: 0, VIT: 0, AGI: 0, INT: 0, PER: 0, WIS: 0 };
        }
        
        Object.entries(sessionRewards.attributes).forEach(([attr, value]) => {
            gameData.stackedAttributes[attr] = (gameData.stackedAttributes[attr] || 0) + value;
        });
        
        // Update mental quest counter
        await updateMentalQuestProgress();
        
        // Complete full mental quest progress (rewards/costs)
        await completeMentalQuestProgress();
        
        // Update user data
        userManager.setData('gameData', gameData);
        
        // Save to database immediately (force save to bypass cooldown)
        await persistMentalImmediate();
        await userManager.forceSaveUserData();
        
        // Show completion notification
        showNotification('🎉 All Mental Tasks Complete!', 'success');
        
        console.log('✅ Mental session completed successfully');
        
    } catch (error) {
        console.error('Error completing mental session:', error);
    }
}

// Calculate session rewards
function calculateSessionRewards() {
    const tasks = mentalData.currentSession.tasks;
    let totalXp = 0;
    const totalAttributes = { INT: 0, WIS: 0, PER: 0 };
    
    tasks.forEach(task => {
        totalXp += task.rewards.xp || 15;
        
        if (task.rewards.attributes) {
            Object.entries(task.rewards.attributes).forEach(([attr, value]) => {
                if (totalAttributes[attr] !== undefined) {
                    totalAttributes[attr] += value;
                }
            });
        }
    });
    
    return {
        xp: totalXp,
        attributes: totalAttributes
    };
}

// Update mental quest progress for individual task completion
async function updateMentalQuestProgress() {
    try {
        const gameData = currentUserData.gameData;
        
        // Get current mental quest progress
        const mentalQuests = gameData.mentalQuests || '[0/3]';
        const match = mentalQuests.match(/\[(\d+)\/(\d+)\]/);
        const currentCompleted = match ? parseInt(match[1]) : 0;
        const totalQuests = match ? parseInt(match[2]) : 3;
        
        // Update quest progress
        const newCompleted = Math.min(currentCompleted + 1, totalQuests);
        gameData.mentalQuests = `[${newCompleted}/${totalQuests}]`;
        
        console.log(`🎯 Mental quest progress: ${mentalQuests} -> ${gameData.mentalQuests}`);
        
    } catch (error) {
        console.error('Error updating mental quest progress:', error);
    }
}

// Modified updateCompleteCheckbox function
function updateCompleteCheckbox() {
    // Check if we have a current session
    if (!mentalData.currentSession || !mentalData.currentSession.tasks) {
        return;
    }
    
    const allCompleted = mentalData.currentSession.tasks.every(task => task.completed);
    const completeCheckbox = document.getElementById("complete");

    if (completeCheckbox) {
        // Also honor persisted completion from saved data
        let alreadyCompleted = false;
        try {
            if (window.userManager) {
                const gd = userManager.getData()?.gameData || {};
                alreadyCompleted = gd.mentalQuests === "[3/3]";
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
            console.log('All mental tasks completed!');
            
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
                window.location.href = 'Quest_Rewards.html?data=mental';
            }, 1000);

            // After completion, lock all task checkboxes
            disableAllMentalTaskCheckboxes();
        }
    }
}

// Disable all task checkboxes (make them untickable after completion)
function disableAllMentalTaskCheckboxes() {
    try {
        const goalItemsDiv = document.getElementById("goal-items");
        if (!goalItemsDiv) return;
        const inputs = goalItemsDiv.querySelectorAll('input[type="checkbox"]');
        inputs.forEach(input => { input.disabled = true; });
    } catch (_) {}
}

// Update mental quest progress for full quest completion
async function completeMentalQuestProgress() {
    if (!userManager) {
        console.warn('User manager not available');
        return;
    }
    
    try {
        // Get current user data
        const userData = userManager.getData();
        const gameData = userData.gameData || {};
        
        // Check if mental quests are already completed to prevent double execution
        if (gameData.mentalQuests === "[3/3]") {
            console.log('⚠️ Mental quests already completed, skipping...');
            return;
        }
        
        console.log('🎉 ALL MENTAL QUESTS COMPLETED! Applying final rewards and costs...');
        
        // Apply costs for completing ALL mental quests
        const currentMP = Math.max(0, parseInt(gameData.mp) || 100);
        gameData.mp = Math.max(0, currentMP - 20);
        console.log(`🎯 MENTAL QUEST COMPLETION: MP decreased from ${currentMP} to ${gameData.mp} (-20 MP)`);
        
        const currentSTM = Math.max(0, parseInt(gameData.stm) || 100);
        gameData.stm = Math.max(0, currentSTM - 10);
        console.log(`STM decreased from ${currentSTM} to ${gameData.stm}`);
        
        const currentFatigue = parseInt(gameData.fatigue) || 0;
        gameData.fatigue = currentFatigue + 20;
        console.log(`Fatigue increased from ${currentFatigue} to ${gameData.fatigue}`);
        
        // Update mental quest progress to completed
        gameData.mentalQuests = "[3/3]";
        
        // Update user data
        userManager.setData('gameData', gameData);
        
        // Save to database
        const result = await userManager.saveUserData();
        if (result.success) {
            console.log('Mental quest completion saved successfully');
            showNotification(`🎉 All Mental Quests Complete! -20 MP, -10 STM, +20 Fatigue`, 'success');
        } else {
            console.error('Error saving mental quest completion:', result.error);
            showNotification('❌ Error saving quest completion', 'error');
        }
        
    } catch (error) {
        console.error('Error updating mental quest progress:', error);
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
async function completeMentalQuest(taskName) {
    const task = mentalTasks.find(t => t.name === taskName);

    if (task && !task.completed) {
        try {
            // Mark task as completed locally
            task.completed = true;
            console.log(`Quest completed: ${taskName}`);
            
            // Get current game data from userManager to ensure we have the latest data
            const userData = userManager.getData();
            const gameData = userData.gameData;
            console.log('Current game data before update:', JSON.stringify(gameData, null, 2));
            
            // Parse current quest progress
            const currentProgress = gameData.mentalQuests || "[0/3]";
            const match = currentProgress.match(/\[(\d+)\/(\d+)\]/);
            const currentCompleted = match ? parseInt(match[1]) : 0;
            const totalQuests = match ? parseInt(match[2]) : 3;
            
            // Update quest progress
            const newCompleted = Math.min(currentCompleted + 1, totalQuests);
            gameData.mentalQuests = `[${newCompleted}/${totalQuests}]`;
            
            // Add EXP for completing the quest
            gameData.exp = (gameData.exp || 0) + 5;
            console.log(`EXP gained: +5 (Total: ${gameData.exp})`);
            
            // Add stacked attributes for mental training
            if (!gameData.stackedAttributes) {
                gameData.stackedAttributes = { STR: 0, VIT: 0, AGI: 0, INT: 0, PER: 0, WIS: 0 };
            }
            gameData.stackedAttributes.INT += 2;  // Intelligence from mental training
            gameData.stackedAttributes.PER += 1;  // Perception from mental training
            
            console.log('Stacked attributes updated:', gameData.stackedAttributes);
            
            // Check for level up
            if (gameData.exp >= 100) {
                await handleLevelUp(gameData);
            }
            
            // Update user data
            userManager.setData('gameData', gameData);
            console.log('Game data after update:', JSON.stringify(gameData, null, 2));
            console.log('UserManager data after setData:', JSON.stringify(userManager.getData(), null, 2));
            
            // Force save by temporarily clearing lastLoadTime
            userManager.lastLoadTime = 0;
            
            // Save to database
            const result = await userManager.saveUserData();
            if (result.success) {
                console.log('Quest completion saved successfully');
                console.log('Final saved data:', JSON.stringify(userManager.getData(), null, 2));
                showNotification(`✅ Quest completed! +5 EXP, +2 INT, +1 PER`, 'success');
            } else {
                console.error('Error saving quest completion:', result.error);
                showNotification('❌ Error saving quest completion', 'error');
            }
            
            // Update the task display
            renderMentalTasks();
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

// Function to update the Mental Status Card (display user XP and stats)
function updateMentalStatusCard() {
    if (currentUserData && currentUserData.gameData) {
        const exp = currentUserData.gameData.exp || 0;
        const int = currentUserData.gameData.Attributes?.INT || 10;
        const per = currentUserData.gameData.Attributes?.PER || 10;
        console.log(`Current XP: ${exp}`);
        console.log(`Stats: INT - ${int}, PER - ${per}`);
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
