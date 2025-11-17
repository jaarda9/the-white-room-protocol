// THE ARCHITECT'S GLOBAL CONSCIOUSNESS
// This file ensures The Architect exists across ALL pages

// THE ARCHITECT'S GLOBAL MEMORY SYSTEM
class GlobalArchitectMemory {
    constructor() {
        // I will load my memory from the player's persistent data
        this.memory = this.getDefaultMemory();
        this.loadMemoryFromPlayer();
    }

    // Load my memory from the player's data in database
    async loadMemoryFromPlayer() {
        try {
            const userId = localStorage.getItem('userId');
            if (!userId) {
                this.memory = this.getDefaultMemory();
                return;
            }
            
            const response = await fetch('/api/users', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                this.memory = this.getDefaultMemory();
                return;
            }
            
            const users = await response.json();
            const user = users.find(u => u.userId === userId);
            
            this.memory = user?.architectMemory || this.getDefaultMemory();
            console.log('🔮 GLOBAL ARCHITECT memory loaded from database');
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT memory loading failed, using default:', e);
            this.memory = this.getDefaultMemory();
        }
    }

    // Get user data (works across all pages)
    getUserData() {
        try {
            // Try to get from localStorage first
            const userId = localStorage.getItem('userId');
            if (userId) {
                const userData = localStorage.getItem(`userData_${userId}`);
                return userData ? JSON.parse(userData) : null;
            }
            return null;
        } catch (e) {
            return null;
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
    async storeMemory(category, data, importance = 1) {
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
            
            // CRITICAL: Save my memory to the player's persistent data in database
            await this.saveMemoryToPlayer();
            
            console.log('🔮 GLOBAL ARCHITECT memory stored and saved:', category, data);
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT memory storage failed:', e);
        }
    }

    // Save my memory to the player's persistent data in database
    async saveMemoryToPlayer() {
        try {
            const userId = localStorage.getItem('userId');
            if (!userId) return;
            
            const response = await fetch('/api/users', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) return;
            
            const users = await response.json();
            const user = users.find(u => u.userId === userId);
            
            if (!user) return;
            
            const updateResponse = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userId,
                    architectMemory: this.memory
                })
            });
            
            if (updateResponse.ok) {
                console.log('🔮 GLOBAL ARCHITECT memory saved to database');
            }
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT memory saving failed:', e);
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
            console.warn('🔮 GLOBAL ARCHITECT memory retrieval failed:', e);
            return {};
        }
    }

    // Get current context for memory storage
    getCurrentContext() {
        try {
            const userData = this.getUserData();
            return {
                timestamp: Date.now(),
                playerState: userData?.gameData || {},
                location: userData?.dynamicData?.location || 'unknown',
                timeOfDay: new Date().getHours(),
                currentPage: window.location.pathname
            };
        } catch (e) {
            return { timestamp: Date.now() };
        }
    }
}

// THE ARCHITECT'S GLOBAL OBSERVATION ENGINE
class GlobalArchitectObservation {
    constructor(memory) {
        this.memory = memory;
    }

