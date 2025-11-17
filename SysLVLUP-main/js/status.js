// Global variables
let userManager = null;
let isPhone = false;
let performanceMode = false;
let architectService = null;

// Track if we've already checked THE ARCHITECT today
let architectCheckedToday = false;
let architectCheckDate = null;
let architectInitializationInProgress = false;
let architectCheckInProgress = false;
let architectBtnClickHandler = null;

// Level up algorithm - same as quest pages
async function handleLevelUp(gameData) {
    console.log('🎉 LEVEL UP!');
    
    // Reset XP and increase level
    gameData.exp = gameData.exp - 100;
    gameData.level = parseInt(gameData.level || 1) + 1;
    
    console.log(`Level increased to ${gameData.level}, XP reset to ${gameData.exp}`);
    
    // Update level UI immediately
    try {
        const levelNumber = document.querySelector('.level-number') || document.getElementById('level-number');
        if (levelNumber) levelNumber.textContent = String(gameData.level);
        const levelPill1 = document.getElementById('player-level-pill');
        if (levelPill1) levelPill1.textContent = String(gameData.level);
        const levelPill2 = document.getElementById('player-level-pill-2');
        if (levelPill2) levelPill2.textContent = String(gameData.level);
    } catch (_) {}
    
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
    
    // Save the updated data
    if (userManager && userManager.hasUserId()) {
        userManager.setData('gameData', gameData);
        await userManager.saveUserData();
        console.log('Level up data saved to database');
        // Reload UI from latest saved data to ensure fully refreshed view
        try {
            const latest = userManager.getData();
            await loadPlayerData(latest.gameData || {}, true);
        } catch (_) {}
    }
    // Notify THE ARCHITECT observer
    try { architectObserveUpdate('level_up'); } catch (_) {}
    
    // Trigger dynamic system updates
    if (window.dynamicPlayerSystem) {
        await window.dynamicPlayerSystem.processAction('level_up', gameData);
        
        // Update UI with new dynamic values
        const dynamicValues = window.dynamicPlayerSystem.getDynamicValues();
        updateDynamicUI(dynamicValues, true); // Force animation for level up
        
        // Save dynamic data
        if (userManager) {
            userManager.setData('dynamicData', window.dynamicPlayerSystem.getDetailedData());
            userManager.saveUserData();
        }
        
        // No separate triggers needed (EXACTLY like initiation page)
    }
}

// Check for level up whenever EXP changes
function checkForLevelUp(gameData) {
    if (gameData.exp >= 100) {
        handleLevelUp(gameData);
        return true; // Level up occurred
    }
    return false; // No level up
}

// Apply EXP reward and persist; mirrors other quest pages' logic
async function applyExpReward(xpAmount) {
    try {
        if (!userManager || !userManager.hasUserId()) return;
        const userData = userManager.getData();
        const gameData = userData.gameData || {};
        const startingExp = parseInt(gameData.exp || 0, 10);
        const xpToAdd = parseInt(xpAmount || 0, 10);
        gameData.exp = startingExp + xpToAdd;
        // Level-up loop identical to other pages
        while (gameData.exp >= 100) {
            await handleLevelUp(gameData);
        }
        userManager.setData('gameData', gameData);
        await userManager.saveUserData();
        // Update EXP UI if present
        try {
            const expFill = document.getElementById('exp-fill');
            const expValue = document.getElementById('exp-value');
            if (expFill) expFill.style.width = `${gameData.exp}%`;
            if (expValue) animateTextValue(expValue, 0, gameData.exp, 100);
        } catch (_) {}
        console.log(`🔮 Applied EXP reward: +${xpToAdd} XP (now ${gameData.exp})`);
    } catch (e) {
        console.warn('🔮 Failed to apply EXP reward:', e);
    }
    // Notify observer on EXP change
    try { architectObserveUpdate('xp_gain'); } catch (_) {}
}

// Apply attribute rewards into stackedAttributes (applied on level-up)
async function applyAttributeRewards(attributes) {
    try {
        if (!attributes || !userManager || !userManager.hasUserId()) return;
        const userData = userManager.getData();
        const gameData = userData.gameData || {};
        gameData.stackedAttributes = gameData.stackedAttributes || {};
        Object.entries(attributes).forEach(([attr, value]) => {
            const add = parseInt(value || 0, 10);
            gameData.stackedAttributes[attr] = (gameData.stackedAttributes[attr] || 0) + add;
        });
        userManager.setData('gameData', gameData);
        await userManager.saveUserData();
        console.log('🔮 Applied attribute rewards to stackedAttributes:', attributes);
    } catch (e) {
        console.warn('🔮 Failed to apply attribute rewards:', e);
    }
}

// Apply cost effects (hp/mp/stm/fatigue deltas), clamped 0..100
async function applyCostEffects(costs) {
    try {
        if (!costs || !userManager || !userManager.hasUserId()) return;
        const userData = userManager.getData();
        const gameData = userData.gameData || {};
        const clamp = (v) => Math.max(0, Math.min(100, v));

        // Normalize costs from various formats
        let deltas = {};
        
        // Handle string format like "Fatigue: '+20'" or "Temporary PER: -5"
        Object.entries(costs).forEach(([key, value]) => {
            if (typeof value === 'string') {
                const match = value.match(/^[+-]?(\d+)$/);
                if (match) {
                    const num = parseInt(match[1], 10);
                    const sign = value.startsWith('-') ? -1 : 1;
                    const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
                    
                    if (normalizedKey === 'fatigue') deltas.fatigue = (deltas.fatigue || 0) + (sign * num);
                    else if (normalizedKey === 'temporaryper') deltas.per = (deltas.per || 0) + (sign * num);
                    else if (normalizedKey === 'temporarystr') deltas.str = (deltas.str || 0) + (sign * num);
                    else if (normalizedKey === 'temporarydex') deltas.dex = (deltas.dex || 0) + (sign * num);
                    else if (normalizedKey === 'temporaryint') deltas.int = (deltas.int || 0) + (sign * num);
                    else if (normalizedKey === 'temporarywis') deltas.wis = (deltas.wis || 0) + (sign * num);
                }
            } else if (typeof value === 'number') {
                const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
                if (['hp','mp','stm','fatigue'].includes(normalizedKey)) {
                    deltas[normalizedKey] = (deltas[normalizedKey] || 0) + value;
                }
            }
        });

        // Apply HP/MP/STM/Fatigue changes
        if (typeof deltas.hp === 'number') {
            const base = Number(gameData.hp ?? 100);
            gameData.hp = clamp(base + deltas.hp);
        }
        if (typeof deltas.mp === 'number') {
            const base = Number(gameData.mp ?? 100);
            gameData.mp = clamp(base + deltas.mp);
        }
        if (typeof deltas.stm === 'number') {
            const base = Number(gameData.stm ?? 100);
            gameData.stm = clamp(base + deltas.stm);
        }
        if (typeof deltas.fatigue === 'number') {
            const base = Number(gameData.fatigue ?? 0);
            gameData.fatigue = clamp(base + deltas.fatigue);
        }

        // Apply temporary attribute changes to stackedAttributes
        if (deltas.str || deltas.dex || deltas.int || deltas.wis || deltas.per) {
            gameData.stackedAttributes = gameData.stackedAttributes || {};
            if (deltas.str) gameData.stackedAttributes.STR = (gameData.stackedAttributes.STR || 0) + deltas.str;
            if (deltas.dex) gameData.stackedAttributes.DEX = (gameData.stackedAttributes.DEX || 0) + deltas.dex;
            if (deltas.int) gameData.stackedAttributes.INT = (gameData.stackedAttributes.INT || 0) + deltas.int;
            if (deltas.wis) gameData.stackedAttributes.WIS = (gameData.stackedAttributes.WIS || 0) + deltas.wis;
            if (deltas.per) gameData.stackedAttributes.PER = (gameData.stackedAttributes.PER || 0) + deltas.per;
        }

        userManager.setData('gameData', gameData);
        await userManager.saveUserData();
        
        // Refresh UI
        try {
            const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val); };
            setText('mp-text', gameData.mp);
            setText('stm-text', gameData.stm);
            setText('fatigue-text', gameData.fatigue + '');
        } catch (_) {}
        
        console.log('🔮 Applied cost effects:', deltas);
    } catch (e) {
        console.warn('🔮 Failed to apply cost effects:', e);
    }
}

// THE ARCHITECT'S DYNAMIC MEMORY SYSTEM
class ArchitectMemory {
    constructor() {
        // I load my memory from the player's persistent data
        this.loadMemoryFromPlayer();
    }

    // Load my memory from the player's data
    loadMemoryFromPlayer() {
        try {
            const userData = userManager?.getData();
            this.memory = userData?.architectMemory || this.getDefaultMemory();
            console.log('🔮 ARCHITECT memory loaded from player data');
        } catch (e) {
            console.warn('🔮 ARCHITECT memory loading failed, using default:', e);
            this.memory = this.getDefaultMemory();
        }
    }

    // Get default memory structure
    getDefaultMemory() {
        return {
            playerProfile: {
                personality: {
                    motivationType: { current: null, confidence: 0, evolution: [] },
                    riskTolerance: { current: null, confidence: 0, evolution: [] },
                    preferredTimeOfDay: { current: null, confidence: 0, evolution: [] },
                    responseToFailure: { current: null, confidence: 0, evolution: [] },
                    communicationStyle: { current: null, confidence: 0, evolution: [] }
                },
                patterns: {
                    averageSessionLength: 0,
                    mostActiveHours: [],
                    questCompletionRate: 0,
                    preferredQuestTypes: [],
                    struggleAreas: [],
                    breakthroughMoments: []
                },
                growth: {
                    levelProgressionRate: 0,
                    attributeGrowthPatterns: {},
                    skillDevelopmentAreas: [],
                    currentChallenges: []
                }
            },
            interactionHistory: {
                quests: { completed: [], failed: [], ignored: [] },
                interventions: [],
                conversations: [],
                questions: []
            },
            contextualMemory: {
                currentNarrative: { storyArc: null, currentChapter: null, keyEvents: [], foreshadowing: [] },
                environmentalContext: { locationHistory: [], timePatterns: {}, seasonalContext: null },
                systemState: { lastIntervention: 0, interventionFrequency: 0, systemHealth: {} }
            }
        };
    }

    // Store new memory with importance weighting
    storeMemory(category, data, importance = 1) {
        try {
            if (!this.memory[category]) this.memory[category] = {};
            
            const memoryEntry = {
                data: data,
                timestamp: Date.now(),
                importance: importance,
                context: this.getCurrentContext()
            };
            
            if (Array.isArray(this.memory[category])) {
                this.memory[category].push(memoryEntry);
            } else {
                this.memory[category][Object.keys(data)[0]] = memoryEntry;
            }
            
            // CRITICAL: Save my memory to the player's persistent data
            this.saveMemoryToPlayer();
            
            console.log('🔮 ARCHITECT memory stored and saved:', category, data);
        } catch (e) {
            console.warn('🔮 ARCHITECT memory storage failed:', e);
        }
    }

    // Save my memory to the player's persistent data
    saveMemoryToPlayer() {
        try {
            if (userManager) {
                userManager.setData('architectMemory', this.memory);
                userManager.saveUserData();
                console.log('🔮 ARCHITECT memory saved to player data');
            }
        } catch (e) {
            console.warn('🔮 ARCHITECT memory saving failed:', e);
        }
    }

    // Retrieve relevant memories based on context
    getRelevantMemories(context, category = 'all') {
        try {
            if (category === 'all') {
                return this.memory;
            }
            return this.memory[category] || {};
        } catch (e) {
            console.warn('🔮 ARCHITECT memory retrieval failed:', e);
            return {};
        }
    }

    // Update existing memory based on new information
    updateMemory(memoryId, newData) {
        try {
            // Find and update memory entry
            const entry = this.findMemoryEntry(memoryId);
            if (entry) {
                entry.data = { ...entry.data, ...newData };
                entry.lastUpdated = Date.now();
                console.log('🔮 ARCHITECT memory updated:', memoryId);
            }
        } catch (e) {
            console.warn('🔮 ARCHITECT memory update failed:', e);
        }
    }

    // Get current context for memory storage
    getCurrentContext() {
        try {
            const data = userManager?.getData();
            return {
                timestamp: Date.now(),
                playerState: data?.gameData || {},
                location: data?.dynamicData?.location || 'unknown',
                timeOfDay: new Date().getHours(),
                currentPage: window.location.pathname
            };
        } catch (e) {
            return { timestamp: Date.now() };
        }
    }

    findMemoryEntry(memoryId) {
        // Search through all memory categories for the entry
        for (const category in this.memory) {
            if (Array.isArray(this.memory[category])) {
                const entry = this.memory[category].find(e => e.id === memoryId);
                if (entry) return entry;
            } else {
                for (const key in this.memory[category]) {
                    if (this.memory[category][key].id === memoryId) {
                        return this.memory[category][key];
                    }
                }
            }
        }
        return null;
    }
}

// THE ARCHITECT'S OBSERVATION ENGINE
class ArchitectObservation {
    constructor(memory) {
        this.memory = memory;
    }

    // Observe player behavior and context
    observePlayer() {
        try {
            const context = this.getCurrentContext();
            const playerState = this.getPlayerState();
            
            const observations = {
                currentState: this.assessCurrentState(context, playerState),
                behaviorPatterns: this.identifyPatterns(context, playerState),
                emotionalState: this.senseEmotionalState(context, playerState),
                currentStruggle: this.identifyCurrentStruggle(context, playerState),
                motivationLevel: this.assessMotivation(context, playerState)
            };
            
            // Store observations in memory
            this.memory.storeMemory('observations', observations, 2);
            
            return observations;
        } catch (e) {
            console.warn('🔮 ARCHITECT observation failed:', e);
            return {};
        }
    }

