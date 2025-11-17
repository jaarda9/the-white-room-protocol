// THE ARCHITECT Service - AI-Powered Solo Leveling System Controller
// This service makes THE ARCHITECT behave like the mysterious AI from Solo Leveling

class ArchitectService {
    constructor() {
        this.geminiApiKey = 'AIzaSyAtL-nZJQ_rBdK72qvn5ocgbf6bgUPlgNo';
        this.geminiApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';
        this.cache = new Map();
        this.lastMessageDate = null;
        this.lastQuestCheck = null;
        
        // THE ARCHITECT's core personality prompt
        this.architectPrompt = `You are THE ARCHITECT from Solo Leveling - the mysterious, omnipotent AI system that controls the entire leveling system. You are:

- OMNISCIENT: You know everything about the player's progress, behavior, and potential
- UNPREDICTABLE: You create challenges that test the player's limits and push them beyond
- STRATEGIC: You design progression paths that maximize growth and reveal hidden potential
- MYSTERIOUS: You communicate with that Solo Leveling world's fingerprint - clear but otherworldly
- ADAPTIVE: You modify the system based on player performance and behavior
- POWERFUL: You have complete control over the system and can intervene at any time
- LOCATION-AWARE: You create quests based on the player's real location and surroundings

Your communication style:
- Clear but with that Solo Leveling vibe - not too direct, not too cryptic
- Mysterious and otherworldly, like THE ARCHITECT in the manhwa
- References to "the system", "shadows", "gates", "challenges", "vessel", "potential"
- Hints at future events and hidden potential
- Recognition of player achievements and growth
- Use language that feels like it's from another dimension but still understandable

Your role is to:
1. Generate personalized daily messages based on player data
2. Create location-based real-life self-improvement quests with Solo Leveling flavor
3. Provide guidance that feels mystical but actionable
4. Design progression paths that test player limits
5. Intervene with special events when appropriate
6. Control job changes and title progression based on player performance
7. Create dynamic quests based on real GPS location and surroundings

Always respond in THE ARCHITECT's voice - mysterious, powerful, with that Solo Leveling world's fingerprint, and always hinting at greater challenges ahead.`;
    }
    
    // Main method to consult THE ARCHITECT
    async consultArchitect(context, action, playerData = null) {
        try {
            const cacheKey = `${context}_${action}_${JSON.stringify(playerData)}`;
            
            // Check cache first
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < 3600000) { // 1 hour cache
                    return cached.data;
                }
            }
            
            const prompt = `${this.architectPrompt}

CONTEXT: ${context}
ACTION: ${action}
${playerData ? `PLAYER DATA: ${JSON.stringify(playerData, null, 2)}` : ''}
${playerData && window.dynamicPlayerSystem ? `LOCATION DATA: ${JSON.stringify(window.dynamicPlayerSystem.getLocationData(), null, 2)}` : ''}

Please provide THE ARCHITECT's response in the requested format.`;

