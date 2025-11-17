// Pick Your Topic Page Logic
// Centralized completion tracking for all research domains

let userManager;
let currentUserData;

document.addEventListener("DOMContentLoaded", function() {
    console.log('Pick Your Topic page loaded');
    
    // Initialize user manager
    initializeUserManager();
});

async function initializeUserManager() {
    try {
        // Check if player name exists
        const playerName = localStorage.getItem('playerName');
        if (!playerName) {
            console.log('No player name found, redirecting to alarm page');
            window.location.href = 'alarm.html';
            return;
        }
        
        userManager = new UserManager();
        window.userManager = userManager;
        
        // Set the user ID and load data
        await userManager.setUserId(playerName);
        
        currentUserData = userManager.getData();
        
        console.log('User data loaded:', currentUserData);
        
        // Load and display completion status
        loadCompletionStatus();
        
        // Set up event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Error initializing user manager:', error);
    }
}

function loadCompletionStatus() {
    if (!currentUserData) {
        console.log('No user data available yet');
        return;
    }
    
    console.log('Loading completion status for all domains...');
    
    // Get completion status for each domain
    const domains = [
        { key: 'historyResearchData', checkboxId: 'history-checkbox', name: 'History' },
        { key: 'geographyResearchData', checkboxId: 'geography-checkbox', name: 'Geography' },
        { key: 'economicsResearchData', checkboxId: 'economics-checkbox', name: 'Economics' },
        { key: 'politicsResearchData', checkboxId: 'politics-checkbox', name: 'Politics' },
        { key: 'scienceResearchData', checkboxId: 'science-checkbox', name: 'Science' }
    ];
    
    let completedCount = 0;
    
    domains.forEach(domain => {
        const domainData = currentUserData[domain.key];
        const checkbox = document.getElementById(domain.checkboxId);
        
        console.log(`Checking ${domain.name} completion:`, domainData);
        
        if (domainData && domainData.userProgress && domainData.userProgress.lastQuizDate) {
            // Handle the date format properly - it's stored as DD/MM/YYYY
            const rawDate = domainData.userProgress.lastQuizDate;
            console.log(`${domain.name} raw lastQuizDate:`, rawDate);
            
            // Parse DD/MM/YYYY format correctly
            const dateParts = rawDate.split('/');
            if (dateParts.length === 3) {
                const day = parseInt(dateParts[0]);
                const month = parseInt(dateParts[1]) - 1; // JavaScript months are 0-indexed
                const year = parseInt(dateParts[2]);
                const lastQuizDate = new Date(year, month, day);
                
                const today = new Date();
                
                console.log(`${domain.name} parsed lastQuizDate:`, lastQuizDate);
                console.log(`${domain.name} today:`, today);
                
                // Normalize dates to compare only the date part (ignore time)
                const lastQuizDateStr = lastQuizDate.toDateString();
                const todayStr = today.toDateString();
                const isToday = lastQuizDateStr === todayStr;
                
                console.log(`${domain.name} last quiz date:`, lastQuizDateStr, 'Today:', todayStr, 'Is today:', isToday);
                
                if (isToday && checkbox) {
                    checkbox.checked = true;
                    completedCount++;
                    console.log(`✅ ${domain.name} Research completed today`);
                }
            } else {
                console.log(`❌ ${domain.name} Invalid date format:`, rawDate);
            }
        } else {
            console.log(`❌ ${domain.name} Research not completed today`);
        }
    });
    
    console.log(`Total completed domains: ${completedCount}`);
    
    // Update overall completion status
    updateOverallCompletion(completedCount);
    
    // Update mental quest counter
    updateMentalQuestCounter(completedCount);
}

function updateOverallCompletion(completedCount) {
    const completeCheckbox = document.getElementById('complete');
    const completeSection = document.getElementById('complete-section');
    
    if (completeCheckbox && completeSection) {
        // Only mark as completed if ALL domains are completed (5 total)
        const totalDomains = 5;
        const allCompleted = completedCount >= totalDomains;
        
        if (allCompleted) {
            completeCheckbox.checked = true;
            completeSection.classList.add("animatedd");
            completeCheckbox.classList.add("animatedd");
            console.log(`🎉 All research domains completed! (${completedCount}/${totalDomains})`);
        } else {
            completeCheckbox.checked = false;
            completeSection.classList.remove("animatedd");
            completeCheckbox.classList.remove("animatedd");
            console.log(`Research progress: ${completedCount}/${totalDomains} domains completed`);
        }
    }
}

async function updateMentalQuestCounter(completedCount) {
    try {
        if (!userManager || !userManager.hasUserId()) return;
        
        const userData = userManager.getData();
        const gameData = userData.gameData || {};
        
        // Get current mental quest progress
        const mentalQuests = gameData.mentalQuests || '[0/3]';
        const match = mentalQuests.match(/\[(\d+)\/(\d+)\]/);
        const currentCompleted = match ? parseInt(match[1]) : 0;
        const totalQuests = match ? parseInt(match[2]) : 3;
        
        // Calculate new progress based on completed domains
        const newCompleted = Math.min(completedCount, totalQuests);
        
        // Only update if there's a change
        if (newCompleted !== currentCompleted) {
            gameData.mentalQuests = `[${newCompleted}/${totalQuests}]`;
            
            // Add EXP for each completed domain
            const expGain = (newCompleted - currentCompleted) * 5;
            if (expGain > 0) {
                gameData.exp = (gameData.exp || 0) + expGain;
                console.log(`EXP gained: +${expGain} (Total: ${gameData.exp})`);
            }
            
            // Add stacked attributes for mental training
            if (!gameData.stackedAttributes) {
                gameData.stackedAttributes = { STR: 0, VIT: 0, AGI: 0, INT: 0, PER: 0, WIS: 0 };
            }
            
            const attributeGain = newCompleted - currentCompleted;
            if (attributeGain > 0) {
                gameData.stackedAttributes.INT += attributeGain * 2;  // Intelligence from mental training
                gameData.stackedAttributes.PER += attributeGain * 1;  // Perception from research
            }
            
            // Update user data
            userManager.setData('gameData', gameData);
            
            // Save to database
            await userManager.saveUserData();
            
            console.log(`🎯 Research completion updated! Mental quests: ${mentalQuests} -> ${gameData.mentalQuests}`);
        }
        
    } catch (error) {
        console.error('Error updating mental quest counter:', error);
    }
}

function setupEventListeners() {
    // Set up navigation listeners for each domain
    const domains = [
        { id: 'historyQuests', url: 'history-research.html' },
        { id: 'geographyQuests', url: 'geography-research.html' },
        { id: 'economicsQuests', url: 'economics-research.html' },
        { id: 'politicsQuests', url: 'politics-research.html' },
        { id: 'scienceQuests', url: 'science-research.html' }
    ];
    
    domains.forEach(domain => {
        const element = document.getElementById(domain.id);
        if (element) {
            element.addEventListener('click', function() {
                console.log(`Navigating to ${domain.id}`);
                window.location.href = domain.url;
            });
        }
    });
    
    // Note: Checkboxes are disabled and read-only - they only reflect completion status
}

// Function to be called when returning from a research domain
function checkForCompletionUpdates() {
    console.log('Checking for completion updates...');
    
    // Reload user data to get latest completion status
    if (userManager) {
        userManager.loadUserData().then(() => {
            currentUserData = userManager.getData();
            loadCompletionStatus();
        });
    }
}

// Check for updates when page becomes visible (user returns from research domain)
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        checkForCompletionUpdates();
    }
});

// Also check on page focus
window.addEventListener('focus', function() {
    checkForCompletionUpdates();
});