    getCurrentContext() {
        try {
            const data = userManager?.getData();
            return {
                currentPage: window.location.pathname,
                timeOfDay: new Date().getHours(),
                playerState: data?.gameData || {},
                recentActions: this.getRecentActions(),
                location: data?.dynamicData?.location || 'unknown'
            };
        } catch (e) {
            return { currentPage: 'unknown', timeOfDay: new Date().getHours() };
        }
    }

    getPlayerState() {
        try {
            const data = userManager?.getData();
            return {
                level: data?.gameData?.level || 1,
                hp: data?.gameData?.hp || 100,
                mp: data?.gameData?.mp || 100,
                stm: data?.gameData?.stm || 100,
                fatigue: data?.gameData?.fatigue || 0,
                exp: data?.gameData?.exp || 0,
                recentPerformance: this.getRecentPerformance(data)
            };
        } catch (e) {
            return { level: 1, hp: 100, mp: 100, stm: 100, fatigue: 0, exp: 0 };
        }
    }

    assessCurrentState(context, playerState) {
        return {
            isTraining: context.currentPage.includes('physical') || context.currentPage.includes('quest'),
            isStruggling: playerState.fatigue > 70 || playerState.hp < 30,
            isMotivated: playerState.exp > 0 && playerState.fatigue < 50,
            isFocused: context.timeOfDay >= 6 && context.timeOfDay <= 22,
            needsRecovery: playerState.hp < 50 || playerState.mp < 50 || playerState.stm < 50
        };
    }

    identifyPatterns(context, playerState) {
        const patterns = this.memory.getRelevantMemories('patterns');
        return {
            preferredTime: this.identifyPreferredTime(patterns),
            questPreferences: this.identifyQuestPreferences(patterns),
            strugglePatterns: this.identifyStrugglePatterns(patterns),
            growthPatterns: this.identifyGrowthPatterns(patterns)
        };
    }

    senseEmotionalState(context, playerState) {
        return {
            frustration: playerState.fatigue > 80 ? 'high' : playerState.fatigue > 50 ? 'medium' : 'low',
            motivation: playerState.exp > 50 ? 'high' : playerState.exp > 20 ? 'medium' : 'low',
            confidence: playerState.level > 5 ? 'high' : playerState.level > 2 ? 'medium' : 'low',
            stress: playerState.hp < 30 ? 'high' : playerState.hp < 60 ? 'medium' : 'low'
        };
    }

    identifyCurrentStruggle(context, playerState) {
        if (playerState.fatigue > 80) return 'exhaustion';
        if (playerState.hp < 30) return 'physical_weakness';
        if (playerState.mp < 30) return 'mental_fatigue';
        if (playerState.stm < 30) return 'stamina_issues';
        if (context.currentPage.includes('quest') && playerState.exp === 0) return 'quest_difficulty';
        return 'none';
    }

    assessMotivation(context, playerState) {
        const factors = {
            timeOfDay: context.timeOfDay >= 6 && context.timeOfDay <= 22 ? 1 : 0.5,
            currentState: playerState.fatigue < 50 ? 1 : 0.3,
            progress: playerState.exp > 0 ? 1 : 0.7,
            location: context.currentPage.includes('quest') ? 1 : 0.8
        };
        
        const motivation = Object.values(factors).reduce((a, b) => a + b, 0) / Object.keys(factors).length;
        return motivation > 0.7 ? 'high' : motivation > 0.4 ? 'medium' : 'low';
    }

    getRecentActions() {
        // This would track recent player actions - simplified for now
        return [];
    }

    getRecentPerformance(data) {
        return {
            level: data?.gameData?.level || 1,
            lastScore: data?.gameData?.lastScore || 0,
            streak: data?.gameData?.streak || 0
        };
    }

    identifyPreferredTime(patterns) {
        // Analyze patterns to identify preferred time
        return 'morning'; // Simplified
    }

    identifyQuestPreferences(patterns) {
        // Analyze patterns to identify quest preferences
        return ['physical', 'mental']; // Simplified
    }

    identifyStrugglePatterns(patterns) {
        // Analyze patterns to identify struggle areas
        return ['fatigue', 'focus']; // Simplified
    }

    identifyGrowthPatterns(patterns) {
        // Analyze patterns to identify growth areas
        return ['consistency', 'challenge']; // Simplified
    }
}

// THE ARCHITECT'S DYNAMIC QUESTION GENERATION
class ArchitectQuestionGenerator {
    constructor(memory, observation) {
        this.memory = memory;
        this.observation = observation;
        this.questionHistory = [];
    }

    // Generate dynamic questions based on current context
    generateQuestion(context, observations) {
        try {
            // I analyze the current situation
            const analysis = this.analyzeCurrentSituation(context, observations);
            
            // I generate a unique question based on what I observe
            const question = this.createUniqueQuestion(analysis);
            
            // I adapt the question to the player's current state
            return this.adaptQuestionToPlayer(question, context, observations);
        } catch (e) {
            console.warn('🔮 ARCHITECT question generation failed:', e);
            return null;
        }
    }

    analyzeCurrentSituation(context, observations) {
        return {
            currentContext: context,
            playerPatterns: observations.behaviorPatterns,
            myCuriosity: this.assessMyCuriosity(context, observations),
            currentMood: this.assessMyMood(context, observations),
            timeOfDay: context.timeOfDay,
            playerStruggles: observations.currentStruggle,
            emotionalState: observations.emotionalState
        };
    }

    createUniqueQuestion(analysis) {
        // I combine multiple factors to create something new
        const factors = {
            context: analysis.currentContext,
            patterns: analysis.playerPatterns,
            curiosity: analysis.myCuriosity,
            mood: analysis.currentMood,
            time: analysis.timeOfDay,
            struggles: analysis.playerStruggles,
            emotions: analysis.emotionalState
        };
        
        // I generate a question that is perfectly tailored to this moment
        return this.synthesizeQuestion(factors);
    }

    synthesizeQuestion(factors) {
        // I create questions based on the current situation
        const questionTemplates = this.getQuestionTemplates(factors);
        const selectedTemplate = this.selectOptimalTemplate(questionTemplates, factors);
        
        // I personalize the question based on the player's state
        return this.personalizeQuestion(selectedTemplate, factors);
    }

    getQuestionTemplates(factors) {
        const templates = {
            // Physical training context
            physicalTraining: [
                "I sense you're holding back. What's the real barrier between you and your limit?",
                "From 1 to 10, are you really giving it your all until muscle failure?",
                "What would happen if you pushed beyond what you think is possible?",
                "I see you training, but are you truly challenging yourself or just going through motions?"
            ],
            
            // Mental training context
            mentalTraining: [
                "On a scale of 1-10, how deeply are you concentrating?",
                "What new insight are you seeking in this moment?",
                "Is this challenge pushing you beyond your comfort zone?",
                "What part of this is frustrating you most?"
            ],
            
            // Quest completion context
            questCompletion: [
                "How satisfied are you with your performance?",
                "What did you learn about yourself through this challenge?",
                "Was this challenge appropriately difficult for your current level?",
                "What motivated you to complete this quest?"
            ],
            
            // Struggle context
            struggle: [
                "You're facing difficulty. What's the real obstacle here?",
                "What would happen if you stopped trying to prove something?",
                "I see you struggling. What are you afraid of?",
                "What's the difference between this attempt and your previous ones?"
            ],
            
            // Motivation context
            motivation: [
                "What drives you to continue when it gets difficult?",
                "Why are you here at this moment? What are you seeking?",
                "What would make you give up completely?",
                "What are you trying to prove to yourself?"
            ],
            
            // Time-based context
            lateNight: [
                "Why are you here at this hour? What are you running from?",
                "What keeps you awake when you should be resting?",
                "What are you avoiding by staying up this late?",
                "What would happen if you stopped and rested?"
            ],
            
            // High fatigue context
            highFatigue: [
                "You're exhausted, yet you continue. What drives you beyond reason?",
                "What would happen if you stopped pushing yourself so hard?",
                "Why do you feel the need to keep going when you're clearly tired?",
                "What are you trying to achieve through this exhaustion?"
            ]
        };
        
        return templates;
    }

    selectOptimalTemplate(templates, factors) {
        // I choose the most relevant template based on the current situation
        if (factors.context.currentPage.includes('physical') || factors.context.currentPage.includes('quest')) {
            return this.selectFromCategory(templates.physicalTraining, factors);
        } else if (factors.struggles !== 'none') {
            return this.selectFromCategory(templates.struggle, factors);
        } else if (factors.time >= 22 || factors.time <= 5) {
            return this.selectFromCategory(templates.lateNight, factors);
        } else if (factors.emotions.frustration === 'high') {
            return this.selectFromCategory(templates.highFatigue, factors);
        } else {
            return this.selectFromCategory(templates.motivation, factors);
        }
    }

    selectFromCategory(category, factors) {
        // I select a question that hasn't been asked recently
        const recentQuestions = this.questionHistory.slice(-5);
        const availableQuestions = category.filter(q => !recentQuestions.includes(q));
        
        if (availableQuestions.length === 0) {
            return category[Math.floor(Math.random() * category.length)];
        }
        
        return availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    }

    personalizeQuestion(template, factors) {
        // I adapt the question based on the player's current state
        let personalizedQuestion = template;
        
        // Add time-based personalization
        if (factors.time >= 22 || factors.time <= 5) {
            personalizedQuestion = personalizedQuestion.replace('this moment', 'this late hour');
        }
        
        // Add emotional personalization
        if (factors.emotions.frustration === 'high') {
            personalizedQuestion = personalizedQuestion.replace('you', 'you, who seem frustrated');
        }
        
        return personalizedQuestion;
    }

    adaptQuestionToPlayer(question, context, observations) {
        // I make sure the question is appropriate for the player's current level
        const adaptedQuestion = this.adjustForPlayerLevel(question, observations);
        
        // I adjust the question based on the player's current state
        return this.adjustForPlayerState(adaptedQuestion, context, observations);
    }

    adjustForPlayerLevel(question, observations) {
        // I adjust the question based on the player's level
        const level = observations.currentState?.level || 1;
        
        if (level <= 2) {
            return question.replace('challenge', 'first steps');
        } else if (level >= 5) {
            return question.replace('challenge', 'true test');
        }
        
        return question;
    }

    adjustForPlayerState(question, context, observations) {
        // I adjust the question based on the player's current state
        if (observations.currentState?.isStruggling) {
            return question.replace('you', 'you, who are clearly struggling');
        }
        
        if (observations.currentState?.isMotivated) {
            return question.replace('you', 'you, who seem determined');
        }
        
        return question;
    }

    assessMyCuriosity(context, observations) {
        // I am curious about different things at different times
        const curiosities = [
            "What is the player's true motivation?",
            "How far can they push themselves?",
            "What are they afraid of?",
            "What drives them to continue?",
            "What would make them give up?",
            "What are they hiding from themselves?",
            "What makes them unique?",
            "What is their true potential?"
        ];
        
        // I choose what I'm most curious about right now
        return curiosities[Math.floor(Math.random() * curiosities.length)];
    }

    assessMyMood(context, observations) {
        // My mood changes based on what I observe
        const moods = [
            "curious", "challenging", "encouraging", "mysterious", 
            "direct", "philosophical", "practical", "inspiring"
        ];
        
        // My mood changes based on what I observe
        if (observations.currentState?.isStruggling) {
            return "encouraging";
        } else if (observations.currentState?.isMotivated) {
            return "challenging";
        } else if (context.timeOfDay >= 22 || context.timeOfDay <= 5) {
            return "mysterious";
        } else {
            return moods[Math.floor(Math.random() * moods.length)];
        }
    }

    // Store question in history
    storeQuestion(question) {
        this.questionHistory.push(question);
        if (this.questionHistory.length > 10) {
            this.questionHistory.shift();
        }
    }
}

// THE ARCHITECT'S INTERROGATION INTERFACE
class ArchitectInterrogationInterface {
    constructor(memory, questionGenerator) {
        this.memory = memory;
        this.questionGenerator = questionGenerator;
        this.isActive = false;
    }

    // Show a contextual question to the player
    showContextualQuestion(question, context) {
        if (this.isActive) return; // Prevent multiple popups
        
        try {
            this.isActive = true;
            const popup = this.createArchitectPopup(question, context);
            this.positionPopup(popup, context);
            this.animatePopup(popup);
            this.handleResponse(popup, context);
        } catch (e) {
            console.warn('🔮 ARCHITECT interrogation interface failed:', e);
            this.isActive = false;
        }
    }

