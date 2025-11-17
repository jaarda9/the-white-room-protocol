// Global variables
let userManager = null;

// Islamic Training Manager - Authentic Islamic Knowledge System
class IslamicTrainingManager {
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
                console.log('🕌 Loading user data:', userData);
                this.islamicData = userData?.islamicTrainingData || this.getDefaultIslamicData();
                
 
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
        this.islamicData = JSON.parse(localStorage.getItem("islamicTrainingData")) || this.getDefaultIslamicData();
        return savedData;
    }
    
    getDefaultIslamicData() {
        return {
            currentTopic: null,
            quizData: null,
            quizResults: null,
            userProgress: {
                score: 0,
                streak: 0,
                totalQuizzes: 0,
                lastQuizDate: null
            },
            lastTopicDate: null
        };
    }
    
    getPlayerLevel() {
        try {
            if (this.userManager && this.userManager.hasUserId()) {
                const userData = this.userManager.getData();
                return userData?.gameData?.level || 1;
            } else {
                const savedData = JSON.parse(localStorage.getItem("gameData")) || {};
                return savedData.level || 1;
            }
        } catch (error) {
            console.error('Error getting player level:', error);
            return 1;
        }
    }
    
    getDifficultyRank(playerLevel) {
        if (playerLevel <= 5) return 'E';
        if (playerLevel <= 10) return 'D';
        if (playerLevel <= 20) return 'C';
        if (playerLevel <= 35) return 'B';
        if (playerLevel <= 50) return 'A';
        return 'S';
    }
    
    getDifficultyDescription(rank) {
        const descriptions = {
            'E': 'Basic Islamic concepts - daily prayers, basic beliefs',
            'D': 'Islamic history basics - Prophet\'s life, early Islam',
            'C': 'Hadith understanding - authentic narrations, basic fiqh',
            'B': 'Advanced fiqh concepts - complex rulings, theological discussions',
            'A': 'Islamic philosophy - deep theological concepts, scholarly debates',
            'S': 'Scholar-level knowledge - research methodology, advanced studies'
        };
        return descriptions[rank] || descriptions['E'];
    }
    
    async saveProgress() {
        try {
            if (this.userManager && this.userManager.hasUserId()) {
                await this.userManager.updateUserData({
                    islamicTrainingData: this.islamicData
                });
                await this.userManager.forceSaveUserData();
            } else {
                localStorage.setItem("islamicTrainingData", JSON.stringify(this.islamicData));
            }
        } catch (error) {
            console.error('Error saving progress:', error);
            localStorage.setItem("islamicTrainingData", JSON.stringify(this.islamicData));
        }
    }
    
    setupEventListeners() {
        document.getElementById('start-quiz-btn')?.addEventListener('click', () => this.startQuiz());
        document.getElementById('next-btn')?.addEventListener('click', () => this.nextQuestion());
        document.getElementById('prev-btn')?.addEventListener('click', () => this.previousQuestion());
        document.getElementById('submit-btn')?.addEventListener('click', () => this.submitQuiz());
        document.getElementById('retry-btn')?.addEventListener('click', () => this.retryQuiz());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.isQuizActive && !this.islamicData.quizResults) {
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
        });
    }
    
    updateProgressDisplay() {
        const progress = this.islamicData.userProgress;
        document.getElementById('streak-value').textContent = progress.streak || 0;
        document.getElementById('total-score').textContent = progress.score || 0;
        document.getElementById('quizzes-taken').textContent = progress.totalQuizzes || 0;
    }
    
    checkForNewDay() {
        const currentDate = new Date().toLocaleDateString();
        const lastTopicDate = this.islamicData.lastTopicDate;
        
        if (!lastTopicDate || lastTopicDate !== currentDate) {
            this.islamicData.currentTopic = null;
            this.islamicData.quizData = null;
            this.islamicData.quizResults = null;
        }
    }
    
    async loadDailyTopic() {
        const topicContent = document.getElementById('topic-content');
        
        if (this.islamicData.quizResults) {
            this.showResultsInterface();
            return;
        }
        
        if (this.islamicData.currentTopic) {
            this.displayTopic(this.islamicData.currentTopic);
            return;
        }
        
        console.log('📚 No existing topic, generating new Islamic one...');
        
        // Show loading spinner
        topicContent.innerHTML = `
            <div class="loading-spinner">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <p>Generating today's Islamic topic...</p>
            </div>
        `;
        
        try {
            // Call Gemini API for Islamic topic generation
            const GEMINI_API_KEY = 'AIzaSyAtL-nZJQ_rBdK72qvn5ocgbf6bgUPlgNo';
            const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';
            
            const islamicCategories = [
                'Aqeedah (Islamic Beliefs & Theology)',
                'Fiqh (Islamic Jurisprudence & Law)',
                'Seerah (Prophet Muhammad ﷺ Life & History)',
                'Tafseer (Quran Interpretation)',
                'Hadith (Prophet\'s Authentic Sayings)',
                'Islamic Ethics & Character (Akhlaq)',
                'Islamic History & Civilization',
                'Arabic Language & Islamic Terminology'
            ];
            
            const randomCategory = islamicCategories[Math.floor(Math.random() * islamicCategories.length)];
            
            // Get player level for difficulty scaling
            const playerLevel = this.getPlayerLevel();
            const difficultyRank = this.getDifficultyRank(playerLevel);
            
            const prompt = `Generate an Islamic learning topic from this category: ${randomCategory}

IMPORTANT: This is for educating a teenage Muslim with authentic Islamic knowledge.

DIFFICULTY: ${difficultyRank} Rank (${this.getDifficultyDescription(difficultyRank)})

CRITICAL REQUIREMENTS:
- Focus ONLY on authentic Islamic knowledge agreed upon by major scholars
- Include Arabic terms with English translations where appropriate
- Reference strong (Sahih) hadiths and authentic sources
- Avoid weak or disputed narrations
- Make content engaging and practical for teenagers
- Include proper Islamic terminology and respect

Please provide a response in this exact JSON format:
{
  "category": "Islamic Category Name",
  "title": "Topic Title",
  "description": "A brief but engaging description of the Islamic topic",
  "difficulty": "${difficultyRank}",
  "arabicTerms": [
    {
      "arabic": "Arabic text",
      "translation": "English translation",
      "meaning": "Brief explanation"
    }
  ],
  "keyPoints": [
    "Key Islamic learning point 1",
    "Key Islamic learning point 2",
    "Key Islamic learning point 3",
    "Key Islamic learning point 4",
    "Key Islamic learning point 5"
  ],
  "authenticSources": [
    "Quran: Surah:Verse (if applicable)",
    "Sahih Hadith: Source and reference",
    "Scholarly consensus or major opinion"
  ]
}

Make the topic interesting, educational, and spiritually uplifting while maintaining authenticity.`;

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
            
            // Ensure required fields exist
            if (!topicData.keyPoints || !Array.isArray(topicData.keyPoints)) {
                topicData.keyPoints = [
                    "Understand the basic Islamic concept",
                    "Learn the authentic sources and references",
                    "Apply the teachings to daily life",
                    "Connect to broader Islamic principles",
                    "Develop deeper spiritual understanding"
                ];
            }
            
            if (!topicData.arabicTerms || !Array.isArray(topicData.arabicTerms)) {
                topicData.arabicTerms = [];
            }
            
            if (!topicData.authenticSources || !Array.isArray(topicData.authenticSources)) {
                topicData.authenticSources = ["Based on authentic Islamic sources"];
            }
            
            console.log('🕌 Generated Islamic topic data:', topicData);
            
            this.islamicData.currentTopic = topicData;
            this.islamicData.lastTopicDate = new Date().toLocaleDateString();
            
            this.displayTopic(topicData);
            await this.saveProgress();
            
        } catch (error) {
            console.error('Error generating Islamic topic:', error);
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
        
        // Create key points HTML (moved to top)
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
        
        // Create Arabic terms HTML (collapsible, starts minimized)
        let arabicTermsHTML = '';
        if (topic.arabicTerms && Array.isArray(topic.arabicTerms) && topic.arabicTerms.length > 0) {
            arabicTermsHTML = `
                <div class="arabic-terms-section collapsible-section">
                    <h4 class="collapsible-header" onclick="toggleCollapsible(this)">
                        <i class="fa-solid fa-language"></i> Arabic Terms:
                        <i class="fa-solid fa-chevron-right collapsible-icon"></i>
                    </h4>
                    <div class="arabic-terms-list collapsible-content">
                        ${topic.arabicTerms.map(term => `
                            <div class="arabic-term">
                                <span class="arabic-text">${term.arabic}</span>
                                <span class="translation">${term.translation}</span>
                                <span class="meaning">${term.meaning}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        // Create sources HTML (collapsible, starts minimized)
        let sourcesHTML = '';
        if (topic.authenticSources && Array.isArray(topic.authenticSources)) {
            sourcesHTML = `
                <div class="sources-section collapsible-section">
                    <h4 class="collapsible-header" onclick="toggleCollapsible(this)">
                        <i class="fa-solid fa-book-open"></i> Authentic Sources:
                        <i class="fa-solid fa-chevron-right collapsible-icon"></i>
                    </h4>
                    <div class="sources-list collapsible-content">
                        ${topic.authenticSources.map(source => `<li>${source}</li>`).join('')}
                    </div>
                </div>
            `;
        }
        
        topicContent.innerHTML = `
            <div class="topic-title">${topic.title}</div>
            <div class="topic-description">${topic.description}</div>
            <div class="topic-category">${topic.category} • <span class="difficulty-rank ${topic.difficulty?.toLowerCase()}">${topic.difficulty || 'E'}</span></div>
            ${keyPointsHTML}
            ${arabicTermsHTML}
            ${sourcesHTML}
        `;
        
        startQuizBtn.style.display = 'inline-flex';
        
        // Update button text based on quiz status
        if (this.islamicData.quizResults) {
            startQuizBtn.innerHTML = '<i class="fa-solid fa-eye"></i> View Results';
            startQuizBtn.onclick = () => this.showResultsInterface();
        } else {
            startQuizBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start Quiz';
            startQuizBtn.onclick = () => this.startQuiz();
        }
        
        // Ensure quest box expands to fit content
        this.expandQuestBox();
    }
    
    expandQuestBox() {
        const questBox = document.querySelector('.quest-box');
        if (questBox) {
            // Force a reflow to ensure proper height calculation
            questBox.style.height = 'auto';
            questBox.offsetHeight; // Trigger reflow
            
            // Add a small delay to ensure content is fully rendered
            setTimeout(() => {
                questBox.style.height = 'auto';
                questBox.style.overflow = 'visible';
            }, 100);
        }
    }
    
    async startQuiz() {
        if (this.islamicData.quizResults) {
            console.log('🕌 Quiz already completed today, showing results');
            this.showResultsInterface();
            return;
        }
        
        if (this.islamicData.quizData) {
            // Quiz already exists - fix it if it's missing options or has corrupted types
            this.currentQuiz = this.fixQuizData(this.islamicData.quizData);
            
            // Update the stored quiz data with the fixed version
            this.islamicData.quizData = this.currentQuiz;
            await this.saveProgress();
            
            console.log('🕌 Using existing quiz data for today');
            console.log('🕌 Fixed quiz data:', this.currentQuiz);
        } else {
            // Generate new quiz
            console.log('🕌 Generating new Islamic quiz for today');
            await this.generateQuiz();
        }
        
        // Double-check quiz wasn't completed while generating
        if (this.islamicData.quizResults) {
            console.log('🕌 Quiz was completed while generating, showing results');
            this.showResultsInterface();
            return;
        }
        
        this.currentQuestionIndex = 0;
        this.userAnswers = new Array(this.currentQuiz.length).fill(null);
        this.timeLeft = 180;
        this.isQuizActive = true;
        
        this.showQuizInterface();
        this.displayQuestion();
        this.startTimer();
        
        // Ensure quest box expands for quiz content
        this.expandQuestBox();
        
        console.log('🕌 Quiz started successfully');
    }
    
    async generateQuiz() {
        const startQuizBtn = document.getElementById('start-quiz-btn');
        startQuizBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating Quiz...';
        startQuizBtn.disabled = true;
        
        try {
            // Call Gemini API for Islamic quiz generation
            const GEMINI_API_KEY = 'AIzaSyAtL-nZJQ_rBdK72qvn5ocgbf6bgUPlgNo';
            const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent';
            
                         const prompt = `Create 5 engaging Islamic quiz questions about: ${this.islamicData.currentTopic.title} - ${this.islamicData.currentTopic.description}

 DIFFICULTY: ${this.islamicData.currentTopic.difficulty} Rank (${this.getDifficultyDescription(this.islamicData.currentTopic.difficulty)})

 KEY LEARNING POINTS TO FOCUS ON:
 ${this.islamicData.currentTopic.keyPoints ? this.islamicData.currentTopic.keyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n') : 'General Islamic knowledge of the topic'}

 ARABIC TERMS TO INCLUDE:
 ${this.islamicData.currentTopic.arabicTerms ? this.islamicData.currentTopic.arabicTerms.map(term => `${term.arabic} (${term.translation})`).join(', ') : 'None specified'}

 CRITICAL REQUIREMENTS:
 - Questions MUST be based on authentic Islamic knowledge
 - Include Arabic terms where appropriate
 - Reference authentic sources (Quran, Sahih Hadith, scholarly consensus)
 - Make questions engaging and educational for teenagers
 - Ensure accuracy and respect for Islamic traditions
 - Mix question types: multiple choice, true/false
 - Each question MUST include ALL required fields
 - For true/false questions, ALWAYS include options: ["True", "False"]
 - For multiple choice questions, ALWAYS include exactly 4 options

 Please provide a response in this exact JSON format:
 {
   "questions": [
     {
       "question": "Question text here?",
       "type": "multiple_choice",
       "options": ["Option A", "Option B", "Option C", "Option D"],
       "correctAnswer": "Option A",
       "explanation": "Brief explanation with Islamic context",
       "arabicTerm": "Arabic term if applicable",
       "source": "Quran: Surah:Verse or Hadith reference"
     },
     {
       "question": "True or False question here?",
       "type": "true_false",
       "options": ["True", "False"],
       "correctAnswer": "True",
       "explanation": "Brief explanation with Islamic context",
       "arabicTerm": "Arabic term if applicable",
       "source": "Quran: Surah:Verse or Hadith reference"
     }
   ]
 }

 Make questions that test understanding of Islamic principles while being engaging and educational.`;

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
            
            if (quizData.questions && quizData.questions.length > 0) {
                this.currentQuiz = quizData.questions;
                this.islamicData.quizData = quizData.questions;
                await this.saveProgress();
            } else {
                throw new Error('No questions generated');
            }
            
        } catch (error) {
            console.error('Error generating Islamic quiz:', error);
            startQuizBtn.innerHTML = '<i class="fa-solid fa-exclamation-triangle"></i> AI Generation Failed';
            startQuizBtn.style.background = 'linear-gradient(135deg, #ff6b6b, #ee5a52)';
            startQuizBtn.onclick = () => location.reload();
            
            this.showNotification('AI quiz generation failed. Please try again.', 'error');
        }
        
        startQuizBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start Quiz';
        startQuizBtn.disabled = false;
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
    
    showQuizInterface() {
        document.getElementById('topic-section').style.display = 'none';
        document.getElementById('quiz-section').style.display = 'block';
        document.getElementById('results-section').style.display = 'none';
        
        // Update quiz header with difficulty info
        const quizHeader = document.querySelector('.quiz-section h2');
        if (quizHeader && this.islamicData.currentTopic) {
            const difficulty = this.islamicData.currentTopic.difficulty || 'E';
            quizHeader.innerHTML = `Islamic Knowledge Quiz - <span class="difficulty-rank ${difficulty.toLowerCase()}">${difficulty}</span> Rank`;
        }
    }
    
    displayQuestion() {
        const question = this.currentQuiz[this.currentQuestionIndex];
        const questionContainer = document.getElementById('question-container');
        const questionCounter = document.getElementById('question-counter');
        const progressFill = document.getElementById('progress-fill');
        
        console.log('🕌 Displaying question:', this.currentQuestionIndex, 'Question:', question);
        console.log('🕌 Question options:', question.options);
        console.log('🕌 Question type:', question.type);
        
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
                console.log(`🕌 Option ${index}: "${option}", isSelected: ${isSelected}`);
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
                console.log(`🕌 Option ${index}: "${option}", isSelected: ${isSelected}`);
                optionsHTML += `
                    <div class="answer-option ${isSelected ? 'selected' : ''}" data-option="${index}" data-value="${option}">
                        <input type="radio" name="q${this.currentQuestionIndex}" value="${option}" ${isSelected ? 'checked' : ''}>
                        <label>${option}</label>
                    </div>
                `;
            });
        } else {
            console.error('🕌 Invalid question structure after fixing:', question);
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
        
        // Add Arabic term and source if available
        let additionalInfo = '';
        if (question.arabicTerm) {
            additionalInfo += `<div class="arabic-term-display"><strong>Arabic:</strong> ${question.arabicTerm}</div>`;
        }
        if (question.source) {
            additionalInfo += `<div class="source-display"><strong>Source:</strong> ${question.source}</div>`;
        }
        
        questionContainer.innerHTML = `
            <div class="question-type">${question.type.replace('_', ' ').toUpperCase()}</div>
            <div class="question-text">${question.question}</div>
            ${additionalInfo}
            <div class="answer-options">
                ${optionsHTML}
            </div>
        `;
        
        console.log('🕌 Generated HTML for options:', optionsHTML);
        
        // Add click event listeners to answer options
        const answerOptions = questionContainer.querySelectorAll('.answer-option');
        answerOptions.forEach((option, index) => {
            option.addEventListener('click', () => {
                const value = option.getAttribute('data-value');
                console.log('🕌 Option clicked:', index, 'Value:', value);
                this.selectAnswer(value);
            });
        });
        
        this.updateQuizControls();
    }
    
    selectAnswer(answer) {
        console.log('🕌 Selecting answer:', answer, 'for question:', this.currentQuestionIndex);
        this.userAnswers[this.currentQuestionIndex] = answer;
        
        const options = document.querySelectorAll('.answer-option');
        console.log('🕌 Found options:', options.length);
        
        options.forEach((option, index) => {
            option.classList.remove('selected');
            const radio = option.querySelector('input[type="radio"]');
            console.log(`🕌 Option ${index}:`, option.textContent.trim(), 'Radio value:', radio?.value, 'Matches answer:', radio?.value === answer);
            
            if (radio && radio.value === answer) {
                option.classList.add('selected');
                radio.checked = true;
                console.log('🕌 Selected option:', index);
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
                console.log('🕌 Time ran out, auto-submitting quiz');
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
        
        timerElement.className = 'timer';
        if (this.timeLeft <= 30) {
            timerElement.classList.add('danger');
        } else if (this.timeLeft <= 60) {
            timerElement.classList.add('warning');
        }
    }
    
    async submitQuiz() {
        // Prevent multiple submissions
        if (!this.isQuizActive || this.islamicData.quizResults) {
            console.log('🕌 Quiz already submitted or not active, ignoring duplicate submission');
            return;
        }
        
        console.log('🕌 Submitting Islamic quiz...');
        
        // Clear timer and set to null to prevent further calls
        if (this.quizTimer) {
            clearInterval(this.quizTimer);
            this.quizTimer = null;
        }
        
        // Also clear any remaining time to prevent further timer events
        this.timeLeft = 0;
        this.isQuizActive = false;
        
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
                explanation: question.explanation,
                arabicTerm: question.arabicTerm,
                source: question.source
            });
        });
        
        const score = Math.round((correctAnswers / this.currentQuiz.length) * 100);
        this.quizResults = { score, correctAnswers, totalQuestions: this.currentQuiz.length, results };
        
        // Mark as completed immediately to prevent re-submission
        this.islamicData.quizResults = this.quizResults;
        
        this.updateProgress(score);
        this.showResults();
        
        // Save only once
        await this.saveProgress();
        
        console.log('🕌 Islamic quiz results saved successfully');
    }
    
    showResultsInterface() {
        // Clear any active timer when showing results
        if (this.quizTimer) {
            clearInterval(this.quizTimer);
            this.quizTimer = null;
        }
        
        document.getElementById('topic-section').style.display = 'none';
        document.getElementById('quiz-section').style.display = 'none';
        document.getElementById('results-section').style.display = 'block';
        
        this.quizResults = this.islamicData.quizResults;
        this.showResults();
    }
    
    updateProgress(score) {
        const progress = this.islamicData.userProgress;
        const currentDate = new Date().toLocaleDateString();
        
        // Prevent multiple progress updates for the same quiz
        if (progress.lastQuizDate === currentDate && this.islamicData.quizResults) {
            console.log('🕌 Progress already updated today, skipping duplicate update');
            return;
        }
        
        console.log('🕌 Updating progress with score:', score);
        
        progress.score += score;
        progress.totalQuizzes++;
        
        if (progress.lastQuizDate === currentDate) {
            // Already completed today
            console.log('🕌 Already completed today, streak maintained');
        } else if (progress.lastQuizDate === this.getYesterdayDate()) {
            progress.streak++;
            console.log('🕌 Streak continued:', progress.streak);
        } else {
            progress.streak = 1;
            console.log('🕌 New streak started');
        }
        
        progress.lastQuizDate = currentDate;
        this.updateProgressDisplay();
        
        console.log('🕌 Progress updated - Score:', progress.score, 'Quizzes:', progress.totalQuizzes, 'Streak:', progress.streak);
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
                    <div class="value">${this.islamicData.userProgress.streak}</div>
                    <div class="label">Day Streak</div>
                </div>
            </div>
        `;
        
        let reviewHTML = '';
        this.quizResults.results.forEach((result, index) => {
            let additionalInfo = '';
            if (result.arabicTerm) {
                additionalInfo += `<div class="review-arabic">Arabic: ${result.arabicTerm}</div>`;
            }
            if (result.source) {
                additionalInfo += `<div class="review-source">Source: ${result.source}</div>`;
            }
            
            reviewHTML += `
                <div class="review-item ${result.isCorrect ? 'correct' : 'incorrect'}">
                    <div class="review-question">${index + 1}. ${result.question}</div>
                    <div class="review-answer">Your answer: ${result.userAnswer || 'No answer'}</div>
                    ${!result.isCorrect ? `<div class="review-correct">Correct: ${result.correctAnswer}</div>` : ''}
                    <div class="review-explanation">${result.explanation}</div>
                    ${additionalInfo}
                </div>
            `;
        });
        answersReview.innerHTML = reviewHTML;
        
        const tomorrowMessage = document.createElement('div');
        tomorrowMessage.className = 'tomorrow-message';
        tomorrowMessage.innerHTML = `
            <div style="text-align: center; margin-top: 20px; padding: 15px; background: rgba(0, 255, 255, 0.1); border-radius: 10px; border: 1px solid rgba(0, 255, 255, 0.3);">
                <i class="fa-solid fa-calendar-day" style="font-size: 1.5rem; color: #00ffff; margin-bottom: 10px;"></i>
                <p style="margin: 0; color: #00ffff; font-size: 1.1rem; font-weight: 500;">Come back tomorrow for new Islamic knowledge!</p>
            </div>
        `;
        answersReview.appendChild(tomorrowMessage);
        
        this.applyRewards();
        // Mark daily quest complete regardless of score; completion is about participation
        this.completeDailyQuest();
    }
    
    applyRewards() {
        const rewards = {
            xp: this.quizResults.score * 2,
            wisdom: this.quizResults.score / 20
        };
        
        this.showNotification(`Islamic training completed! +${rewards.xp} XP, +${rewards.wisdom.toFixed(1)} WIS`);
        
        try {
            if (this.userManager && this.userManager.hasUserId()) {
                const userData = this.userManager.getData();
                const gameData = userData.gameData || {};
                
                gameData.exp = (gameData.exp || 0) + rewards.xp;
                gameData.stackedAttributes = gameData.stackedAttributes || {};
                gameData.stackedAttributes.WIS = (gameData.stackedAttributes.WIS || 0) + rewards.wisdom;
                
                this.userManager.setData('gameData', gameData);
                this.userManager.saveUserData();
            } else {
                const savedData = JSON.parse(localStorage.getItem("gameData")) || {};
                savedData.exp = (savedData.exp || 0) + rewards.xp;
                savedData.stackedAttributes = savedData.stackedAttributes || {};
                savedData.stackedAttributes.WIS = (savedData.stackedAttributes.WIS || 0) + rewards.wisdom;
                localStorage.setItem("gameData", JSON.stringify(savedData));
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
        console.log('📝 Showing "come back tomorrow" message');
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

// Toggle collapsible sections with smooth animation
function toggleCollapsible(header) {
    const content = header.nextElementSibling;
    const icon = header.querySelector('.collapsible-icon');
    
    if (content.classList.contains('expanded')) {
        // Collapse
        content.classList.remove('expanded');
        icon.className = 'fa-solid fa-chevron-right collapsible-icon';
        icon.style.transform = 'rotate(0deg)';
    } else {
        // Expand
        content.classList.add('expanded');
        icon.className = 'fa-solid fa-chevron-down collapsible-icon';
        icon.style.transform = 'rotate(0deg)';
    }
}

// Initialize the Islamic training manager when the page loads
let islamicTrainingManager;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Islamic Training page loaded, initializing...');
    
    userManager = new UserManager();
    window.userManager = userManager;
    
    const existingPlayerName = localStorage.getItem('playerName');
    
    if (existingPlayerName) {
        await loadExistingPlayerData(existingPlayerName);
    } else {
        islamicTrainingManager = new IslamicTrainingManager();
        await islamicTrainingManager.initialize();
    }
    
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

// Load existing player data
async function loadExistingPlayerData(playerName) {
    try {
        const result = await userManager.setUserId(playerName);
        
        if (result.dataFound) {
            console.log('Loading existing player data for:', playerName);
            const existingData = userManager.getData();
            console.log('Existing data retrieved:', existingData);
        } else {
            console.log('Creating new player data for:', playerName);
            const initialData = userManager.createInitialData(playerName);
            await userManager.saveUserData();
            console.log('Initial data saved for new player');
        }
        
        islamicTrainingManager = new IslamicTrainingManager();
        await islamicTrainingManager.initialize();
        
    } catch (error) {
        console.error('Error loading existing player data:', error);
        islamicTrainingManager = new IslamicTrainingManager();
        await islamicTrainingManager.initialize();
    }
}

// Global functions for backward compatibility
function selectAnswer(answer) {
    if (islamicTrainingManager) {
        islamicTrainingManager.selectAnswer(answer);
    }
}

// Sync to database function
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
