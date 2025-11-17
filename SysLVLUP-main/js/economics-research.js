// Global variables
let userManager = null;

// Research Training Manager - AI-Powered Learning System
class ResearchTrainingManager {
    constructor() {
        this.userManager = window.userManager;
        this.currentTopic = null;
        this.currentQuiz = null;
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.quizTimer = null;
        this.timeLeft = 180; // 3 minutes
        this.isQuizActive = false;
        this.quizResults = null;
    }
    
    async initialize() {
        await this.loadUserData();
        this.setupEventListeners();
        this.updateProgressDisplay();
        this.checkForNewDay();
        await this.loadDailyTopic();
    }
    
    async loadUserData() {
        try {
            if (this.userManager && this.userManager.hasUserId()) {
                const userData = this.userManager.getData();
                console.log('🔍 Loading user data:', userData);
                console.log('🔍 Existing research data:', userData?.researchTrainingData);
                
                this.researchData = userData?.economicsResearchData || this.getDefaultResearchData();
                console.log('🔍 Final research data loaded:', this.researchData);
                return userData;
            } else {
                console.warn('User manager not available, using localStorage fallback');
                return this.loadFromLocalStorage();
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            return this.loadFromLocalStorage();
        }
    }
    
    loadFromLocalStorage() {
        const savedData = JSON.parse(localStorage.getItem("gameData")) || {};
        this.researchData = JSON.parse(localStorage.getItem("economicsResearchData")) || this.getDefaultResearchData();
        return savedData;
    }
    
    getDefaultResearchData() {
        return {
            currentTopic: null,
            quizData: null,
            quizResults: null, // Store completed quiz results
            userProgress: {
                score: 0,
                streak: 0,
                totalQuizzes: 0,
                lastQuizDate: null
            },
            lastTopicDate: null
        };
    }
    
    // Get player level for difficulty scaling
    getPlayerLevel() {
        try {
            if (this.userManager && this.userManager.hasUserId()) {
                const userData = this.userManager.getData();
                return userData?.gameData?.level || 1;
            } else {
                // Fallback to localStorage
                const savedData = JSON.parse(localStorage.getItem("gameData")) || {};
                return savedData.level || 1;
            }
        } catch (error) {
            console.error('Error getting player level:', error);
            return 1;
        }
    }
    
    // Get difficulty rank based on player level
    getDifficultyRank(playerLevel) {
        if (playerLevel <= 5) return 'E';        // Really, really easy
        if (playerLevel <= 10) return 'D';      // A little harder
        if (playerLevel <= 20) return 'C';      // Moderate
        if (playerLevel <= 35) return 'B';      // Challenging
        if (playerLevel <= 50) return 'A';      // Advanced
        return 'S';                             // Elite (50+)
    }
    
    // Get difficulty description for quiz generation
    getDifficultyDescription(rank) {
        const descriptions = {
            'E': 'Really, really easy - basic concepts and simple facts',
            'D': 'A little harder - fundamental understanding required',
            'C': 'Moderate - some analytical thinking needed',
            'B': 'Challenging - deeper comprehension and connections',
            'A': 'Advanced - complex analysis and synthesis',
            'S': 'Elite - expert-level understanding and application'
        };
        return descriptions[rank] || descriptions['E'];
    }
    
    async saveProgress() {
        try {
            console.log('💾 Saving progress:', this.researchData);
            
            if (this.userManager && this.userManager.hasUserId()) {
                console.log('💾 Saving via user manager...');
                await this.userManager.updateUserData({
                    economicsResearchData: this.researchData
                });
                // Force save to database (bypasses cooldown check)
                await this.userManager.forceSaveUserData();
                console.log('💾 Progress saved via user manager');
            } else {
                console.log('💾 Saving via localStorage...');
                localStorage.setItem("economicsResearchData", JSON.stringify(this.researchData));
                console.log('💾 Progress saved via localStorage');
            }
        } catch (error) {
            console.error('Error saving progress:', error);
            localStorage.setItem("researchTrainingData", JSON.stringify(this.researchData));
        }
    }
    
    setupEventListeners() {
        // Quiz controls
        document.getElementById('start-quiz-btn')?.addEventListener('click', () => this.startQuiz());
        document.getElementById('next-btn')?.addEventListener('click', () => this.nextQuestion());
        document.getElementById('prev-btn')?.addEventListener('click', () => this.previousQuestion());
        document.getElementById('submit-btn')?.addEventListener('click', () => this.submitQuiz());
        document.getElementById('retry-btn')?.addEventListener('click', () => this.retryQuiz());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.isQuizActive && !this.researchData.quizResults) {
                if (e.key === 'ArrowRight' || e.key === ' ') {
                    e.preventDefault();
                    this.nextQuestion();
                }
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    this.previousQuestion();
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (this.currentQuestionIndex === this.currentQuiz.length - 1) {
                        this.submitQuiz();
                    } else {
                        this.nextQuestion();
                    }
                }
            }
        });
        
        // Clean up timers when page is unloaded
        window.addEventListener('beforeunload', () => {
            if (this.quizTimer) {
                clearInterval(this.quizTimer);
                this.quizTimer = null;
            }
            if (this.isQuizActive && !this.researchData.quizResults) {
                try {
                    this.researchData.partialAnswers = this.userAnswers;
                    this.researchData.partialIndex = this.currentQuestionIndex;
                    if (this.userManager && this.userManager.hasUserId()) {
                        this.userManager.updateUserData({ economicsResearchData: this.researchData });
                        this.userManager.forceSaveUserData();
                    } else {
                        localStorage.setItem("economicsResearchData", JSON.stringify(this.researchData));
                    }
                } catch(_) {}
            }
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState !== 'visible' && this.isQuizActive && !this.researchData.quizResults) {
                try {
                    this.researchData.partialAnswers = this.userAnswers;
                    this.researchData.partialIndex = this.currentQuestionIndex;
                    if (this.userManager && this.userManager.hasUserId()) {
                        this.userManager.updateUserData({ economicsResearchData: this.researchData });
                        this.userManager.forceSaveUserData();
                    } else {
                        localStorage.setItem("economicsResearchData", JSON.stringify(this.researchData));
                    }
                } catch(_) {}
            }
        });
    }
    
    updateProgressDisplay() {
        const progress = this.researchData.userProgress;
        document.getElementById('streak-value').textContent = progress.streak || 0;
        document.getElementById('total-score').textContent = progress.score || 0;
        document.getElementById('quizzes-taken').textContent = progress.totalQuizzes || 0;
    }
    
    checkForNewDay() {
        const currentDate = new Date().toISOString().split('T')[0];
        const lastTopicDate = this.researchData.lastTopicDate;
        
        console.log('📅 Checking for new day...');
        console.log('📅 Current date:', currentDate);
        console.log('📅 Last topic date:', lastTopicDate);
        console.log('📅 Current topic exists:', !!this.researchData.currentTopic);
        console.log('📅 Quiz results exist:', !!this.researchData.quizResults);
        
        if (!lastTopicDate || lastTopicDate !== currentDate) {
            console.log('📅 New day detected, resetting topic, quiz, and results');
            // New day - reset everything
            this.researchData.currentTopic = null;
            this.researchData.quizData = null;
            this.researchData.quizResults = null;
            this.researchData.partialAnswers = null;
            this.researchData.partialIndex = 0;
        } else {
            console.log('📅 Same day, keeping existing data');
        }
    }
    
    async loadDailyTopic() {
        const topicContent = document.getElementById('topic-content');
        
        console.log('📚 Loading daily topic...');
        console.log('📚 Current topic exists:', !!this.researchData.currentTopic);
        console.log('📚 Current topic data:', this.researchData.currentTopic);
        console.log('📚 Quiz results exist:', !!this.researchData.quizResults);
        
        // If quiz results exist for today, show them instead of topic
        if (this.researchData.quizResults) {
            console.log('📚 Quiz already completed today, showing results');
            this.showResultsInterface();
            return;
        }
        
        if (this.researchData.currentTopic) {
            // Topic already exists for today
            console.log('📚 Displaying existing topic');
            this.displayTopic(this.researchData.currentTopic);
            return;
        }
        
        console.log('📚 No existing topic, generating new one...');
        
        // Show loading spinner
        topicContent.innerHTML = `
            <div class="loading-spinner">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <p>Generating today's topic...</p>
            </div>
        `;
        
        try {
            // Call Gemini API directly (same approach as working implementation)
            const GEMINI_API_KEY = 'AIzaSyAtL-nZJQ_rBdK72qvn5ocgbf6bgUPlgNo';
            const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';
            
            const categories = [
                'Microeconomics (Supply & Demand, Market Structures, Consumer Behavior)',
                'Macroeconomics (GDP, Inflation, Unemployment, Fiscal Policy)',
                'International Economics (Trade, Exchange Rates, Globalization)',
                'Financial Markets (Stocks, Bonds, Banking, Investment)',
                'Economic Theories (Keynesian, Classical, Behavioral Economics)'
            ];
            
            const randomCategory = categories[Math.floor(Math.random() * categories.length)];
            
            // Get player level for difficulty scaling
            const playerLevel = this.getPlayerLevel();
            const difficultyRank = this.getDifficultyRank(playerLevel);
            
            const prompt = `Generate a daily economic learning topic from this category: ${randomCategory}

IMPORTANT: The difficulty should be appropriate for a player at level ${playerLevel} (${difficultyRank} rank).

Please provide a response in this exact JSON format:
{
  "category": "Category Name",
  "title": "Topic Title",
  "description": "A brief but engaging description of the economic topic that would interest someone learning about it",
  "difficulty": "${difficultyRank}",
  "keyPoints": [
    "Key economic point 1 - essential economic concept to understand",
    "Key economic point 2 - important economic fact or principle",
    "Key economic point 3 - core economic idea or theory",
    "Key economic point 4 - economic context or practical application",
    "Key economic point 5 - connection to broader economic context"
  ]
}

CRITICAL REQUIREMENTS:
- difficulty MUST be exactly "${difficultyRank}"
- keyPoints MUST contain exactly 5 focused economic learning objectives
- Each key point should be specific and economically accurate
- Make the topic interesting and educational about economics
- Keep the description concise but informative
- Focus on essential economic knowledge, not overwhelming details`;

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

            const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            
            const jsonText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!jsonText) throw new Error('Invalid response structure from API');

            const topicData = JSON.parse(jsonText);
            
            // Ensure keyPoints exist (fallback if AI doesn't provide them)
            if (!topicData.keyPoints || !Array.isArray(topicData.keyPoints)) {
                topicData.keyPoints = [
                    "Understand the basic concepts and definitions",
                    "Learn the key historical or scientific facts",
                    "Identify the main principles and theories",
                    "Recognize practical applications and examples",
                    "Connect to broader context and significance"
                ];
            }
            
            console.log('🎯 Generated topic data:', topicData);
            
            this.researchData.currentTopic = topicData;
            this.researchData.lastTopicDate = new Date().toISOString().split('T')[0];
            
            console.log('🎯 Updated research data:', this.researchData);
            
            this.displayTopic(topicData);
            await this.saveProgress();
            
            console.log('🎯 Topic saved and displayed');
            
        } catch (error) {
            console.error('Error generating topic:', error);
            const topicContent = document.getElementById('topic-content');
            topicContent.innerHTML = `
                <div style="text-align: center; color: #ff6b6b;">
                    <i class="fa-solid fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 10px;"></i>
                    <p>AI topic generation failed. Please try again later.</p>
                    <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #00ffff; color: #0A1B2E; border: none; border-radius: 5px; cursor: pointer;">
                        <i class="fa-solid fa-redo"></i> Retry
                    </button>
                </div>
            `;
        }
    }
    
    displayTopic(topic) {
        const topicContent = document.getElementById('topic-content');
        const startQuizBtn = document.getElementById('start-quiz-btn');
        
        // Create key points HTML if available
        let keyPointsHTML = '';
        if (topic.keyPoints && Array.isArray(topic.keyPoints)) {
            keyPointsHTML = `
                <div class="key-points-section">
                    <h4><i class="fa-solid fa-lightbulb"></i> Key Learning Points:</h4>
                    <ul class="key-points-list">
                        ${topic.keyPoints.map(point => `<li>${point}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        topicContent.innerHTML = `
            <div class="topic-title">${topic.title}</div>
            <div class="topic-description">${topic.description}</div>
            <div class="topic-category">${topic.category} • <span class="difficulty-rank ${topic.difficulty?.toLowerCase()}">${topic.difficulty || 'E'}</span></div>
            ${keyPointsHTML}
        `;
        
        startQuizBtn.style.display = 'inline-flex';
        
        // Update button text based on quiz status
        if (this.researchData.quizResults) {
            startQuizBtn.innerHTML = '<i class="fa-solid fa-eye"></i> View Results';
            startQuizBtn.onclick = () => this.showResultsInterface();
        } else {
            startQuizBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start Quiz';
            startQuizBtn.onclick = () => this.startQuiz();
        }
    }
    
    async startQuiz() {
        // Check if quiz already completed today
        if (this.researchData.quizResults) {
            console.log('🎯 Quiz already completed today, showing results');
            this.showResultsInterface();
            return;
        }
        
        if (this.researchData.quizData) {
            // Quiz already exists - fix it if it's missing options or has corrupted types
            this.currentQuiz = this.fixQuizData(this.researchData.quizData);
            
            // Update the stored quiz data with the fixed version
            this.researchData.quizData = this.currentQuiz;
            await this.saveProgress();
            
            console.log('🎯 Using existing quiz data for today');
            console.log('🎯 Fixed quiz data:', this.currentQuiz);
        } else {
            // Generate new quiz
            console.log('🎯 Generating new quiz for today');
            await this.generateQuiz();
        }
        
        // Double-check quiz wasn't completed while generating
        if (this.researchData.quizResults) {
            console.log('🎯 Quiz was completed while generating, showing results');
            this.showResultsInterface();
            return;
        }
        
        if (this.researchData.partialAnswers && Array.isArray(this.researchData.partialAnswers) && this.researchData.partialAnswers.length === this.currentQuiz.length) {
            this.userAnswers = this.researchData.partialAnswers.slice();
            this.currentQuestionIndex = Math.min(this.researchData.partialIndex || 0, this.currentQuiz.length - 1);
            console.log('↩️ Resuming quiz from saved progress at index', this.currentQuestionIndex);
        } else {
            this.currentQuestionIndex = 0;
            this.userAnswers = new Array(this.currentQuiz.length).fill(null);
        }
        this.timeLeft = 180;
        this.isQuizActive = true;
        
        this.showQuizInterface();
        this.displayQuestion();
        this.startTimer();
    }
    
    fixQuizData(quizData) {
        console.log('🔧 Fixing quiz data:', quizData);
        // Fix existing quiz data that might be missing options or have corrupted types
        const fixedQuiz = quizData.map((question, index) => {
            console.log(`🔧 Question ${index}:`, question);
            
            // Always ensure options exist and are properly formatted
            if (!question.options || !Array.isArray(question.options) || question.options.length === 0) {
                console.log('🔧 Fixing question missing or empty options:', question);
                
                if (question.type === 'multiple_choice' || question.type.includes('multiple_choice')) {
                    // Generate 4 options for multiple choice
                    question.options = [
                        question.correctAnswer || 'Option A',
                        'Option B',
                        'Option C', 
                        'Option D'
                    ];
                    question.type = 'multiple_choice'; // Clean up corrupted type
                } else if (question.type === 'true_false' || question.type.includes('true_false')) {
                    // Standard true/false options - always ensure these exist
                    question.options = ['True', 'False'];
                    question.type = 'true_false'; // Clean up corrupted type
                    
                    // Ensure correctAnswer is one of the valid options
                    if (question.correctAnswer && !['True', 'False'].includes(question.correctAnswer)) {
                        console.log('🔧 Fixing invalid true/false correctAnswer:', question.correctAnswer);
                        question.correctAnswer = 'True'; // Default fallback
                    }
                } else {
                    // Fallback options
                    question.options = ['Option A', 'Option B', 'Option C', 'Option D'];
                    question.type = 'multiple_choice'; // Default to multiple choice
                }
                
                console.log('🔧 Fixed question options:', question.options);
                console.log('🔧 Fixed question type:', question.type);
            }
            
            // Additional validation for true/false questions
            if (question.type === 'true_false') {
                if (!question.options || question.options.length !== 2) {
                    console.log('🔧 Fixing true/false question with wrong number of options:', question.options);
                    question.options = ['True', 'False'];
                }
                
                // Ensure options are exactly "True" and "False"
                if (!question.options.includes('True') || !question.options.includes('False')) {
                    console.log('🔧 Fixing true/false options to standard format');
                    question.options = ['True', 'False'];
                }
            }
            
            console.log(`🔧 Final question ${index}:`, question);
            return question;
        });
        
        console.log('🔧 Fixed quiz result:', fixedQuiz);
        return fixedQuiz;
    }
    
    async generateQuiz() {
        const startQuizBtn = document.getElementById('start-quiz-btn');
        startQuizBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating Quiz...';
        startQuizBtn.disabled = true;
        
        try {
            // Call Gemini API directly for quiz generation
            const GEMINI_API_KEY = 'AIzaSyAtL-nZJQ_rBdK72qvn5ocgbf6bgUPlgNo';
            const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';
            
                         const prompt = `Create 5 engaging quiz questions about: ${this.researchData.currentTopic.title} - ${this.researchData.currentTopic.description}

 DIFFICULTY: ${this.researchData.currentTopic.difficulty} Rank (${this.getDifficultyDescription(this.researchData.currentTopic.difficulty)})

 KEY LEARNING POINTS TO FOCUS ON:
 ${this.researchData.currentTopic.keyPoints ? this.researchData.currentTopic.keyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n') : 'General knowledge of the topic'}

 CRITICAL REQUIREMENTS:
 - Questions MUST be based on authentic knowledge and facts
 - Include a mix of question types: multiple choice, true/false
 - Each question MUST include ALL required fields
 - For true/false questions, ALWAYS include options: ["True", "False"]
 - For multiple choice questions, ALWAYS include exactly 4 options
 - Ensure accuracy and respect for the subject matter
 - Make questions engaging and educational

 Please provide a response in this exact JSON format:
 {
   "questions": [
     {
       "question": "Question text here?",
       "type": "multiple_choice",
       "options": ["Option A", "Option B", "Option C", "Option D"],
       "correctAnswer": "Option A",
       "explanation": "Brief explanation of why this is correct"
     },
     {
       "question": "True or False question here?",
       "type": "true_false",
       "options": ["True", "False"],
       "correctAnswer": "True",
       "explanation": "Brief explanation"
     }
   ]
 }

 Make questions that test understanding of the topic while being engaging and educational.`;

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

            const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            
            const jsonText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!jsonText) throw new Error('Invalid response structure from API');

            const quizData = JSON.parse(jsonText);
            
            console.log('🎲 Raw quiz data from Gemini:', quizData);
            console.log('🎲 Questions array:', quizData.questions);
            if (quizData.questions && quizData.questions.length > 0) {
                console.log('🎲 First question structure:', quizData.questions[0]);
            }
            
            if (quizData.questions && quizData.questions.length > 0) {
                this.currentQuiz = quizData.questions;
                this.researchData.quizData = quizData.questions;
                await this.saveProgress();
            } else {
                throw new Error('No questions generated');
            }
            
        } catch (error) {
            console.error('Error generating quiz:', error);
            const startQuizBtn = document.getElementById('start-quiz-btn');
            startQuizBtn.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> AI Generation Failed';
            startQuizBtn.style.background = 'linear-gradient(135deg, #ff6b6b, #ee5a52)';
            startQuizBtn.onclick = () => location.reload();
            
            this.showNotification('AI quiz generation failed. Please try again.', 'error');
        }
        
        startQuizBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start Quiz';
        startQuizBtn.disabled = false;
    }
    
    showQuizInterface() {
        document.getElementById('topic-section').style.display = 'none';
        document.getElementById('quiz-section').style.display = 'block';
        document.getElementById('results-section').style.display = 'none';
        
        // Update quiz header with difficulty info
        const quizHeader = document.querySelector('.quiz-section h2');
        if (quizHeader && this.researchData.currentTopic) {
            const difficulty = this.researchData.currentTopic.difficulty || 'E';
            quizHeader.innerHTML = `Quiz - <span class="difficulty-rank ${difficulty.toLowerCase()}">${difficulty}</span> Rank`;
        }
    }
    
    displayQuestion() {
        const question = this.currentQuiz[this.currentQuestionIndex];
        const questionContainer = document.getElementById('question-container');
        const questionCounter = document.getElementById('question-counter');
        const progressFill = document.getElementById('progress-fill');
        
        console.log('🎯 Displaying question:', this.currentQuestionIndex, 'Question:', question);
        console.log('🎯 Question options:', question.options);
        console.log('🎯 Question type:', question.type);
        
        questionCounter.textContent = `Question ${this.currentQuestionIndex + 1}/${this.currentQuiz.length}`;
        progressFill.style.width = `${((this.currentQuestionIndex + 1) / this.currentQuiz.length) * 100}%`;
        
        let optionsHTML = '';
        
        // Ensure question has valid options, if not, try to fix it
        if (!question.options || !Array.isArray(question.options) || question.options.length === 0) {
            console.warn('🔄 Question has no options, attempting to fix...');
            const fixedQuestion = this.fixQuizData([question])[0];
            question.options = fixedQuestion.options;
            question.type = fixedQuestion.type;
            console.log('🔄 Fixed question:', fixedQuestion);
        }
        
        if (question.type === 'multiple_choice' && question.options && Array.isArray(question.options)) {
            question.options.forEach((option, index) => {
                const isSelected = this.userAnswers[this.currentQuestionIndex] === option;
                console.log(`🎯 Option ${index}: "${option}", isSelected: ${isSelected}`);
                optionsHTML += `
                    <div class="answer-option ${isSelected ? 'selected' : ''}" data-option="${index}" data-value="${option}">
                        <input type="radio" name="q${this.currentQuestionIndex}" value="${option}" ${isSelected ? 'checked' : ''}>
                        <label>${option}</label>
                    </div>
                `;
            });
        } else if (question.type === 'true_false' && question.options && Array.isArray(question.options)) {
            question.options.forEach((option, index) => {
                const isSelected = this.userAnswers[this.currentQuestionIndex] === option;
                console.log(`🎯 Option ${index}: "${option}", isSelected: ${isSelected}`);
                optionsHTML += `
                    <div class="answer-option ${isSelected ? 'selected' : ''}" data-option="${index}" data-value="${option}">
                        <input type="radio" name="q${this.currentQuestionIndex}" value="${option}" ${isSelected ? 'checked' : ''}>
                        <label>${option}</label>
                    </div>
                `;
            });
        } else {
            console.error('🎯 Invalid question structure after fixing:', question);
            // Fallback: create basic options
            if (question.type === 'true_false') {
                optionsHTML = `
                    <div class="answer-option" data-option="0" data-value="True">
                        <input type="radio" name="q${this.currentQuestionIndex}" value="True">
                        <label>True</label>
                    </div>
                    <div class="answer-option" data-option="1" data-value="False">
                        <input type="radio" name="q${this.currentQuestionIndex}" value="False">
                        <label>False</label>
                    </div>
                `;
            } else {
                optionsHTML = `
                    <div class="answer-option" data-option="0" data-value="Option A">
                        <input type="radio" name="q${this.currentQuestionIndex}" value="Option A">
                        <label>Option A</label>
                    </div>
                    <div class="answer-option" data-option="1" data-value="Option B">
                        <input type="radio" name="q${this.currentQuestionIndex}" value="Option B">
                        <label>Option B</label>
                    </div>
                    <div class="answer-option" data-option="2" data-value="Option C">
                        <input type="radio" name="q${this.currentQuestionIndex}" value="Option C">
                        <label>Option C</label>
                    </div>
                    <div class="answer-option" data-option="3" data-value="Option D">
                        <input type="radio" name="q${this.currentQuestionIndex}" value="Option D">
                        <label>Option D</label>
                    </div>
                `;
            }
        }
        
        questionContainer.innerHTML = `
            <div class="question-type">${question.type.replace('_', ' ').toUpperCase()}</div>
            <div class="question-text">${question.question}</div>
            <div class="answer-options">
                ${optionsHTML}
            </div>
        `;
        
        console.log('🎯 Generated HTML for options:', optionsHTML);
        
        // Add click event listeners to answer options
        const answerOptions = questionContainer.querySelectorAll('.answer-option');
        answerOptions.forEach((option, index) => {
            option.addEventListener('click', () => {
                const value = option.getAttribute('data-value');
                console.log('🎯 Option clicked:', index, 'Value:', value);
                this.selectAnswer(value);
            });
        });
        
        this.updateQuizControls();
    }
    
    async selectAnswer(answer) {
        console.log('🎯 Selecting answer:', answer, 'for question:', this.currentQuestionIndex);
        this.userAnswers[this.currentQuestionIndex] = answer;
        try {
            this.researchData.partialAnswers = this.userAnswers;
            this.researchData.partialIndex = this.currentQuestionIndex;
            if (this.userManager && this.userManager.hasUserId()) {
                await this.userManager.updateUserData({ economicsResearchData: this.researchData });
                await this.userManager.forceSaveUserData();
            } else {
                localStorage.setItem("economicsResearchData", JSON.stringify(this.researchData));
            }
        } catch (_) {}
        
        // Update visual selection
        const options = document.querySelectorAll('.answer-option');
        console.log('🎯 Found options:', options.length);
        
        options.forEach((option, index) => {
            option.classList.remove('selected');
            const radio = option.querySelector('input[type="radio"]');
            console.log(`🎯 Option ${index}:`, option.textContent.trim(), 'Radio value:', radio?.value, 'Matches answer:', radio?.value === answer);
            
            if (radio && radio.value === answer) {
                option.classList.add('selected');
                radio.checked = true;
                console.log('🎯 Selected option:', index);
            }
        });
        
        this.updateQuizControls();
    }
    
    updateQuizControls() {
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const submitBtn = document.getElementById('submit-btn');
        
        prevBtn.style.display = this.currentQuestionIndex > 0 ? 'inline-flex' : 'none';
        nextBtn.style.display = this.currentQuestionIndex < this.currentQuiz.length - 1 ? 'inline-flex' : 'none';
        submitBtn.style.display = this.currentQuestionIndex === this.currentQuiz.length - 1 ? 'inline-flex' : 'none';
    }
    
    nextQuestion() {
        if (this.currentQuestionIndex < this.currentQuiz.length - 1) {
            this.currentQuestionIndex++;
            this.displayQuestion();
        }
    }
    
    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.displayQuestion();
        }
    }
    
    startTimer() {
        // Clear any existing timer first
        if (this.quizTimer) {
            clearInterval(this.quizTimer);
            this.quizTimer = null;
        }
        
        this.updateTimerDisplay();
        this.quizTimer = setInterval(() => {
            this.timeLeft--;
            this.updateTimerDisplay();
            
            if (this.timeLeft <= 0) {
                console.log('🔍 Time ran out, auto-submitting quiz');
                // Clear timer immediately and set to null
                clearInterval(this.quizTimer);
                this.quizTimer = null;
                this.submitQuiz();
            }
        }, 1000);
    }
    
    updateTimerDisplay() {
        const timeDisplay = document.getElementById('time-left');
        const timerElement = document.getElementById('timer');
        
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        timeDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        // Update timer color based on time remaining
        timerElement.className = 'timer';
        if (this.timeLeft <= 30) {
            timerElement.classList.add('danger');
        } else if (this.timeLeft <= 60) {
            timerElement.classList.add('warning');
        }
    }
    
    async submitQuiz() {
        // Prevent multiple submissions
        if (!this.isQuizActive || this.researchData.quizResults) {
            console.log('🔍 Quiz already submitted or not active, ignoring duplicate submission');
            return;
        }
        
        console.log('🔍 Submitting research quiz...');
        
        // Clear timer and set to null to prevent further calls
        if (this.quizTimer) {
            clearInterval(this.quizTimer);
            this.quizTimer = null;
        }
        
        // Also clear any remaining time to prevent further timer events
        this.timeLeft = 0;
        this.isQuizActive = false;
        
        // Calculate results
        let correctAnswers = 0;
        const results = [];
        
        this.currentQuiz.forEach((question, index) => {
            const userAnswer = this.userAnswers[index];
            const isCorrect = userAnswer === question.correctAnswer;
            if (isCorrect) correctAnswers++;
            
            results.push({
                question: question.question,
                userAnswer: userAnswer,
                correctAnswer: question.correctAnswer,
                isCorrect: isCorrect,
                explanation: question.explanation
            });
        });
        
        const score = Math.round((correctAnswers / this.currentQuiz.length) * 100);
        this.quizResults = { score, correctAnswers, totalQuestions: this.currentQuiz.length, results };
        
        // Update progress
        this.updateProgress(score);
        
        // Show results
        this.showResults();
        
        // Save progress
        await this.saveProgress();
        
        // Save quiz results to prevent re-taking on same day
        this.researchData.quizResults = this.quizResults;
        await this.saveProgress();
        
        console.log('🎯 Quiz results saved to database');
    }
    
    showResultsInterface() {
        // Clear any active timer when showing results
        if (this.quizTimer) {
            clearInterval(this.quizTimer);
            this.quizTimer = null;
        }
        
        // Show results section directly without going through quiz
        document.getElementById('topic-section').style.display = 'none';
        document.getElementById('quiz-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'block';
        
        // Display the saved results
        this.quizResults = this.researchData.quizResults;
        this.showResults();
        
        console.log('📊 Displaying saved quiz results from database');
    }
    
    isQuizCompletedToday() {
        return !!(this.researchData.quizResults && this.researchData.lastTopicDate === new Date().toLocaleDateString());
    }
    
    updateProgress(score) {
        const progress = this.researchData.userProgress;
        const currentDate = new Date().toLocaleDateString();
        
        // Prevent multiple progress updates for the same quiz
        if (progress.lastQuizDate === currentDate && this.researchData.quizResults) {
            console.log('🔍 Progress already updated today, skipping duplicate update');
            return;
        }
        
        console.log('🔍 Updating progress with score:', score);
        
        progress.score += score;
        progress.totalQuizzes++;
        
        // Update streak
        if (progress.lastQuizDate === currentDate) {
            // Already completed today
        } else if (progress.lastQuizDate === this.getYesterdayDate()) {
            // Consecutive day
            progress.streak++;
        } else {
            // Break in streak
            progress.streak = 1;
        }
        
        progress.lastQuizDate = currentDate;
        this.updateProgressDisplay();
    }
    
    getYesterdayDate() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toLocaleDateString();
    }
    
    showResults() {
        // Ensure timer is completely cleared
        if (this.quizTimer) {
            clearInterval(this.quizTimer);
            this.quizTimer = null;
        }
        
        document.getElementById('quiz-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'block';
        
        const scoreDisplay = document.getElementById('score-display');
        const answersReview = document.getElementById('answers-review');
        
        // Display score
        scoreDisplay.innerHTML = `
            <div class="score-value">${this.quizResults.score}%</div>
            <div class="score-text">You got ${this.quizResults.correctAnswers} out of ${this.quizResults.totalQuestions} questions correct!</div>
            <div class="score-breakdown">
                <div class="score-item">
                    <div class="value">${this.quizResults.correctAnswers}</div>
                    <div class="label">Correct</div>
                </div>
                <div class="score-item">
                    <div class="value">${this.quizResults.totalQuestions - this.quizResults.correctAnswers}</div>
                    <div class="label">Incorrect</div>
                </div>
                <div class="score-item">
                    <div class="value">${this.researchData.userProgress.streak}</div>
                    <div class="label">Day Streak</div>
                </div>
            </div>
        `;
        
        // Display answer review
        let reviewHTML = '';
        this.quizResults.results.forEach((result, index) => {
            reviewHTML += `
                <div class="review-item ${result.isCorrect ? 'correct' : 'incorrect'}">
                    <div class="review-question">${index + 1}. ${result.question}</div>
                    <div class="review-answer">Your answer: ${result.userAnswer || 'No answer'}</div>
                    ${!result.isCorrect ? `<div class="review-correct">Correct: ${result.correctAnswer}</div>` : ''}
                    <div class="review-correct">${result.explanation}</div>
                </div>
            `;
        });
        answersReview.innerHTML = reviewHTML;
        
        // Add "come back tomorrow" message
        const tomorrowMessage = document.createElement('div');
        tomorrowMessage.className = 'tomorrow-message';
        tomorrowMessage.innerHTML = `
            <div style="text-align: center; margin-top: 20px; padding: 15px; background: rgba(0, 255, 255, 0.1); border-radius: 10px; border: 1px solid rgba(0, 255, 255, 0.3);">
                <i class="fa-solid fa-calendar-day" style="font-size: 1.5rem; color: #00ffff; margin-bottom: 10px;"></i>
                <p style="margin: 0; color: #00ffff; font-size: 1.1rem; font-weight: 500;">Come back tomorrow for a new quiz!</p>
            </div>
        `;
        answersReview.appendChild(tomorrowMessage);
        
        // Apply rewards
        this.applyRewards();
        
        // Check completion
        if (this.quizResults.score >= 60) {
            this.completeDailyQuest();
        }
    }
    
    applyRewards() {
        const rewards = {
            xp: this.quizResults.score * 2, // 2 XP per percentage point
            intelligence: this.quizResults.score / 20, // 0.05 INT per percentage point
            fatigue: 5, // Small fatigue cost
            mp: -3, // MP cost
            stm: -2  // Stamina cost
        };
        
        this.showNotification(`Quiz completed! +${rewards.xp} XP, +${rewards.intelligence.toFixed(1)} INT`);
        
        // Apply to game data (same pattern as dental study)
        try {
            if (this.userManager && this.userManager.hasUserId()) {
                const userData = this.userManager.getData();
                const gameData = userData.gameData || {};
                
                gameData.exp = (gameData.exp || 0) + rewards.xp;
                gameData.stackedAttributes = gameData.stackedAttributes || {};
                gameData.stackedAttributes.INT = (gameData.stackedAttributes.INT || 0) + rewards.intelligence;
                gameData.mp = Math.max(0, (gameData.mp || 100) + rewards.mp);
                gameData.stm = Math.max(0, (gameData.stm || 100) + rewards.stm);
                gameData.fatigue = Math.min(100, (gameData.fatigue || 0) + rewards.fatigue);
                
                // Check for level up
                let levelUps = 0;
                while (gameData.exp >= 100) {
                    gameData.exp -= 100;
                    gameData.level = (gameData.level || 1) + 1;
                    levelUps++;
                    
                    // Apply stacked attributes to base attributes
                    if (gameData.Attributes) {
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
                }
                
                // Show level up notification
                if (levelUps > 0) {
                    this.showNotification(`🎉 LEVEL UP! You are now level ${gameData.level}!`, 'success');
                }
                
                this.userManager.setData('gameData', gameData);
                this.userManager.saveUserData();
            } else {
                // Fallback to localStorage
                const savedData = JSON.parse(localStorage.getItem("gameData")) || {};
                savedData.exp = (savedData.exp || 0) + rewards.xp;
                savedData.stackedAttributes = savedData.stackedAttributes || {};
                savedData.stackedAttributes.INT = (savedData.stackedAttributes.INT || 0) + rewards.intelligence;
                savedData.mp = Math.max(0, (savedData.mp || 100) + rewards.mp);
                savedData.stm = Math.max(0, (savedData.stm || 100) + rewards.stm);
                savedData.fatigue = Math.min(100, (savedData.fatigue || 0) + rewards.fatigue);
                
                // Check for level up in localStorage fallback
                let levelUps = 0;
                while (savedData.exp >= 100) {
                    savedData.exp -= 100;
                    savedData.level = (savedData.level || 1) + 1;
                    levelUps++;
                    
                    // Apply stacked attributes to base attributes
                    if (savedData.Attributes) {
                        for (let stat in savedData.stackedAttributes) {
                            if (savedData.Attributes[stat] !== undefined) {
                                const oldValue = savedData.Attributes[stat];
                                savedData.Attributes[stat] += savedData.stackedAttributes[stat];
                                console.log(`${stat}: ${oldValue} → ${savedData.Attributes[stat]} (+${savedData.stackedAttributes[stat]})`);
                            }
                        }
                        
                        // Reset stacked attributes
                        for (let stat in savedData.stackedAttributes) {
                            savedData.stackedAttributes[stat] = 0;
                        }
                        console.log('Stacked attributes reset to 0');
                    }
                }
                
                localStorage.setItem("gameData", JSON.stringify(savedData));
                
                // Show level up notification for localStorage
                if (levelUps > 0) {
                    this.showNotification(`🎉 LEVEL UP! You are now level ${savedData.level}!`, 'success');
                }
            }
        } catch (error) {
            console.error('Error applying rewards:', error);
        }
    }
    
    completeDailyQuest() {
        const completeCheckbox = document.getElementById('complete');
        const section = document.getElementById('complete-section');
        
        if (completeCheckbox && section) {
            completeCheckbox.checked = true;
            section.classList.add("animatedd");
            completeCheckbox.classList.add("animatedd");
        }
    }
    
    retryQuiz() {
        // Just show a message - don't reset anything
        console.log('📝 Showing "come back tomorrow" message');
        
        // You can customize this message however you want
        // For now, it just logs to console since you don't want a button
    }
    
    showNotification(message, type = 'success') {
        const notification = document.getElementById("notification");
        if (notification) {
            notification.querySelector('p').textContent = message;
            notification.className = `notification ${type}`;
            notification.classList.remove("hidden");
            notification.classList.add("show");
            
            setTimeout(() => {
                notification.classList.remove("show");
                notification.classList.add("hidden");
            }, 4000);
        }
    }
}

// Initialize the research training manager when the page loads
let researchTrainingManager;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Research Training page loaded, initializing...');
    
    // Create user manager instance (same pattern as status.js)
    userManager = new UserManager();
    window.userManager = userManager;
    
    // Check if player already has a name set
    const existingPlayerName = localStorage.getItem('playerName');
    
    if (existingPlayerName) {
        console.log('Existing player found:', existingPlayerName);
        // Player has a name, try to load their data
        await loadExistingPlayerData(existingPlayerName);
    } else {
        console.log('No existing player name found');
        // For now, just initialize with fallback data
        researchTrainingManager = new ResearchTrainingManager();
        await researchTrainingManager.initialize();
    }
    
    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    }
});