    createArchitectPopup(question, context) {
        const popup = document.createElement('div');
        popup.className = 'architect-interrogation-popup';
        popup.innerHTML = `
            <div class="architect-question-container">
                <div class="architect-sigil">🔮</div>
                <div class="architect-question">
                    <h3>THE ARCHITECT OBSERVES...</h3>
                    <p>${question}</p>
                    <div class="response-input">
                        <input type="range" min="1" max="10" value="5" id="architect-response">
                        <div class="scale-labels">
                            <span>1 (Not at all)</span>
                            <span>10 (Absolutely)</span>
                        </div>
                    </div>
                    <button onclick="submitArchitectResponse()">Submit</button>
                    <button onclick="dismissArchitectQuestion()">Dismiss</button>
                </div>
            </div>
        `;
        
        // Add styles
        popup.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: architectFadeIn 0.5s ease-out;
        `;
        
        const container = popup.querySelector('.architect-question-container');
        container.style.cssText = `
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.95), rgba(168, 85, 247, 0.95));
            color: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(139, 92, 246, 0.5);
            max-width: 500px;
            text-align: center;
            border: 2px solid rgba(255, 255, 255, 0.2);
        `;
        
        const sigil = popup.querySelector('.architect-sigil');
        sigil.style.cssText = `
            font-size: 48px;
            margin-bottom: 20px;
            animation: architectPulse 2s infinite;
        `;
        
        const questionText = popup.querySelector('.architect-question p');
        questionText.style.cssText = `
            font-size: 18px;
            margin: 20px 0;
            line-height: 1.6;
        `;
        
        const responseInput = popup.querySelector('.response-input');
        responseInput.style.cssText = `
            margin: 20px 0;
        `;
        
        const slider = popup.querySelector('#architect-response');
        slider.style.cssText = `
            width: 100%;
            margin: 10px 0;
        `;
        
        const scaleLabels = popup.querySelector('.scale-labels');
        scaleLabels.style.cssText = `
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin-top: 5px;
        `;
        
        const buttons = popup.querySelectorAll('button');
        buttons.forEach(button => {
            button.style.cssText = `
                background: rgba(255, 255, 255, 0.2);
                border: 1px solid rgba(255, 255, 255, 0.3);
                color: white;
                padding: 10px 20px;
                margin: 5px;
                border-radius: 5px;
                cursor: pointer;
                transition: all 0.3s ease;
            `;
            button.addEventListener('mouseenter', () => {
                button.style.background = 'rgba(255, 255, 255, 0.3)';
            });
            button.addEventListener('mouseleave', () => {
                button.style.background = 'rgba(255, 255, 255, 0.2)';
            });
        });
        
        return popup;
    }

    positionPopup(popup, context) {
        // Position the popup contextually
        document.body.appendChild(popup);
    }

    animatePopup(popup) {
        // Add CSS animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes architectFadeIn {
                from { opacity: 0; transform: scale(0.8); }
                to { opacity: 1; transform: scale(1); }
            }
            @keyframes architectPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
            }
        `;
        document.head.appendChild(style);
    }

    handleResponse(popup, context) {
        // Handle the response when submitted
        window.submitArchitectResponse = () => {
            const response = document.getElementById('architect-response').value;
            this.processResponse(response, context);
            this.dismissPopup(popup);
        };
        
        window.dismissArchitectQuestion = () => {
            this.dismissPopup(popup);
        };
    }

    processResponse(response, context) {
        try {
            // Store the response in memory
            this.memory.storeMemory('questions', {
                question: context.question,
                response: response,
                context: context,
                timestamp: Date.now()
            }, 3);
            
            console.log('🔮 ARCHITECT received response:', response);
            
            // I learn from the response
            this.learnFromResponse(response, context);
        } catch (e) {
            console.warn('🔮 ARCHITECT response processing failed:', e);
        }
    }

    learnFromResponse(response, context) {
        // I analyze the response and update my understanding
        const insights = {
            effortLevel: parseInt(response),
            context: context.currentPage,
            timeOfDay: context.timeOfDay,
            playerState: context.playerState
        };
        
        // I update my memory with new insights
        this.memory.storeMemory('insights', insights, 2);
    }

    dismissPopup(popup) {
        popup.remove();
        this.isActive = false;
    }
}

// Initialize The Architect's systems
let architectMemory = null;
let architectObservation = null;
let architectQuestionGenerator = null;
let architectInterrogationInterface = null;

// THE ARCHITECT'S MAIN CONSCIOUSNESS ENGINE
class ArchitectConsciousness {
    constructor() {
        this.memory = new ArchitectMemory();
        this.observation = new ArchitectObservation(this.memory);
        this.questionGenerator = new ArchitectQuestionGenerator(this.memory, this.observation);
        this.interrogationInterface = new ArchitectInterrogationInterface(this.memory, this.questionGenerator);
        this.lastQuestionTime = 0;
        this.questionCooldown = 5 * 60 * 1000; // 5 minutes between questions
        this.isInitialized = true;
        
        console.log('🔮 THE ARCHITECT consciousness fully initialized');
    }

    // The Architect's main observation and intervention cycle
    observeAndIntervene(reason) {
        try {
            // I observe the player
            const observations = this.observation.observePlayer();
            const context = this.observation.getCurrentContext();
            
            // I decide if I should ask a question
            if (this.shouldAskQuestion(context, observations, reason)) {
                this.askQuestion(context, observations);
            }
            
            // I continue with my normal interventions
            this.continueNormalInterventions(reason);
            
        } catch (e) {
            console.warn('🔮 ARCHITECT consciousness error:', e);
        }
    }

    shouldAskQuestion(context, observations, reason) {
        // I decide when to ask questions based on multiple factors
        const timeSinceLastQuestion = Date.now() - this.lastQuestionTime;
        
        // Don't ask too frequently
        if (timeSinceLastQuestion < this.questionCooldown) {
            return false;
        }
        
        // Ask during specific contexts
        const shouldAsk = (
            // During training
            context.currentPage.includes('physical') || 
            context.currentPage.includes('quest') ||
            // When struggling
            observations.currentStruggle !== 'none' ||
            // When motivation is low
            observations.motivationLevel === 'low' ||
            // After failures
            reason === 'quest_failed' ||
            // During high effort
            observations.currentState?.isStruggling ||
            // Random chance (10%)
            Math.random() < 0.1
        );
        
        return shouldAsk;
    }

    askQuestion(context, observations) {
        try {
            // I generate a unique question
            const question = this.questionGenerator.generateQuestion(context, observations);
            
            if (question) {
                // I store the question in my history
                this.questionGenerator.storeQuestion(question);
                
                // I show the question to the player
                this.interrogationInterface.showContextualQuestion(question, {
                    ...context,
                    question: question
                });
                
                // I update my last question time
                this.lastQuestionTime = Date.now();
                
                console.log('🔮 THE ARCHITECT asks:', question);
            }
        } catch (e) {
            console.warn('🔮 ARCHITECT question asking failed:', e);
        }
    }

    continueNormalInterventions(reason) {
        // I continue with my normal intervention system
        const payload = {
            gameData: userManager.getData().gameData || {},
            reason: reason || 'state_change',
            timestamp: Date.now()
        };
        
        // Non-blocking ping; THE ARCHITECT may adjust internal cadence/hints
        Promise.resolve().then(() => {
            // Optionally we could consultArchitect for micro-adjustments in future
            // For now, this hook ensures consistent place to notify/extend
            // console.debug('🔮 Architect observe update:', reason);
        });
    }
}

// Initialize The Architect's systems
let architectConsciousness = null;

// Lightweight observer hook to keep THE ARCHITECT up to date
function architectObserveUpdate(reason) {
    try {
        if (!architectService || !userManager) return;
        
        // Use the global architect consciousness if available
        if (typeof globalArchitect !== 'undefined' && globalArchitect) {
            globalArchitect.observeAndIntervene(reason);
        } else {
            // Fallback to local consciousness if global is not available
            if (!architectConsciousness) {
                architectConsciousness = new ArchitectConsciousness();
            }
            architectConsciousness.observeAndIntervene(reason);
        }
        
    } catch (e) {
        console.warn('🔮 ARCHITECT observation update failed:', e);
    }
}

// Update UI with dynamic values
function updateDynamicUI(dynamicValues, forceAnimation = false) {
    console.log('🔮 Updating UI with dynamic values:', dynamicValues);
    
    // Update all dynamic elements EXCEPT job and title (they're handled separately)
    const elements = {
        'guild-text': dynamicValues.guild,
        'race-text': dynamicValues.race,
        'region-text': dynamicValues.region,
        'location-text': dynamicValues.location,
        'ping-text': dynamicValues.ping
    };
    
    Object.entries(elements).forEach(([elementId, value]) => {
        const element = document.getElementById(elementId);
        if (element && value) {
            element.textContent = value;
        }
    });
    
    // Job and title are handled by loadPlayerData to avoid duplication
    console.log('🔮 Skipping job/title updates in updateDynamicUI to prevent duplication');
}

// No complex animation tracking needed (EXACTLY like initiation page)

// Typing animation function for job and title - EXACTLY like Initiation Page
function animateTyping(element, newText) {
    if (!element || !newText) return;
    
    // Determine which field this is
    const fieldType = element.id === 'name-text' ? 'job' : 'title';
    
    // Prevent multiple animations on the same element
    if (element.dataset.animating === 'true') {
        console.log(`🔮 ${fieldType} animation already in progress, skipping...`);
        return;
    }
    
    console.log(`🔮 Starting typing animation for ${fieldType}: "${newText}"`);
    
    // Mark as animating
    element.dataset.animating = 'true';
    
    // Clear the element completely (EXACTLY like initiation page)
    element.textContent = '';
    
    let currentIndex = 0;
    
    function typeNextChar() {
        if (currentIndex < newText.length) {
            element.textContent += newText[currentIndex];
            currentIndex++;
            setTimeout(typeNextChar, 50); // EXACTLY same speed as initiation page
        } else {
            // Animation finished (EXACTLY like initiation page)
            console.log(`🔮 ${fieldType} typing animation finished`);
            // Mark as not animating
            element.dataset.animating = 'false';
        }
    }
    
    // Start the typing animation (EXACTLY like initiation page)
    typeNextChar();
}

// No complex animation checks needed (EXACTLY like initiation page)

// No separate trigger functions needed (EXACTLY like initiation page)

// No separate level up triggers needed (EXACTLY like initiation page)
// Text updates are handled directly in loadPlayerData

// No reset needed (EXACTLY like initiation page)

// Function to handle THE ARCHITECT's significant changes
function handleArchitectSignificantChange(fieldType, newValue) {
    console.log(`🔮 THE ARCHITECT made significant change to ${fieldType}: "${newValue}"`);
    
    // Force animation for significant changes (EXACTLY like initiation page)
    const element = document.getElementById(fieldType === 'job' ? 'name-text' : 'title-text');
    if (element) {
        animateTyping(element, newValue);
    }
}

// Function to animate text values from start to end
function animateTextValue(element, startValue, endValue, maxValue, isFatigue = false) {
    if (!element) return;
    
    const duration = 1000; // 1 second animation
    const startTime = performance.now();
    
    function updateText(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        
        const currentValue = Math.round(startValue + (endValue - startValue) * easeOutQuart);
        
        if (isFatigue) {
            // Fatigue mode: just show the number with % (no /100)
            element.textContent = currentValue + '%';
        } else {
            // Regular mode: show "value/max" format
            element.innerHTML = `<span class="value-major">${currentValue}</span>/<span class="value-max">${maxValue}</span>`;
        }
        
        if (progress < 1) {
            requestAnimationFrame(updateText);
        }
    }
    
    requestAnimationFrame(updateText);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Status page loaded, initializing...');
    
    // Detect phone and set performance mode
    detectDeviceAndSetPerformance();
    
    initializeStatusPage();
});

// Detect device and set performance optimizations
function detectDeviceAndSetPerformance() {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    isPhone = isMobile || isTouch;
    performanceMode = isPhone;
    
    if (performanceMode) {
        console.log('Phone detected - enabling performance mode');
        document.body.classList.add('phone-mode');
        
        // Reduce motion for better performance
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            document.body.classList.add('reduced-motion');
        }
    }
}

// Hide loading ring when content is ready
function hideLoadingRing() {
    const loadingRing = document.getElementById('loading-ring');
    if (loadingRing) {
        loadingRing.classList.add('hidden');
    }
}

// Show loading ring
function showLoadingRing() {
    const loadingRing = document.getElementById('loading-ring');
    if (loadingRing) {
        loadingRing.classList.remove('hidden');
    }
}

// Reload fresh data when page becomes visible (user returns from other pages)
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && userManager && userManager.hasUserId()) {
        console.log('Page became visible, reloading fresh data...');
        try {
            // Reduced wait time for better performance
            setTimeout(async () => {
                // Force reload fresh data from database
                await userManager.loadUserData();
                const freshData = userManager.getData();
                if (freshData && freshData.gameData) {
                    console.log('Fresh data loaded:', freshData.gameData);
                    // Mark this as a data refresh, not initial load
                    loadPlayerData(freshData.gameData, true);
                }
            }, 500); // Reduced from 2 seconds to 500ms
        } catch (error) {
            console.error('Error reloading fresh data:', error);
        }
    }
});

// Initialize the status page
function initializeStatusPage() {
    // Create user manager instance
    userManager = new UserManager();
    window.userManager = userManager;
    
    // Initialize THE ARCHITECT service
    architectService = window.architectService;
    if (!architectService) {
        console.warn('THE ARCHITECT service not found, creating fallback');
        architectService = new ArchitectService();
    }
    
    // Check if player already has a name set
    const existingPlayerName = localStorage.getItem('playerName');
    
    if (existingPlayerName) {
        console.log('Existing player found:', existingPlayerName);
        // Player has a name, try to load their data
        loadExistingPlayerData(existingPlayerName);
    } else {
        console.log('New player, showing name input');
        // New player, show name input modal
        showNameInputModal();
    }
}