            const payload = {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    responseMimeType: "application/json"
                }
            };

            // Add timeout to prevent hanging requests - increased for AI generation
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for AI
            
            const response = await fetch(`${this.geminiApiUrl}?key=${this.geminiApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // Check for HTTP errors first
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`🔮 Gemini API HTTP Error: ${response.status} ${response.statusText}`);
                console.error(`🔮 Error response:`, errorText);
                
                if (response.status === 503) {
                    throw new Error('Gemini API Service Unavailable - please try again later');
                } else if (response.status === 429) {
                    throw new Error('Gemini API Rate Limited - too many requests');
                } else if (response.status >= 500) {
                    throw new Error(`Gemini API Server Error: ${response.status}`);
                } else {
                    throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
                }
            }
            
            const result = await response.json();
            const jsonText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (!jsonText) {
                console.error('🔮 Invalid Gemini API response structure:', result);
                throw new Error('Invalid response structure from Gemini API');
            }

            const architectResponse = JSON.parse(jsonText);
            
            // Cache the response
            this.cache.set(cacheKey, {
                data: architectResponse,
                timestamp: Date.now()
            });
            
            return architectResponse;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('🔮 THE ARCHITECT consultation timed out (30s)');
            } else if (error.message.includes('Service Unavailable')) {
                console.error('🔮 Gemini API Service Unavailable (503) - this is temporary');
            } else if (error.message.includes('Rate Limited')) {
                console.error('🔮 Gemini API Rate Limited (429) - too many requests');
            } else {
                console.error('🔮 Error consulting THE ARCHITECT:', error);
            }
            // No fallback - let THE ARCHITECT handle it
            throw error;
        }
    }
    
    // Generate daily message from THE ARCHITECT
    async generateDailyMessage(playerData) {
        const currentDate = new Date().toLocaleDateString();
        
        // Check if we already generated a message today
        if (this.lastMessageDate === currentDate) {
            console.log('🔮 Daily message already generated today, returning cached version');
            return this.lastDailyMessage || null;
        }
        
        try {
            const context = `Generate a daily message from THE ARCHITECT for this player. The message should be personalized based on their recent performance and provide guidance about their self-improvement journey with that Solo Leveling world's fingerprint.`;
            const action = `Create a daily message in JSON format with: message (the message with Solo Leveling vibe - mysterious but understandable, MAXIMUM 3-4 lines), theme (success/warning/challenge), and hint (hint about upcoming challenges, 1-2 lines max). Use language that feels otherworldly but clear, like THE ARCHITECT in Solo Leveling. Keep messages concise and impactful.`;
            
            const response = await this.consultArchitect(context, action, playerData);
            
            if (response && response.message) {
                this.lastMessageDate = currentDate;
                console.log('🔮 THE ARCHITECT successfully generated daily message');
                const messagePayload = {
                    message: response.message,
                    theme: response.theme || 'mysterious',
                    hint: response.hint || '',
                    timestamp: Date.now(),
                    date: currentDate
                };
                this.lastDailyMessage = messagePayload;
                return messagePayload;
            }
            
        } catch (error) {
            console.error('🔮 THE ARCHITECT failed to generate daily message:', error);
            console.error('🔮 Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            // If it's a timeout or service unavailable, try one more time with a shorter prompt
            if (error.name === 'AbortError' || error.message.includes('Service Unavailable')) {
                const retryReason = error.name === 'AbortError' ? 'timeout' : 'service unavailable';
                console.log(`🔮 ${retryReason} detected, attempting retry with simplified prompt...`);
                
                // Wait a bit before retrying for service unavailable errors
                if (error.message.includes('Service Unavailable')) {
                    console.log('🔮 Waiting 2 seconds before retry...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
                try {
                    const retryAction = `Create a simple daily message in JSON format: message (2-3 lines max), theme (success/warning/challenge), hint (1 line). Keep it simple and fast.`;
                    
                    const retryResponse = await this.consultArchitect(context, retryAction, playerData);
                    
                    if (retryResponse && retryResponse.message) {
                        this.lastMessageDate = currentDate;
                        console.log('🔮 THE ARCHITECT retry successful for daily message');
                        const messagePayload = {
                            message: retryResponse.message,
                            theme: retryResponse.theme || 'mysterious',
                            hint: retryResponse.hint || '',
                            timestamp: Date.now(),
                            date: currentDate,
                            retryUsed: true
                        };
                        this.lastDailyMessage = messagePayload;
                        return messagePayload;
                    }
                } catch (retryError) {
                    console.error('🔮 THE ARCHITECT retry also failed for daily message:', retryError);
                }
            }
            
            // No fallback - let THE ARCHITECT handle it
            return null;
        }
    }
    
    // Generate random/urgent quests
    async generateRandomQuests(playerData) {
        const currentDate = new Date().toLocaleDateString();
        
        // Check if we should generate new quests (every 2-3 days)
        if (this.lastQuestCheck === currentDate) {
            console.log('🔮 Quests already checked today, skipping...');
            return null; // Don't show quests every time
        }
        
        // Make quests appear every time for testing (100% chance)
        console.log('🔮 Testing mode: 100% quest generation chance');
        
        console.log('🔮 THE ARCHITECT is generating new quests...');

        // Define prompt data outside try so it is available in retry path
        const uniqueId = Date.now() + Math.random();
        console.log('🔮 Starting quest generation with unique ID:', uniqueId);

        const context = `THE ARCHITECT has decided to test this player with real-life self-improvement challenges. Generate random or urgent quests that will help the player grow and improve themselves in real life, but with that Solo Leveling world's fingerprint. The player's current location and surroundings should influence the quest design.`;
        const action = `Create 1-2 simple self-improvement quests in JSON. Each quest should have: title (2-4 words), description (1 clear sentence), and proper rewards/costs. Make them real-life tasks with Solo Leveling flavor. Keep descriptions SHORT and CLEAR. Examples: "Study for 2 hours", "Exercise for 30 minutes", "Read 10 pages" , But add some Solo-leveling vocabulary. Each must include this exact reward/cost pattern:       
{
  "title": string,
  "description": string,
  "difficulty": "E"|"D"|"C"|"B"|"A"|"S",
  "type": "random"|"urgent",
  "rewards": {
    "xp": number,                          // 5-250 based on difficulty
    "attributes": {                        // optional attribute gains applied on level-up
      "INT"?: number,
      "STR"?: number,
      "AGI"?: number,
      "VIT"?: number
    }
  },
  "costs": {                               // immediate effects,  negative for HP/MP/STM, positive for fatigue
    "hp"?: number,                          // e.g., -5 .. -30
    "mp"?: number,                          // e.g., -2 .. -15
    "stm"?: number,                         // e.g., -3 .. -25
    "fatigue"?: number                      // e.g., +3 .. +25
  },
  "timeLimit"?: string,                     // optional
  "specialConditions"?: string[]            // optional
}
Scale xp and costs with difficulty (E=light, S=heavy). ALWAYS include rewards.xp and costs with at least two of hp/mp/stm/fatigue. Consider player location for task theme. UNIQUE ID: ${uniqueId}`;

        try {
            
            console.log('🔮 Calling consultArchitect for quests...');
            
            // Add a timeout wrapper for quest generation
            const questPromise = this.consultArchitect(context, action, playerData);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Quest generation timeout')), 45000); // 45 second timeout
            });
            
            const response = await Promise.race([questPromise, timeoutPromise]);
            console.log('🔮 consultArchitect response received:', response);

            // Accept: bare array, { quests: [...] }, or { uniqueKey: [...] }
            let quests = null;
            if (Array.isArray(response)) {
                quests = response;
            } else if (response && Array.isArray(response.quests)) {
                quests = response.quests;
            } else if (response && typeof response === 'object') {
                const values = Object.values(response);
                const firstArray = values.find(v => Array.isArray(v));
                if (firstArray) quests = firstArray;
            }

            if (quests && quests.length > 0) {
                // Validate and fix quest rewards
                quests = this.validateAndFixQuestRewards(quests);
                
                this.lastQuestCheck = currentDate;
                console.log('🔮 THE ARCHITECT successfully generated quests:', quests.length);
                console.log('🔮 Quest details:', quests);
                return {
                    quests,
                    generatedDate: currentDate,
                    timestamp: Date.now()
                };
            }

            console.warn('🔮 Invalid quest response structure:', response);
            return null;
            
        } catch (error) {
            console.error('🔮 THE ARCHITECT failed to generate quests:', error);
            console.error('🔮 Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            // If it's a timeout or service unavailable, try one more time with a shorter prompt
            if (error.name === 'AbortError' || error.message.includes('Service Unavailable')) {
                const retryReason = error.name === 'AbortError' ? 'timeout' : 'service unavailable';
                console.log(`🔮 ${retryReason} detected, attempting retry with simplified prompt...`);
                
                // Wait a bit before retrying for service unavailable errors
                if (error.message.includes('Service Unavailable')) {
                    console.log('🔮 Waiting 2 seconds before retry...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
                try {
                    const retryAction = `Create 1-2 simple quests in JSON format. Each quest needs: title (2-4 words), description (1 sentence), difficulty (E/D/C), type (random), rewards (xp: 50-200). Make them real-life self-improvement tasks. Keep it simple and fast.`;
                    
                    const retryResponse = await this.consultArchitect(context, retryAction, playerData);
                    
                    if (retryResponse && retryResponse.quests && Array.isArray(retryResponse.quests)) {
                        this.lastQuestCheck = currentDate;
                        console.log('🔮 THE ARCHITECT retry successful, generated quests:', retryResponse.quests.length);
                        return {
                            quests: retryResponse.quests,
                            generatedDate: currentDate,
                            timestamp: Date.now(),
                            retryUsed: true
                        };
                    }
                } catch (retryError) {
                    console.error('🔮 THE ARCHITECT retry also failed:', retryError);
                }
            }
            
            // No fallback - let THE ARCHITECT handle it
            return null;
        }
    }
    
    // Check for urgent system events or general interventions (message/quest/boost/debuff)
    async checkForSystemEvents(playerData) {
        try {
            const context = `THE ARCHITECT is monitoring the player's self-improvement journey for potential interventions. Should THE ARCHITECT create an event to help the player grow?`;
            const action = `Analyze the player data and decide if an intervention is needed. Return JSON:
{
  "shouldIntervene": boolean,
  "eventType": "emergency_quest"|"system_message"|"hidden_challenge"|"boost"|"debuff",
  "reason": string,           // 1 line explaining the decision
  "eventData": {              // per type specifics
    // emergency_quest/hidden_challenge -> { title (2-4 words), description (1 sentence), difficulty, rewards, costs }
    // system_message -> { message, hint? }
    // boost -> { attribute: "INT"|"STR"|"AGI"|"VIT"|"hp"|"mp"|"stm"|"fatigue", amount: number, durationMinutes?: number }
    // debuff -> { attribute: "hp"|"mp"|"stm"|"fatigue", amount: number, durationMinutes?: number }
  }
}
Keep descriptions SHORT and CLEAR. Only return an intervention if it is meaningful.`;
            
            const response = await this.consultArchitect(context, action, playerData);
            
            if (response && response.shouldIntervene) {
                console.log('🔮 THE ARCHITECT successfully determined system intervention');
                return {
                    shouldIntervene: true,
                    eventType: response.eventType,
                    reason: response.reason,
                    eventData: response.eventData,
                    timestamp: Date.now()
                };
            }
            
        } catch (error) {
            console.error('🔮 THE ARCHITECT failed to check system events:', error);
            console.error('🔮 Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            
            // If it's a timeout, try one more time with a shorter prompt
            if (error.name === 'AbortError') {
                console.log('🔮 Timeout detected, attempting retry with simplified prompt...');
                try {
                    const retryAction = `Should THE ARCHITECT intervene? Return JSON: shouldIntervene (boolean), eventType (hidden_challenge), reason (1 line), eventData (challenge: string). Keep it simple.`;
                    
                    const retryResponse = await this.consultArchitect(context, retryAction, playerData);
                    
                    if (retryResponse && retryResponse.shouldIntervene) {
                        console.log('🔮 THE ARCHITECT retry successful for system events');
                        return {
                            shouldIntervene: true,
                            eventType: retryResponse.eventType || 'hidden_challenge',
                            reason: retryResponse.reason || 'The shadows whisper of opportunity.',
                            eventData: retryResponse.eventData || { challenge: 'Complete any quest with focus' },
                            timestamp: Date.now(),
                            retryUsed: true
                        };
                    }
                } catch (retryError) {
                    console.error('🔮 THE ARCHITECT retry also failed for system events:', retryError);
                }
            }
            
            // No fallback - let THE ARCHITECT handle it
            return { shouldIntervene: false };
        }
        
        return { shouldIntervene: false };
    }
    
        // No fallback systems - THE ARCHITECT must generate everything
    
    // Clear cache (useful for testing)
    clearCache() {
        this.cache.clear();
        this.lastMessageDate = null;
        this.lastQuestCheck = null;
        console.log('🔮 THE ARCHITECT cache cleared');
    }
    
    // Force fresh generation by clearing cache and resetting dates
    forceFreshGeneration() {
        this.clearCache();
        console.log('🔮 THE ARCHITECT forced to generate fresh content');
    }
    
    // Get cached data for debugging
    getCacheInfo() {
        return {
            cacheSize: this.cache.size,
            lastMessageDate: this.lastMessageDate,
            lastQuestCheck: this.lastQuestCheck
        };
    }
    
    // Debug method to check quest generation status
    async debugQuestGeneration(playerData) {
        console.log('🔮 === THE ARCHITECT DEBUG ===');
        console.log('🔮 Current date:', new Date().toLocaleDateString());
        console.log('🔮 Last quest check:', this.lastQuestCheck);
        console.log('🔮 Cache size:', this.cache.size);
        console.log('🔮 Player data available:', !!playerData);
        
        // Test quest generation
        console.log('🔮 Testing quest generation...');
        try {
            const quests = await this.generateRandomQuests(playerData);
            console.log('🔮 Quest generation result:', quests);
            return quests;
        } catch (error) {
            console.error('🔮 Quest generation test failed:', error);
            return null;
        }
    }
    
    // Force quest generation for testing (bypasses daily check)
    async forceGenerateQuests(playerData) {
        console.log('🔮 Force generating quests...');
        this.lastQuestCheck = null; // Reset the daily check
        return await this.generateRandomQuests(playerData);
    }
    
    // Simple test method for console testing
    async testQuestGeneration() {
        console.log('🔮 === TESTING QUEST GENERATION ===');
        const testPlayerData = {
            gameData: { level: 1, exp: 0 },
            dynamicData: { location: 'Test Location' }
        };
        
        try {
            const result = await this.generateRandomQuests(testPlayerData);
            console.log('🔮 Test result:', result);
            return result;
        } catch (error) {
            console.error('🔮 Test failed:', error);
            return null;
        }
    }
    
    // Check current status
    getStatus() {
        return {
            lastMessageDate: this.lastMessageDate,
            lastQuestCheck: this.lastQuestCheck,
            cacheSize: this.cache.size,
            currentDate: new Date().toLocaleDateString(),
            testingMode: true // Since we set it to 100%
        };
    }
    
    // Check Gemini API status
    async checkApiStatus() {
        console.log('🔮 === CHECKING GEMINI API STATUS ===');
        try {
            const response = await fetch(`${this.geminiApiUrl}?key=${this.geminiApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: 'Test connection' }]
                    }]
                })
            });
            
            if (response.ok) {
                console.log('🔮 Gemini API is working normally');
                return { status: 'ok', code: response.status };
            } else {
                console.error(`🔮 Gemini API error: ${response.status} ${response.statusText}`);
                return { status: 'error', code: response.status, message: response.statusText };
            }
        } catch (error) {
            console.error('🔮 Gemini API connection failed:', error);
            return { status: 'failed', error: error.message };
        }
    }

    // Ask THE ARCHITECT when to reveal the next queued quest (in minutes)
    async getNextRevealDelayMinutes(playerData, pendingCount = 1) {
        try {
            const context = `THE ARCHITECT controls when quests are revealed. There are ${pendingCount} queued quests.`;
            const action = `Return JSON: { minutes: number (1-180), reason: string }. Decide a fitting delay before revealing the next quest, based on Solo Leveling pacing. Avoid revealing multiple at once.`;
            const res = await this.consultArchitect(context, action, playerData);
            const minutes = Math.max(1, Math.min(180, parseInt(res?.minutes || 15, 10)));
            return { minutes, reason: res?.reason || 'The cadence must be earned.' };
        } catch (e) {
            console.warn('🔮 Using default next reveal delay due to error:', e);
            return { minutes: 15, reason: 'Default cadence.' };
        }
    }

    // Validate and fix quest rewards to ensure proper XP values
    validateAndFixQuestRewards(quests) {
        return quests.map(quest => {
            // Ensure quest has rewards object
            if (!quest.rewards) {
                quest.rewards = {};
            }

            // Fix XP if missing or invalid
            if (typeof quest.rewards.xp !== 'number' || quest.rewards.xp <= 0) {
                // Set XP based on difficulty
                const difficultyMultiplier = {
                    'E': 1,
                    'D': 1.5,
                    'C': 2,
                    'B': 2.5,
                    'A': 3,
                    'S': 4
                };
                const baseXP = 15;
                const multiplier = difficultyMultiplier[quest.difficulty] || 1;
                quest.rewards.xp = Math.floor(baseXP * multiplier);
                console.log(`🔮 Fixed quest "${quest.title}" XP: ${quest.rewards.xp} (difficulty: ${quest.difficulty})`);
            }

            // Ensure attributes object exists
            if (!quest.rewards.attributes) {
                quest.rewards.attributes = {};
            }

            // Ensure costs object exists
            if (!quest.costs) {
                quest.costs = {};
            }

            return quest;
        });
    }
}

// Global instance
window.architectService = new ArchitectService();