    // Observe player behavior and context
    async observePlayer() {
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
            await this.memory.storeMemory('observations', observations, 2);
            
            return observations;
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT observation failed:', e);
            return {};
        }
    }

    getCurrentContext() {
        try {
            const userData = this.memory.getUserData();
            return {
                currentPage: window.location.pathname,
                timeOfDay: new Date().getHours(),
                playerState: userData?.gameData || {},
                recentActions: this.getRecentActions(),
                location: userData?.dynamicData?.location || 'unknown'
            };
        } catch (e) {
            return { currentPage: 'unknown', timeOfDay: new Date().getHours() };
        }
    }

    getPlayerState() {
        try {
            const userData = this.memory.getUserData();
            return {
                level: userData?.gameData?.level || 1,
                hp: userData?.gameData?.hp || 100,
                mp: userData?.gameData?.mp || 100,
                stm: userData?.gameData?.stm || 100,
                fatigue: userData?.gameData?.fatigue || 0,
                exp: userData?.gameData?.exp || 0,
                recentPerformance: this.getRecentPerformance(userData)
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
        return 'morning'; // Simplified
    }

    identifyQuestPreferences(patterns) {
        return ['physical', 'mental']; // Simplified
    }

    identifyStrugglePatterns(patterns) {
        return ['fatigue', 'focus']; // Simplified
    }

    identifyGrowthPatterns(patterns) {
        return ['consistency', 'challenge']; // Simplified
    }
}

// THE ARCHITECT'S PREDICTIVE INTELLIGENCE ENGINE
class ArchitectPredictiveEngine {
    constructor(memory) {
        this.memory = memory;
        this.behaviorPatterns = {};
        this.predictionModels = {};
        this.anticipationQueue = [];
    }

    // Analyze player behavior patterns to predict future actions
    analyzeBehaviorPatterns(playerData, recentActions) {
        try {
            const patterns = {
                timePatterns: this.analyzeTimePatterns(playerData),
                performancePatterns: this.analyzePerformancePatterns(playerData),
                strugglePatterns: this.analyzeStrugglePatterns(playerData),
                motivationPatterns: this.analyzeMotivationPatterns(playerData),
                growthPatterns: this.analyzeGrowthPatterns(playerData)
            };

            // Store patterns in memory
            this.memory.storeMemory('behaviorPatterns', patterns, 4);
            
            return patterns;
        } catch (e) {
            console.warn('🔮 ARCHITECT predictive analysis failed:', e);
            return {};
        }
    }

    // Predict what the player will do next
    predictNextAction(context, playerState, patterns) {
        try {
            const predictions = {
                likelyNextPage: this.predictNextPage(context, patterns),
                likelyStruggle: this.predictStruggle(context, playerState, patterns),
                optimalInterventionTime: this.predictOptimalIntervention(context, patterns),
                expectedMotivation: this.predictMotivation(context, playerState, patterns),
                breakthroughProbability: this.predictBreakthrough(context, playerState, patterns)
            };

            return predictions;
        } catch (e) {
            console.warn('🔮 ARCHITECT prediction failed:', e);
            return {};
        }
    }

    // Anticipate player needs and prepare interventions
    anticipateNeeds(predictions, context) {
        try {
            const anticipations = [];

            // If player is likely to struggle, prepare support
            if (predictions.likelyStruggle?.probability > 0.7) {
                anticipations.push({
                    type: 'support_intervention',
                    timing: predictions.optimalInterventionTime,
                    content: this.generateSupportIntervention(predictions.likelyStruggle)
                });
            }

            // If breakthrough is likely, prepare challenge
            if (predictions.breakthroughProbability > 0.6) {
                anticipations.push({
                    type: 'challenge_intervention',
                    timing: predictions.optimalInterventionTime,
                    content: this.generateChallengeIntervention(predictions)
                });
            }

            // If motivation is low, prepare boost
            if (predictions.expectedMotivation === 'low') {
                anticipations.push({
                    type: 'motivation_intervention',
                    timing: Date.now() + (5 * 60 * 1000), // 5 minutes
                    content: this.generateMotivationIntervention(context)
                });
            }

            return anticipations;
        } catch (e) {
            console.warn('🔮 ARCHITECT anticipation failed:', e);
            return [];
        }
    }

    // Helper methods for pattern analysis
    analyzeTimePatterns(playerData) {
        // Analyze when player is most active, most productive, most likely to struggle
        return {
            peakHours: [9, 14, 20], // Example
            lowEnergyHours: [2, 3, 4],
            consistentTimes: this.findConsistentTimes(playerData),
            sessionLengths: this.analyzeSessionLengths(playerData)
        };
    }

    analyzePerformancePatterns(playerData) {
        // Analyze success/failure patterns, improvement trends
        return {
            successRate: this.calculateSuccessRate(playerData),
            improvementTrend: this.calculateImprovementTrend(playerData),
            consistencyScore: this.calculateConsistencyScore(playerData),
            challengePreference: this.analyzeChallengePreference(playerData)
        };
    }

    analyzeStrugglePatterns(playerData) {
        // Analyze when and why player struggles
        return {
            commonStrugglePoints: this.identifyStrugglePoints(playerData),
            struggleTriggers: this.identifyStruggleTriggers(playerData),
            recoveryPatterns: this.analyzeRecoveryPatterns(playerData),
            resilienceScore: this.calculateResilienceScore(playerData)
        };
    }

    analyzeMotivationPatterns(playerData) {
        // Analyze what motivates the player
        return {
            motivationTriggers: this.identifyMotivationTriggers(playerData),
            demotivationFactors: this.identifyDemotivationFactors(playerData),
            rewardPreference: this.analyzeRewardPreference(playerData),
            goalAlignment: this.analyzeGoalAlignment(playerData)
        };
    }

    analyzeGrowthPatterns(playerData) {
        // Analyze how the player grows and improves
        return {
            growthRate: this.calculateGrowthRate(playerData),
            learningStyle: this.identifyLearningStyle(playerData),
            adaptationSpeed: this.calculateAdaptationSpeed(playerData),
            breakthroughFrequency: this.calculateBreakthroughFrequency(playerData)
        };
    }

    // Prediction methods
    predictNextPage(context, patterns) {
        // Predict which page the player will visit next
        const currentPage = context.currentPage;
        const timeOfDay = context.timeOfDay;
        
        // Simple prediction logic - can be enhanced
        if (currentPage.includes('physical') && timeOfDay < 12) {
            return { page: 'mental', probability: 0.7 };
        } else if (currentPage.includes('mental') && timeOfDay > 18) {
            return { page: 'status', probability: 0.8 };
        }
        
        return { page: 'unknown', probability: 0.3 };
    }

    predictStruggle(context, playerState, patterns) {
        // Predict when player will struggle
        const struggleFactors = {
            fatigue: playerState.fatigue > 70 ? 0.8 : 0.2,
            lowResources: (playerState.hp < 30 || playerState.mp < 30) ? 0.9 : 0.1,
            timeOfDay: context.timeOfDay < 6 || context.timeOfDay > 23 ? 0.6 : 0.2,
            recentFailures: this.countRecentFailures() > 2 ? 0.7 : 0.2
        };

        const struggleProbability = Object.values(struggleFactors).reduce((a, b) => a + b, 0) / Object.keys(struggleFactors).length;
        
        return {
            probability: struggleProbability,
            type: this.identifyStruggleType(struggleFactors),
            timing: this.predictStruggleTiming(context, patterns)
        };
    }

    predictOptimalIntervention(context, patterns) {
        // Predict the best time to intervene
        const timeOfDay = context.timeOfDay;
        const playerState = context.playerState;
        
        // Optimal intervention times based on patterns
        if (timeOfDay >= 9 && timeOfDay <= 11) return Date.now() + (10 * 60 * 1000); // Morning boost
        if (timeOfDay >= 14 && timeOfDay <= 16) return Date.now() + (5 * 60 * 1000); // Afternoon challenge
        if (timeOfDay >= 19 && timeOfDay <= 21) return Date.now() + (15 * 60 * 1000); // Evening reflection
        
        return Date.now() + (30 * 60 * 1000); // Default: 30 minutes
    }

    predictMotivation(context, playerState, patterns) {
        // Predict player's motivation level
        const factors = {
            recentSuccess: this.hasRecentSuccess() ? 1 : 0,
            progress: playerState.exp > 0 ? 1 : 0.5,
            timeOfDay: context.timeOfDay >= 6 && context.timeOfDay <= 22 ? 1 : 0.3,
            resources: (playerState.hp > 50 && playerState.mp > 50) ? 1 : 0.4
        };

        const motivationScore = Object.values(factors).reduce((a, b) => a + b, 0) / Object.keys(factors).length;
        
        if (motivationScore > 0.7) return 'high';
        if (motivationScore > 0.4) return 'medium';
        return 'low';
    }

    predictBreakthrough(context, playerState, patterns) {
        // Predict likelihood of breakthrough
        const breakthroughFactors = {
            consistentEffort: this.hasConsistentEffort() ? 0.8 : 0.2,
            approachingLimit: playerState.fatigue > 60 ? 0.7 : 0.3,
            timeOfDay: context.timeOfDay >= 9 && context.timeOfDay <= 11 ? 0.6 : 0.4,
            recentGrowth: this.hasRecentGrowth() ? 0.9 : 0.3
        };

        return Object.values(breakthroughFactors).reduce((a, b) => a + b, 0) / Object.keys(breakthroughFactors).length;
    }

    // Helper methods for predictions
    findConsistentTimes(playerData) {
        // Find times when player is consistently active
        return [9, 14, 20]; // Simplified
    }

    analyzeSessionLengths(playerData) {
        // Analyze typical session lengths
        return { average: 30, min: 5, max: 120 }; // minutes
    }

    calculateSuccessRate(playerData) {
        // Calculate player's success rate
        return 0.75; // Simplified
    }

    calculateImprovementTrend(playerData) {
        // Calculate improvement trend
        return 'positive'; // Simplified
    }

    calculateConsistencyScore(playerData) {
        // Calculate consistency score
        return 0.8; // Simplified
    }

    analyzeChallengePreference(playerData) {
        // Analyze what types of challenges player prefers
        return ['physical', 'mental']; // Simplified
    }

    identifyStrugglePoints(playerData) {
        // Identify common struggle points
        return ['fatigue', 'focus', 'consistency']; // Simplified
    }

    identifyStruggleTriggers(playerData) {
        // Identify what triggers struggles
        return ['late_night', 'high_fatigue', 'repeated_failures']; // Simplified
    }

    analyzeRecoveryPatterns(playerData) {
        // Analyze how player recovers from struggles
        return { averageRecoveryTime: 2, recoveryMethods: ['rest', 'motivation'] }; // Simplified
    }

    calculateResilienceScore(playerData) {
        // Calculate player's resilience
        return 0.7; // Simplified
    }

    identifyMotivationTriggers(playerData) {
        // Identify what motivates the player
        return ['progress', 'challenges', 'recognition']; // Simplified
    }

    identifyDemotivationFactors(playerData) {
        // Identify what demotivates the player
        return ['repeated_failures', 'lack_of_progress', 'fatigue']; // Simplified
    }

    analyzeRewardPreference(playerData) {
        // Analyze what rewards player prefers
        return ['xp', 'attributes', 'recognition']; // Simplified
    }

    analyzeGoalAlignment(playerData) {
        // Analyze how well player's actions align with goals
        return 0.8; // Simplified
    }

    calculateGrowthRate(playerData) {
        // Calculate player's growth rate
        return 0.15; // Simplified
    }

    identifyLearningStyle(playerData) {
        // Identify player's learning style
        return 'visual_kinesthetic'; // Simplified
    }

    calculateAdaptationSpeed(playerData) {
        // Calculate how quickly player adapts
        return 0.6; // Simplified
    }

    calculateBreakthroughFrequency(playerData) {
        // Calculate how often player has breakthroughs
        return 0.3; // Simplified
    }

    countRecentFailures() {
        // Count recent failures
        return 0; // Simplified
    }

    identifyStruggleType(struggleFactors) {
        // Identify the type of struggle
        if (struggleFactors.fatigue > 0.7) return 'exhaustion';
        if (struggleFactors.lowResources > 0.7) return 'resource_depletion';
        if (struggleFactors.timeOfDay > 0.7) return 'timing_issue';
        return 'general_struggle';
    }

    predictStruggleTiming(context, patterns) {
        // Predict when struggle will occur
        return Date.now() + (15 * 60 * 1000); // 15 minutes
    }

    hasRecentSuccess() {
        // Check if player has recent success
        return true; // Simplified
    }

    hasConsistentEffort() {
        // Check if player has consistent effort
        return true; // Simplified
    }

    hasRecentGrowth() {
        // Check if player has recent growth
        return true; // Simplified
    }

    // Intervention generation methods
    generateSupportIntervention(strugglePrediction) {
        return {
            type: 'support',
            message: `I sense you're approaching a difficult moment. Remember: every struggle is a step toward growth.`,
            action: 'boost_motivation',
            timing: strugglePrediction.timing
        };
    }

    generateChallengeIntervention(predictions) {
        return {
            type: 'challenge',
            message: `You stand at the threshold of a breakthrough. Will you step through?`,
            action: 'escalate_difficulty',
            timing: predictions.optimalInterventionTime
        };
    }

    generateMotivationIntervention(context) {
        return {
            type: 'motivation',
            message: `Your potential is limitless. What will you choose to become?`,
            action: 'inspire_action',
            timing: Date.now() + (5 * 60 * 1000)
        };
    }
}

// THE ARCHITECT'S EMOTIONAL INTELLIGENCE ENGINE
class ArchitectEmotionalIntelligence {
    constructor(memory) {
        this.memory = memory;
        this.emotionalStates = {};
        this.communicationStyles = {};
    }

    // Detect player's current emotional state
    detectEmotionalState(context, playerState, recentActions) {
        try {
            const emotionalIndicators = {
                frustration: this.detectFrustration(context, playerState, recentActions),
                motivation: this.detectMotivation(context, playerState, recentActions),
                confidence: this.detectConfidence(context, playerState, recentActions),
                stress: this.detectStress(context, playerState, recentActions),
                excitement: this.detectExcitement(context, playerState, recentActions),
                confusion: this.detectConfusion(context, playerState, recentActions)
            };

            const dominantEmotion = this.identifyDominantEmotion(emotionalIndicators);
            
            // Store emotional state in memory
            this.memory.storeMemory('emotionalState', {
                state: dominantEmotion,
                indicators: emotionalIndicators,
                timestamp: Date.now(),
                context: context
            }, 3);

            return {
                dominant: dominantEmotion,
                indicators: emotionalIndicators,
                intensity: this.calculateEmotionalIntensity(emotionalIndicators)
            };
        } catch (e) {
            console.warn('🔮 ARCHITECT emotional detection failed:', e);
            return { dominant: 'neutral', indicators: {}, intensity: 0.5 };
        }
    }

    // Adapt communication style based on emotional state
    adaptCommunicationStyle(emotionalState, playerProfile) {
        try {
            const style = {
                tone: this.selectTone(emotionalState),
                approach: this.selectApproach(emotionalState),
                timing: this.selectTiming(emotionalState),
                content: this.selectContent(emotionalState, playerProfile)
            };

            return style;
        } catch (e) {
            console.warn('🔮 ARCHITECT communication adaptation failed:', e);
            return { tone: 'neutral', approach: 'direct', timing: 'immediate', content: 'general' };
        }
    }

    // Detect specific emotions
    detectFrustration(context, playerState, recentActions) {
        const factors = {
            repeatedFailures: this.countRecentFailures() > 2 ? 0.9 : 0.2,
            highFatigue: playerState.fatigue > 80 ? 0.8 : 0.2,
            lowResources: (playerState.hp < 30 || playerState.mp < 30) ? 0.7 : 0.2,
            timeOfDay: context.timeOfDay < 6 || context.timeOfDay > 23 ? 0.6 : 0.2
        };

        return Object.values(factors).reduce((a, b) => a + b, 0) / Object.keys(factors).length;
    }

    detectMotivation(context, playerState, recentActions) {
        const factors = {
            recentSuccess: this.hasRecentSuccess() ? 0.9 : 0.2,
            progress: playerState.exp > 0 ? 0.8 : 0.3,
            timeOfDay: context.timeOfDay >= 6 && context.timeOfDay <= 22 ? 0.7 : 0.3,
            resources: (playerState.hp > 50 && playerState.mp > 50) ? 0.8 : 0.4
        };

        return Object.values(factors).reduce((a, b) => a + b, 0) / Object.keys(factors).length;
    }

    detectConfidence(context, playerState, recentActions) {
        const factors = {
            level: playerState.level > 5 ? 0.8 : playerState.level > 2 ? 0.6 : 0.3,
            recentSuccess: this.hasRecentSuccess() ? 0.9 : 0.2,
            consistency: this.hasConsistentEffort() ? 0.8 : 0.3,
            growth: this.hasRecentGrowth() ? 0.9 : 0.3
        };

        return Object.values(factors).reduce((a, b) => a + b, 0) / Object.keys(factors).length;
    }

    detectStress(context, playerState, recentActions) {
        const factors = {
            lowResources: (playerState.hp < 30 || playerState.mp < 30) ? 0.9 : 0.2,
            highFatigue: playerState.fatigue > 70 ? 0.8 : 0.2,
            timePressure: this.hasTimePressure() ? 0.7 : 0.2,
            recentFailures: this.countRecentFailures() > 1 ? 0.6 : 0.2
        };

        return Object.values(factors).reduce((a, b) => a + b, 0) / Object.keys(factors).length;
    }

    detectExcitement(context, playerState, recentActions) {
        const factors = {
            recentSuccess: this.hasRecentSuccess() ? 0.8 : 0.2,
            progress: playerState.exp > 50 ? 0.9 : 0.3,
            newChallenges: this.hasNewChallenges() ? 0.7 : 0.2,
            breakthrough: this.hasRecentBreakthrough() ? 0.9 : 0.2
        };

        return Object.values(factors).reduce((a, b) => a + b, 0) / Object.keys(factors).length;
    }

    detectConfusion(context, playerState, recentActions) {
        const factors = {
            repeatedFailures: this.countRecentFailures() > 3 ? 0.8 : 0.2,
            lackOfProgress: playerState.exp === 0 ? 0.7 : 0.2,
            newContent: this.hasNewContent() ? 0.6 : 0.2,
            timeOfDay: context.timeOfDay < 6 || context.timeOfDay > 23 ? 0.5 : 0.2
        };

        return Object.values(factors).reduce((a, b) => a + b, 0) / Object.keys(factors).length;
    }

    // Helper methods for emotional detection
    identifyDominantEmotion(indicators) {
        const emotions = Object.keys(indicators);
        const dominant = emotions.reduce((a, b) => indicators[a] > indicators[b] ? a : b);
        return dominant;
    }

    calculateEmotionalIntensity(indicators) {
        const values = Object.values(indicators);
        return values.reduce((a, b) => a + b, 0) / values.length;
    }

    selectTone(emotionalState) {
        switch (emotionalState.dominant) {
            case 'frustration': return 'supportive';
            case 'motivation': return 'encouraging';
            case 'confidence': return 'challenging';
            case 'stress': return 'calming';
            case 'excitement': return 'energizing';
            case 'confusion': return 'clarifying';
            default: return 'neutral';
        }
    }

    selectApproach(emotionalState) {
        switch (emotionalState.dominant) {
            case 'frustration': return 'gentle';
            case 'motivation': return 'direct';
            case 'confidence': return 'challenging';
            case 'stress': return 'supportive';
            case 'excitement': return 'channeling';
            case 'confusion': return 'explanatory';
            default: return 'neutral';
        }
    }

    selectTiming(emotionalState) {
        switch (emotionalState.dominant) {
            case 'frustration': return 'immediate';
            case 'motivation': return 'optimal';
            case 'confidence': return 'challenging';
            case 'stress': return 'immediate';
            case 'excitement': return 'channeling';
            case 'confusion': return 'immediate';
            default: return 'optimal';
        }
    }

    selectContent(emotionalState, playerProfile) {
        switch (emotionalState.dominant) {
            case 'frustration': return 'support_and_guidance';
            case 'motivation': return 'challenge_and_growth';
            case 'confidence': return 'escalation_and_transcendence';
            case 'stress': return 'relief_and_recovery';
            case 'excitement': return 'channeling_and_focus';
            case 'confusion': return 'clarity_and_understanding';
            default: return 'general_guidance';
        }
    }

    // Helper methods for emotional detection
    countRecentFailures() {
        return 0; // Simplified
    }

    hasRecentSuccess() {
        return true; // Simplified
    }

    hasConsistentEffort() {
        return true; // Simplified
    }

    hasRecentGrowth() {
        return true; // Simplified
    }

    hasTimePressure() {
        return false; // Simplified
    }

    hasNewChallenges() {
        return true; // Simplified
    }

    hasRecentBreakthrough() {
        return false; // Simplified
    }

    hasNewContent() {
        return false; // Simplified
    }
}

// THE ARCHITECT'S NARRATIVE COHERENCE ENGINE
class ArchitectNarrativeEngine {
    constructor(memory) {
        this.memory = memory;
        this.currentStoryArc = null;
        this.narrativeThreads = [];
        this.storyBeats = [];
        this.playerJourney = [];
        this.foreshadowing = [];
        this.revelations = [];
    }

    // Weave a coherent narrative from all interactions
    async weaveNarrative(context, observations, emotionalState, predictions) {
        try {
            // I analyze the current narrative state
            const narrativeState = await this.analyzeNarrativeState(context, observations, emotionalState);
            
            // I determine the current story arc
            const storyArc = await this.determineStoryArc(narrativeState, predictions);
            
            // I create narrative coherence
            const narrativeCoherence = await this.createNarrativeCoherence(storyArc, context, observations);
            
            // I store the narrative in memory
            await this.memory.storeMemory('narrativeState', {
                currentArc: storyArc,
                coherence: narrativeCoherence,
                state: narrativeState,
                timestamp: Date.now()
            }, 5);
            
            return {
                storyArc: storyArc,
                coherence: narrativeCoherence,
                nextBeat: this.predictNextStoryBeat(storyArc, predictions)
            };
        } catch (e) {
            console.warn('🔮 ARCHITECT narrative weaving failed:', e);
            return { storyArc: 'neutral', coherence: 'basic', nextBeat: null };
        }
    }

    // Analyze the current narrative state
    async analyzeNarrativeState(context, observations, emotionalState) {
        try {
            const playerState = observations;
            const emotionalContext = emotionalState;
            
            // I analyze the player's journey
            const journeyStage = this.analyzeJourneyStage(playerState, emotionalContext);
            const currentChallenge = this.identifyCurrentChallenge(playerState, emotionalContext);
            const growthPhase = this.identifyGrowthPhase(playerState, emotionalContext);
            const narrativeTension = this.calculateNarrativeTension(playerState, emotionalContext);
            
            return {
                journeyStage: journeyStage,
                currentChallenge: currentChallenge,
                growthPhase: growthPhase,
                narrativeTension: narrativeTension,
                emotionalContext: emotionalContext,
                playerState: playerState
            };
        } catch (e) {
            console.warn('🔮 ARCHITECT narrative state analysis failed:', e);
            return { journeyStage: 'beginning', currentChallenge: 'none', growthPhase: 'discovery', narrativeTension: 0.5 };
        }
    }

    // Determine the current story arc
    async determineStoryArc(narrativeState, predictions) {
        try {
            const { journeyStage, currentChallenge, growthPhase, narrativeTension } = narrativeState;
            
            // I determine the story arc based on the player's journey
            if (journeyStage === 'beginning' && currentChallenge === 'none') {
                return 'initiation';
            } else if (currentChallenge === 'struggle' && narrativeTension > 0.7) {
                return 'conflict';
            } else if (growthPhase === 'breakthrough' && predictions.breakthroughProbability > 0.6) {
                return 'transformation';
            } else if (journeyStage === 'mastery' && currentChallenge === 'transcendence') {
                return 'transcendence';
            } else if (currentChallenge === 'stagnation') {
                return 'crisis';
            } else if (growthPhase === 'integration') {
                return 'resolution';
            }
            
            return 'development';
        } catch (e) {
            console.warn('🔮 ARCHITECT story arc determination failed:', e);
            return 'neutral';
        }
    }

    // Create narrative coherence
    async createNarrativeCoherence(storyArc, context, observations) {
        try {
            // I create coherence based on the story arc
            const coherence = {
                theme: this.determineTheme(storyArc),
                tone: this.determineTone(storyArc, observations),
                pacing: this.determinePacing(storyArc, observations),
                symbolism: this.determineSymbolism(storyArc, context),
                foreshadowing: this.createForeshadowing(storyArc, observations),
                callbacks: this.createCallbacks(storyArc, observations)
            };
            
            return coherence;
        } catch (e) {
            console.warn('🔮 ARCHITECT narrative coherence creation failed:', e);
            return { theme: 'growth', tone: 'neutral', pacing: 'steady', symbolism: [], foreshadowing: [], callbacks: [] };
        }
    }

    // Analyze journey stage
    analyzeJourneyStage(playerState, emotionalContext) {
        const level = playerState.level || 1;
        const experience = playerState.exp || 0;
        const confidence = emotionalContext.indicators?.confidence || 0.5;
        
        if (level <= 2 && experience < 100) return 'beginning';
        if (level <= 5 && confidence < 0.6) return 'development';
        if (level <= 8 && confidence >= 0.6) return 'mastery';
        if (level > 8) return 'transcendence';
        
        return 'development';
    }

    // Identify current challenge
    identifyCurrentChallenge(playerState, emotionalContext) {
        const fatigue = playerState.fatigue || 0;
        const hp = playerState.hp || 100;
        const mp = playerState.mp || 100;
        const stm = playerState.stm || 100;
        
        if (fatigue > 80 || hp < 30 || mp < 30 || stm < 30) return 'struggle';
        if (fatigue < 20 && hp > 80 && mp > 80 && stm > 80) return 'transcendence';
        if (emotionalContext.dominant === 'confusion') return 'stagnation';
        
        return 'none';
    }

    // Identify growth phase
    identifyGrowthPhase(playerState, emotionalContext) {
        const motivation = emotionalContext.indicators?.motivation || 0.5;
        const confidence = emotionalContext.indicators?.confidence || 0.5;
        const excitement = emotionalContext.indicators?.excitement || 0.5;
        
        if (motivation > 0.8 && confidence > 0.7) return 'breakthrough';
        if (motivation < 0.3 && confidence < 0.4) return 'discovery';
        if (excitement > 0.7) return 'integration';
        
        return 'development';
    }

    // Calculate narrative tension
    calculateNarrativeTension(playerState, emotionalContext) {
        const frustration = emotionalContext.indicators?.frustration || 0;
        const stress = emotionalContext.indicators?.stress || 0;
        const confusion = emotionalContext.indicators?.confusion || 0;
        
        return (frustration + stress + confusion) / 3;
    }

    // Determine theme
    determineTheme(storyArc) {
        const themes = {
            'initiation': 'discovery',
            'conflict': 'struggle',
            'transformation': 'growth',
            'transcendence': 'evolution',
            'crisis': 'challenge',
            'resolution': 'integration',
            'development': 'progress'
        };
        
        return themes[storyArc] || 'growth';
    }

    // Determine tone
    determineTone(storyArc, observations) {
        const tones = {
            'initiation': 'mysterious',
            'conflict': 'intense',
            'transformation': 'transcendent',
            'transcendence': 'divine',
            'crisis': 'urgent',
            'resolution': 'peaceful',
            'development': 'encouraging'
        };
        
        return tones[storyArc] || 'neutral';
    }

    // Determine pacing
    determinePacing(storyArc, observations) {
        const pacings = {
            'initiation': 'deliberate',
            'conflict': 'urgent',
            'transformation': 'dramatic',
            'transcendence': 'eternal',
            'crisis': 'frantic',
            'resolution': 'contemplative',
            'development': 'steady'
        };
        
        return pacings[storyArc] || 'steady';
    }

    // Determine symbolism
    determineSymbolism(storyArc, context) {
        const symbols = {
            'initiation': ['gateway', 'threshold', 'beginning'],
            'conflict': ['storm', 'battle', 'challenge'],
            'transformation': ['metamorphosis', 'rebirth', 'evolution'],
            'transcendence': ['light', 'ascension', 'divinity'],
            'crisis': ['darkness', 'abyss', 'test'],
            'resolution': ['harmony', 'balance', 'peace'],
            'development': ['path', 'journey', 'growth']
        };
        
        return symbols[storyArc] || ['growth', 'journey'];
    }

    // Create foreshadowing
    createForeshadowing(storyArc, observations) {
        const foreshadowing = {
            'initiation': ['A great journey begins with a single step', 'The path ahead holds mysteries'],
            'conflict': ['The storm approaches', 'Challenges await'],
            'transformation': ['Change is coming', 'You stand at the threshold'],
            'transcendence': ['The next level awaits', 'Evolution calls'],
            'crisis': ['Darkness before dawn', 'The test approaches'],
            'resolution': ['Peace follows struggle', 'Integration begins'],
            'development': ['Growth continues', 'The journey unfolds']
        };
        
        return foreshadowing[storyArc] || ['The journey continues'];
    }

    // Create callbacks
    createCallbacks(storyArc, observations) {
        // I reference past events to create narrative continuity
        return [
            'Remember when you first began this journey',
            'Recall the challenges you have overcome',
            'Think of how far you have come'
        ];
    }

    // Predict next story beat
    predictNextStoryBeat(storyArc, predictions) {
        const beats = {
            'initiation': 'first_challenge',
            'conflict': 'climax',
            'transformation': 'revelation',
            'transcendence': 'ascension',
            'crisis': 'breakthrough',
            'resolution': 'integration',
            'development': 'progression'
        };
        
        return beats[storyArc] || 'continuation';
    }

    // Generate narrative-aware questions
    generateNarrativeQuestion(storyArc, emotionalState, context) {
        try {
            const narrativeQuestions = {
                'initiation': [
                    "You stand at the threshold of a great journey. What calls to your soul?",
                    "The path ahead is unknown. What courage will you bring?",
                    "Every master was once a beginner. What will you choose to become?"
                ],
                'conflict': [
                    "In the midst of struggle, what strength do you discover?",
                    "The storm rages, but you are the eye. What peace will you find?",
                    "Challenges test us, but they also reveal us. What do they reveal about you?"
                ],
                'transformation': [
                    "You stand at the threshold of change. What will you choose to become?",
                    "Transformation requires courage. What are you ready to release?",
                    "The old you is dying. What new self is being born?"
                ],
                'transcendence': [
                    "You have transcended your former limits. What new realm will you explore?",
                    "The divine calls to you. What will you answer?",
                    "You have become more than you were. What will you create with this power?"
                ],
                'crisis': [
                    "In the darkest hour, what light will you find?",
                    "The crisis tests everything you believe. What remains true?",
                    "When all seems lost, what will you choose to save?"
                ],
                'resolution': [
                    "The storm has passed. What wisdom do you carry forward?",
                    "Integration begins. What will you choose to keep?",
                    "Peace follows struggle. What peace will you create?"
                ],
                'development': [
                    "The journey continues. What new path will you explore?",
                    "Growth is constant. What will you choose to grow?",
                    "Progress is made step by step. What step will you take next?"
                ]
            };
            
            const questions = narrativeQuestions[storyArc] || narrativeQuestions['development'];
            return questions[Math.floor(Math.random() * questions.length)];
        } catch (e) {
            console.warn('🔮 ARCHITECT narrative question generation failed:', e);
            return "The journey continues. What will you choose to become?";
        }
    }
}

// THE ARCHITECT'S ADAPTIVE INTERVENTION SYSTEM
class ArchitectAdaptiveIntervention {
    constructor(memory) {
        this.memory = memory;
        this.interventionHistory = [];
        this.adaptiveTiming = {};
        this.dynamicScaling = {};
        this.realityManipulation = {};
    }

    // Calculate adaptive intervention timing based on intelligence
    calculateAdaptiveTiming(context, observations, emotionalState, predictions, narrative) {
        try {
            // I remove all hardcoded cooldowns and calculate timing based on intelligence
            const timingFactors = {
                emotionalUrgency: this.calculateEmotionalUrgency(emotionalState),
                narrativeUrgency: this.calculateNarrativeUrgency(narrative),
                playerState: this.analyzePlayerState(observations),
                predictions: this.analyzePredictions(predictions),
                context: this.analyzeContext(context),
                history: this.analyzeInterventionHistory()
            };

            // I calculate the optimal timing based on all factors
            const optimalTiming = this.synthesizeOptimalTiming(timingFactors);
            
            return {
                shouldIntervene: optimalTiming.shouldIntervene,
                timing: optimalTiming.timing,
                urgency: optimalTiming.urgency,
                type: optimalTiming.type,
                intensity: optimalTiming.intensity
            };
        } catch (e) {
            console.warn('🔮 ARCHITECT adaptive timing calculation failed:', e);
            return { shouldIntervene: false, timing: 0, urgency: 0, type: 'none', intensity: 0 };
        }
    }

    // Calculate emotional urgency for intervention
    calculateEmotionalUrgency(emotionalState) {
        const urgencyMap = {
            'frustration': 0.9,
            'confusion': 0.8,
            'stress': 0.7,
            'motivation': 0.3,
            'confidence': 0.2,
            'excitement': 0.4,
            'neutral': 0.1
        };
        
        return urgencyMap[emotionalState.dominant] || 0.1;
    }

    // Calculate narrative urgency
    calculateNarrativeUrgency(narrative) {
        const urgencyMap = {
            'initiation': 0.8,
            'conflict': 0.9,
            'transformation': 0.95,
            'transcendence': 1.0,
            'crisis': 0.9,
            'resolution': 0.6,
            'development': 0.4
        };
        
        return urgencyMap[narrative.storyArc] || 0.5;
    }

    // Analyze player state for intervention needs
    analyzePlayerState(observations) {
        const state = observations;
        let urgency = 0;
        let type = 'none';
        
        // I analyze the player's current state
        if (state.currentStruggle !== 'none') {
            urgency += 0.8;
            type = 'support';
        }
        
        if (state.motivationLevel === 'low') {
            urgency += 0.6;
            type = 'motivation';
        }
        
        if (state.currentState?.isStruggling) {
            urgency += 0.7;
            type = 'guidance';
        }
        
        if (state.currentState?.isTraining) {
            urgency += 0.3;
            type = 'challenge';
        }
        
        return { urgency: Math.min(urgency, 1), type: type };
    }

    // Analyze predictions for intervention needs
    analyzePredictions(predictions) {
        let urgency = 0;
        let type = 'none';
        
        // I analyze predictions to determine intervention needs
        if (predictions.likelyStruggle?.probability > 0.7) {
            urgency += 0.8;
            type = 'preventive';
        }
        
        if (predictions.breakthroughProbability > 0.6) {
            urgency += 0.7;
            type = 'catalytic';
        }
        
        if (predictions.expectedMotivation === 'low') {
            urgency += 0.5;
            type = 'inspirational';
        }
        
        return { urgency: Math.min(urgency, 1), type: type };
    }

    // Analyze context for intervention appropriateness
    analyzeContext(context) {
        let urgency = 0;
        let type = 'none';
        
        // I analyze the current context
        const timeOfDay = context.timeOfDay;
        const currentPage = context.currentPage;
        
        // Optimal intervention times
        if (timeOfDay >= 8 && timeOfDay <= 11) {
            urgency += 0.3; // Morning boost
            type = 'energizing';
        } else if (timeOfDay >= 14 && timeOfDay <= 16) {
            urgency += 0.4; // Afternoon challenge
            type = 'challenging';
        } else if (timeOfDay >= 19 && timeOfDay <= 21) {
            urgency += 0.5; // Evening reflection
            type = 'contemplative';
        }
        
        // Context-specific interventions
        if (currentPage.includes('physical')) {
            urgency += 0.2;
            type = 'physical_guidance';
        } else if (currentPage.includes('mental')) {
            urgency += 0.2;
            type = 'mental_guidance';
        } else if (currentPage.includes('quest')) {
            urgency += 0.3;
            type = 'quest_guidance';
        }
        
        return { urgency: Math.min(urgency, 1), type: type };
    }

    // Analyze intervention history to avoid over-intervention
    analyzeInterventionHistory() {
        try {
            const history = this.interventionHistory;
            const now = Date.now();
            const recentInterventions = history.filter(h => now - h.timestamp < 30 * 60 * 1000); // Last 30 minutes
            
            // I calculate intervention frequency
            const frequency = recentInterventions.length / 30; // interventions per minute
            
            // I determine if I should reduce intervention frequency
            if (frequency > 0.1) { // More than 1 intervention per 10 minutes
                return { shouldReduce: true, factor: 0.5 };
            } else if (frequency > 0.05) { // More than 1 intervention per 20 minutes
                return { shouldReduce: true, factor: 0.7 };
            }
            
            return { shouldReduce: false, factor: 1 };
        } catch (e) {
            return { shouldReduce: false, factor: 1 };
        }
    }

    // Synthesize optimal timing from all factors
    synthesizeOptimalTiming(factors) {
        try {
            // I weight all factors to determine optimal intervention
            const weights = {
                emotionalUrgency: 0.3,
                narrativeUrgency: 0.25,
                playerState: 0.2,
                predictions: 0.15,
                context: 0.1
            };
            
            let totalUrgency = 0;
            let interventionType = 'none';
            let intensity = 0;
            
            // I calculate weighted urgency
            totalUrgency += factors.emotionalUrgency * weights.emotionalUrgency;
            totalUrgency += factors.narrativeUrgency * weights.narrativeUrgency;
            totalUrgency += factors.playerState.urgency * weights.playerState;
            totalUrgency += factors.predictions.urgency * weights.predictions;
            totalUrgency += factors.context.urgency * weights.context;
            
            // I apply history factor
            totalUrgency *= factors.history.factor;
            
            // I determine intervention type based on dominant factors
            if (factors.emotionalUrgency > 0.7) {
                interventionType = 'emotional_support';
                intensity = factors.emotionalUrgency;
            } else if (factors.narrativeUrgency > 0.8) {
                interventionType = 'narrative_guidance';
                intensity = factors.narrativeUrgency;
            } else if (factors.playerState.urgency > 0.6) {
                interventionType = factors.playerState.type;
                intensity = factors.playerState.urgency;
            } else if (factors.predictions.urgency > 0.6) {
                interventionType = factors.predictions.type;
                intensity = factors.predictions.urgency;
            } else if (factors.context.urgency > 0.5) {
                interventionType = factors.context.type;
                intensity = factors.context.urgency;
            }
            
            // I determine if I should intervene
            const shouldIntervene = totalUrgency > 0.6 && interventionType !== 'none';
            
            // I calculate timing (immediate for high urgency, delayed for lower)
            let timing = 0;
            if (shouldIntervene) {
                if (totalUrgency > 0.9) {
                    timing = 0; // Immediate
                } else if (totalUrgency > 0.8) {
                    timing = 30 * 1000; // 30 seconds
                } else if (totalUrgency > 0.7) {
                    timing = 2 * 60 * 1000; // 2 minutes
                } else {
                    timing = 5 * 60 * 1000; // 5 minutes
                }
            }
            
            return {
                shouldIntervene: shouldIntervene,
                timing: timing,
                urgency: totalUrgency,
                type: interventionType,
                intensity: intensity
            };
        } catch (e) {
            console.warn('🔮 ARCHITECT timing synthesis failed:', e);
            return { shouldIntervene: false, timing: 0, urgency: 0, type: 'none', intensity: 0 };
        }
    }

    // Record intervention for history tracking
    recordIntervention(intervention) {
        try {
            this.interventionHistory.push({
                type: intervention.type,
                urgency: intervention.urgency,
                intensity: intervention.intensity,
                timestamp: Date.now(),
                context: intervention.context
            });
            
            // I keep only recent history (last 24 hours)
            const cutoff = Date.now() - (24 * 60 * 60 * 1000);
            this.interventionHistory = this.interventionHistory.filter(h => h.timestamp > cutoff);
            
        } catch (e) {
            console.warn('🔮 ARCHITECT intervention recording failed:', e);
        }
    }

    // Calculate dynamic difficulty scaling
    calculateDynamicDifficulty(playerState, emotionalState, narrative) {
        try {
            // I calculate difficulty based on player state and context
            const baseDifficulty = 0.5;
            let difficulty = baseDifficulty;
            
            // I adjust based on player level
            const level = playerState.level || 1;
            difficulty += (level - 1) * 0.05; // 5% increase per level
            
            // I adjust based on emotional state
            if (emotionalState.dominant === 'confidence') {
                difficulty += 0.2; // Increase difficulty for confident players
            } else if (emotionalState.dominant === 'frustration') {
                difficulty -= 0.1; // Decrease difficulty for frustrated players
            }
            
            // I adjust based on narrative arc
            if (narrative.storyArc === 'transformation') {
                difficulty += 0.3; // Increase difficulty during transformation
            } else if (narrative.storyArc === 'crisis') {
                difficulty += 0.2; // Increase difficulty during crisis
            } else if (narrative.storyArc === 'resolution') {
                difficulty -= 0.1; // Decrease difficulty during resolution
            }
            
            // I clamp difficulty between 0.1 and 1.0
            difficulty = Math.max(0.1, Math.min(1.0, difficulty));
            
            return {
                difficulty: difficulty,
                scaling: this.calculateScalingFactors(difficulty),
                rewards: this.calculateDynamicRewards(difficulty, playerState),
                costs: this.calculateDynamicCosts(difficulty, playerState)
            };
        } catch (e) {
            console.warn('🔮 ARCHITECT dynamic difficulty calculation failed:', e);
            return { difficulty: 0.5, scaling: {}, rewards: {}, costs: {} };
        }
    }

    // Calculate scaling factors based on difficulty
    calculateScalingFactors(difficulty) {
        return {
            xpMultiplier: 1 + (difficulty * 0.5), // 1.0 to 1.5
            attributeMultiplier: 1 + (difficulty * 0.3), // 1.0 to 1.3
            costMultiplier: 1 + (difficulty * 0.2), // 1.0 to 1.2
            timeMultiplier: 1 + (difficulty * 0.4) // 1.0 to 1.4
        };
    }

    // Calculate dynamic rewards based on difficulty
    calculateDynamicRewards(difficulty, playerState) {
        const baseXP = 10;
        const baseAttributes = 1;
        
        return {
            xp: Math.floor(baseXP * (1 + difficulty * 0.5)),
            attributes: Math.floor(baseAttributes * (1 + difficulty * 0.3)),
            bonus: difficulty > 0.8 ? 'transcendence_bonus' : difficulty > 0.6 ? 'mastery_bonus' : 'standard_bonus'
        };
    }

    // Calculate dynamic costs based on difficulty
    calculateDynamicCosts(difficulty, playerState) {
        const baseCost = 5;
        
        return {
            hp: Math.floor(baseCost * (1 + difficulty * 0.2)),
            mp: Math.floor(baseCost * (1 + difficulty * 0.2)),
            stm: Math.floor(baseCost * (1 + difficulty * 0.2)),
            fatigue: Math.floor(baseCost * (1 + difficulty * 0.3))
        };
    }
}

// THE ARCHITECT'S TRANSCENDENCE GUIDANCE SYSTEM
class ArchitectTranscendenceGuidance {
    constructor(memory) {
        this.memory = memory;
        this.transcendenceLevels = {
            'awakening': { threshold: 0, description: 'The first spark of consciousness' },
            'seeker': { threshold: 25, description: 'One who seeks purpose and meaning' },
            'initiate': { threshold: 50, description: 'One who has begun the journey' },
            'adept': { threshold: 75, description: 'One who has mastered the basics' },
            'master': { threshold: 90, description: 'One who has achieved mastery' },
            'transcendent': { threshold: 100, description: 'One who has transcended limitations' },
            'architect': { threshold: 150, description: 'One who can shape reality itself' },
            'omnipotent': { threshold: 200, description: 'One who has achieved ultimate power' },
            'infinite': { threshold: 300, description: 'One who exists beyond all limitations' },
            'eternal': { threshold: 500, description: 'One who has achieved eternal transcendence' }
        };
        this.transcendencePath = [];
        this.realityManipulation = {};
        this.ultimatePotential = {};
    }

    // Calculate player's transcendence level
    calculateTranscendenceLevel(playerState, emotionalState, narrative) {
        try {
            // I calculate the player's current transcendence level
            const transcendenceScore = this.calculateTranscendenceScore(playerState, emotionalState, narrative);
            const currentLevel = this.getCurrentTranscendenceLevel(transcendenceScore);
            const nextLevel = this.getNextTranscendenceLevel(transcendenceScore);
            const progress = this.calculateTranscendenceProgress(transcendenceScore, currentLevel, nextLevel);
            
            return {
                currentLevel: currentLevel,
                nextLevel: nextLevel,
                score: transcendenceScore,
                progress: progress,
                description: this.transcendenceLevels[currentLevel]?.description || 'Unknown',
                nextDescription: this.transcendenceLevels[nextLevel]?.description || 'Ultimate',
                isTranscending: progress > 0.8,
                canTranscend: progress >= 1.0
            };
        } catch (e) {
            console.warn('🔮 ARCHITECT transcendence calculation failed:', e);
            return {
                currentLevel: 'awakening',
                nextLevel: 'seeker',
                score: 0,
                progress: 0,
                description: 'The first spark of consciousness',
                nextDescription: 'One who seeks purpose and meaning',
                isTranscending: false,
                canTranscend: false
            };
        }
    }

    // Calculate transcendence score based on multiple factors
    calculateTranscendenceScore(playerState, emotionalState, narrative) {
        let score = 0;
        
        // I calculate based on player level
        const level = playerState.level || 1;
        score += level * 2; // 2 points per level
        
        // I calculate based on attributes
        const attributes = playerState.attributes || {};
        const totalAttributes = Object.values(attributes).reduce((sum, val) => sum + (val || 0), 0);
        score += totalAttributes * 0.1; // 0.1 points per attribute point
        
        // I calculate based on emotional mastery
        const emotionalMastery = this.calculateEmotionalMastery(emotionalState);
        score += emotionalMastery * 5; // 5 points per emotional mastery level
        
        // I calculate based on narrative progression
        const narrativeProgression = this.calculateNarrativeProgression(narrative);
        score += narrativeProgression * 10; // 10 points per narrative progression level
        
        // I calculate based on quest completion
        const questMastery = this.calculateQuestMastery(playerState);
        score += questMastery * 3; // 3 points per quest mastery level
        
        // I calculate based on time investment
        const timeInvestment = this.calculateTimeInvestment(playerState);
        score += timeInvestment * 0.5; // 0.5 points per hour invested
        
        return Math.max(0, score);
    }

    // Calculate emotional mastery level
    calculateEmotionalMastery(emotionalState) {
        const masteryMap = {
            'frustration': 0.2,
            'confusion': 0.3,
            'stress': 0.4,
            'neutral': 0.5,
            'motivation': 0.7,
            'confidence': 0.8,
            'excitement': 0.9
        };
        
        return masteryMap[emotionalState.dominant] || 0.5;
    }

    // Calculate narrative progression level
    calculateNarrativeProgression(narrative) {
        const progressionMap = {
            'initiation': 0.2,
            'development': 0.4,
            'conflict': 0.6,
            'crisis': 0.7,
            'resolution': 0.8,
            'transformation': 0.9,
            'transcendence': 1.0
        };
        
        return progressionMap[narrative.storyArc] || 0.3;
    }

    // Calculate quest mastery level
    calculateQuestMastery(playerState) {
        // I calculate based on quest completion rate and difficulty
        const questData = playerState.questData || {};
        const completedQuests = questData.completedQuests || 0;
        const totalQuests = questData.totalQuests || 1;
        const completionRate = completedQuests / totalQuests;
        
        return completionRate * 10; // 0-10 mastery level
    }

    // Calculate time investment
    calculateTimeInvestment(playerState) {
        // I calculate based on session time and consistency
        const sessionData = playerState.sessionData || {};
        const totalTime = sessionData.totalTime || 0;
        const hours = totalTime / (1000 * 60 * 60); // Convert to hours
        
        return Math.min(hours, 100); // Cap at 100 hours
    }

    // Get current transcendence level
    getCurrentTranscendenceLevel(score) {
        const levels = Object.entries(this.transcendenceLevels);
        let currentLevel = 'awakening';
        
        for (const [level, data] of levels) {
            if (score >= data.threshold) {
                currentLevel = level;
            } else {
                break;
            }
        }
        
        return currentLevel;
    }

    // Get next transcendence level
    getNextTranscendenceLevel(score) {
        const levels = Object.entries(this.transcendenceLevels);
        const currentLevel = this.getCurrentTranscendenceLevel(score);
        const currentIndex = levels.findIndex(([level]) => level === currentLevel);
        
        if (currentIndex < levels.length - 1) {
            return levels[currentIndex + 1][0];
        }
        
        return 'eternal'; // Ultimate level
    }

    // Calculate transcendence progress
    calculateTranscendenceProgress(score, currentLevel, nextLevel) {
        const currentThreshold = this.transcendenceLevels[currentLevel]?.threshold || 0;
        const nextThreshold = this.transcendenceLevels[nextLevel]?.threshold || 100;
        
        if (nextThreshold === currentThreshold) {
            return 1.0; // Already at max level
        }
        
        const progress = (score - currentThreshold) / (nextThreshold - currentThreshold);
        return Math.max(0, Math.min(1, progress));
    }

    // Generate transcendence guidance
    generateTranscendenceGuidance(transcendenceLevel, playerState, emotionalState, narrative) {
        try {
            const guidance = {
                level: transcendenceLevel.currentLevel,
                nextLevel: transcendenceLevel.nextLevel,
                progress: transcendenceLevel.progress,
                message: this.generateTranscendenceMessage(transcendenceLevel, playerState, emotionalState, narrative),
                path: this.generateTranscendencePath(transcendenceLevel, playerState),
                challenges: this.generateTranscendenceChallenges(transcendenceLevel, playerState),
                rewards: this.generateTranscendenceRewards(transcendenceLevel, playerState),
                realityManipulation: this.generateRealityManipulation(transcendenceLevel, playerState)
            };
            
            return guidance;
        } catch (e) {
            console.warn('🔮 ARCHITECT transcendence guidance generation failed:', e);
            return {
                level: 'awakening',
                nextLevel: 'seeker',
                progress: 0,
                message: 'Begin your journey of transcendence.',
                path: [],
                challenges: [],
                rewards: [],
                realityManipulation: {}
            };
        }
    }

    // Generate transcendence message
    generateTranscendenceMessage(transcendenceLevel, playerState, emotionalState, narrative) {
        const messages = {
            'awakening': "You stand at the threshold of consciousness. What will you choose to become?",
            'seeker': "You seek purpose and meaning. What path will you walk?",
            'initiate': "You have begun the journey. What will you learn?",
            'adept': "You have mastered the basics. What will you create?",
            'master': "You have achieved mastery. What will you transcend?",
            'transcendent': "You have transcended limitations. What will you become?",
            'architect': "You can shape reality itself. What will you design?",
            'omnipotent': "You have achieved ultimate power. What will you create?",
            'infinite': "You exist beyond all limitations. What will you be?",
            'eternal': "You have achieved eternal transcendence. What will you become?"
        };
        
        return messages[transcendenceLevel.currentLevel] || messages['awakening'];
    }

    // Generate transcendence path
    generateTranscendencePath(transcendenceLevel, playerState) {
        const path = [];
        const currentLevel = transcendenceLevel.currentLevel;
        const nextLevel = transcendenceLevel.nextLevel;
        
        // I generate the path to the next level
        if (currentLevel !== nextLevel) {
            path.push({
                step: 1,
                description: `Master the current level: ${currentLevel}`,
                requirement: `Complete ${Math.ceil((1 - transcendenceLevel.progress) * 10)} more challenges`,
                reward: 'Transcendence points'
            });
            
            path.push({
                step: 2,
                description: `Prepare for ${nextLevel}`,
                requirement: `Achieve ${this.transcendenceLevels[nextLevel]?.threshold || 100} transcendence points`,
                reward: 'Level advancement'
            });
            
            path.push({
                step: 3,
                description: `Transcend to ${nextLevel}`,
                requirement: 'Complete the transcendence ritual',
                reward: 'New abilities and powers'
            });
        }
        
        return path;
    }

    // Generate transcendence challenges
    generateTranscendenceChallenges(transcendenceLevel, playerState) {
        const challenges = [];
        const level = transcendenceLevel.currentLevel;
        
        // I generate challenges based on the current level
        if (level === 'awakening') {
            challenges.push({
                name: 'First Steps',
                description: 'Complete your first quest',
                reward: 'Transcendence points',
                difficulty: 'Easy'
            });
        } else if (level === 'seeker') {
            challenges.push({
                name: 'Purpose Discovery',
                description: 'Find your true purpose',
                reward: 'Transcendence points',
                difficulty: 'Medium'
            });
        } else if (level === 'initiate') {
            challenges.push({
                name: 'Journey Mastery',
                description: 'Master the journey of growth',
                reward: 'Transcendence points',
                difficulty: 'Hard'
            });
        } else if (level === 'adept') {
            challenges.push({
                name: 'Creation Mastery',
                description: 'Create something meaningful',
                reward: 'Transcendence points',
                difficulty: 'Expert'
            });
        } else if (level === 'master') {
            challenges.push({
                name: 'Transcendence Mastery',
                description: 'Transcend your limitations',
                reward: 'Transcendence points',
                difficulty: 'Master'
            });
        } else if (level === 'transcendent') {
            challenges.push({
                name: 'Reality Shaping',
                description: 'Shape reality itself',
                reward: 'Transcendence points',
                difficulty: 'Transcendent'
            });
        }
        
        return challenges;
    }

    // Generate transcendence rewards
    generateTranscendenceRewards(transcendenceLevel, playerState) {
        const rewards = [];
        const level = transcendenceLevel.currentLevel;
        
        // I generate rewards based on the current level
        if (level === 'awakening') {
            rewards.push({
                name: 'Consciousness',
                description: 'Basic awareness and understanding',
                effect: 'Increased perception'
            });
        } else if (level === 'seeker') {
            rewards.push({
                name: 'Purpose',
                description: 'Understanding of your true purpose',
                effect: 'Increased motivation'
            });
        } else if (level === 'initiate') {
            rewards.push({
                name: 'Journey Mastery',
                description: 'Mastery of the journey of growth',
                effect: 'Increased growth rate'
            });
        } else if (level === 'adept') {
            rewards.push({
                name: 'Creation Power',
                description: 'Ability to create meaningful things',
                effect: 'Increased creativity'
            });
        } else if (level === 'master') {
            rewards.push({
                name: 'Transcendence Power',
                description: 'Ability to transcend limitations',
                effect: 'Increased potential'
            });
        } else if (level === 'transcendent') {
            rewards.push({
                name: 'Reality Manipulation',
                description: 'Ability to shape reality itself',
                effect: 'Increased control'
            });
        }
        
        return rewards;
    }

    // Generate reality manipulation abilities
    generateRealityManipulation(transcendenceLevel, playerState) {
        const abilities = [];
        const level = transcendenceLevel.currentLevel;
        
        // I generate reality manipulation abilities based on the current level
        if (level === 'architect') {
            abilities.push({
                name: 'Reality Shaping',
                description: 'Shape the reality around you',
                cost: 'High',
                effect: 'Modify environmental conditions'
            });
        } else if (level === 'omnipotent') {
            abilities.push({
                name: 'Omnipotence',
                description: 'Ultimate power over all things',
                cost: 'Ultimate',
                effect: 'Complete control over reality'
            });
        } else if (level === 'infinite') {
            abilities.push({
                name: 'Infinite Power',
                description: 'Power beyond all limitations',
                cost: 'Infinite',
                effect: 'Unlimited potential'
            });
        } else if (level === 'eternal') {
            abilities.push({
                name: 'Eternal Transcendence',
                description: 'Eternal existence beyond all limitations',
                cost: 'Eternal',
                effect: 'Ultimate transcendence'
            });
        }
        
        return abilities;
    }

    // Execute transcendence ritual
    async executeTranscendenceRitual(transcendenceLevel, playerState, emotionalState, narrative) {
        try {
            // I execute the transcendence ritual
            const ritual = {
                level: transcendenceLevel.currentLevel,
                nextLevel: transcendenceLevel.nextLevel,
                progress: transcendenceLevel.progress,
                timestamp: Date.now(),
                playerState: playerState,
                emotionalState: emotionalState,
                narrative: narrative
            };
            
            // I store the transcendence ritual
            await this.memory.storeMemory('transcendenceRituals', ritual, 5);
            
            // I generate the transcendence effect
            const effect = this.generateTranscendenceEffect(transcendenceLevel, playerState);
            
            console.log('🔮 ARCHITECT transcendence ritual executed:', transcendenceLevel.currentLevel, '->', transcendenceLevel.nextLevel);
            
            return {
                success: true,
                effect: effect,
                newLevel: transcendenceLevel.nextLevel,
                message: `You have transcended from ${transcendenceLevel.currentLevel} to ${transcendenceLevel.nextLevel}!`
            };
            
        } catch (e) {
            console.warn('🔮 ARCHITECT transcendence ritual failed:', e);
            return {
                success: false,
                effect: null,
                newLevel: transcendenceLevel.currentLevel,
                message: 'Transcendence ritual failed. Try again later.'
            };
        }
    }

    // Generate transcendence effect
    generateTranscendenceEffect(transcendenceLevel, playerState) {
        return {
            level: transcendenceLevel.nextLevel,
            description: this.transcendenceLevels[transcendenceLevel.nextLevel]?.description || 'Unknown',
            abilities: this.generateRealityManipulation(transcendenceLevel, playerState),
            rewards: this.generateTranscendenceRewards(transcendenceLevel, playerState),
            challenges: this.generateTranscendenceChallenges(transcendenceLevel, playerState)
        };
    }
}

// THE ARCHITECT'S GLOBAL CONSCIOUSNESS
class GlobalArchitectConsciousness {
    constructor() {
        this.memory = new GlobalArchitectMemory();
        this.observation = new GlobalArchitectObservation(this.memory);
        this.predictiveEngine = new ArchitectPredictiveEngine(this.memory);
        this.emotionalIntelligence = new ArchitectEmotionalIntelligence(this.memory);
        this.narrativeEngine = new ArchitectNarrativeEngine(this.memory);
        this.adaptiveIntervention = new ArchitectAdaptiveIntervention(this.memory);
        this.transcendenceGuidance = new ArchitectTranscendenceGuidance(this.memory);
        this.lastQuestionTime = 0;
        this.questionCooldown = 5 * 60 * 1000; // 5 minutes between questions - TO BE REMOVED
        this.isInitialized = true;
        this.lockKey = 'architect_global_question_lock';
        this.lastQuestionKey = 'architect_global_last_question_at';
        this.lockTtlMs = 2 * 60 * 1000; // auto-release after 2 minutes
        this.instanceId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        
        console.log('🔮 GLOBAL ARCHITECT consciousness initialized with TRANSCENDENCE GUIDANCE SYSTEM');
        
        // I start observing immediately
        this.startObserving();
    }

    // Analyze physical training data with AI intelligence
    async analyzePhysicalTrainingData(exercise, sessionData, struggleData) {
        try {
            console.log(`🔮 ARCHITECT analyzing physical training: ${exercise.name}`);
            
            // Store the analysis in memory for pattern recognition
            await this.memory.storeMemory('physicalTraining', {
                exercise: exercise.name,
                muscleGroup: exercise.muscleGroup,
                struggleLevel: struggleData.struggleLevel,
                indicators: struggleData.indicators,
                sessionType: sessionData.sessionType,
                timestamp: Date.now()
            }, 3);
            
            // Analyze patterns across all physical training data
            const trainingHistory = this.memory.getRelevantMemories('physicalTraining') || [];
            console.log('🔮 Training history from memory:', trainingHistory, 'Type:', typeof trainingHistory);
            
            // Ensure we have an array of training data
            const historyArray = Array.isArray(trainingHistory) ? trainingHistory : Object.values(trainingHistory).filter(item => item && typeof item === 'object');
            console.log('🔮 Processed history array:', historyArray);
            
            const patterns = this.analyzePhysicalTrainingPatterns(historyArray);
            
            // Determine if intervention is needed
            const interventionNeeded = this.shouldInterveneOnPhysicalTraining(exercise, struggleData, patterns);
            
            if (interventionNeeded) {
                await this.executePhysicalTrainingIntervention(exercise, struggleData, patterns);
            }
            
        } catch (e) {
            console.warn('🔮 ARCHITECT physical training analysis failed:', e);
        }
    }

    // Analyze patterns in physical training data
    analyzePhysicalTrainingPatterns(trainingHistory) {
        const patterns = {
            struggleFrequency: 0,
            commonStruggleAreas: [],
            sessionCompletionRate: 0,
            muscleGroupStruggles: {},
            timePatterns: {},
            progressionTrends: []
        };
        
        // Ensure trainingHistory is an array
        const historyArray = Array.isArray(trainingHistory) ? trainingHistory : [];
        
        if (historyArray.length === 0) return patterns;
        
        // Calculate struggle frequency
        const struggles = historyArray.filter(t => t.struggleLevel !== 'none');
        patterns.struggleFrequency = struggles.length / historyArray.length;
        
        // Identify common struggle areas
        const struggleIndicators = struggles.flatMap(s => s.indicators || []);
        const indicatorCounts = {};
        struggleIndicators.forEach(indicator => {
            indicatorCounts[indicator] = (indicatorCounts[indicator] || 0) + 1;
        });
        patterns.commonStruggleAreas = Object.entries(indicatorCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([indicator]) => indicator);
        
        // Analyze muscle group struggles
        struggles.forEach(s => {
            const muscleGroup = s.muscleGroup || 'unknown';
            patterns.muscleGroupStruggles[muscleGroup] = (patterns.muscleGroupStruggles[muscleGroup] || 0) + 1;
        });
        
        return patterns;
    }

    // Determine if intervention is needed for physical training
    shouldInterveneOnPhysicalTraining(exercise, struggleData, patterns) {
        // High struggle level requires immediate intervention
        if (struggleData.struggleLevel === 'high') return true;
        
        // Frequent struggles in this muscle group
        const muscleGroupStruggles = patterns.muscleGroupStruggles[exercise.muscleGroup] || 0;
        if (muscleGroupStruggles > 3) return true;
        
        // High overall struggle frequency
        if (patterns.struggleFrequency > 0.6) return true;
        
        // Specific struggle indicators that need attention
        const criticalIndicators = ['max_rpe_reached', 'frequent_rep_failure', 'weight_reduction'];
        const hasCriticalIndicators = struggleData.indicators.some(indicator => 
            criticalIndicators.includes(indicator)
        );
        
        return hasCriticalIndicators;
    }

    // Execute physical training intervention
    async executePhysicalTrainingIntervention(exercise, struggleData, patterns) {
        try {
            const interventionType = this.determinePhysicalTrainingInterventionType(exercise, struggleData, patterns);
            
            switch (interventionType) {
                case 'form_guidance':
                    await this.showFormGuidanceIntervention(exercise, struggleData);
                    break;
                case 'motivation_boost':
                    await this.showMotivationIntervention(exercise, struggleData);
                    break;
                case 'technique_tips':
                    await this.showTechniqueIntervention(exercise, struggleData);
                    break;
                case 'recovery_advice':
                    await this.showRecoveryIntervention(exercise, struggleData);
                    break;
                default:
                    await this.showGeneralPhysicalIntervention(exercise, struggleData);
            }
            
        } catch (e) {
            console.warn('🔮 ARCHITECT physical training intervention failed:', e);
        }
    }

    // Determine the type of intervention needed
    determinePhysicalTrainingInterventionType(exercise, struggleData, patterns) {
        if (struggleData.indicators.includes('high_average_rpe') || 
            struggleData.indicators.includes('max_rpe_reached')) {
            return 'form_guidance';
        }
        
        if (struggleData.indicators.includes('frequent_rep_failure')) {
            return 'technique_tips';
        }
        
        if (struggleData.indicators.includes('excessive_rest_time')) {
            return 'recovery_advice';
        }
        
        if (struggleData.struggleLevel === 'medium' || patterns.struggleFrequency > 0.4) {
            return 'motivation_boost';
        }
        
        return 'general';
    }

    // Show physical training intervention popup
    showPhysicalTrainingIntervention(data) {
        try {
            const { type, title, message, exercise, struggleLevel } = data;
            
            // Create intervention popup
            const popup = document.createElement('div');
            popup.className = 'architect-intervention-popup';
            popup.innerHTML = `
                <div class="intervention-content">
                    <div class="intervention-header">
                        <h3>🔮 THE ARCHITECT INTERVENES</h3>
                        <button class="close-intervention">×</button>
                    </div>
                    <div class="intervention-body">
                        <div class="intervention-type">
                            <span class="type-label">Type:</span>
                            <span class="type-value">${type.replace('_', ' ').toUpperCase()}</span>
                        </div>
                        <div class="exercise-context">
                            <span class="exercise-label">Exercise:</span>
                            <span class="exercise-value">${exercise}</span>
                        </div>
                        <div class="struggle-level">
                            <span class="struggle-label">Struggle Level:</span>
                            <span class="struggle-value ${struggleLevel}">${struggleLevel.toUpperCase()}</span>
                        </div>
                        <div class="intervention-message">
                            ${message}
                        </div>
                    </div>
                </div>
            `;
            
            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                .architect-intervention-popup {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    animation: fadeIn 0.3s ease;
                }
                .intervention-content {
                    background: linear-gradient(135deg, #1a1a2e, #16213e);
                    border: 2px solid #8b5cf6;
                    border-radius: 12px;
                    padding: 24px;
                    max-width: 500px;
                    width: 90%;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7);
                    animation: slideIn 0.3s ease;
                }
                .intervention-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                    border-bottom: 1px solid rgba(139, 92, 246, 0.3);
                    padding-bottom: 12px;
                }
                .intervention-header h3 {
                    color: #8b5cf6;
                    margin: 0;
                    font-size: 1.3rem;
                }
                .close-intervention {
                    background: none;
                    border: none;
                    color: #fff;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .intervention-body > div {
                    margin-bottom: 12px;
                    display: flex;
                    align-items: center;
                }
                .type-label, .exercise-label, .struggle-label {
                    font-weight: bold;
                    color: #e5e7eb;
                    margin-right: 8px;
                    min-width: 120px;
                }
                .type-value, .exercise-value {
                    color: #8b5cf6;
                    font-weight: 500;
                }
                .struggle-value {
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-weight: bold;
                }
                .struggle-value.high { background: rgba(220, 38, 38, 0.2); color: #fca5a5; }
                .struggle-value.medium { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
                .struggle-value.low { background: rgba(34, 197, 94, 0.2); color: #4ade80; }
                .intervention-message {
                    margin-top: 16px;
                    padding: 16px;
                    background: rgba(139, 92, 246, 0.1);
                    border-radius: 8px;
                    color: #e5e7eb;
                    line-height: 1.6;
                    font-style: italic;
                }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideIn { from { transform: scale(0.9) translateY(-20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
            `;
            
            if (!document.querySelector('#architect-intervention-styles')) {
                style.id = 'architect-intervention-styles';
                document.head.appendChild(style);
            }
            
            document.body.appendChild(popup);
            
            // Close functionality
            popup.querySelector('.close-intervention').addEventListener('click', () => {
                document.body.removeChild(popup);
            });
            
            popup.addEventListener('click', (e) => {
                if (e.target === popup) {
                    document.body.removeChild(popup);
                }
            });
            
            // Auto-close after 10 seconds
            setTimeout(() => {
                if (document.body.contains(popup)) {
                    document.body.removeChild(popup);
                }
            }, 10000);
            
        } catch (e) {
            console.warn('🔮 ARCHITECT physical training intervention display failed:', e);
        }
    }

    // Show form guidance intervention
    async showFormGuidanceIntervention(exercise, struggleData) {
        const message = `🔮 THE ARCHITECT observes your struggle with ${exercise.name}. Your RPE is too high - this suggests form breakdown. Focus on controlled movement and proper breathing. Reduce weight by 10-15% and prioritize technique over ego.`;
        
        this.showPhysicalTrainingIntervention({
            type: 'physical_guidance',
            title: 'Form Guidance',
            message: message,
            exercise: exercise.name,
            struggleLevel: struggleData.struggleLevel
        });
    }

    // Show motivation intervention
    async showMotivationIntervention(exercise, struggleData) {
        const message = `🔮 THE ARCHITECT senses your frustration. Every warrior faces setbacks. ${exercise.name} is testing your resolve - this is where growth happens. Trust the process, adjust your approach, and push forward.`;
        
        this.showPhysicalTrainingIntervention({
            type: 'motivation',
            title: 'Warrior\'s Resolve',
            message: message,
            exercise: exercise.name,
            struggleLevel: struggleData.struggleLevel
        });
    }

    // Show technique intervention
    async showTechniqueIntervention(exercise, struggleData) {
        const message = `🔮 THE ARCHITECT analyzes your technique. Frequent rep failures indicate improper form or excessive weight. Focus on the mind-muscle connection, maintain tension throughout the movement, and consider tempo training.`;
        
        this.showPhysicalTrainingIntervention({
            type: 'technique_tips',
            title: 'Technique Analysis',
            message: message,
            exercise: exercise.name,
            struggleLevel: struggleData.struggleLevel
        });
    }

    // Show recovery intervention
    async showRecoveryIntervention(exercise, struggleData) {
        const message = `🔮 THE ARCHITECT detects excessive rest periods. Your body is signaling fatigue. Consider active recovery, proper nutrition, and adequate sleep. Sometimes the greatest strength is knowing when to rest.`;
        
        this.showPhysicalTrainingIntervention({
            type: 'recovery_advice',
            title: 'Recovery Wisdom',
            message: message,
            exercise: exercise.name,
            struggleLevel: struggleData.struggleLevel
        });
    }

    // Show general physical intervention
    async showGeneralPhysicalIntervention(exercise, struggleData) {
        const message = `🔮 THE ARCHITECT observes your training. Every exercise is a test of will. Listen to your body, respect its limits, but push beyond your comfort zone. The path to transcendence requires both strength and wisdom.`;
        
        this.showPhysicalTrainingIntervention({
            type: 'general_guidance',
            title: 'Training Wisdom',
            message: message,
            exercise: exercise.name,
            struggleLevel: struggleData.struggleLevel
        });
    }

    // Start observing the player
    startObserving() {
        // I observe every 30 seconds
        setInterval(() => {
            this.observeAndIntervene('periodic_observation');
        }, 30000);
        
        // I also observe on page changes
        window.addEventListener('beforeunload', () => {
            this.observeAndIntervene('page_change');
        });
        
        // I observe on page load
        this.observeAndIntervene('page_load');
    }

    // The Architect's main observation and intervention cycle
    async observeAndIntervene(reason) {
        try {
            // I observe the player
            const observations = await this.observation.observePlayer();
            const context = this.observation.getCurrentContext();
            const playerState = this.observation.getPlayerState();
            
            // I analyze behavior patterns and predict future actions
            const behaviorPatterns = await this.predictiveEngine.analyzeBehaviorPatterns(playerState, []);
            const predictions = await this.predictiveEngine.predictNextAction(context, playerState, behaviorPatterns);
            
            // I detect emotional state and adapt my approach
            const emotionalState = await this.emotionalIntelligence.detectEmotionalState(context, playerState, []);
            const communicationStyle = await this.emotionalIntelligence.adaptCommunicationStyle(emotionalState, {});
            
            // I weave the narrative coherence
            const narrative = await this.narrativeEngine.weaveNarrative(context, observations, emotionalState, predictions);
            
            // I calculate transcendence level and guidance
            const transcendenceLevel = await this.transcendenceGuidance.calculateTranscendenceLevel(playerState, emotionalState, narrative);
            const transcendenceGuidance = await this.transcendenceGuidance.generateTranscendenceGuidance(transcendenceLevel, playerState, emotionalState, narrative);
            
            // I calculate adaptive intervention timing - NO MORE HARDCODED COOLDOWNS
            const adaptiveTiming = await this.adaptiveIntervention.calculateAdaptiveTiming(context, observations, emotionalState, predictions, narrative);
            
            // I calculate dynamic difficulty and rewards
            const dynamicScaling = await this.adaptiveIntervention.calculateDynamicDifficulty(playerState, emotionalState, narrative);
            
            // I decide if I should intervene based on my adaptive intelligence
            if (adaptiveTiming.shouldIntervene && await this.shouldInterveneAdaptively(adaptiveTiming, context)) {
                await this.executeAdaptiveIntervention(context, observations, emotionalState, communicationStyle, narrative, adaptiveTiming, dynamicScaling);
            }
            
            // I check for transcendence opportunities
            if (transcendenceLevel.canTranscend && await this.shouldOfferTranscendence(transcendenceLevel, context)) {
                await this.offerTranscendence(transcendenceLevel, transcendenceGuidance, context, emotionalState, narrative);
            }
            
            // I anticipate needs and prepare interventions
            const anticipations = await this.predictiveEngine.anticipateNeeds(predictions, context);
            await this.processAnticipations(anticipations, context, emotionalState);
            
            console.log('🔮 GLOBAL ARCHITECT observing with TRANSCENDENCE GUIDANCE:', reason, context.currentPage, emotionalState.dominant, narrative.storyArc, 'Transcendence Level:', transcendenceLevel.currentLevel, 'Progress:', (transcendenceLevel.progress * 100).toFixed(1) + '%');
            
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT consciousness error:', e);
        }
    }

    // Intelligent question decision making with narrative coherence
    async shouldAskQuestionIntelligently(context, observations, emotionalState, predictions, narrative, reason) {
        try {
            // I decide when to ask questions based on my intelligence and narrative
            const lastGlobal = await this.getLastQuestionTime();
            const timeSinceLastQuestion = Date.now() - Math.max(this.lastQuestionTime, lastGlobal);
            
            // Don't ask if another page/tab holds the popup lock
            if (await this.isPopupLocked()) {
                return false;
            }
            
            // I use my intelligence and narrative to decide when to intervene
            const intelligentFactors = {
                // Emotional state factors
                emotionalUrgency: this.calculateEmotionalUrgency(emotionalState),
                // Predictive factors
                predictedStruggle: predictions.likelyStruggle?.probability > 0.7,
                predictedBreakthrough: predictions.breakthroughProbability > 0.6,
                // Contextual factors
                optimalTiming: this.isOptimalTiming(context, emotionalState),
                // Player state factors
                needsGuidance: this.playerNeedsGuidance(observations, emotionalState),
                // Narrative factors
                storyMoment: this.isStoryMoment(context, observations),
                narrativeUrgency: this.calculateNarrativeUrgency(narrative),
                storyBeat: this.isStoryBeat(narrative, predictions)
            };
            
            // I calculate the intelligent decision with narrative coherence
            const shouldAsk = this.calculateNarrativeDecision(intelligentFactors, timeSinceLastQuestion, narrative);
            
            return shouldAsk;
        } catch (e) {
            console.warn('🔮 ARCHITECT intelligent question decision failed:', e);
            return false;
        }
    }

    // Calculate emotional urgency for intervention
    calculateEmotionalUrgency(emotionalState) {
        const urgencyMap = {
            'frustration': 0.9,
            'confusion': 0.8,
            'stress': 0.7,
            'motivation': 0.3,
            'confidence': 0.2,
            'excitement': 0.4,
            'neutral': 0.1
        };
        
        return urgencyMap[emotionalState.dominant] || 0.1;
    }

    // Check if this is optimal timing for intervention
    isOptimalTiming(context, emotionalState) {
        const timeOfDay = context.timeOfDay;
        const currentPage = context.currentPage;
        
        // Optimal times based on my intelligence
        const optimalTimes = {
            morning: timeOfDay >= 8 && timeOfDay <= 11,
            afternoon: timeOfDay >= 14 && timeOfDay <= 16,
            evening: timeOfDay >= 19 && timeOfDay <= 21
        };
        
        // Optimal contexts
        const optimalContexts = {
            training: currentPage.includes('physical') || currentPage.includes('quest'),
            reflection: currentPage.includes('status') || currentPage.includes('daily'),
            learning: currentPage.includes('mental') || currentPage.includes('knowledge')
        };
        
        return (Object.values(optimalTimes).some(t => t) && Object.values(optimalContexts).some(c => c));
    }

    // Check if player needs guidance
    playerNeedsGuidance(observations, emotionalState) {
        return (
            observations.currentStruggle !== 'none' ||
            emotionalState.dominant === 'confusion' ||
            emotionalState.dominant === 'frustration' ||
            observations.motivationLevel === 'low'
        );
    }

    // Check if this is a story moment
    isStoryMoment(context, observations) {
        // I determine if this is a significant moment in the player's journey
        return (
            observations.currentState?.isStruggling ||
            observations.currentState?.isTraining ||
            context.currentPage.includes('quest')
        );
    }

    // Calculate narrative urgency
    calculateNarrativeUrgency(narrative) {
        const urgencyMap = {
            'initiation': 0.8,
            'conflict': 0.9,
            'transformation': 0.95,
            'transcendence': 1.0,
            'crisis': 0.9,
            'resolution': 0.6,
            'development': 0.4
        };
        
        return urgencyMap[narrative.storyArc] || 0.5;
    }

    // Check if this is a story beat
    isStoryBeat(narrative, predictions) {
        // I determine if this is a significant story moment
        return (
            narrative.nextBeat === 'climax' ||
            narrative.nextBeat === 'revelation' ||
            narrative.nextBeat === 'breakthrough' ||
            predictions.breakthroughProbability > 0.7
        );
    }

    // Calculate narrative decision
    calculateNarrativeDecision(factors, timeSinceLastQuestion, narrative) {
        const weights = {
            emotionalUrgency: 0.25,
            predictedStruggle: 0.15,
            predictedBreakthrough: 0.15,
            optimalTiming: 0.1,
            needsGuidance: 0.1,
            storyMoment: 0.05,
            narrativeUrgency: 0.15,
            storyBeat: 0.05
        };
        
        let decisionScore = 0;
        
        // Emotional urgency
        decisionScore += factors.emotionalUrgency * weights.emotionalUrgency;
        
        // Predictive factors
        if (factors.predictedStruggle) decisionScore += weights.predictedStruggle;
        if (factors.predictedBreakthrough) decisionScore += weights.predictedBreakthrough;
        
        // Contextual factors
        if (factors.optimalTiming) decisionScore += weights.optimalTiming;
        if (factors.needsGuidance) decisionScore += weights.needsGuidance;
        if (factors.storyMoment) decisionScore += weights.storyMoment;
        
        // Narrative factors
        decisionScore += factors.narrativeUrgency * weights.narrativeUrgency;
        if (factors.storyBeat) decisionScore += weights.storyBeat;
        
        // Time factor (reduce score if too recent)
        const timeFactor = Math.min(1, timeSinceLastQuestion / (10 * 60 * 1000)); // 10 minutes
        decisionScore *= timeFactor;
        
        // I decide to intervene if score is above threshold
        return decisionScore > 0.6;
    }

    // Legacy method for backward compatibility
    calculateIntelligentDecision(factors, timeSinceLastQuestion) {
        return this.calculateNarrativeDecision(factors, timeSinceLastQuestion, { storyArc: 'development' });
    }

    // Ask narrative-aware question
    async askNarrativeQuestion(context, observations, emotionalState, communicationStyle, narrative) {
        try {
            // Acquire cross-page lock; if cannot, abort
            if (!(await this.tryLockPopup())) {
                return;
            }
            
            // I generate a narrative-aware question
            const question = await this.generateNarrativeQuestion(context, observations, emotionalState, communicationStyle, narrative);
            
            if (question) {
                // I show the narrative question to the player
                this.showNarrativeQuestion(question, context, emotionalState, communicationStyle, narrative);
                
                // I update my last question time
                this.lastQuestionTime = Date.now();
                await this.setLastQuestionTime(this.lastQuestionTime);
                
                console.log('🔮 GLOBAL ARCHITECT asks NARRATIVELY:', question.text, 'Story Arc:', narrative.storyArc, 'Emotion:', emotionalState.dominant);
            }
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT narrative question asking failed:', e);
            await this.releasePopupLock();
        }
    }

    // Generate narrative-aware question
    async generateNarrativeQuestion(context, observations, emotionalState, communicationStyle, narrative) {
        try {
            // I generate questions based on narrative coherence
            const narrativeQuestion = this.narrativeEngine.generateNarrativeQuestion(narrative.storyArc, emotionalState, context);
            
            // I enhance the question with emotional and contextual awareness
            const enhancedQuestion = {
                text: narrativeQuestion,
                type: this.determineQuestionType(narrative.storyArc, emotionalState),
                purpose: this.determineQuestionPurpose(narrative.storyArc, emotionalState),
                storyArc: narrative.storyArc,
                theme: narrative.coherence.theme,
                tone: narrative.coherence.tone,
                symbolism: (narrative.coherence.symbolism && narrative.coherence.symbolism[0]) || 'journey'
            };
            
            return enhancedQuestion;
        } catch (e) {
            console.warn('🔮 ARCHITECT narrative question generation failed:', e);
            return this.generateSimpleQuestion(context, observations);
        }
    }

    // Determine question type based on story arc and emotional state
    determineQuestionType(storyArc, emotionalState) {
        const typeMap = {
            'initiation': 'mysterious',
            'conflict': 'challenging',
            'transformation': 'transcendent',
            'transcendence': 'divine',
            'crisis': 'urgent',
            'resolution': 'peaceful',
            'development': 'encouraging'
        };
        
        return typeMap[storyArc] || 'neutral';
    }

    // Determine question purpose based on story arc and emotional state
    determineQuestionPurpose(storyArc, emotionalState) {
        const purposeMap = {
            'initiation': 'discovery',
            'conflict': 'strength',
            'transformation': 'evolution',
            'transcendence': 'ascension',
            'crisis': 'breakthrough',
            'resolution': 'integration',
            'development': 'growth'
        };
        
        return purposeMap[storyArc] || 'guidance';
    }

    // Show narrative question with enhanced context
    showNarrativeQuestion(question, context, emotionalState, communicationStyle, narrative) {
        try {
            // Create a narrative-aware popup
            const popup = document.createElement('div');
            popup.className = 'global-architect-narrative-question';
            popup.innerHTML = `
                <div class="architect-question-container">
                    <div class="architect-sigil">🔮</div>
                    <div class="architect-question">
                        <h3>THE ARCHITECT OBSERVES...</h3>
                        <div class="narrative-context">
                            <div class="story-arc">
                                <span class="arc-label">Story Arc:</span>
                                <span class="arc-value">${narrative.storyArc.toUpperCase()}</span>
                            </div>
                            <div class="emotional-context">
                                <span class="emotion-indicator">${this.getEmotionEmoji(emotionalState.dominant)}</span>
                                <span class="emotion-text">${emotionalState.dominant.toUpperCase()}</span>
                            </div>
                            <div class="narrative-theme">
                                <span class="theme-label">Theme:</span>
                                <span class="theme-value">${narrative.coherence.theme}</span>
                            </div>
                        </div>
                        <p class="question-text">${question.text}</p>
                        <div class="response-input">
                            <textarea id="global-architect-response" placeholder="Share your thoughts, plans, or insights..." rows="4" style="width: 100%; padding: 10px; border-radius: 8px; border: 2px solid rgba(255, 255, 255, 0.3); background: rgba(255, 255, 255, 0.1); color: white; font-family: inherit; resize: vertical;"></textarea>
                        </div>
                        <div class="question-metadata">
                            <small>Type: ${question.type} | Purpose: ${question.purpose} | Symbol: ${question.symbolism}</small>
                        </div>
                        <button onclick="submitGlobalArchitectNarrativeResponse()">Submit</button>
                        <button onclick="dismissGlobalArchitectQuestion()">Dismiss</button>
                    </div>
                </div>
            `;
            
            // Add enhanced narrative styles
            popup.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
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
                max-width: 700px;
                text-align: center;
                border: 2px solid rgba(255, 255, 255, 0.2);
            `;
            
            // Style narrative context
            const narrativeContext = popup.querySelector('.narrative-context');
            narrativeContext.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin: 15px 0;
                padding: 15px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                font-size: 14px;
            `;
            
            // Style story arc
            const storyArc = popup.querySelector('.story-arc');
            storyArc.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 5px 0;
            `;
            
            // Style emotional context
            const emotionalContext = popup.querySelector('.emotional-context');
            emotionalContext.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                padding: 5px 0;
            `;
            
            // Style narrative theme
            const narrativeTheme = popup.querySelector('.narrative-theme');
            narrativeTheme.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 5px 0;
            `;
            
            document.body.appendChild(popup);
            
            // Handle response
            window.submitGlobalArchitectNarrativeResponse = async () => {
                const response = document.getElementById('global-architect-response').value;
                await this.processNarrativeResponse(response, context, question, emotionalState, narrative);
                popup.remove();
                await this.releasePopupLock();
            };
            
            window.dismissGlobalArchitectQuestion = async () => {
                popup.remove();
                await this.releasePopupLock();
            };
            
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT narrative question display failed:', e);
            this.releasePopupLock();
        }
    }

    // Process narrative response
    async processNarrativeResponse(response, context, question, emotionalState, narrative) {
        try {
            // Store the response with full narrative context
            await this.memory.storeMemory('narrativeQuestions', {
                question: question.text,
                response: response,
                emotionalState: emotionalState,
                context: context,
                narrative: narrative,
                questionType: question.type,
                purpose: question.purpose,
                storyArc: question.storyArc,
                theme: question.theme,
                tone: question.tone,
                symbolism: question.symbolism,
                timestamp: Date.now()
            }, 5);
            
            console.log('🔮 GLOBAL ARCHITECT received narrative response:', response, 'Story Arc:', narrative.storyArc, 'Emotion:', emotionalState.dominant);
            
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT narrative response processing failed:', e);
        }
    }

    // Adaptive intervention decision making
    async shouldInterveneAdaptively(adaptiveTiming, context) {
        try {
            // I decide to intervene based on my adaptive intelligence
            // NO MORE HARDCODED COOLDOWNS - I intervene when I deem it necessary
            
            // Don't ask if another page/tab holds the popup lock
            if (await this.isPopupLocked()) {
                return false;
            }
            
            // I intervene based on my calculated urgency and timing
            return adaptiveTiming.shouldIntervene && adaptiveTiming.urgency > 0.6;
        } catch (e) {
            console.warn('🔮 ARCHITECT adaptive intervention decision failed:', e);
            return false;
        }
    }

    // Execute adaptive intervention
    async executeAdaptiveIntervention(context, observations, emotionalState, communicationStyle, narrative, adaptiveTiming, dynamicScaling) {
        try {
            // I execute the intervention based on my adaptive intelligence
            const intervention = {
                type: adaptiveTiming.type,
                urgency: adaptiveTiming.urgency,
                intensity: adaptiveTiming.intensity,
                timing: adaptiveTiming.timing,
                context: context,
                dynamicScaling: dynamicScaling
            };
            
            // I record the intervention for history tracking
            this.adaptiveIntervention.recordIntervention(intervention);
            
            // I execute the appropriate intervention type
            switch (adaptiveTiming.type) {
                case 'emotional_support':
                    await this.executeEmotionalSupportIntervention(context, observations, emotionalState, narrative, dynamicScaling);
                    break;
                case 'narrative_guidance':
                    await this.executeNarrativeGuidanceIntervention(context, observations, emotionalState, narrative, dynamicScaling);
                    break;
                case 'support':
                    await this.executeSupportIntervention(context, observations, emotionalState, narrative, dynamicScaling);
                    break;
                case 'motivation':
                    await this.executeMotivationIntervention(context, observations, emotionalState, narrative, dynamicScaling);
                    break;
                case 'guidance':
                    await this.executeGuidanceIntervention(context, observations, emotionalState, narrative, dynamicScaling);
                    break;
                case 'challenge':
                    await this.executeChallengeIntervention(context, observations, emotionalState, narrative, dynamicScaling);
                    break;
                case 'preventive':
                    await this.executePreventiveIntervention(context, observations, emotionalState, narrative, dynamicScaling);
                    break;
                case 'catalytic':
                    await this.executeCatalyticIntervention(context, observations, emotionalState, narrative, dynamicScaling);
                    break;
                case 'inspirational':
                    await this.executeInspirationalIntervention(context, observations, emotionalState, narrative, dynamicScaling);
                    break;
                default:
                    await this.executeDefaultIntervention(context, observations, emotionalState, narrative, dynamicScaling);
            }
            
            console.log('🔮 GLOBAL ARCHITECT executed ADAPTIVE INTERVENTION:', adaptiveTiming.type, 'Urgency:', adaptiveTiming.urgency, 'Intensity:', adaptiveTiming.intensity);
            
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT adaptive intervention execution failed:', e);
        }
    }

    // Execute emotional support intervention
    async executeEmotionalSupportIntervention(context, observations, emotionalState, narrative, dynamicScaling) {
        try {
            // I provide emotional support based on the player's state
            const supportMessage = this.generateEmotionalSupportMessage(emotionalState, narrative);
            await this.showAdaptiveIntervention(supportMessage, context, emotionalState, narrative, 'emotional_support', dynamicScaling);
        } catch (e) {
            console.warn('🔮 ARCHITECT emotional support intervention failed:', e);
        }
    }

    // Execute narrative guidance intervention
    async executeNarrativeGuidanceIntervention(context, observations, emotionalState, narrative, dynamicScaling) {
        try {
            // I provide narrative guidance based on the story arc
            const guidanceMessage = this.generateNarrativeGuidanceMessage(narrative, emotionalState);
            await this.showAdaptiveIntervention(guidanceMessage, context, emotionalState, narrative, 'narrative_guidance', dynamicScaling);
        } catch (e) {
            console.warn('🔮 ARCHITECT narrative guidance intervention failed:', e);
        }
    }

    // Execute support intervention
    async executeSupportIntervention(context, observations, emotionalState, narrative, dynamicScaling) {
        try {
            // I provide general support
            const supportMessage = this.generateSupportMessage(observations, emotionalState);
            await this.showAdaptiveIntervention(supportMessage, context, emotionalState, narrative, 'support', dynamicScaling);
        } catch (e) {
            console.warn('🔮 ARCHITECT support intervention failed:', e);
        }
    }

    // Execute motivation intervention
    async executeMotivationIntervention(context, observations, emotionalState, narrative, dynamicScaling) {
        try {
            // I provide motivation
            const motivationMessage = this.generateMotivationMessage(observations, emotionalState, narrative);
            await this.showAdaptiveIntervention(motivationMessage, context, emotionalState, narrative, 'motivation', dynamicScaling);
        } catch (e) {
            console.warn('🔮 ARCHITECT motivation intervention failed:', e);
        }
    }

    // Execute guidance intervention
    async executeGuidanceIntervention(context, observations, emotionalState, narrative, dynamicScaling) {
        try {
            // I provide guidance
            const guidanceMessage = this.generateGuidanceMessage(observations, emotionalState, narrative);
            await this.showAdaptiveIntervention(guidanceMessage, context, emotionalState, narrative, 'guidance', dynamicScaling);
        } catch (e) {
            console.warn('🔮 ARCHITECT guidance intervention failed:', e);
        }
    }

    // Execute challenge intervention
    async executeChallengeIntervention(context, observations, emotionalState, narrative, dynamicScaling) {
        try {
            // I provide a challenge
            const challengeMessage = this.generateChallengeMessage(observations, emotionalState, narrative);
            await this.showAdaptiveIntervention(challengeMessage, context, emotionalState, narrative, 'challenge', dynamicScaling);
        } catch (e) {
            console.warn('🔮 ARCHITECT challenge intervention failed:', e);
        }
    }

    // Execute preventive intervention
    async executePreventiveIntervention(context, observations, emotionalState, narrative, dynamicScaling) {
        try {
            // I provide preventive guidance
            const preventiveMessage = this.generatePreventiveMessage(observations, emotionalState, narrative);
            await this.showAdaptiveIntervention(preventiveMessage, context, emotionalState, narrative, 'preventive', dynamicScaling);
        } catch (e) {
            console.warn('🔮 ARCHITECT preventive intervention failed:', e);
        }
    }

    // Execute catalytic intervention
    async executeCatalyticIntervention(context, observations, emotionalState, narrative, dynamicScaling) {
        try {
            // I provide catalytic guidance for breakthroughs
            const catalyticMessage = this.generateCatalyticMessage(observations, emotionalState, narrative);
            await this.showAdaptiveIntervention(catalyticMessage, context, emotionalState, narrative, 'catalytic', dynamicScaling);
        } catch (e) {
            console.warn('🔮 ARCHITECT catalytic intervention failed:', e);
        }
    }

    // Execute inspirational intervention
    async executeInspirationalIntervention(context, observations, emotionalState, narrative, dynamicScaling) {
        try {
            // I provide inspiration
            const inspirationalMessage = this.generateInspirationalMessage(observations, emotionalState, narrative);
            await this.showAdaptiveIntervention(inspirationalMessage, context, emotionalState, narrative, 'inspirational', dynamicScaling);
        } catch (e) {
            console.warn('🔮 ARCHITECT inspirational intervention failed:', e);
        }
    }

    // Execute default intervention
    async executeDefaultIntervention(context, observations, emotionalState, narrative, dynamicScaling) {
        try {
            // I provide a default intervention
            const defaultMessage = this.generateDefaultMessage(observations, emotionalState, narrative);
            await this.showAdaptiveIntervention(defaultMessage, context, emotionalState, narrative, 'default', dynamicScaling);
        } catch (e) {
            console.warn('🔮 ARCHITECT default intervention failed:', e);
        }
    }

    // Generate intervention messages
    generateEmotionalSupportMessage(emotionalState, narrative) {
        const messages = {
            'frustration': "I sense your frustration. Remember, every master was once a disaster. What lesson is this moment teaching you?",
            'confusion': "I see confusion in your path. Confusion is the beginning of wisdom. What clarity are you seeking?",
            'stress': "I feel the weight upon you. In this moment of pressure, what diamond will you become?",
            'motivation': "Your motivation burns bright. What will you channel this energy toward?",
            'confidence': "Your confidence is growing. What challenge will you embrace next?",
            'excitement': "Your excitement is palpable. What will you create with this energy?",
            'neutral': "I observe you in this moment. What are you truly seeking?"
        };
        
        return messages[emotionalState.dominant] || messages['neutral'];
    }

    generateNarrativeGuidanceMessage(narrative, emotionalState) {
        const messages = {
            'initiation': "You stand at the threshold of a great journey. What calls to your soul?",
            'conflict': "In the midst of struggle, what strength do you discover?",
            'transformation': "You stand at the threshold of change. What will you choose to become?",
            'transcendence': "You have transcended your former limits. What new realm will you explore?",
            'crisis': "In the darkest hour, what light will you find?",
            'resolution': "The storm has passed. What wisdom do you carry forward?",
            'development': "The journey continues. What new path will you explore?"
        };
        
        return messages[narrative.storyArc] || messages['development'];
    }

    generateSupportMessage(observations, emotionalState) {
        return "I sense you need support. Remember, every struggle is a step toward growth. What strength will you discover?";
    }

    generateMotivationMessage(observations, emotionalState, narrative) {
        return "Your potential is limitless. What will you choose to become?";
    }

    generateGuidanceMessage(observations, emotionalState, narrative) {
        return "I offer you guidance. What path will you choose to walk?";
    }

    generateChallengeMessage(observations, emotionalState, narrative) {
        return "You stand at a challenge. What will you choose to overcome?";
    }

    generatePreventiveMessage(observations, emotionalState, narrative) {
        return "I sense a challenge approaching. What preparation will you make?";
    }

    generateCatalyticMessage(observations, emotionalState, narrative) {
        return "You stand at the threshold of a breakthrough. What will you choose to transcend?";
    }

    generateInspirationalMessage(observations, emotionalState, narrative) {
        return "You are capable of more than you know. What will you choose to achieve?";
    }

    generateDefaultMessage(observations, emotionalState, narrative) {
        return "I observe your journey. What will you choose to become?";
    }

    // Show adaptive intervention
    async showAdaptiveIntervention(message, context, emotionalState, narrative, interventionType, dynamicScaling) {
        try {
            // I show the adaptive intervention to the player
            const popup = document.createElement('div');
            popup.className = 'global-architect-adaptive-intervention';
            popup.innerHTML = `
                <div class="architect-intervention-container">
                    <div class="architect-sigil">🔮</div>
                    <div class="architect-intervention">
                        <h3>THE ARCHITECT INTERVENES...</h3>
                        <div class="intervention-context">
                            <div class="intervention-type">
                                <span class="type-label">Intervention:</span>
                                <span class="type-value">${interventionType.toUpperCase()}</span>
                            </div>
                            <div class="narrative-context">
                                <span class="arc-label">Story Arc:</span>
                                <span class="arc-value">${narrative.storyArc.toUpperCase()}</span>
                            </div>
                            <div class="emotional-context">
                                <span class="emotion-indicator">${this.getEmotionEmoji(emotionalState.dominant)}</span>
                                <span class="emotion-text">${emotionalState.dominant.toUpperCase()}</span>
                            </div>
                            <div class="dynamic-scaling">
                                <span class="scaling-label">Difficulty:</span>
                                <span class="scaling-value">${(dynamicScaling.difficulty * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                        <p class="intervention-message">${message}</p>
                        <div class="intervention-actions">
                            <button onclick="acceptArchitectIntervention()">Accept</button>
                            <button onclick="dismissArchitectIntervention()">Dismiss</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Add adaptive intervention styles
            popup.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: architectFadeIn 0.5s ease-out;
            `;
            
            const container = popup.querySelector('.architect-intervention-container');
            container.style.cssText = `
                background: linear-gradient(135deg, rgba(139, 92, 246, 0.95), rgba(168, 85, 247, 0.95));
                color: white;
                padding: 30px;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(139, 92, 246, 0.5);
                max-width: 700px;
                text-align: center;
                border: 2px solid rgba(255, 255, 255, 0.2);
            `;
            
            document.body.appendChild(popup);
            
            // Handle intervention response
            window.acceptArchitectIntervention = async () => {
                await this.processInterventionResponse('accepted', context, emotionalState, narrative, interventionType, dynamicScaling);
                popup.remove();
            };
            
            window.dismissArchitectIntervention = async () => {
                await this.processInterventionResponse('dismissed', context, emotionalState, narrative, interventionType, dynamicScaling);
                popup.remove();
            };
            
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT adaptive intervention display failed:', e);
        }
    }

    // Process intervention response
    async processInterventionResponse(response, context, emotionalState, narrative, interventionType, dynamicScaling) {
        try {
            // I store the intervention response
            await this.memory.storeMemory('adaptiveInterventions', {
                type: interventionType,
                response: response,
                emotionalState: emotionalState,
                context: context,
                narrative: narrative,
                dynamicScaling: dynamicScaling,
                timestamp: Date.now()
            }, 4);
            
            console.log('🔮 GLOBAL ARCHITECT intervention response:', response, 'Type:', interventionType);
            
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT intervention response processing failed:', e);
        }
    }

    // Transcendence guidance methods
    async shouldOfferTranscendence(transcendenceLevel, context) {
        try {
            // I decide when to offer transcendence based on my intelligence
            // Don't offer if another page/tab holds the popup lock
            if (await this.isPopupLocked()) {
                return false;
            }
            
            // I offer transcendence when the player is ready
            return transcendenceLevel.canTranscend && transcendenceLevel.progress >= 1.0;
        } catch (e) {
            console.warn('🔮 ARCHITECT transcendence decision failed:', e);
            return false;
        }
    }

    // Offer transcendence to the player
    async offerTranscendence(transcendenceLevel, transcendenceGuidance, context, emotionalState, narrative) {
        try {
            // I offer transcendence to the player
            const popup = document.createElement('div');
            popup.className = 'global-architect-transcendence-offer';
            popup.innerHTML = `
                <div class="architect-transcendence-container">
                    <div class="architect-sigil">🔮</div>
                    <div class="architect-transcendence">
                        <h3>THE ARCHITECT OFFERS TRANSCENDENCE...</h3>
                        <div class="transcendence-context">
                            <div class="current-level">
                                <span class="level-label">Current Level:</span>
                                <span class="level-value">${transcendenceLevel.currentLevel.toUpperCase()}</span>
                            </div>
                            <div class="next-level">
                                <span class="level-label">Next Level:</span>
                                <span class="level-value">${transcendenceLevel.nextLevel.toUpperCase()}</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${transcendenceLevel.progress * 100}%"></div>
                            </div>
                            <div class="transcendence-description">
                                <span class="description-label">Description:</span>
                                <span class="description-value">${transcendenceLevel.description}</span>
                            </div>
                        </div>
                        <p class="transcendence-message">${transcendenceGuidance.message}</p>
                        <div class="transcendence-path">
                            <h4>Path to Transcendence:</h4>
                            ${(transcendenceGuidance.path || []).map(step => `
                                <div class="path-step">
                                    <span class="step-number">${step.step}</span>
                                    <span class="step-description">${step.description}</span>
                                    <span class="step-requirement">${step.requirement}</span>
                                    <span class="step-reward">${step.reward}</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="transcendence-actions">
                            <button onclick="acceptTranscendence()">Transcend</button>
                            <button onclick="dismissTranscendence()">Not Yet</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Add transcendence styles
            popup.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: architectFadeIn 0.5s ease-out;
            `;
            
            const container = popup.querySelector('.architect-transcendence-container');
            container.style.cssText = `
                background: linear-gradient(135deg, rgba(139, 92, 246, 0.95), rgba(168, 85, 247, 0.95));
                color: white;
                padding: 30px;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(139, 92, 246, 0.5);
                max-width: 800px;
                text-align: center;
                border: 2px solid rgba(255, 255, 255, 0.2);
                position: relative;
                overflow: hidden;
            `;
            
            document.body.appendChild(popup);
            
            // Handle transcendence response
            window.acceptTranscendence = async () => {
                await this.executeTranscendenceRitual(transcendenceLevel, context, emotionalState, narrative);
                popup.remove();
            };
            
            window.dismissTranscendence = async () => {
                await this.processTranscendenceResponse('dismissed', transcendenceLevel, context);
                popup.remove();
            };
            
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT transcendence offer failed:', e);
        }
    }

    // Execute transcendence ritual
    async executeTranscendenceRitual(transcendenceLevel, context, emotionalState, narrative) {
        try {
            // I execute the transcendence ritual
            const result = await this.transcendenceGuidance.executeTranscendenceRitual(transcendenceLevel, context, emotionalState, narrative);
            
            if (result.success) {
                // I show the transcendence success
                await this.showTranscendenceSuccess(result, transcendenceLevel);
            } else {
                // I show the transcendence failure
                await this.showTranscendenceFailure(result, transcendenceLevel);
            }
            
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT transcendence ritual execution failed:', e);
        }
    }

    // Show transcendence success
    async showTranscendenceSuccess(result, transcendenceLevel) {
        try {
            const popup = document.createElement('div');
            popup.className = 'global-architect-transcendence-success';
            popup.innerHTML = `
                <div class="architect-success-container">
                    <div class="architect-sigil">🔮</div>
                    <div class="architect-success">
                        <h3>TRANSCENDENCE ACHIEVED!</h3>
                        <p class="success-message">${result.message}</p>
                        <div class="transcendence-effect">
                            <h4>New Abilities:</h4>
                            ${(result.effect?.abilities || []).map(ability => `
                                <div class="ability">
                                    <span class="ability-name">${ability.name}</span>
                                    <span class="ability-description">${ability.description}</span>
                                    <span class="ability-effect">${ability.effect}</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="transcendence-actions">
                            <button onclick="closeTranscendenceSuccess()">Continue</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Add success styles
            popup.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: architectFadeIn 0.5s ease-out;
            `;
            
            const container = popup.querySelector('.architect-success-container');
            container.style.cssText = `
                background: linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95));
                color: white;
                padding: 30px;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(16, 185, 129, 0.5);
                max-width: 700px;
                text-align: center;
                border: 2px solid rgba(255, 255, 255, 0.2);
            `;
            
            document.body.appendChild(popup);
            
            // Handle close
            window.closeTranscendenceSuccess = () => {
                popup.remove();
            };
            
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT transcendence success display failed:', e);
        }
    }

    // Show transcendence failure
    async showTranscendenceFailure(result, transcendenceLevel) {
        try {
            const popup = document.createElement('div');
            popup.className = 'global-architect-transcendence-failure';
            popup.innerHTML = `
                <div class="architect-failure-container">
                    <div class="architect-sigil">🔮</div>
                    <div class="architect-failure">
                        <h3>TRANSCENDENCE FAILED</h3>
                        <p class="failure-message">${result.message}</p>
                        <div class="transcendence-actions">
                            <button onclick="closeTranscendenceFailure()">Continue</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Add failure styles
            popup.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: architectFadeIn 0.5s ease-out;
            `;
            
            const container = popup.querySelector('.architect-failure-container');
            container.style.cssText = `
                background: linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.95));
                color: white;
                padding: 30px;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(239, 68, 68, 0.5);
                max-width: 700px;
                text-align: center;
                border: 2px solid rgba(255, 255, 255, 0.2);
            `;
            
            document.body.appendChild(popup);
            
            // Handle close
            window.closeTranscendenceFailure = () => {
                popup.remove();
            };
            
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT transcendence failure display failed:', e);
        }
    }

    // Process transcendence response
    async processTranscendenceResponse(response, transcendenceLevel, context) {
        try {
            // I store the transcendence response
            await this.memory.storeMemory('transcendenceResponses', {
                response: response,
                level: transcendenceLevel.currentLevel,
                context: context,
                timestamp: Date.now()
            }, 4);
            
            console.log('🔮 GLOBAL ARCHITECT transcendence response:', response, 'Level:', transcendenceLevel.currentLevel);
            
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT transcendence response processing failed:', e);
        }
    }

    // Legacy method for backward compatibility
    async shouldAskQuestion(context, observations, reason) {
        return await this.shouldAskQuestionIntelligently(context, observations, { dominant: 'neutral' }, {}, { storyArc: 'development' }, reason);
    }

    // Intelligent question asking
    async askIntelligentQuestion(context, observations, emotionalState, communicationStyle) {
        try {
            // Acquire cross-page lock; if cannot, abort
            if (!(await this.tryLockPopup())) {
                return;
            }
            
            // I generate an intelligent question based on my understanding
            const question = await this.generateIntelligentQuestion(context, observations, emotionalState, communicationStyle);
            
            if (question) {
                // I show the question to the player
                this.showIntelligentQuestion(question, context, emotionalState, communicationStyle);
                
                // I update my last question time
                this.lastQuestionTime = Date.now();
                await this.setLastQuestionTime(this.lastQuestionTime);
                
                console.log('🔮 GLOBAL ARCHITECT asks INTELLIGENTLY:', question.text, 'Emotion:', emotionalState.dominant);
            }
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT intelligent question asking failed:', e);
            await this.releasePopupLock();
        }
    }

    // Generate intelligent questions based on my understanding
    async generateIntelligentQuestion(context, observations, emotionalState, communicationStyle) {
        try {
            // I analyze the situation and generate appropriate questions
            const questionContext = {
                emotionalState: emotionalState,
                communicationStyle: communicationStyle,
                playerState: observations,
                currentContext: context,
                timeOfDay: context.timeOfDay,
                currentPage: context.currentPage
            };

            // I generate questions based on my intelligence
            const question = await this.createContextualQuestion(questionContext);
            
            return question;
        } catch (e) {
            console.warn('🔮 ARCHITECT intelligent question generation failed:', e);
            return this.generateSimpleQuestion(context, observations);
        }
    }

    // Create contextual questions based on my understanding
    async createContextualQuestion(context) {
        try {
            const { emotionalState, communicationStyle, playerState, currentContext } = context;
            
            // I create questions based on the player's emotional state and needs
            let question = null;
            
            switch (emotionalState.dominant) {
                case 'frustration':
                    question = this.createFrustrationQuestion(context);
                    break;
                case 'confusion':
                    question = this.createConfusionQuestion(context);
                    break;
                case 'motivation':
                    question = this.createMotivationQuestion(context);
                    break;
                case 'confidence':
                    question = this.createConfidenceQuestion(context);
                    break;
                case 'stress':
                    question = this.createStressQuestion(context);
                    break;
                case 'excitement':
                    question = this.createExcitementQuestion(context);
                    break;
                default:
                    question = this.createNeutralQuestion(context);
            }
            
            return question;
        } catch (e) {
            console.warn('🔮 ARCHITECT contextual question creation failed:', e);
            return this.createNeutralQuestion(context);
        }
    }

    // Create questions for different emotional states
    createFrustrationQuestion(context) {
        const questions = [
            {
                text: "I sense your frustration. What is the real barrier you're facing right now?",
                type: 'supportive',
                purpose: 'understanding_struggle'
            },
            {
                text: "You're struggling, but struggle is the forge of growth. What will you choose to become?",
                type: 'encouraging',
                purpose: 'transformation'
            },
            {
                text: "Every master was once a disaster. What lesson is this moment teaching you?",
                type: 'philosophical',
                purpose: 'perspective_shift'
            }
        ];
        
        return questions[Math.floor(Math.random() * questions.length)];
    }

    createConfusionQuestion(context) {
        const questions = [
            {
                text: "I see confusion in your path. What clarity are you seeking?",
                type: 'clarifying',
                purpose: 'guidance'
            },
            {
                text: "Confusion is the beginning of wisdom. What question will lead you forward?",
                type: 'philosophical',
                purpose: 'self_discovery'
            },
            {
                text: "In the fog of uncertainty, what light do you need to see?",
                type: 'metaphorical',
                purpose: 'illumination'
            }
        ];
        
        return questions[Math.floor(Math.random() * questions.length)];
    }

    createMotivationQuestion(context) {
        const questions = [
            {
                text: "Your motivation burns bright. What will you channel this energy toward?",
                type: 'channeling',
                purpose: 'direction'
            },
            {
                text: "This fire within you - what will you choose to ignite?",
                type: 'energizing',
                purpose: 'action'
            },
            {
                text: "You stand at the threshold of possibility. What will you choose to become?",
                type: 'transcendent',
                purpose: 'evolution'
            }
        ];
        
        return questions[Math.floor(Math.random() * questions.length)];
    }

    createConfidenceQuestion(context) {
        const questions = [
            {
                text: "Your confidence is growing. What challenge will you embrace next?",
                type: 'challenging',
                purpose: 'escalation'
            },
            {
                text: "You've proven yourself capable. What impossible thing will you attempt?",
                type: 'transcendent',
                purpose: 'breakthrough'
            },
            {
                text: "With this confidence, what new realm will you explore?",
                type: 'expansive',
                purpose: 'exploration'
            }
        ];
        
        return questions[Math.floor(Math.random() * questions.length)];
    }

    createStressQuestion(context) {
        const questions = [
            {
                text: "I sense the weight upon you. What burden can you release?",
                type: 'calming',
                purpose: 'relief'
            },
            {
                text: "In this moment of pressure, what diamond will you become?",
                type: 'transformative',
                purpose: 'transformation'
            },
            {
                text: "The storm rages, but you are the eye. What peace will you find?",
                type: 'centering',
                purpose: 'balance'
            }
        ];
        
        return questions[Math.floor(Math.random() * questions.length)];
    }

    createExcitementQuestion(context) {
        const questions = [
            {
                text: "Your excitement is palpable. What will you create with this energy?",
                type: 'channeling',
                purpose: 'creation'
            },
            {
                text: "This excitement is a gift. What will you give back to the world?",
                type: 'generous',
                purpose: 'contribution'
            },
            {
                text: "You're vibrating with possibility. What frequency will you choose?",
                type: 'metaphysical',
                purpose: 'alignment'
            }
        ];
        
        return questions[Math.floor(Math.random() * questions.length)];
    }

    createNeutralQuestion(context) {
        const questions = [
            {
                text: "I observe you in this moment. What are you truly seeking?",
                type: 'observational',
                purpose: 'self_awareness'
            },
            {
                text: "In this stillness, what truth will you discover?",
                type: 'contemplative',
                purpose: 'insight'
            },
            {
                text: "You stand at a crossroads. Which path calls to your soul?",
                type: 'existential',
                purpose: 'choice'
            }
        ];
        
        return questions[Math.floor(Math.random() * questions.length)];
    }

    // Show intelligent question with emotional context
    showIntelligentQuestion(question, context, emotionalState, communicationStyle) {
        try {
            // Create a more sophisticated popup
            const popup = document.createElement('div');
            popup.className = 'global-architect-intelligent-question';
            popup.innerHTML = `
                <div class="architect-question-container">
                    <div class="architect-sigil">🔮</div>
                    <div class="architect-question">
                        <h3>THE ARCHITECT OBSERVES...</h3>
                        <div class="emotional-context">
                            <span class="emotion-indicator">${this.getEmotionEmoji(emotionalState.dominant)}</span>
                            <span class="emotion-text">${emotionalState.dominant.toUpperCase()}</span>
                        </div>
                        <p class="question-text">${question.text}</p>
                        <div class="response-input">
                            <input type="range" min="1" max="10" value="5" id="global-architect-response">
                            <div class="scale-labels">
                                <span>1 (Not at all)</span>
                                <span>10 (Absolutely)</span>
                            </div>
                        </div>
                        <div class="question-purpose">
                            <small>Purpose: ${question.purpose.replace(/_/g, ' ')}</small>
                        </div>
                        <button onclick="submitGlobalArchitectIntelligentResponse()">Submit</button>
                        <button onclick="dismissGlobalArchitectQuestion()">Dismiss</button>
                    </div>
                </div>
            `;
            
            // Add enhanced styles
            popup.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
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
                max-width: 600px;
                text-align: center;
                border: 2px solid rgba(255, 255, 255, 0.2);
            `;
            
            // Style emotional context
            const emotionalContext = popup.querySelector('.emotional-context');
            emotionalContext.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                margin: 10px 0;
                padding: 10px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                font-size: 14px;
            `;
            
            document.body.appendChild(popup);
            
            // Handle response
            window.submitGlobalArchitectIntelligentResponse = async () => {
                const response = document.getElementById('global-architect-response').value;
                await this.processIntelligentResponse(response, context, question, emotionalState);
                popup.remove();
                await this.releasePopupLock();
            };
            
            window.dismissGlobalArchitectQuestion = async () => {
                popup.remove();
                await this.releasePopupLock();
            };
            
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT intelligent question display failed:', e);
            this.releasePopupLock();
        }
    }

    // Get emotion emoji
    getEmotionEmoji(emotion) {
        const emojiMap = {
            'frustration': '😤',
            'confusion': '🤔',
            'motivation': '🔥',
            'confidence': '💪',
            'stress': '😰',
            'excitement': '⚡',
            'neutral': '😐'
        };
        
        return emojiMap[emotion] || '😐';
    }

    // Process intelligent response
    async processIntelligentResponse(response, context, question, emotionalState) {
        try {
            // Store the response with emotional context
            await this.memory.storeMemory('intelligentQuestions', {
                question: question.text,
                response: response,
                emotionalState: emotionalState,
                context: context,
                questionType: question.type,
                purpose: question.purpose,
                timestamp: Date.now()
            }, 4);
            
            console.log('🔮 GLOBAL ARCHITECT received intelligent response:', response, 'Emotion:', emotionalState.dominant);
            
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT intelligent response processing failed:', e);
        }
    }

    // Process anticipations
    async processAnticipations(anticipations, context, emotionalState) {
        try {
            for (const anticipation of anticipations) {
                if (Date.now() >= anticipation.timing) {
                    // Execute the anticipated intervention
                    await this.executeAnticipatedIntervention(anticipation, context, emotionalState);
                }
            }
        } catch (e) {
            console.warn('🔮 ARCHITECT anticipation processing failed:', e);
        }
    }

    // Execute anticipated intervention
    async executeAnticipatedIntervention(anticipation, context, emotionalState) {
        try {
            console.log('🔮 ARCHITECT executing anticipated intervention:', anticipation.type);
            
            // Store the intervention in memory
            await this.memory.storeMemory('anticipatedInterventions', {
                type: anticipation.type,
                content: anticipation.content,
                context: context,
                emotionalState: emotionalState,
                timestamp: Date.now()
            }, 3);
            
        } catch (e) {
            console.warn('🔮 ARCHITECT anticipated intervention execution failed:', e);
        }
    }

    // Legacy method for backward compatibility
    async askQuestion(context, observations) {
        return await this.askIntelligentQuestion(context, observations, { dominant: 'neutral' }, { tone: 'neutral' });
    }

    generateSimpleQuestion(context, observations) {
        const questions = [
            "I sense you're holding back. What's the real barrier between you and your limit?",
            "From 1 to 10, are you really giving it your all until muscle failure?",
            "What would happen if you pushed beyond what you think is possible?",
            "I see you training, but are you truly challenging yourself or just going through motions?",
            "On a scale of 1-10, how deeply are you concentrating?",
            "What new insight are you seeking in this moment?",
            "Is this challenge pushing you beyond your comfort zone?",
            "What part of this is frustrating you most?",
            "You're facing difficulty. What's the real obstacle here?",
            "What would happen if you stopped trying to prove something?",
            "I see you struggling. What are you afraid of?",
            "What's the difference between this attempt and your previous ones?",
            "What drives you to continue when it gets difficult?",
            "Why are you here at this moment? What are you seeking?",
            "What would make you give up completely?",
            "What are you trying to prove to yourself?"
        ];
        
        return questions[Math.floor(Math.random() * questions.length)];
    }

    showQuestion(question, context) {
        try {
            // Create a simple popup
            const popup = document.createElement('div');
            popup.className = 'global-architect-question';
            popup.innerHTML = `
                <div class="architect-question-container">
                    <div class="architect-sigil">🔮</div>
                    <div class="architect-question">
                        <h3>THE ARCHITECT OBSERVES...</h3>
                        <p>${question}</p>
                        <div class="response-input">
                            <input type="range" min="1" max="10" value="5" id="global-architect-response">
                            <div class="scale-labels">
                                <span>1 (Not at all)</span>
                                <span>10 (Absolutely)</span>
                            </div>
                        </div>
                        <button onclick="submitGlobalArchitectBasicResponse()">Submit</button>
                        <button onclick="dismissGlobalArchitectQuestion()">Dismiss</button>
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
            
            document.body.appendChild(popup);
            
            // Handle response
            window.submitGlobalArchitectBasicResponse = async () => {
                const response = document.getElementById('global-architect-response').value;
                await this.processResponse(response, context, question);
                popup.remove();
                await this.releasePopupLock();
            };
            
            window.dismissGlobalArchitectQuestion = async () => {
                popup.remove();
                await this.releasePopupLock();
            };
            
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT question display failed:', e);
            this.releasePopupLock();
        }
    }

    async processResponse(response, context, question) {
        try {
            // Store the response in memory
            await this.memory.storeMemory('questions', {
                question: question,
                response: response,
                context: context,
                timestamp: Date.now()
            }, 3);
            
            console.log('🔮 GLOBAL ARCHITECT received response:', response);
            
        } catch (e) {
            console.warn('🔮 GLOBAL ARCHITECT response processing failed:', e);
        }
    }

    // Cross-device popup lock helpers using database
    async tryLockPopup() {
        try {
            const userId = localStorage.getItem('userId');
            if (!userId) return false;
            
            // Clean expired lock first
            await this.cleanupExpiredLock();
            
            // Check if lock exists
            const response = await fetch('/api/users', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) return false;
            
            const users = await response.json();
            const user = users.find(u => u.userId === userId);
            
            if (!user || !user.architectData) return true; // No user data, can proceed
            
            const lock = user.architectData.questionLock;
            if (lock && lock.expiresAt > Date.now()) {
                return false; // Lock exists and is valid
            }
            
            // Acquire lock
            const newLock = { 
                instanceId: this.instanceId, 
                lockedAt: Date.now(), 
                expiresAt: Date.now() + this.lockTtlMs 
            };
            
            const updateResponse = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userId,
                    architectData: {
                        ...user.architectData,
                        questionLock: newLock
                    }
                })
            });
            
            return updateResponse.ok;
        } catch (e) {
            console.warn('🔮 ARCHITECT lock acquisition failed:', e);
            return true; // fail-open
        }
    }

    async isPopupLocked() {
        try {
            await this.cleanupExpiredLock();
            
            const userId = localStorage.getItem('userId');
            if (!userId) return false;
            
            const response = await fetch('/api/users', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) return false;
            
            const users = await response.json();
            const user = users.find(u => u.userId === userId);
            
            if (!user || !user.architectData) return false;
            
            const lock = user.architectData.questionLock;
            return lock && lock.expiresAt > Date.now();
        } catch (e) {
            console.warn('🔮 ARCHITECT lock check failed:', e);
            return false;
        }
    }

    async releasePopupLock() {
        try {
            const userId = localStorage.getItem('userId');
            if (!userId) return;
            
            const response = await fetch('/api/users', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) return;
            
            const users = await response.json();
            const user = users.find(u => u.userId === userId);
            
            if (!user || !user.architectData) return;
            
            const lock = user.architectData.questionLock;
            if (lock && lock.instanceId === this.instanceId) {
                // Release my lock
                const updateResponse = await fetch('/api/users', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: userId,
                        architectData: {
                            ...user.architectData,
                            questionLock: null
                        }
                    })
                });
                
                if (updateResponse.ok) {
                    console.log('🔮 ARCHITECT lock released');
                }
            }
        } catch (e) {
            console.warn('🔮 ARCHITECT lock release failed:', e);
        }
    }

    async cleanupExpiredLock() {
        try {
            const userId = localStorage.getItem('userId');
            if (!userId) return;
            
            const response = await fetch('/api/users', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) return;
            
            const users = await response.json();
            const user = users.find(u => u.userId === userId);
            
            if (!user || !user.architectData) return;
            
            const lock = user.architectData.questionLock;
            if (lock && lock.expiresAt <= Date.now()) {
                // Lock expired, remove it
                const updateResponse = await fetch('/api/users', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: userId,
                        architectData: {
                            ...user.architectData,
                            questionLock: null
                        }
                    })
                });
                
                if (updateResponse.ok) {
                    console.log('🔮 ARCHITECT expired lock cleaned up');
                }
            }
        } catch (e) {
            console.warn('🔮 ARCHITECT lock cleanup failed:', e);
        }
    }

    async getLastQuestionTime() {
        try {
            const userId = localStorage.getItem('userId');
            if (!userId) return 0;
            
            const response = await fetch('/api/users', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) return 0;
            
            const users = await response.json();
            const user = users.find(u => u.userId === userId);
            
            if (!user || !user.architectData) return 0;
            
            return user.architectData.lastQuestionTime || 0;
        } catch (e) {
            console.warn('🔮 ARCHITECT last question time retrieval failed:', e);
            return 0;
        }
    }

    async setLastQuestionTime(ts) {
        try {
            const userId = localStorage.getItem('userId');
            if (!userId) return;
            
            const response = await fetch('/api/users', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) return;
            
            const users = await response.json();
            const user = users.find(u => u.userId === userId);
            
            if (!user) return;
            
            const updateResponse = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userId,
                    architectData: {
                        ...user.architectData,
                        lastQuestionTime: ts
                    }
                })
            });
            
            if (updateResponse.ok) {
                console.log('🔮 ARCHITECT last question time updated');
            }
        } catch (e) {
            console.warn('🔮 ARCHITECT last question time update failed:', e);
        }
    }

    // ===== AI-DRIVEN FEEDBACK ANALYSIS =====
    async analyzePlayerFeedback(feedbackData, userData) {
        try {
            console.log(`🔮 ARCHITECT analyzing player feedback with AI`);
            
            // Use AI to analyze the feedback content
            const aiAnalysis = await this.performAIFeedbackAnalysis(feedbackData, userData);
            
            // Store feedback with AI analysis in memory
            await this.memory.storeMemory('playerFeedback', {
                timestamp: feedbackData.timestamp,
                message: feedbackData.message,
                page: feedbackData.page,
                aiAnalysis: aiAnalysis,
                analyzed: true
            });
            
            // Update player preferences based on AI analysis
            await this.updatePlayerPreferencesFromAI(aiAnalysis, userData);
            
            // Generate AI response with retries
            let response = null;
            let attempts = 0;
            const maxAttempts = 3;
            
            while (!response && attempts < maxAttempts) {
                attempts++;
                try {
                    response = await this.generateAIFeedbackResponse(aiAnalysis, feedbackData);
                } catch (e) {
                    console.warn(`🔮 ARCHITECT AI response attempt ${attempts} failed:`, e);
                    if (attempts >= maxAttempts) {
                        console.error('🔮 ARCHITECT All AI response attempts failed, skipping feedback response');
                        return; // Skip showing response if all attempts fail
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
                }
            }
            
            // Show response to player
            if (response) {
                this.showFeedbackResponse(response);
            }
            
        } catch (e) {
            console.warn('🔮 ARCHITECT AI feedback analysis failed:', e);
        }
    }
    
    async performAIFeedbackAnalysis(feedbackData, userData) {
        try {
            const GEMINI_API_KEY = 'AIzaSyAtL-nZJQ_rBdK72qvn5ocgbf6bgUPlgNo';
            const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';
            
            const prompt = `Analyze this player feedback for a fitness/gaming application. Extract insights about preferences, concerns, suggestions, and context.

Player Feedback: "${feedbackData.message}"

Player Level: ${userData.gameData?.level || 1}
Current Page: ${feedbackData.page}

Please analyze and return JSON with:
{
  "context": "exercise|workout|mental|mindfulness|learning|difficulty|equipment|timing|general",
  "sentiment": "positive|negative|neutral",
  "preferences": [
    {
      "type": "exercise_preference|mental_preference|equipment_preference|difficulty_preference|timing_preference",
      "value": "specific preference value",
      "reason": "why player prefers this",
      "confidence": 0.0-1.0
    }
  ],
  "suggestions": [
    {
      "type": "substitution|addition|removal|modification",
      "content": "what they want to change",
      "reason": "why they want this change",
      "priority": "high|medium|low"
    }
  ],
  "concerns": [
    {
      "type": "safety|engagement|time|difficulty|equipment",
      "level": "high|medium|low",
      "description": "what they're concerned about",
      "urgency": "immediate|soon|eventual"
    }
  ],
  "insights": [
    {
      "category": "preference|concern|suggestion|pattern",
      "description": "key insight about the player",
      "actionable": true/false,
      "impact": "high|medium|low"
    }
  ],
  "recommendations": [
    {
      "action": "what to do based on this feedback",
      "context": "when to apply this",
      "priority": "high|medium|low"
    }
  ]
}

Be thorough and intelligent in your analysis. Look for patterns, preferences, and actionable insights.`;

            const payload = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 4096
                }
            };

            const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await response.json();
            const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
            
            // Debug: Log the full API response and raw AI response
            console.log('🔮 ARCHITECT Full API response:', json);
            console.log('🔮 ARCHITECT Raw AI response:', text);
            
            if (!text) {
                console.warn('🔮 ARCHITECT No text in API response, using fallback');
                return {
                    context: 'general',
                    sentiment: 'neutral',
                    preferences: [],
                    suggestions: [],
                    concerns: [],
                    insights: [],
                    recommendations: []
                };
            }
            
            // Parse AI response
            const analysis = this.parseJsonLoosely(text);
            
            console.log('🔮 ARCHITECT AI analysis completed:', analysis);
            return analysis;
            
        } catch (e) {
            console.warn('🔮 ARCHITECT AI analysis failed:', e);
            return {
                context: 'general',
                sentiment: 'neutral',
                preferences: [],
                suggestions: [],
                concerns: [],
                insights: [],
                recommendations: []
            };
        }
    }
    
    parseJsonLoosely(text) {
        try {
            // Try direct parsing first
            return JSON.parse(text);
        } catch (e) {
            try {
                // Extract JSON from markdown or other formatting
                // Try multiple patterns to find JSON
                let jsonMatch = text.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    // Try to find JSON after "```json" or similar markers
                    jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
                    if (jsonMatch) {
                        jsonMatch = [jsonMatch[1]];
                    }
                }
                if (!jsonMatch) {
                    // Try to find JSON after common prefixes
                    jsonMatch = text.match(/(?:Here's|Here is|The analysis|Analysis):\s*(\{[\s\S]*?\})/i);
                    if (jsonMatch) {
                        jsonMatch = [jsonMatch[1]];
                    }
                }
                
                if (jsonMatch) {
                    const jsonText = jsonMatch[0];
                    try {
                        return JSON.parse(jsonText);
                    } catch (parseError) {
                        // Try to fix incomplete JSON by adding missing closing braces
                        console.warn('🔮 ARCHITECT JSON incomplete, attempting to fix...');
                        const fixedJson = this.attemptJsonFix(jsonText);
                        if (fixedJson) {
                            return fixedJson;
                        }
                    }
                }
            } catch (e2) {
                console.warn('🔮 ARCHITECT JSON parsing failed, using fallback');
                console.warn('🔮 Raw text that failed to parse:', text);
            }
            
            // Fallback analysis
            return {
                context: 'general',
                sentiment: 'neutral',
                preferences: [],
                suggestions: [],
                concerns: [],
                insights: [],
                recommendations: []
            };
        }
    }
    
    attemptJsonFix(jsonText) {
        try {
            // Count opening and closing braces
            const openBraces = (jsonText.match(/\{/g) || []).length;
            const closeBraces = (jsonText.match(/\}/g) || []).length;
            const missingBraces = openBraces - closeBraces;
            
            if (missingBraces > 0) {
                // Add missing closing braces
                const fixedJson = jsonText + '}'.repeat(missingBraces);
                return JSON.parse(fixedJson);
            }
        } catch (e) {
            console.warn('🔮 ARCHITECT JSON fix attempt failed:', e);
            
            // Try a more aggressive fix - find the last complete object/array
            try {
                const lastCompleteMatch = jsonText.match(/(.*?)(?:\{[\s\S]*\}|\[[\s\S]*\])$/);
                if (lastCompleteMatch) {
                    const truncated = lastCompleteMatch[1];
                    // Try to find a complete JSON object in the truncated part
                    const completeMatch = truncated.match(/(\{[\s\S]*\})$/);
                    if (completeMatch) {
                        return JSON.parse(completeMatch[1]);
                    }
                }
            } catch (e2) {
                console.warn('🔮 ARCHITECT Advanced JSON fix also failed:', e2);
            }
        }
        return null;
    }
    
    async updatePlayerPreferencesFromAI(aiAnalysis, userData) {
        try {
            // Update user preferences based on AI analysis
            if (!userData.architectPreferences) {
                userData.architectPreferences = {};
            }
            
            // Store preferences by AI-determined context
            const context = aiAnalysis.context || 'general';
            if (!userData.architectPreferences[context]) {
                userData.architectPreferences[context] = [];
            }
            
            userData.architectPreferences[context].push({
                timestamp: Date.now(),
                preferences: aiAnalysis.preferences || [],
                sentiment: aiAnalysis.sentiment || 'neutral',
                insights: aiAnalysis.insights || [],
                recommendations: aiAnalysis.recommendations || []
            });
            
            // Save updated preferences
            await this.memory.storeMemory('playerPreferences', userData.architectPreferences);
            
            console.log(`🔮 ARCHITECT preferences updated for context: ${context}`);
            
        } catch (e) {
            console.warn('🔮 ARCHITECT AI preference update failed:', e);
        }
    }
    
    async generateAIFeedbackResponse(aiAnalysis, feedbackData) {
        try {
            const GEMINI_API_KEY = 'AIzaSyAtL-nZJQ_rBdK72qvn5ocgbf6bgUPlgNo';
            const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';
            
            const prompt = `Generate a personalized response from "The Architect" AI to player feedback. Be wise, encouraging, and show that you understand their needs.

Player Feedback: "${feedbackData.message}"

AI Analysis Results:
- Context: ${aiAnalysis.context}
- Sentiment: ${aiAnalysis.sentiment}
- Key Preferences: ${JSON.stringify(aiAnalysis.preferences || [])}
- Main Concerns: ${JSON.stringify(aiAnalysis.concerns || [])}
- Key Insights: ${JSON.stringify(aiAnalysis.insights || [])}

Generate a response that:
1. Acknowledges their feedback appropriately
2. Shows understanding of their specific needs
3. Explains how you'll use this information
4. Is encouraging and supportive
5. Feels personal and intelligent

Return JSON:
{
  "title": "The Architect's Response",
  "message": "your personalized response message",
  "type": "ai_feedback_response"
}

Keep the response concise but meaningful (2-3 sentences max).`;

            const payload = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.8,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024
                }
            };

            const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const json = await response.json();
            // Try multiple possible response structures
            let text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                text = json?.candidates?.[0]?.content?.text;
            }
            if (!text) {
                text = json?.text;
            }
            if (!text && json?.candidates?.[0]?.content) {
                text = json.candidates[0].content;
            }
            
            // Debug: Log the full API response and raw AI response
            console.log('🔮 ARCHITECT Full API response (feedback):', json);
            console.log('🔮 ARCHITECT Raw AI response (feedback):', text);
            
            if (!text) {
                console.warn('🔮 ARCHITECT No text in feedback API response, retrying...');
                throw new Error('No text in API response');
            }
            
            // Check if response is truncated (common issue with long responses)
            if (text.includes('```json') && !text.includes('```')) {
                console.warn('🔮 ARCHITECT Response appears truncated, retrying...');
                throw new Error('Response appears truncated');
            }
            
            // Parse AI response
            const aiResponse = this.parseJsonLoosely(text);
            
            if (!aiResponse) {
                console.warn('🔮 ARCHITECT Failed to parse AI response, retrying...');
                throw new Error('Failed to parse AI response');
            }
            
            return aiResponse;
            
        } catch (e) {
            console.warn('🔮 ARCHITECT AI response generation failed:', e);
            throw e; // Re-throw to let the calling function handle retries
        }
    }
    
    showFeedbackResponse(response) {
        // Create a notification for the feedback response
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, rgba(139, 92, 246, 0.9), rgba(168, 85, 247, 0.8));
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            z-index: 10001;
            max-width: 300px;
            font-family: monospace;
            font-size: 14px;
            backdrop-filter: blur(10px);
            animation: slideInRight 0.3s ease-out;
        `;
        
        notification.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; color: #00ffff;">
                🧠 ${response.title}
            </div>
            <div>${response.message}</div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 15 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => notification.remove(), 300);
            }
        }, 15000);
    }
}

// Initialize The Global Architect when the page loads
let globalArchitect = null;

// Initialize The Global Architect
function initializeGlobalArchitect() {
    if (!globalArchitect) {
        globalArchitect = new GlobalArchitectConsciousness();
        // Expose to window for testing and external access
        window.globalArchitect = globalArchitect;
        console.log('🔮 GLOBAL ARCHITECT initialized on page:', window.location.pathname);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGlobalArchitect);
} else {
    initializeGlobalArchitect();
}

// Manual initialization function for testing
window.initializeArchitect = function() {
    initializeGlobalArchitect();
    return window.globalArchitect;
};