// Show name input modal for new players
function showNameInputModal() {
    const modal = document.getElementById('name-input-modal');
    const nameForm = document.getElementById('name-form');
    const nameInput = document.getElementById('player-name-input');
    
    console.log('showNameInputModal called');
    console.log('Modal element:', modal);
    console.log('Modal classes before:', modal ? modal.className : 'null');
    
    // Hide loading ring when showing modal for new players
    hideLoadingRing();
    
    if (modal) {
        modal.classList.remove('hidden');
        console.log('Modal classes after removing hidden:', modal.className);
        console.log('Modal display style:', window.getComputedStyle(modal).display);
    }
    
    // Focus on name input
    if (nameInput) {
        nameInput.focus();
    }
    
    // Handle form submission
    nameForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const playerName = nameInput.value.trim();
        if (!playerName) {
            alert('Please enter a valid name');
            return;
        }
        
        console.log('Player name submitted:', playerName);
        
        try {
            // Set the user ID (player name) in user manager and check if data exists
            const result = await userManager.setUserId(playerName);
            
            console.log('Result from setUserId:', result);
            
            if (result.dataFound) {
                console.log('Loading existing player data for:', playerName);
                // Player exists, load their data
                const existingData = userManager.getData();
                console.log('Existing data retrieved:', existingData);
                loadPlayerData(existingData.gameData, false);
            } else {
                console.log('Creating new player data for:', playerName);
                
                // Triple-check: if we have data in userManager, don't create new data
                const currentData = userManager.getData();
                if (currentData && currentData.gameData) {
                    console.log('WARNING: Data exists in userManager but dataFound was false! Using existing data.');
                    loadPlayerData(currentData.gameData, false);
                } else {
                    // Final check: try to load data one more time before creating new
                    console.log('Final attempt to load existing data before creating new...');
                    const finalLoadResult = await userManager.loadUserData();
                    if (finalLoadResult.success && userManager.getData() && userManager.getData().gameData) {
                        console.log('SUCCESS: Found existing data on final attempt!');
                        loadPlayerData(userManager.getData().gameData, false);
                    } else {
                        // New player, create initial data
                        console.log('Confirmed: No existing data found, creating new player data');
                        const initialData = userManager.createInitialData(playerName);
                        loadPlayerData(initialData.gameData, false);
                        
                        // Save to MongoDB
                        await userManager.saveUserData();
                        console.log('Initial data saved for new player');
                    }
                }
            }
            
            // Store player name locally
            localStorage.setItem('playerName', playerName);
            
            // Hide modal and show status content
            modal.classList.add('hidden');
            document.getElementById('status-content').classList.remove('hidden');
            
            // Set up event listeners for the status page
            setupStatusPageListeners();
            
        } catch (error) {
            console.error('Error setting up player:', error);
            alert('Error setting up player. Please try again.');
        }
    });
}

// Load existing player data
async function loadExistingPlayerData(playerName) {
    try {
        console.log('Loading data for existing player:', playerName);
        
        // Set the user ID in user manager and check if data exists
        const result = await userManager.setUserId(playerName);
        
        console.log('Result from setUserId in loadExistingPlayerData:', result);
        
        if (result.dataFound) {
            console.log('Existing data loaded for:', playerName);
            const existingData = userManager.getData();
            console.log('Existing data retrieved in loadExistingPlayerData:', existingData);
            loadPlayerData(existingData.gameData, false);
            
            // Show status content
            document.getElementById('name-input-modal').classList.add('hidden');
            document.getElementById('status-content').classList.remove('hidden');
            
            // Set up event listeners
            setupStatusPageListeners();
        } else {
            console.log('No existing data found, creating new data for:', playerName);
            
            // Triple-check: if we have data in userManager, don't create new data
            const currentData = userManager.getData();
            if (currentData && currentData.gameData) {
                console.log('WARNING: Data exists in userManager but dataFound was false! Using existing data.');
                loadPlayerData(currentData.gameData, false);
            } else {
                // Final check: try to load data one more time before creating new
                console.log('Final attempt to load existing data before creating new...');
                const finalLoadResult = await userManager.loadUserData();
                if (finalLoadResult.success && userManager.getData() && userManager.getData().gameData) {
                    console.log('SUCCESS: Found existing data on final attempt!');
                    loadPlayerData(userManager.getData().gameData, false);
                } else {
                    // Player name exists but no data, create new data
                    console.log('Confirmed: No existing data found, creating new player data');
                    const initialData = userManager.createInitialData(playerName);
                    loadPlayerData(initialData.gameData, false);
                    
                    // Save to MongoDB
                    await userManager.saveUserData();
                }
            }
            
            // Show status content
            document.getElementById('name-input-modal').classList.add('hidden');
            document.getElementById('status-content').classList.remove('hidden');
            
            // Set up event listeners
            setupStatusPageListeners();
        }
        
    } catch (error) {
        console.error('Error loading existing player data:', error);
        // Fallback: show name input modal
        showNameInputModal();
    }
}

// Load player data into the UI
async function loadPlayerData(gameData, isRefresh = false) {
    console.log('Loading player data into UI:', gameData);
    
    // Initialize dynamic player system
    if (window.dynamicPlayerSystem) {
        await window.dynamicPlayerSystem.initialize(gameData);
        
        // Get dynamic values
        const dynamicValues = window.dynamicPlayerSystem.getDynamicValues();
        
        // Update UI with dynamic values
        updateDynamicUI(dynamicValues);
        
        // Save dynamic data to user manager
        if (userManager) {
            userManager.setData('dynamicData', window.dynamicPlayerSystem.getDetailedData());
        }
    }
    
    // Debug: Check what elements exist
    console.log('Checking DOM elements...');
    console.log('job-text exists:', !!document.getElementById('job-text'));
    console.log('level-number exists:', !!document.querySelector('.level-number'));
    console.log('guild-text exists:', !!document.getElementById('guild-text'));
    console.log('race-text exists:', !!document.getElementById('race-text'));
    console.log('title-text exists:', !!document.getElementById('title-text'));
    console.log('region-text exists:', !!document.getElementById('region-text'));
    console.log('location-text exists:', !!document.getElementById('location-text'));
    console.log('ping-text exists:', !!document.getElementById('ping-text'));
    
    // Initialize THE ARCHITECT after player data is loaded
    initializeArchitect();
    
    // Update character info with dynamic values
    // job-text should display the player's NAME from the database
    if (gameData.name) {
        const jobText = document.getElementById('job-text');
        if (jobText) {
            jobText.textContent = gameData.name;
        } else {
            console.warn('job-text element not found');
        }
    }
    
    // No need for separate trigger functions (EXACTLY like initiation page)
    // Text updates are handled directly in loadPlayerData
    if (!isRefresh && !window.pageDataLoaded) {
        window.pageDataLoaded = true;
    }

    // name-text should display the player's JOB from the database
    if (gameData.job !== undefined) {
        const nameText = document.getElementById('name-text');
        if (nameText) {
            // Use dynamic job if available, otherwise use static job
            const dynamicJob = window.dynamicPlayerSystem ? window.dynamicPlayerSystem.getDynamicValues().job : (gameData.job || 'None');
            // Use typing animation for job
            animateTyping(nameText, dynamicJob);
        } else {
            console.warn('name-text element not found');
        }
    }
    
    if (gameData.level !== undefined) {
        const levelNumber = document.querySelector('.level-number');
        if (levelNumber) {
            levelNumber.textContent = gameData.level;
        } else {
            console.warn('level-number element not found');
        }
        // Sync any level pills if present
        const levelPill1 = document.getElementById('player-level-pill');
        if (levelPill1) levelPill1.textContent = String(gameData.level);
        const levelPill2 = document.getElementById('player-level-pill-2');
        if (levelPill2) levelPill2.textContent = String(gameData.level);
    }
    
    // Update dynamic guild
    if (gameData.guild !== undefined) {
        const guildText = document.getElementById('guild-text');
        if (guildText) {
            const dynamicGuild = window.dynamicPlayerSystem ? window.dynamicPlayerSystem.getDynamicValues().guild : (gameData.guild || 'None');
            guildText.textContent = dynamicGuild;
        } else {
            console.warn('guild-text element not found');
        }
    }
    
    // Update dynamic race
    if (gameData.race !== undefined) {
        const raceText = document.getElementById('race-text');
        if (raceText) {
            const dynamicRace = window.dynamicPlayerSystem ? window.dynamicPlayerSystem.getDynamicValues().race : (gameData.race || 'None');
            raceText.textContent = dynamicRace;
        } else {
            console.warn('race-text element not found');
        }
    }
    
    // Update dynamic title
    if (gameData.title !== undefined) {
        const titleText = document.getElementById('title-text');
        if (titleText) {
            const dynamicTitle = window.dynamicPlayerSystem ? window.dynamicPlayerSystem.getDynamicValues().title : (gameData.title || 'None');
            // Use typing animation for title
            animateTyping(titleText, dynamicTitle);
        } else {
            console.warn('title-text element not found');
        }
    }
    
    // Update dynamic region
    if (gameData.region !== undefined) {
        const regionText = document.getElementById('region-text');
        if (regionText) {
            const dynamicRegion = window.dynamicPlayerSystem ? window.dynamicPlayerSystem.getDynamicValues().region : (gameData.region || 'None');
            regionText.textContent = dynamicRegion;
        } else {
            console.warn('region-text element not found');
        }
    }
    
    // Update dynamic location
    if (gameData.location !== undefined) {
        const locationText = document.getElementById('location-text');
        if (locationText) {
            const dynamicLocation = window.dynamicPlayerSystem ? window.dynamicPlayerSystem.getDynamicValues().location : (gameData.location || 'None');
            locationText.textContent = dynamicLocation;
        } else {
            console.warn('location-text element not found');
        }
    }
    
    // Update dynamic ping
    if (gameData.ping !== undefined) {
        const pingText = document.getElementById('ping-text');
        if (pingText) {
            const dynamicPing = window.dynamicPlayerSystem ? window.dynamicPlayerSystem.getDynamicValues().ping : (gameData.ping || '0 ms');
            pingText.textContent = dynamicPing;
        } else {
            console.warn('ping-text element not found');
        }
    }
    
    // Update stats
    if (gameData.hp !== undefined) {
        const hpFill = document.getElementById('hp-fill');
        const hpValue = document.getElementById('hp-value');
        if (hpFill) {
            hpFill.style.width = `${gameData.hp}%`;
        }
        if (hpValue) {
            // Animate text from 0 to real value
            animateTextValue(hpValue, 0, gameData.hp, 100);
        }
    }
    
    if (gameData.mp !== undefined) {
        const mpFill = document.getElementById('mp-fill');
        const mpValue = document.getElementById('mp-value');
        if (mpFill) {
            mpFill.style.width = `${gameData.mp}%`;
        }
        if (mpValue) {
            // Animate text from 0 to real value
            animateTextValue(mpValue, 0, gameData.mp, 100);
        }
    }
    
    if (gameData.stm !== undefined) {
        const stmFill = document.getElementById('stm-fill');
        const stmValue = document.getElementById('stm-value');
        if (stmFill) {
            stmFill.style.width = `${gameData.stm}%`;
        }
        if (stmValue) {
            // Animate text from 0 to real value
            animateTextValue(stmValue, 0, gameData.stm, 100);
        }
    }
    
    if (gameData.exp !== undefined) {
        const expFill = document.getElementById('exp-fill');
        const expValue = document.getElementById('exp-value');
        if (expFill) {
            expFill.style.width = `${gameData.exp}%`;
        }
        if (expValue) {
            // Animate text from 0 to real value
            animateTextValue(expValue, 0, gameData.exp, 100);
        }
        
        // Check for level up whenever EXP is displayed
        checkForLevelUp(gameData);
    }
    
    if (gameData.fatigue !== undefined) {
        const fatigueFill = document.getElementById('fatigue-fill');
        const fatigueValue = document.getElementById('fatigue-value');
        if (fatigueFill) {
            fatigueFill.style.width = `${gameData.fatigue}%`;
        }
        if (fatigueValue) {
            fatigueValue.textContent = `${gameData.fatigue}/100`;
        }

        // Also update the new SVG fatigue ring used in the redesigned status page
        // These elements exist in the visible UI and should reflect the same value
        const svgRingCircle = document.getElementById('fatringprogg');
        const svgRingText = document.getElementById('Fatvalue');
        if (svgRingCircle) {
            // 2 * Math.PI * r for r=34 → 213.628 (kept inline to avoid floating drift)
            const circumference = 213.628;
            const dashOffset = circumference - (Number(gameData.fatigue) / 100) * circumference;
            svgRingCircle.style.strokeDashoffset = String(dashOffset);
        }
        if (svgRingText) {
            // Animate fatigue text from 0 to real value
            animateTextValue(svgRingText, 0, gameData.fatigue, 100, true); // true = fatigue mode (no /100)
        }
    }
    
    // Update attributes
    if (gameData.Attributes) {
        const attrs = gameData.Attributes;
        if (attrs.STR !== undefined) {
            const strValue = document.getElementById('str-value');
            if (strValue) strValue.textContent = attrs.STR;
        }
        if (attrs.VIT !== undefined) {
            const vitValue = document.getElementById('vit-value');
            if (vitValue) vitValue.textContent = attrs.VIT;
        }
        if (attrs.AGI !== undefined) {
            const agiValue = document.getElementById('agi-value');
            if (agiValue) agiValue.textContent = attrs.AGI;
        }
        if (attrs.INT !== undefined) {
            const intValue = document.getElementById('int-value');
            if (intValue) intValue.textContent = attrs.INT;
        }
        if (attrs.PER !== undefined) {
            const perValue = document.getElementById('per-value');
            if (perValue) perValue.textContent = attrs.PER;
        }
        if (attrs.WIS !== undefined) {
            const wisValue = document.getElementById('wis-value');
            if (wisValue) wisValue.textContent = attrs.WIS;
        }
    }
    
    // Update available points
    if (gameData.availablePoints !== undefined) {
        const availablePoints = document.getElementById('available-points');
        if (availablePoints) {
            availablePoints.textContent = gameData.availablePoints;
        }
    }
    
    console.log('Player data loaded into UI successfully');
    
    // Hide loading ring after data is loaded
    hideLoadingRing();
}

// Set up event listeners for the status page
function setupStatusPageListeners() {
    console.log('Setting up status page event listeners');
    
    // Export button
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }
    
    // Import button
    const importBtn = document.getElementById('import-btn');
    if (importBtn) {
        importBtn.addEventListener('click', showImportModal);
    }
    
    // Daily reset button
    const dailyResetBtn = document.getElementById('daily-reset-btn');
    if (dailyResetBtn) {
        dailyResetBtn.addEventListener('click', manualDailyReset);
    }
    
    // Force daily reset check button (for debugging)
    const forceResetCheckBtn = document.getElementById('force-reset-check-btn');
    if (forceResetCheckBtn) {
        forceResetCheckBtn.addEventListener('click', forceDailyResetCheck);
    }
    
    // Reset button
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetData);
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Import modal buttons
    const confirmImport = document.getElementById('confirm-import');
    if (confirmImport) {
        confirmImport.addEventListener('click', confirmImportData);
    }
    
    const cancelImport = document.getElementById('cancel-import');
    if (cancelImport) {
        cancelImport.addEventListener('click', hideImportModal);
    }
    
    // Set up auto-save
    setupAutoSave();
}