// Load existing player data (same pattern as status.js)
async function loadExistingPlayerData(playerName) {
    try {
        // Set the user ID (player name) in user manager and check if data exists
        const result = await userManager.setUserId(playerName);
        
        console.log('Result from setUserId:', result);
        
        if (result.dataFound) {
            console.log('Loading existing player data for:', playerName);
            // Player exists, load their data
            const existingData = userManager.getData();
            console.log('Existing data retrieved:', existingData);
        } else {
            console.log('Creating new player data for:', playerName);
            // New player, create initial data
            const initialData = userManager.createInitialData(playerName);
            
            // Save to MongoDB
            await userManager.saveUserData();
            console.log('Initial data saved for new player');
        }
        
        // Initialize research training manager
        researchTrainingManager = new ResearchTrainingManager();
        await researchTrainingManager.initialize();
        
    } catch (error) {
        console.error('Error loading existing player data:', error);
        // Fallback: initialize with basic data
        researchTrainingManager = new ResearchTrainingManager();
        await researchTrainingManager.initialize();
    }
}

// Global functions for backward compatibility
function selectAnswer(answer) {
    if (researchTrainingManager) {
        researchTrainingManager.selectAnswer(answer);
    }
}

// Sync to database function (same pattern as other pages)
async function syncToDatabase() {
    if (window.userManager) {
        try {
            await window.userManager.saveUserData();
            console.log('Sync successful via user manager');
            return { success: true, message: 'Data synced successfully' };
        } catch (error) {
            console.error('Error syncing to database:', error);
            throw error;
        }
    } else {
        console.warn('User manager not available for syncing');
        return { success: false, message: 'User manager not available' };
    }
}