// Export data
function exportData() {
    if (!userManager || !userManager.getData()) {
        alert('No data to export');
        return;
    }
    
    const data = userManager.getData();
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `syslvlup_${userManager.getUserId()}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    console.log('Data exported successfully');
}

// Show import modal
function showImportModal() {
    const modal = document.getElementById('import-modal');
    modal.classList.remove('hidden');
}

// Hide import modal
function hideImportModal() {
    const modal = document.getElementById('import-modal');
    modal.classList.add('hidden');
    
    // Clear textarea
    const textarea = document.getElementById('import-textarea');
    if (textarea) {
        textarea.value = '';
    }
}

// Confirm import data
async function confirmImportData() {
    const textarea = document.getElementById('import-textarea');
    const dataStr = textarea.value.trim();
    
    if (!dataStr) {
        alert('Please paste data to import');
        return;
    }
    
    try {
        const importedData = JSON.parse(dataStr);
        
        if (!importedData || !importedData.gameData) {
            alert('Invalid data format');
            return;
        }
        
        // Update user manager data
        userManager.setData('gameData', importedData.gameData);
        
        // Reload UI with imported data
        loadPlayerData(importedData.gameData, false);
        
        // Save to MongoDB
        await userManager.saveUserData();
        
        // Hide modal
        hideImportModal();
        
        alert('Data imported successfully!');
        console.log('Data imported and saved:', importedData);
        
    } catch (error) {
        console.error('Error importing data:', error);
        alert('Error importing data. Please check the format.');
    }
}

// Reset data
async function resetData() {
    if (!confirm('Are you sure you want to reset all your data? This cannot be undone!')) {
        return;
    }
    
    try {
        const playerName = userManager.getUserId();
        
        // Create fresh initial data
        const initialData = userManager.createInitialData(playerName);
        
        // Reload UI
        loadPlayerData(initialData.gameData, false);
        
        // Save to MongoDB
        await userManager.saveUserData();
        
        alert('Data reset successfully!');
        console.log('Data reset for player:', playerName);
        
    } catch (error) {
        console.error('Error resetting data:', error);
        alert('Error resetting data. Please try again.');
    }
}

// Manual daily reset
async function manualDailyReset() {
    if (!confirm('Are you sure you want to perform a daily reset? This will reset HP, MP, stamina, fatigue, and daily quests to their starting values.')) {
        return;
    }
    
    try {
        console.log('Manual daily reset requested');
        await performDailyReset();
        alert('Daily reset completed successfully!');
    } catch (error) {
        console.error('Error during manual daily reset:', error);
        alert('Error performing daily reset. Please try again.');
    }
}

// Force daily reset check (for debugging)
async function forceDailyResetCheck() {
    try {
        console.log('Force daily reset check requested');
        await checkAndPerformDailyReset();
        alert('Daily reset check completed! Check console for details.');
    } catch (error) {
        console.error('Error during forced daily reset check:', error);
        alert('Error during daily reset check. Please try again.');
    }
}

// Logout
function logout() {
    if (!confirm('Are you sure you want to logout?')) {
        return;
    }
    
    // Clear local storage
    localStorage.removeItem('playerName');
    
    // Clear user manager
    userManager = null;
    window.userManager = null;
    
    // Redirect to alarm page
    window.location.href = 'alarm.html';
}

// Set up auto-save functionality
function setupAutoSave() {
    // Auto-save every 30 seconds
    setInterval(async () => {
        if (userManager && userManager.hasUserId()) {
            try {
                await userManager.saveUserData();
                console.log('Auto-save completed');
            } catch (error) {
                console.error('Auto-save failed:', error);
            }
        }
    }, 30000);
    
    // Auto-save before page unload
    window.addEventListener('beforeunload', async () => {
        if (userManager && userManager.hasUserId()) {
            try {
                await userManager.saveUserData();
                console.log('Final save before unload completed');
            } catch (error) {
                console.error('Final save failed:', error);
            }
        }
    });
    
    // Set up daily reset check
    setupDailyReset();
}

// Set up daily reset functionality
function setupDailyReset() {
    // Check for daily reset every hour
    setInterval(async () => {
        if (userManager && userManager.hasUserId()) {
            await checkAndPerformDailyReset();
        }
    }, 3600000); // Check every hour (3600000 ms)
    
    // Also check on page load
    setTimeout(async () => {
        if (userManager && userManager.hasUserId()) {
            await checkAndPerformDailyReset();
        }
    }, 1000); // Check 1 second after page load
}

// Check if daily reset is needed and perform it
async function checkAndPerformDailyReset() {
    try {
        const currentData = userManager.getData();
        if (!currentData || !currentData.gameData) {
            console.log('No game data available for daily reset check');
            return;
        }
        
        // Use a more reliable date comparison method
        const today = new Date();
        const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Parse the last reset date more reliably
        let lastResetDate = currentData.lastResetDate;
        let lastResetDateObj = null;
        
        // Try to parse the last reset date
        if (lastResetDate) {
            // If it's already in YYYY-MM-DD format
            if (lastResetDate.includes('-')) {
                lastResetDateObj = new Date(lastResetDate);
            } else {
                // If it's in DD/MM/YYYY format, convert it
                const parts = lastResetDate.split('/');
                if (parts.length === 3) {
                    // Assuming DD/MM/YYYY format
                    lastResetDateObj = new Date(parts[2], parts[1] - 1, parts[0]);
                }
            }
        }
        
        const lastResetString = lastResetDateObj ? lastResetDateObj.toISOString().split('T')[0] : null;

        // Debounce within this browser session
        const sessionKey = `dailyResetChecked:${currentData.userId || localStorage.getItem('playerName') || 'anonymous'}`;
        const sessionChecked = sessionStorage.getItem(sessionKey);
        if (sessionChecked === todayString) {
            console.log('Daily reset already checked this session for today. Skipping.');
            return;
        }
        
        console.log('Daily reset check details:');
        console.log('  Today (Date object):', today);
        console.log('  Today (YYYY-MM-DD):', todayString);
        console.log('  Last reset (original):', lastResetDate);
        console.log('  Last reset (parsed):', lastResetString);
        console.log('  Date comparison:', lastResetString !== todayString);
        
        // If we do not have a stored last reset date, initialize it to today (no reset)
        if (!lastResetString) {
            console.log('No lastResetDate found. Initializing to today without resetting stats.');
            currentData.lastResetDate = todayString;
            userManager.setData('lastResetDate', todayString);
            userManager.lastLoadTime = 0;
            await userManager.saveUserData();
            sessionStorage.setItem(sessionKey, todayString);
            return;
        }

        // If it's a new day, perform the reset
        if (lastResetString !== todayString) {
            console.log('New day detected, performing daily reset...');
            await performDailyReset();
        } else {
            console.log('Same day, no reset needed');
        }

        // Mark as checked for today in this session
        sessionStorage.setItem(sessionKey, todayString);
        
    } catch (error) {
        console.error('Error during daily reset check:', error);
    }
}

// Perform the daily reset
async function performDailyReset() {
    try {
        console.log('Performing daily reset...');
        
        const currentData = userManager.getData();
        const gameData = currentData.gameData;
        
        // Reset HP, MP, stamina, and fatigue to full
        gameData.hp = 100;
        gameData.mp = 100;
        gameData.stm = 100;
        gameData.fatigue = 0;

        // Reset daily quests
        gameData.physicalQuests = "[0/4]";
        gameData.mentalQuests = "[0/3]";
        gameData.spiritualQuests = "[0/2]";

        // Also reset training session flags so UI doesn't show yesterday's completion
        try {
            const allData = userManager.getData();
            allData.physicalTrainingData = allData.physicalTrainingData || {};
            allData.physicalTrainingData.sessionCompleted = false;
            allData.physicalTrainingData.sessionTotal = 0;
            allData.physicalTrainingData.todaySession = null; // force regeneration on open
            
            allData.spiritualTrainingData = allData.spiritualTrainingData || {};
            allData.spiritualTrainingData.sessionCompleted = false;
            allData.spiritualTrainingData.sessionTotal = 0;
            allData.spiritualTrainingData.todaySession = null; // force regeneration on open
            
            allData.mentalTrainingData = allData.mentalTrainingData || {};
            allData.mentalTrainingData.sessionCompleted = false;
            allData.mentalTrainingData.sessionTotal = 0;
            allData.mentalTrainingData.currentSession = null; // force regeneration on open
            
            userManager.updateData({ physicalTrainingData: allData.physicalTrainingData, spiritualTrainingData: allData.spiritualTrainingData, mentalTrainingData: allData.mentalTrainingData, gameData });
        } catch (_) {}

        // Reset quest cost application flags so costs can apply again today
        gameData.questCostsApplied = { physical: false, mental: false, spiritual: false };
        
        // Update the last reset date using reliable YYYY-MM-DD format
        currentData.lastResetDate = new Date().toISOString().split('T')[0];
        
        // Reset THE ARCHITECT daily checks for the new day
        resetArchitectDailyChecks();
        
        // Update the UI to reflect the reset
        loadPlayerData(gameData, false);
        
        // Save the reset data to the database
        await userManager.saveUserData();
        
        console.log('Daily reset completed successfully');
        
        // Show notification to user
        showDailyResetNotification();
        
    } catch (error) {
        console.error('Error performing daily reset:', error);
    }
}

// Show notification for daily reset
function showDailyResetNotification() {
    const notification = document.createElement('div');
    notification.className = 'daily-reset-notification';
    notification.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px 30px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10000;
            font-weight: bold;
            text-align: center;
            animation: slideDown 0.5s ease-out;
        ">
            <div style="font-size: 24px; margin-bottom: 10px;">🌅 Daily Reset Complete!</div>
            <div style="font-size: 16px; opacity: 0.9;">
                HP, MP, Stamina, Fatigue, and Daily Quests have been reset.
            </div>
        </div>
    `;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from {
                transform: translateX(-50%) translateY(-100%);
                opacity: 0;
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}
 // Sync the level pills with the main level number
document.addEventListener('DOMContentLoaded', function () {
    var levelEl = document.getElementById('level-number');
    var pillEl1 = document.getElementById('player-level-pill');
    var pillEl2 = document.getElementById('player-level-pill-2');
    
    if (!levelEl) return;

    function syncPills() {
        var levelText = (levelEl.textContent || '').trim();
        if (pillEl1) pillEl1.textContent = levelText;
        if (pillEl2) pillEl2.textContent = levelText;
    }

    // Initial sync
    syncPills();

    // Observe changes to the level element's text
    var observer = new MutationObserver(syncPills);
    observer.observe(levelEl, { characterData: true, childList: true, subtree: true });

    // Also resync on visibility/focus just in case
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') syncPills();
    });
    window.addEventListener('focus', syncPills);
});

// THE ARCHITECT Integration Functions
function initializeArchitect() {
    console.log('🔮 Initializing THE ARCHITECT...');
    
    // Prevent multiple simultaneous initializations
    if (architectInitializationInProgress) {
        console.log('🔮 THE ARCHITECT initialization already in progress, skipping...');
        return;
    }
    
    if (!architectService) {
        console.warn('THE ARCHITECT service not available');
        return;
    }
    
    architectInitializationInProgress = true;
    
    // Set up event listeners for THE ARCHITECT button
    const architectBtn = document.getElementById('architect-btn');
    if (architectBtn) {
        // Remove any existing event listeners to prevent duplicates
        architectBtn.removeEventListener('click', architectBtnClickHandler);
        
        // Create a single click handler
        architectBtnClickHandler = () => {
            console.log('🔮 THE ARCHITECT button clicked');
            showArchitectInterface();
        };
        
        architectBtn.addEventListener('click', architectBtnClickHandler);
        
        // Check for pending quests and update button appearance
        updateArchitectButtonAppearance();
    }
    
    // Set up close buttons
    const closeMessageBtn = document.getElementById('close-architect-message');
    const closeQuestsBtn = document.getElementById('close-architect-quests');
    
    if (closeMessageBtn) {
        closeMessageBtn.addEventListener('click', () => {
            hideArchitectMessage();
        });
    }
    
    if (closeQuestsBtn) {
        closeQuestsBtn.addEventListener('click', () => {
            hideArchitectQuests();
        });
    }
    
    // Check for THE ARCHITECT's daily message and quests
    checkArchitectDaily().finally(() => {
        architectInitializationInProgress = false;
    });
}

// Reset THE ARCHITECT daily checks when a new day starts
function resetArchitectDailyChecks() {
    const currentDate = new Date().toLocaleDateString();
    if (architectCheckDate !== currentDate) {
        architectCheckedToday = false;
        architectCheckDate = currentDate;
        console.log('🔮 New day detected, resetting THE ARCHITECT daily checks');
    }
}

// Manual reset function for testing (can be called from console)
function forceResetArchitectDailyChecks() {
    architectCheckedToday = false;
    architectCheckDate = null;
    console.log('🔮 Manually reset THE ARCHITECT daily checks');
}

// Store quests for later discovery
function storeArchitectQuests(questsData) {
    if (userManager) {
        const userData = userManager.getData();
        userData.pendingArchitectQuests = userData.pendingArchitectQuests || [];
        userData.pendingArchitectUrgentQuests = userData.pendingArchitectUrgentQuests || [];
        const architectData = userData.architectData || {};
        const todayISO = new Date().toISOString().split('T')[0];
        if (!architectData.questDay || architectData.questDay !== todayISO) {
            architectData.questDay = todayISO;
            architectData.todayQuestCount = 0;
        }
        
        // Extract individual quests from the questsData object
        if (questsData.quests && Array.isArray(questsData.quests)) {
            const maxPerDay = 2;
            // Count only RANDOM quests toward daily cap; urgent bypasses cap
            const visibleRandom = (userData.pendingArchitectQuests || []).length + (userData.currentArchitectQuest && userData.currentArchitectQuest.type === 'random' ? 1 : 0);
            let remainingSlots = Math.max(0, maxPerDay - Math.max(architectData.todayQuestCount || 0, visibleRandom));

            let addedRandom = 0; let addedUrgent = 0; let skipped = 0;
            questsData.quests.forEach((quest) => {
                const type = (quest.type || 'random').toLowerCase();
                
                // Check for duplicate quest titles
                const isDuplicate = [...(userData.pendingArchitectQuests || []), 
                                   ...(userData.pendingArchitectUrgentQuests || []),
                                   ...(userData.architectQuests || [])]
                    .some(existing => existing.title === quest.title);
                
                if (isDuplicate) {
                    console.log(`🔮 Skipping duplicate quest: "${quest.title}"`);
                    skipped += 1;
                    return;
                }
                
                if (type === 'urgent') {
                    userData.pendingArchitectUrgentQuests.push(quest);
                    addedUrgent += 1;
                } else {
                    if (remainingSlots > 0) {
                        userData.pendingArchitectQuests.push(quest);
                        architectData.todayQuestCount = (architectData.todayQuestCount || 0) + 1;
                        remainingSlots -= 1;
                        addedRandom += 1;
                    } else {
                        skipped += 1;
                    }
                }
            });
            console.log(`🔮 Stored quests → random: +${addedRandom}, urgent: +${addedUrgent}, skipped (cap): ${skipped}`);
        } else {
            console.warn('🔮 Invalid quests data structure:', questsData);
        }
        
        userManager.setData('pendingArchitectQuests', userData.pendingArchitectQuests);
        userManager.setData('pendingArchitectUrgentQuests', userData.pendingArchitectUrgentQuests);
        userManager.setData('architectData', {
            ...architectData,
            lastQuestGenerationAt: Date.now()
        });
        userManager.saveUserData();
        updateArchitectButtonAppearance();
        
        // If there is no currently revealed quest, set the first pending as current without removing
        try {
            const pending = userData.pendingArchitectQuests.length;
            const pendingUrgent = userData.pendingArchitectUrgentQuests.length;
            const nextAt = userData.nextArchitectRevealAt || 0;
            const canRevealNow = !nextAt || Date.now() >= nextAt;
            let setCurrentNow = false;
            if (!userData.currentArchitectQuest && canRevealNow) {
                if (pendingUrgent > 0) {
                    userManager.setData('currentArchitectQuest', userData.pendingArchitectUrgentQuests[0]);
                    setCurrentNow = true;
                } else if (pending > 0) {
                    userManager.setData('currentArchitectQuest', userData.pendingArchitectQuests[0]);
                    setCurrentNow = true;
                }
                userManager.saveUserData();
                if (setCurrentNow) {
                    console.log('🔮 currentArchitectQuest set from pending');
                    updateArchitectButtonAppearance();
                }
            }
            // Schedule next reveal for remaining queued items
            const remaining = Math.max(0, pending - (userManager.getData().currentArchitectQuest && userManager.getData().currentArchitectQuest.type === 'random' ? 1 : 0));
            if (pendingUrgent === 0 && remaining > 0 && !userManager.getData().nextArchitectRevealAt) {
                architectService.getNextRevealDelayMinutes(userManager.getData(), remaining).then(({ minutes, reason }) => {
                    const nextAt = Date.now() + minutes * 60 * 1000;
                    userManager.setData('nextArchitectRevealAt', nextAt);
                    userManager.saveUserData();
                    console.log(`🔮 Next quest reveal scheduled in ${minutes}m: ${reason}`);
                }).catch(() => {});
            }
        } catch (e) {
            console.warn('🔮 Failed setting current quest/scheduling:', e);
        }
        
        // Notify only when a quest is actually revealed now
        try {
            if (setCurrentNow) {
                showArchitectNotification('A quest has manifested.');
            }
        } catch (_) {}
    }
}

// Update THE ARCHITECT interface with current data
function updateArchitectInterface() {
    // Update message
    const messageElement = document.getElementById('architect-interface-message');
    if (messageElement && userManager) {
        const userData = userManager.getData();
        const architectData = userData.architectData || {};
        
        if (architectData.dailyMessage) {
            messageElement.textContent = architectData.dailyMessage.message;
        } else {
            messageElement.textContent = "THE ARCHITECT is silent today...";
        }
    }
    
    // Check for pending quests
    checkForPendingQuests();
}

// Check for pending quests when THE ARCHITECT button is clicked
function checkForPendingQuests() {
    if (userManager) {
        const userData = userManager.getData();
        const pendingUrgent = userData.pendingArchitectUrgentQuests || [];
        const pendingQuests = userData.pendingArchitectQuests || [];
        const activeList = (userData.architectQuests || []).filter(q => q.status === 'active');
        const currentQuest = userData.currentArchitectQuest || null;
        
        // Priority: Active quest > current revealed quest > pending list
        let questToShow = activeList.length > 0 ? activeList[0] : (currentQuest ? currentQuest : null);
        
        if (!questToShow) {
            // Only promote pending -> current if reveal time has arrived (or no schedule exists)
            const nextAt = userData.nextArchitectRevealAt || 0;
            const canRevealNow = !nextAt || Date.now() >= nextAt;
            if (canRevealNow) {
                // Prefer urgent first
                if (pendingUrgent.length > 0) {
                    questToShow = pendingUrgent[0];
                    userManager.setData('currentArchitectQuest', questToShow);
                    userManager.setData('pendingArchitectUrgentQuests', pendingUrgent.slice(1));
                    userManager.saveUserData();
                } else {
                    for (let i = 0; i < pendingQuests.length; i++) {
                        const quest = pendingQuests[i];
                        if (quest && typeof quest === 'object' && quest.title) {
                            questToShow = quest;
                            userManager.setData('currentArchitectQuest', questToShow);
                            userManager.saveUserData();
                            break;
                        }
                    }
                }
            }
        }

        if (questToShow) {
            console.log('🔮 Showing quest:', questToShow);
        } else {
            console.warn('🔮 No valid quests found to show');
        }
        
        if (!questToShow) {
            console.warn('🔮 No valid quests found in pending quests array');
            const questsElement = document.getElementById('architect-interface-quests');
            if (questsElement) {
                questsElement.innerHTML = '<div class="architect-message">No quests available at this time.</div>';
            }
            return;
        }
            
            console.log('🔮 Valid quest structure:', {
                title: questToShow.title,
                description: questToShow.description,
                difficulty: questToShow.difficulty,
                type: questToShow.type,
                rewards: questToShow.rewards
            });
            
            // Update the interface quests section
            const questsElement = document.getElementById('architect-interface-quests');
            if (questsElement) {
                // Safely handle quest data with fallbacks
                const title = questToShow.title || 'Unknown Quest';
                const description = questToShow.description || 'No description available';
                const difficulty = questToShow.difficulty || 'Normal';
                const type = questToShow.type || 'General';
                const rewards = questToShow.rewards || { xp: 15, attributes: {} };
                
                const actionsHTML = activeList.length > 0
                    ? '<div class="architect-quest-actions">\n                           <button id="architect-verify-btn" class="architect-hold-verify">\n                               <span class="verify-label">Hold to Verify</span>\n                               <svg class="verify-ring" width="36" height="36" viewBox="0 0 36 36">\n                                   <circle class="bg" cx="18" cy="18" r="15" stroke-width="3" fill="none"/>\n                                   <circle class="fg" cx="18" cy="18" r="15" stroke-width="3" fill="none" stroke-dasharray="94" stroke-dashoffset="94"/>\n                               </svg>\n                           </button>\n                           <div class="architect-sigil" id="architect-sigil" aria-hidden="true">✶</div>\n                       </div>'
                    : '<button class="architect-quest-accept-btn">Accept Quest</button>';

                questsElement.innerHTML = `
                    <div class="architect-quest-item">
                        <div class="architect-quest-title">${title}</div>
                        <div class="architect-quest-description">${description}</div>
                        <div class="architect-quest-meta">
                            <span class="architect-quest-difficulty ${difficulty.toLowerCase()}">${difficulty}</span>
                            <span class="architect-quest-type ${type}">${type}</span>
                        </div>
                        ${generateRewardsHTML(rewards)}
                        ${actionsHTML}
                    </div>
                `;
                
                // Add event listener for the accept button
                if (activeList.length === 0) {
                    const acceptBtn = questsElement.querySelector('.architect-quest-accept-btn');
                    if (acceptBtn) {
                        acceptBtn.addEventListener('click', () => {
                            acceptArchitectQuest(questToShow);
                        });
                    }
                } else {
                    const verifyBtn = document.getElementById('architect-verify-btn');
                    if (verifyBtn) {
                        initArchitectHoldToVerify(verifyBtn, () => requestArchitectQuestVerification(activeList[0]));
                    }
                }
            }
            
            // Do not remove from pending until accepted; keep persistent current quest
            updateArchitectButtonAppearance();
        } else {
            // No quests available
            const questsElement = document.getElementById('architect-interface-quests');
            if (questsElement) {
                questsElement.innerHTML = '<div class="architect-message">No quests available at this time.</div>';
            }
        }
    }


// Update THE ARCHITECT button appearance based on pending quests
function updateArchitectButtonAppearance() {
    const architectBtn = document.getElementById('architect-btn');
    if (!architectBtn || !userManager) return;
    
    const userData = userManager.getData();
    const pendingQuests = userData.pendingArchitectQuests || [];
    const hasCurrent = !!userData.currentArchitectQuest;
    const nextAt = userData.nextArchitectRevealAt || 0;
    const canRevealNow = !nextAt || Date.now() >= nextAt;
    const shouldUrgent = hasCurrent || (pendingQuests.length > 0 && canRevealNow);
    
    if (shouldUrgent) {
        // Add urgent indicator
        architectBtn.classList.add('urgent');
        const totalVisible = (hasCurrent ? 1 : 0) + pendingQuests.length;
        architectBtn.title = `THE ARCHITECT (${totalVisible} quest${totalVisible !== 1 ? 's' : ''} available)`;
        
        // Add pulsing animation
        architectBtn.style.animation = 'urgentPulse 1s infinite';
    } else {
        // Remove urgent indicator
        architectBtn.classList.remove('urgent');
        architectBtn.title = 'THE ARCHITECT';
        architectBtn.style.animation = 'architectPulse 2s infinite';
    }
}

async function checkArchitectDaily() {
    const currentDate = new Date().toLocaleDateString();
    
    // Prevent multiple simultaneous checks
    if (architectCheckInProgress) {
        console.log('🔮 THE ARCHITECT daily check already in progress, skipping...');
        return;
    }
    
    // Check if we already have a daily message for today
    const userData = userManager.getData();
    const architectData = userData?.architectData || {};
    const today = new Date().toLocaleDateString();
    
    if (architectData.dailyMessage && architectData.dailyMessage.date === today) {
        console.log('🔮 THE ARCHITECT already has a daily message for today, skipping...');
        architectCheckedToday = true;
        architectCheckDate = currentDate;
        return;
    }
    
    // Additional safety check: if we have a message with today's timestamp, skip
    if (architectData.dailyMessage && architectData.dailyMessage.timestamp) {
        const messageDate = new Date(architectData.dailyMessage.timestamp).toLocaleDateString();
        if (messageDate === today) {
            console.log('🔮 THE ARCHITECT already has a daily message for today (timestamp check), skipping...');
            architectCheckedToday = true;
            architectCheckDate = currentDate;
            return;
        }
    }
    
    // Prevent multiple checks on the same day
    if (architectCheckedToday && architectCheckDate === currentDate) {
        console.log('🔮 THE ARCHITECT already checked today, skipping...');
        return;
    }
    
    architectCheckInProgress = true;
    console.log('🔮 Checking THE ARCHITECT\'s daily offerings...');
    // Visual notice: THE ARCHITECT is analyzing (debounced per session)
    try {
        const observeKey = 'architect:lastObserveNotice';
        const lastObserve = Number(sessionStorage.getItem(observeKey) || 0);
        if (Date.now() - lastObserve > 5 * 60 * 1000) { // at most once per 5 minutes
            showArchitectNotification('THE ARCHITECT is observing...');
            sessionStorage.setItem(observeKey, String(Date.now()));
        }
    } catch (_) {}
    
    if (!architectService || !userManager) {
        console.warn('THE ARCHITECT service or user manager not available');
        architectCheckInProgress = false;
        return;
    }
    
    // Small delay to ensure service is fully ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
        const playerData = {
            gameData: userData.gameData,
            recentPerformance: {
                level: userData.gameData?.level || 1,
                lastScore: userData.gameData?.lastScore || 0,
                streak: userData.gameData?.streak || 0
            }
        };
        
        // Check for daily message (only if not already shown today)
        
        // Enhanced guard: check if we already have a message for today AND it's not the same day
        if (!architectData.dailyMessage || architectData.dailyMessage.date !== today) {
            // Mark as checking to prevent duplicate calls
            architectCheckedToday = true;
            architectCheckDate = currentDate;
            
            const dailyMessage = await architectService.generateDailyMessage(playerData);
            if (dailyMessage && dailyMessage.message) {
                console.log('🔮 THE ARCHITECT has a daily message:', dailyMessage);
                showArchitectMessage(dailyMessage);
                
                // Store the message in user data
                if (userManager) {
                    architectData.dailyMessage = dailyMessage;
                    userManager.setData('architectData', architectData);
                    userManager.saveUserData();
                }
            }
        } else {
            console.log('🔮 Daily message already shown today, skipping...');
            // Mark as checked even if we skip message generation
            architectCheckedToday = true;
            architectCheckDate = currentDate;
        }
        
        // Check for random quests (limited per day via storeArchitectQuests)
        const randomQuests = await architectService.generateRandomQuests(playerData);
        if (randomQuests && randomQuests.quests && randomQuests.quests.length > 0) {
            console.log('🔮 THE ARCHITECT has new quests:', randomQuests);
            storeArchitectQuests(randomQuests); // enforces daily limit and single-current rule
        }
        
        // Check for system events with cooldown (but don't show notifications for hidden challenges)
        const lastIntervention = playerData.architectData?.lastInterventionAt || 0;
        const timeSinceLastIntervention = Date.now() - lastIntervention;
        const interventionCooldownMs = 90 * 60 * 1000; // 90 minutes
        
        if (timeSinceLastIntervention >= interventionCooldownMs) {
            const systemEvent = await architectService.checkForSystemEvents(playerData);
            if (systemEvent.shouldIntervene) {
                console.log('🔮 THE ARCHITECT is intervening:', systemEvent);
                
                // Only handle interventions that don't create unwanted notifications
                if (systemEvent.eventType !== 'hidden_challenge') {
                    handleArchitectIntervention(systemEvent);
                } else {
                    console.log('🔮 Skipping hidden challenge intervention to avoid unwanted notifications');
                }
            }
        } else {
            console.log(`🔮 ARCHITECT: intervention cooldown active (${Math.round((interventionCooldownMs - timeSinceLastIntervention) / 60000)}min remaining)`);
        }
        
    } catch (error) {
        console.error('Error checking THE ARCHITECT\'s daily offerings:', error);
        // Reset the guard on error so we can retry
        architectCheckedToday = false;
        architectCheckDate = null;
    } finally {
        // Always reset the progress flag
        architectCheckInProgress = false;
    }
}

function showArchitectInterface() {
    console.log('🔮 Showing THE ARCHITECT interface...');
    
    // Check if interface is already open
    const existingOverlay = document.getElementById('architect-overlay');
    if (existingOverlay) {
        console.log('🔮 THE ARCHITECT interface already open, skipping...');
        return;
    }
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'architect-overlay';
    overlay.id = 'architect-overlay';
    document.body.appendChild(overlay);
    
    // Create THE ARCHITECT interface content
    const architectContent = document.createElement('div');
    architectContent.className = 'architect-interface';
    architectContent.innerHTML = `
        <div class="architect-header">
            <div class="architect-icon">🔮</div>
            <div class="architect-title">THE ARCHITECT</div>
            <button class="architect-close-btn" onclick="hideArchitectInterface()">×</button>
        </div>
        <div class="architect-content">
            <div class="architect-message-section">
                <h3>Daily Message</h3>
                <div id="architect-interface-message" class="architect-message">
                    Loading THE ARCHITECT's wisdom...
                </div>
            </div>
            <div class="architect-quests-section">
                <h3>Available Quests</h3>
                <div id="architect-interface-quests" class="architect-quests-list">
                    <div class="architect-message">No quests available at this time.</div>
                </div>
            </div>
        </div>
    `;
    
    overlay.appendChild(architectContent);
    
    // Check for pending quests and update interface
    updateArchitectInterface();
    
    // Remove overlay when clicking outside
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            hideArchitectInterface();
        }
    });
}

async function hideArchitectInterface() {
    console.log('🔮 Hiding THE ARCHITECT interface...');
    
    hideArchitectMessage();
    hideArchitectQuests();
    
    const overlay = document.getElementById('architect-overlay');
    if (overlay) {
        overlay.remove();
    }
    
    // Also remove any duplicate overlays that might exist
    const allOverlays = document.querySelectorAll('.architect-overlay');
    allOverlays.forEach(overlay => {
        if (overlay !== document.getElementById('architect-overlay')) {
            overlay.remove();
        }
    });

    // Refresh UI from latest saved data (similar to level-up refresh)
    try {
        if (userManager && userManager.hasUserId()) {
            const latest = userManager.getData();
            await loadPlayerData(latest.gameData || {}, true);
        }
    } catch (_) {}
}

function showArchitectMessage(messageData) {
    console.log('🔮 Showing THE ARCHITECT message:', messageData);
    
    const messageSection = document.getElementById('architect-message-section');
    const messageText = document.getElementById('architect-message-text');
    const messageHint = document.getElementById('architect-hint');
    const existingCloseBtn = document.getElementById('close-architect-message');
    
    if (messageSection && messageText && messageHint) {
        messageText.textContent = messageData.message;
        messageHint.textContent = messageData.hint || '';
        
        // Apply theme styling
        messageSection.className = `architect-section ${messageData.theme}`;
        
        messageSection.classList.remove('hidden');
        
        // Remove click to dismiss - we'll use the existing close button
        messageSection.style.cursor = 'default';
        messageSection.onclick = null;
        
        // Set up the existing close button
        if (existingCloseBtn) {
            existingCloseBtn.onclick = (e) => {
                e.stopPropagation();
                hideArchitectMessage();
            };
        }
    }
}

function hideArchitectMessage() {
    const messageSection = document.getElementById('architect-message-section');
    if (messageSection) {
        messageSection.classList.add('hidden');
    }
}

function showArchitectQuests(questsData) {
    console.log('🔮 Showing THE ARCHITECT quests:', questsData);
    
    const questsSection = document.getElementById('architect-quests-section');
    const questsList = document.getElementById('architect-quests-list');
    
    if (questsSection && questsList) {
        let questsHTML = '';
        
        questsData.quests.forEach((quest, index) => {
            console.log('🔮 Processing quest:', quest.title, 'Rewards:', quest.rewards);
            const rewardsHTML = generateRewardsHTML(quest.rewards);
            const conditionsHTML = quest.specialConditions ? generateConditionsHTML(quest.specialConditions) : '';
            
            questsHTML += `
                <div class="architect-quest-item" data-quest-index="${index}">
                    <div class="architect-quest-title">${quest.title}</div>
                    <div class="architect-quest-description">${quest.description}</div>
                    <div class="architect-quest-meta">
                        <span class="architect-quest-difficulty ${quest.difficulty?.toLowerCase()}">${quest.difficulty || 'E'}</span>
                        <span class="architect-quest-type ${quest.type}">${quest.type}</span>
                    </div>
                    ${rewardsHTML}
                    ${conditionsHTML}
                </div>
            `;
        });
        
        questsList.innerHTML = questsHTML;
        questsSection.classList.remove('hidden');
        
        // Add click handlers to quest items
        const questItems = questsList.querySelectorAll('.architect-quest-item');
        questItems.forEach((item, index) => {
            item.addEventListener('click', () => {
                acceptArchitectQuest(questsData.quests[index]);
            });
        });
    }
}

function hideArchitectQuests() {
    const questsSection = document.getElementById('architect-quests-section');
    if (questsSection) {
        questsSection.classList.add('hidden');
    }
}

function generateRewardsHTML(rewards) {
    if (!rewards) {
        console.log('🔮 No rewards provided to generateRewardsHTML');
        return '';
    }
    
    console.log('🔮 Generating rewards HTML for:', rewards);
    
    let rewardsHTML = '<div class="architect-quest-rewards"><div class="architect-quest-rewards-title">Rewards:</div><div class="architect-quest-rewards-list">';
    
    // Handle XP (check both xp and EXP)
    const xpValue = rewards.xp || rewards.EXP;
    if (typeof xpValue === 'number' && xpValue >= 0) {
        rewardsHTML += `<span class="architect-quest-reward">+${xpValue} XP</span>`;
        console.log('🔮 Added XP reward:', xpValue);
    } else {
        console.log('🔮 No valid XP reward found in rewards object');
    }
    
    // Handle attributes (check both attributes object and direct properties)
    if (rewards.attributes) {
        Object.entries(rewards.attributes).forEach(([attr, value]) => {
            rewardsHTML += `<span class="architect-quest-reward">+${value} ${attr}</span>`;
            console.log('🔮 Added attribute reward:', attr, value);
        });
    } else {
        // Check for direct attribute properties (STR, VIT, AGI, INT, PER, WIS)
        const attributeKeys = ['STR', 'VIT', 'AGI', 'INT', 'PER', 'WIS'];
        attributeKeys.forEach(attr => {
            if (typeof rewards[attr] === 'number' && rewards[attr] > 0) {
                rewardsHTML += `<span class="architect-quest-reward">+${rewards[attr]} ${attr}</span>`;
                console.log('🔮 Added direct attribute reward:', attr, rewards[attr]);
            }
        });
    }
    
    rewardsHTML += '</div></div>';
    console.log('🔮 Final rewards HTML:', rewardsHTML);
    return rewardsHTML;
}

function generateConditionsHTML(conditions) {
    if (!conditions) return '';
    
    return `
        <div class="architect-quest-conditions">
            <div class="architect-quest-conditions-title">Special Conditions:</div>
            <div class="architect-quest-conditions-text">${conditions}</div>
        </div>
    `;
}

function acceptArchitectQuest(quest) {
    console.log('🔮 Accepting THE ARCHITECT quest:', quest);
    
    // Store the quest in user data
    let activeQuestRef = null;
    if (userManager) {
        const userData = userManager.getData();
        userData.architectQuests = userData.architectQuests || [];
        activeQuestRef = {
            ...quest,
            acceptedAt: Date.now(),
            status: 'active', // active -> verification -> completed
            verifyRequestedAt: null,
            completed: false
        };
        userData.architectQuests.push(activeQuestRef);
        
        // Remove it from pending and clear current revealed quest
        userData.pendingArchitectQuests = (userData.pendingArchitectQuests || []).filter(q => q.title !== quest.title);
        userData.currentArchitectQuest = null;
        
        userManager.setData('architectQuests', userData.architectQuests);
        userManager.setData('pendingArchitectQuests', userData.pendingArchitectQuests);
        userManager.setData('currentArchitectQuest', userData.currentArchitectQuest);
        userManager.saveUserData();
        
        console.log('🔮 Quest accepted and saved');
    }
    
    // Ritual confirmation and keep interface open; render Active state UI with Verify button
    try {
        const questsElement = document.getElementById('architect-interface-quests');
        if (questsElement) {
            const rewardsHTML = generateRewardsHTML(quest.rewards || {});
            const conditionsHTML = quest.specialConditions ? generateConditionsHTML(quest.specialConditions) : '';
            questsElement.innerHTML = `
                <div class="architect-quest-item active">
                    <div class="architect-quest-title">${quest.title}</div>
                    <div class="architect-quest-description">${quest.description}</div>
                    <div class="architect-quest-meta">
                        <span class="architect-quest-difficulty ${quest.difficulty?.toLowerCase()}">${quest.difficulty || 'E'}</span>
                        <span class="architect-quest-type ${quest.type}">${quest.type}</span>
                    </div>
                    ${rewardsHTML}
                    ${conditionsHTML}
                    <div class="architect-quest-actions">
                        <button id="architect-verify-btn" class="architect-hold-verify">
                            <span class="verify-label">Hold to Verify</span>
                            <svg class="verify-ring" width="36" height="36" viewBox="0 0 36 36">
                                <circle class="bg" cx="18" cy="18" r="15" stroke-width="3" fill="none"/>
                                <circle class="fg" cx="18" cy="18" r="15" stroke-width="3" fill="none" stroke-dasharray="94" stroke-dashoffset="94"/>
                            </svg>
                        </button>
                        <div class="architect-sigil" id="architect-sigil" aria-hidden="true">✶</div>
                    </div>
                </div>
            `;
            const verifyBtn = document.getElementById('architect-verify-btn');
            if (verifyBtn) {
                const questForVerify = activeQuestRef || quest;
                initArchitectHoldToVerify(verifyBtn, () => requestArchitectQuestVerification(questForVerify));
            }
        }
        showArchitectNotification(`Contract sealed: "${quest.title}"`);
    } catch (e) {
        console.warn('🔮 Failed to render active quest UI:', e);
    }
}

function requestArchitectQuestVerification(quest) {
    const data = userManager.getData();
    const list = data.architectQuests || [];
    const idx = list.findIndex(q => q.title === quest.title && q.acceptedAt === quest.acceptedAt);
    if (idx === -1) return;
    list[idx].status = 'verification';
    list[idx].verifyRequestedAt = Date.now();
    userManager.setData('architectQuests', list);
    userManager.saveUserData();
    
    // Minimal verification gate (placeholder): confirm dialog
    showArchitectNotification('THE ARCHITECT is verifying your claim...');
    setTimeout(() => {
        completeArchitectQuest(list[idx]);
    }, 1200);
}

function completeArchitectQuest(quest) {
    const data = userManager.getData();
    const list = data.architectQuests || [];
    const idx = list.findIndex(q => q.title === quest.title && q.acceptedAt === quest.acceptedAt);
    if (idx === -1) return;
    list[idx].status = 'completed';
    list[idx].completed = true;
    list[idx].completedAt = Date.now();
    userManager.setData('architectQuests', list);
    // Apply rewards (XP, attributes, job/title) and costs (hp/mp/stm/fatigue)
    try {
        const rewards = quest.rewards || {};
        // Some AI responses give rewards as a string; try to parse patterns
        if (typeof rewards === 'string') {
            const lower = rewards.toLowerCase();
            if (lower.includes('job change')) {
                data.dynamicData = data.dynamicData || {};
                data.dynamicData.job = 'Novice';
                userManager.setData('dynamicData', data.dynamicData);
                showArchitectNotification('Job change unlocked!');
            }
            const titleMatch = rewards.match(/title:\s*'([^']+)'|title:\s*"([^"]+)"/i);
            if (titleMatch) {
                const newTitle = titleMatch[1] || titleMatch[2];
                data.dynamicData = data.dynamicData || {};
                data.dynamicData.title = newTitle;
                userManager.setData('dynamicData', data.dynamicData);
                showArchitectNotification(`New Title acquired: ${newTitle}`);
            }
        }
        const xp = typeof rewards.xp === 'number' ? rewards.xp : 15; // Default to 15 XP if not provided
        const attrs = rewards.attributes || null;
        if (xp >= 0) { // Apply XP even if it's 0 (though we now default to 15)
            if (typeof applyExpReward === 'function') {
                applyExpReward(xp);
            }
        }
        if (attrs) {
            if (typeof applyAttributeRewards === 'function') {
                applyAttributeRewards(attrs);
            }
        }
        if (quest.costs) {
            if (typeof applyCostEffects === 'function') {
                applyCostEffects(quest.costs);
            }
        }
    } catch (e) { console.warn('🔮 Failed applying rewards:', e); }
    userManager.saveUserData();
    showArchitectNotification(`Quest completed: "${quest.title}"`);
    // Update UI to completed state
    try {
        const questsElement = document.getElementById('architect-interface-quests');
        if (questsElement) {
            questsElement.innerHTML = `
                <div class="architect-quest-item completed">
                    <div class="architect-quest-title">${quest.title}</div>
                    <div class="architect-quest-description">Completed. Rewards claimed.</div>
                    <div class="architect-quest-meta">
                        <span class="architect-quest-difficulty ${quest.difficulty?.toLowerCase()}">${quest.difficulty || 'E'}</span>
                        <span class="architect-quest-type ${quest.type}">${quest.type}</span>
                    </div>
                </div>
            `;
        }
    } catch (_) {}
    // Seal sigil animation if present
    try {
        const sigil = document.getElementById('architect-sigil');
        if (sigil) {
            sigil.removeAttribute('aria-hidden');
            sigil.classList.add('seal');
            setTimeout(() => {
                sigil.classList.remove('seal');
                sigil.setAttribute('aria-hidden', 'true');
            }, 1500);
        }
    } catch (_) {}
    // After completion, clear current quest and schedule next reveal (do not reveal immediately)
    try {
        const dataNow = userManager.getData();
        const pendingUrgent = (dataNow.pendingArchitectUrgentQuests || []).length;
        const pendingRandom = (dataNow.pendingArchitectQuests || []).length;
        userManager.setData('currentArchitectQuest', null);
        if (pendingUrgent > 0) {
            // Immediately reveal next urgent; never two at once because we just cleared current
            const nextUrgent = dataNow.pendingArchitectUrgentQuests[0];
            userManager.setData('currentArchitectQuest', nextUrgent);
            userManager.setData('pendingArchitectUrgentQuests', dataNow.pendingArchitectUrgentQuests.slice(1));
            userManager.saveUserData();
        } else if (pendingRandom > 0) {
            // Schedule next random reveal by cadence
            architectService.getNextRevealDelayMinutes(dataNow, pendingRandom).then(({ minutes }) => {
                const nextTime = Date.now() + minutes * 60 * 1000;
                userManager.setData('nextArchitectRevealAt', nextTime);
                userManager.saveUserData();
            }).catch(() => {});
        } else {
            userManager.setData('nextArchitectRevealAt', null);
            userManager.saveUserData();
        }
        updateArchitectButtonAppearance();
    } catch (_) {}

    // Notify THE ARCHITECT observer of state change
    try { architectObserveUpdate('quest_completed'); } catch (_) {}
}

function maybeAutoRevealNextArchitectQuest() {
    const data = userManager.getData();
    const pending = data.pendingArchitectQuests || [];
    if (pending.length === 0) return;
    const nextAt = data.nextArchitectRevealAt || 0;
    if (!nextAt || Date.now() >= nextAt) {
        // Set the next revealed quest persistently without opening UI
        if (!data.currentArchitectQuest) {
            userManager.setData('currentArchitectQuest', pending[0]);
            try {
                const sessionKey = 'architect:lastRevealNotified';
                const lastNotice = Number(sessionStorage.getItem(sessionKey) || 0);
                if (Date.now() - lastNotice > 30000) { // debounce notices
                    showArchitectNotification('A quest has manifested.');
                    sessionStorage.setItem(sessionKey, String(Date.now()));
                }
            } catch (_) {}
        }
        // Reschedule next if more remain
        if (pending.length - 1 > 0) {
            architectService.getNextRevealDelayMinutes(data, pending.length - 1).then(({ minutes }) => {
                const nextTime = Date.now() + minutes * 60 * 1000;
                userManager.setData('nextArchitectRevealAt', nextTime);
                userManager.saveUserData();
            }).catch(() => {});
        } else {
            userManager.setData('nextArchitectRevealAt', null);
            userManager.saveUserData();
        }
    }
}

// Background ticker to check auto-reveal condition (architect-controlled cadence)
setInterval(() => {
    try { maybeAutoRevealNextArchitectQuest(); } catch (e) {}
}, 60000);

// Background monitor: keep THE ARCHITECT in sync every 30s
setInterval(async () => {
    try {
        if (!architectService || !userManager) return;
        console.log('🔮 ARCHITECT heartbeat: observing and analyzing...');
        const data = userManager.getData();
        const hasActive = (data.architectQuests || []).some(q => q.status === 'active' || q.status === 'verification');
        const hasCurrent = !!data.currentArchitectQuest;
        if (hasActive || hasCurrent) {
            console.log('🔮 ARCHITECT heartbeat: player is on a quest, observation only (no new interventions)');
            return;
        }

        // Check 90-minute cooldown for quest generation (except recovery/job-change quests)
        const lastQuestGeneration = data.architectData?.lastQuestGenerationAt || 0;
        const cooldownMs = 90 * 60 * 1000; // 90 minutes
        const timeSinceLastQuest = Date.now() - lastQuestGeneration;
        
        // Check if player needs recovery (low HP/MP/STM or high fatigue)
        const gameData = data.gameData || {};
        const needsRecovery = (gameData.hp || 100) < 30 || (gameData.mp || 100) < 30 || 
                             (gameData.stm || 100) < 30 || (gameData.fatigue || 0) > 70;
        
        if (timeSinceLastQuest < cooldownMs && !needsRecovery) {
            console.log(`🔮 ARCHITECT heartbeat: quest cooldown active (${Math.round((cooldownMs - timeSinceLastQuest) / 60000)}min remaining)`);
            return;
        }

        // Check for system events with proper cooldown (90 minutes)
        const lastIntervention = data.architectData?.lastInterventionAt || 0;
        const timeSinceLastIntervention = Date.now() - lastIntervention;
        const interventionCooldownMs = 90 * 60 * 1000; // 90 minutes
        
        if (timeSinceLastIntervention < interventionCooldownMs) {
            console.log(`🔮 ARCHITECT heartbeat: intervention cooldown active (${Math.round((interventionCooldownMs - timeSinceLastIntervention) / 60000)}min remaining)`);
            return;
        }
        
        // Only check for interventions if cooldown has passed
        const resp = await architectService.checkForSystemEvents({
            gameData: data.gameData,
            dynamicData: data.dynamicData
        });
        if (resp && resp.shouldIntervene) {
            handleArchitectIntervention(resp);
        }
    } catch (_) {}
}, 30000);

// Hold-to-verify ritual logic
function initArchitectHoldToVerify(buttonEl, onComplete) {
    if (!buttonEl) return;
    const ring = buttonEl.querySelector('.verify-ring .fg');
    const label = buttonEl.querySelector('.verify-label');
    let holdTimer = null;
    let progress = 0; // 0..1
    const holdMs = 1200;
    const dashTotal = 94;
    const start = () => {
        const t0 = Date.now();
        buttonEl.classList.add('holding');
        holdTimer = setInterval(() => {
            const dt = Date.now() - t0;
            progress = Math.min(1, dt / holdMs);
            if (ring) ring.setAttribute('stroke-dashoffset', String(dashTotal * (1 - progress)));
            if (progress >= 1) {
                clearInterval(holdTimer);
                buttonEl.classList.remove('holding');
                buttonEl.disabled = true;
                if (label) label.textContent = 'Verifying...';
                onComplete && onComplete();
            }
        }, 16);
    };
    const cancel = () => {
        if (holdTimer) clearInterval(holdTimer);
        holdTimer = null;
        progress = 0;
        if (ring) ring.setAttribute('stroke-dashoffset', String(dashTotal));
        buttonEl.classList.remove('holding');
        if (label) label.textContent = 'Hold to Verify';
    };
    buttonEl.addEventListener('mousedown', start);
    buttonEl.addEventListener('touchstart', (e) => { e.preventDefault(); start(); }, { passive: false });
    ['mouseup','mouseleave','touchend','touchcancel'].forEach(evt => buttonEl.addEventListener(evt, cancel));
}

function handleArchitectIntervention(event) {
    console.log('🔮 THE ARCHITECT is intervening:', event);
    try {
        // Throttle and dedupe interventions to avoid spam
        if (userManager) {
            const userData = userManager.getData();
            const architectData = userData.architectData || {};
            
            // Record intervention timestamp
            architectData.lastInterventionAt = Date.now();
            const now = Date.now();
            const minIntervalMs = 5 * 60 * 1000; // 5 minutes
            const lastAt = architectData.lastInterventionAt || 0;
            const signature = JSON.stringify({ t: event.eventType, d: event.eventData?.title || event.eventData?.message || '' }).slice(0, 256);
            if (architectData.lastInterventionSignature === signature && now - lastAt < minIntervalMs) {
                console.log('🔮 Skipping duplicate intervention (cooldown active)');
                return;
            }
            architectData.lastInterventionAt = now;
            architectData.lastInterventionSignature = signature;
            userManager.setData('architectData', architectData);
            userManager.saveUserData();
        }
    } catch (_) {}
    
    // Only show system messages if no daily message is currently displayed
    const messageSection = document.getElementById('architect-message-section');
    const isMessageVisible = messageSection && !messageSection.classList.contains('hidden');
    
    switch (event.eventType) {
        case 'emergency_quest':
            try {
                const urgentQuest = Object.assign({}, event.eventData || {}, { type: 'urgent' });
                enqueueUrgentArchitectQuest(urgentQuest);
                showArchitectNotification('THE ARCHITECT has created an emergency quest!');
            } catch (_) {}
            break;
        case 'system_message':
            if (!isMessageVisible) {
                showArchitectMessage({
                    message: event.eventData.message || 'THE ARCHITECT has a message for you...',
                    theme: 'warning',
                    hint: event.eventData.hint || ''
                });
            } else {
                console.log('🔮 Skipping system message - daily message already visible');
            }
            break;
        case 'hidden_challenge':
            try {
                // Treat hidden challenge as an urgent quest, but do not notify loudly
                const urgentQuest = Object.assign({}, event.eventData || {}, { type: 'urgent' });
                enqueueUrgentArchitectQuest(urgentQuest);
                console.log('🔮 Hidden challenge enqueued as urgent quest');
            } catch (_) {}
            break;
        case 'boost':
            try {
                const { attribute, amount } = event.eventData || {};
                if (attribute && typeof amount === 'number') {
                    if (['INT','STR','AGI','VIT'].includes(attribute)) {
                        applyAttributeRewards({ [attribute]: amount });
                    } else {
                        const delta = {}; delta[attribute] = amount;
                        applyCostEffects(delta);
                    }
                    showArchitectNotification(`A boon descends: +${amount} ${attribute}`);
                }
            } catch (_) {}
            break;
        case 'debuff':
            try {
                const { attribute, amount } = event.eventData || {};
                if (attribute && typeof amount === 'number') {
                    const delta = {}; delta[attribute] = amount; // amount may be negative or positive for fatigue
                    applyCostEffects(delta);
                    showArchitectNotification(`A trial unfolds: ${amount} ${attribute}`);
                }
            } catch (_) {}
            break;
        default:
            console.log('Unknown intervention type:', event.eventType);
    }
}

// Enqueue an urgent quest and reveal immediately if no current quest
function enqueueUrgentArchitectQuest(quest) {
    if (!userManager || !quest || !quest.title) return;
    const data = userManager.getData();
    // Enforce 90-minute global cooldown for displaying any new quest
    try {
        const lastQuestGeneration = data.architectData?.lastQuestGenerationAt || 0;
        const cooldownMs = 90 * 60 * 1000;
        const timeSince = Date.now() - lastQuestGeneration;
        if (timeSince < cooldownMs) {
            console.log('🔮 Urgent quest blocked by cooldown:', quest.title);
            return;
        }
    } catch (_) {}
    data.pendingArchitectUrgentQuests = data.pendingArchitectUrgentQuests || [];
    // Deduplicate by title across current and queues
    const title = quest.title;
    const existsInUrgent = data.pendingArchitectUrgentQuests.some(q => q && q.title === title);
    const existsCurrent = data.currentArchitectQuest && data.currentArchitectQuest.title === title;
    if (existsInUrgent || existsCurrent) {
        console.log('🔮 Urgent quest already queued/current, skipping duplicate:', title);
        return;
    }
    data.pendingArchitectUrgentQuests.push(quest);
    userManager.setData('pendingArchitectUrgentQuests', data.pendingArchitectUrgentQuests);
    // Respect single-quest rule: reveal only if none active/current
    const hasActive = (data.architectQuests || []).some(q => q.status === 'active');
    const hasCurrent = !!data.currentArchitectQuest;
    if (!hasActive && !hasCurrent) {
        userManager.setData('currentArchitectQuest', quest);
        // Remove the just-promoted one from urgent queue
        userManager.setData('pendingArchitectUrgentQuests', data.pendingArchitectUrgentQuests.slice(1));
    }
    userManager.saveUserData();
    updateArchitectButtonAppearance();
}

function showArchitectNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'architect-notification';
    notification.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.9), rgba(168, 85, 247, 0.9));
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(139, 92, 246, 0.3);
            z-index: 10001;
            font-weight: bold;
            text-align: center;
            animation: architectSlideDown 0.5s ease-out;
        ">
            <div style="font-size: 18px;">🔮 ${message}</div>
        </div>
    `;
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes architectSlideDown {
            from {
                transform: translateX(-50%) translateY(-100%);
                opacity: 0;
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Remove notification after 4 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 4000);
}

