// Dynamic Player System - Makes all static details dynamic and responsive
// This system evolves player details based on actions, achievements, and progress

class DynamicPlayerSystem {
    constructor() {
        this.dynamicData = {
            // Real Ping System (network-based)
            ping: {
                current: 60,
                lastMeasured: null,
                measurementHistory: []
            },
            
            // Static Guild System (for future multiplayer)
            guild: {
                current: "Reaper",
                rank: "Member"
            },
            
            // Solo Leveling Race System
            race: {
                current: "Hunter",
                evolution: "Human"
            },
            
            // Solo Leveling Title System (ARCHITECT controlled)
            title: {
                current: "None",
                earned: [],
                active: "None",
                titleHistory: []
            },
            
            // Real Geolocation System
            region: {
                current: "Unknown",
                country: "Unknown",
                coordinates: null,
                lastUpdated: null
            },
            
            // Real Location System (GPS-based)
            location: {
                current: "Unknown",
                coordinates: null,
                address: null,
                lastUpdated: null,
                locationHistory: [],
                accuracy: "unknown"
            },
            
            // Solo Leveling Job System (ARCHITECT controlled)
            job: {
                current: "None",
                rank: "None",
                specializations: [],
                jobHistory: [],
                skills: {},
                jobChangeAvailable: false
            }
        };
        
        this.achievementSystem = new AchievementSystem();
        this.locationSystem = new LocationSystem();
        this.pingSystem = new PingSystem();
    }
    
    // Initialize dynamic system with player data
    async initialize(playerData) {
        console.log('🔮 Initializing Dynamic Player System...');
        
        // Load existing dynamic data if available
        if (playerData.dynamicData) {
            this.dynamicData = { ...this.dynamicData, ...playerData.dynamicData };
        }
        
        // Initialize real systems
        await this.pingSystem.initialize();
        await this.locationSystem.initialize();
        
        // Update all dynamic values based on current player state
        await this.updateAllDynamicValues(playerData);
        
        console.log('🔮 Dynamic Player System initialized');
    }
    
    // Update all dynamic values based on player state
    async updateAllDynamicValues(playerData) {
        await this.updatePing();
        this.updateRace(playerData);
        this.updateTitle(playerData);
        await this.updateRegion();
        await this.updateLocation();
        this.updateJob(playerData);
    }
    
    // Real Ping System (network-based)
    async updatePing() {
        const measuredPing = await this.pingSystem.measurePing();
        this.dynamicData.ping.current = measuredPing;
        this.dynamicData.ping.lastMeasured = Date.now();
        
        // Store measurement history (keep last 10)
        this.dynamicData.ping.measurementHistory.push({
            ping: measuredPing,
            timestamp: Date.now()
        });
        
        if (this.dynamicData.ping.measurementHistory.length > 10) {
            this.dynamicData.ping.measurementHistory.shift();
        }
    }
    
    // Solo Leveling Race System (evolves with level)
    updateRace(playerData) {
        const level = playerData.level || 1;
        
        // Race evolution based on level (like Sung Jin-Woo's progression)
        if (level >= 200) {
            this.dynamicData.race.evolution = "Shadow Monarch";
            this.dynamicData.race.current = "Shadow Monarch";
        } else if (level >= 150) {
            this.dynamicData.race.evolution = "S-Rank Hunter";
            this.dynamicData.race.current = "S-Rank Hunter";
        } else if (level >= 100) {
            this.dynamicData.race.evolution = "A-Rank Hunter";
            this.dynamicData.race.current = "A-Rank Hunter";
        } else if (level >= 75) {
            this.dynamicData.race.evolution = "B-Rank Hunter";
            this.dynamicData.race.current = "B-Rank Hunter";
        } else if (level >= 50) {
            this.dynamicData.race.evolution = "C-Rank Hunter";
            this.dynamicData.race.current = "C-Rank Hunter";
        } else if (level >= 25) {
            this.dynamicData.race.evolution = "D-Rank Hunter";
            this.dynamicData.race.current = "D-Rank Hunter";
        } else if (level >= 10) {
            this.dynamicData.race.evolution = "E-Rank Hunter";
            this.dynamicData.race.current = "E-Rank Hunter";
        } else {
            this.dynamicData.race.evolution = "Novice Hunter";
            this.dynamicData.race.current = "Novice Hunter";
        }
    }
    
    // Solo Leveling Title System (ARCHITECT controlled)
    updateTitle(playerData) {
        const level = playerData.level || 1;
        const attributes = playerData.Attributes || {};
        
        // Base titles based on level (ARCHITECT can override)
        const newTitles = [];
        
        // Solo Leveling inspired titles
        if (level >= 200) newTitles.push("Shadow Monarch");
        if (level >= 150) newTitles.push("The Greatest Hunter");
        if (level >= 100) newTitles.push("The Strongest Hunter");
        if (level >= 75) newTitles.push("The Elite Hunter");
        if (level >= 50) newTitles.push("The Skilled Hunter");
        if (level >= 25) newTitles.push("The Lone Hunter");
        if (level >= 10) newTitles.push("The Rising Hunter");
        if (level >= 1) newTitles.push("The Weakest Hunter");
        
        // Add new titles
        newTitles.forEach(title => {
            if (!this.dynamicData.title.earned.includes(title)) {
                this.dynamicData.title.earned.push(title);
            }
        });
        
        // Set current title to highest earned (ARCHITECT can override)
        if (this.dynamicData.title.earned.length > 0) {
            this.dynamicData.title.current = this.dynamicData.title.earned[this.dynamicData.title.earned.length - 1];
        }
    }
    
    // Real Region System (OpenStreetMap)
    async updateRegion() {
        const locationData = await this.locationSystem.getCurrentLocation();
        if (locationData && locationData.country) {
            // Extract country abbreviation from the full location string
            const countryAbbreviation = this.extractCountryAbbreviation(locationData.address, locationData.country);
            
            this.dynamicData.region.current = countryAbbreviation;
            this.dynamicData.region.country = locationData.country;
            this.dynamicData.region.coordinates = locationData.coordinates;
            this.dynamicData.region.lastUpdated = Date.now();
        }
    }
    
    // Extract country abbreviation from location data
    extractCountryAbbreviation(address, country) {
        if (!address || !country) return "UN";
        
        // Common country abbreviations mapping
        const countryAbbreviations = {
            'Tunisia': 'TN',
            'United States': 'US',
            'United Kingdom': 'UK',
            'France': 'FR',
            'Germany': 'DE',
            'Canada': 'CA',
            'Australia': 'AU',
            'Japan': 'JP',
            'China': 'CN',
            'India': 'IN',
            'Brazil': 'BR',
            'Mexico': 'MX',
            'Italy': 'IT',
            'Spain': 'ES',
            'Netherlands': 'NL',
            'Sweden': 'SE',
            'Norway': 'NO',
            'Denmark': 'DK',
            'Finland': 'FI',
            'Poland': 'PL',
            'Russia': 'RU',
            'South Korea': 'KR',
            'Singapore': 'SG',
            'Malaysia': 'MY',
            'Thailand': 'TH',
            'Vietnam': 'VN',
            'Philippines': 'PH',
            'Indonesia': 'ID',
            'Egypt': 'EG',
            'Morocco': 'MA',
            'Algeria': 'DZ',
            'Libya': 'LY',
            'Saudi Arabia': 'SA',
            'UAE': 'AE',
            'Qatar': 'QA',
            'Kuwait': 'KW',
            'Bahrain': 'BH',
            'Oman': 'OM',
            'Jordan': 'JO',
            'Lebanon': 'LB',
            'Syria': 'SY',
            'Iraq': 'IQ',
            'Iran': 'IR',
            'Turkey': 'TR',
            'Israel': 'IL',
            'Palestine': 'PS',
            'Yemen': 'YE',
            'Sudan': 'SD',
            'Ethiopia': 'ET',
            'Kenya': 'KE',
            'Nigeria': 'NG',
            'South Africa': 'ZA',
            'Ghana': 'GH',
            'Uganda': 'UG',
            'Tanzania': 'TZ',
            'Rwanda': 'RW',
            'Burundi': 'BI',
            'DR Congo': 'CD',
            'Congo': 'CG',
            'Central African Republic': 'CF',
            'Chad': 'TD',
            'Cameroon': 'CM',
            'Gabon': 'GA',
            'Equatorial Guinea': 'GQ',
            'São Tomé and Príncipe': 'ST',
            'Angola': 'AO',
            'Zambia': 'ZM',
            'Zimbabwe': 'ZW',
            'Botswana': 'BW',
            'Namibia': 'NA',
            'Lesotho': 'LS',
            'Eswatini': 'SZ',
            'Mozambique': 'MZ',
            'Madagascar': 'MG',
            'Mauritius': 'MU',
            'Seychelles': 'SC',
            'Comoros': 'KM',
            'Mayotte': 'YT',
            'Réunion': 'RE'
        };
        
        // Try to find the country in the address string
        const addressLower = address.toLowerCase();
        const countryLower = country.toLowerCase();
        
        // First, try exact country match
        if (countryAbbreviations[country]) {
            return countryAbbreviations[country];
        }
        
        // If no exact match, try to find country in address
        for (const [countryName, abbreviation] of Object.entries(countryAbbreviations)) {
            if (addressLower.includes(countryName.toLowerCase())) {
                return abbreviation;
            }
        }
        
        // If still no match, try to extract from common patterns
        // Look for patterns like "City, State, Country" or "City, Country"
        const parts = address.split(',').map(part => part.trim());
        const lastPart = parts[parts.length - 1];
        
        // Check if last part is a country
        for (const [countryName, abbreviation] of Object.entries(countryAbbreviations)) {
            if (lastPart.toLowerCase().includes(countryName.toLowerCase())) {
                return abbreviation;
            }
        }
        
        // Fallback: try to extract from the country field directly
        if (country && country.length <= 3) {
            return country.toUpperCase();
        }
        
        // Final fallback
        return "UN";
    }
    
    // Real Location System (GPS-based)
    async updateLocation() {
        const locationData = await this.locationSystem.getCurrentLocation();
        if (locationData) {
            const previousLocation = this.dynamicData.location.current;
            this.dynamicData.location.current = locationData.address || "Unknown";
            this.dynamicData.location.coordinates = locationData.coordinates;
            this.dynamicData.location.address = locationData.address;
            this.dynamicData.location.accuracy = locationData.accuracy || "unknown";
            this.dynamicData.location.lastUpdated = Date.now();
            
            // Track location history
            if (previousLocation !== this.dynamicData.location.current) {
                this.dynamicData.location.locationHistory.push({
                    location: this.dynamicData.location.current,
                    coordinates: locationData.coordinates,
                    accuracy: locationData.accuracy,
                    timestamp: Date.now()
                });
                
                // Keep only last 20 locations
                if (this.dynamicData.location.locationHistory.length > 20) {
                    this.dynamicData.location.locationHistory.shift();
                }
            }
        }
    }
    
    // Solo Leveling Job System (ARCHITECT controlled)
    updateJob(playerData) {
        const level = playerData.level || 1;
        const attributes = playerData.Attributes || {};
        
        // Job specializations based on attributes
        const specializations = [];
        
        if (attributes.INT >= 50) specializations.push("Necromancer");
        if (attributes.STR >= 50) specializations.push("Warrior");
        if (attributes.AGI >= 50) specializations.push("Assassin");
        if (attributes.VIT >= 50) specializations.push("Tank");
        if (attributes.PER >= 50) specializations.push("Scout");
        if (attributes.WIS >= 50) specializations.push("Sage");
        
        this.dynamicData.job.specializations = specializations;
        
        // Job rank based on level (ARCHITECT can trigger job changes)
        if (level >= 200) {
            this.dynamicData.job.rank = "Shadow Monarch";
        } else if (level >= 150) {
            this.dynamicData.job.rank = "S-Rank";
        } else if (level >= 100) {
            this.dynamicData.job.rank = "A-Rank";
        } else if (level >= 75) {
            this.dynamicData.job.rank = "B-Rank";
        } else if (level >= 50) {
            this.dynamicData.job.rank = "C-Rank";
        } else if (level >= 25) {
            this.dynamicData.job.rank = "D-Rank";
        } else if (level >= 10) {
            this.dynamicData.job.rank = "E-Rank";
        } else {
            this.dynamicData.job.rank = "Novice";
        }
        
        // Check if job change should be available (ARCHITECT decision)
        this.checkJobChangeAvailability(playerData);
    }
    
    // Check if job change should be available
    checkJobChangeAvailability(playerData) {
        const level = playerData.level || 1;
        const attributes = playerData.Attributes || {};
        
        // Job change milestones (ARCHITECT can override)
        const milestones = [25, 50, 75, 100, 150, 200];
        const currentMilestone = milestones.find(m => level >= m) || 0;
        
        // Check if player has enough attributes for job change
        const hasRequiredAttributes = Object.values(attributes).some(attr => attr >= 30);
        
        this.dynamicData.job.jobChangeAvailable = 
            milestones.includes(level) && hasRequiredAttributes;
    }
    
    // Get all dynamic values for display
    getDynamicValues() {
        return {
            ping: `${this.dynamicData.ping.current} ms`,
            guild: `${this.dynamicData.guild.current} (${this.dynamicData.guild.rank})`,
            race: this.dynamicData.race.current,
            title: this.dynamicData.title.current,
            region: this.dynamicData.region.current,
            location: this.dynamicData.location.current,
            job: this.dynamicData.job.current || this.dynamicData.job.rank
        };
    }
    
    // Get detailed dynamic data for saving
    getDetailedData() {
        return this.dynamicData;
    }
    
    // Get location data for THE ARCHITECT
    getLocationData() {
        return {
            coordinates: this.dynamicData.location.coordinates,
            address: this.dynamicData.location.address,
            region: this.dynamicData.region.current,
            country: this.dynamicData.region.country,
            accuracy: this.dynamicData.location.accuracy || "unknown"
        };
    }
    
    // Get location accuracy information for display
    getLocationAccuracyInfo() {
        const accuracy = this.dynamicData.location.accuracy;
        if (accuracy === "geocoded") {
            return "📍 GPS + Geocoded";
        } else if (accuracy === "approximate") {
            return "📍 GPS Coordinates";
        } else {
            return "📍 Unknown";
        }
    }
    
    // Process player action and update dynamics
    async processAction(action, playerData) {
        console.log(`🔮 Processing action: ${action}`);
        
        switch (action) {
            case 'level_up':
                this.handleLevelUp(playerData);
                break;
            case 'quest_complete':
                this.handleQuestComplete(playerData);
                break;
            case 'attribute_increase':
                this.handleAttributeIncrease(playerData);
                break;
            case 'location_change':
                this.handleLocationChange(playerData);
                break;
            case 'job_change':
                this.handleJobChange(playerData);
                break;
        }
        
        await this.updateAllDynamicValues(playerData);
    }
    
    // Handle level up events
    handleLevelUp(playerData) {
        const level = playerData.level;
        console.log(`🔮 Level up detected: ${level}`);
        
        // Special level milestones for job changes
        if ([25, 50, 75, 100, 150, 200].includes(level)) {
            this.dynamicData.job.jobChangeAvailable = true;
            console.log(`🔮 Job change available at level ${level}`);
        }
    }
    
    // Handle quest completion
    handleQuestComplete(playerData) {
        // Update job progress
        if (this.dynamicData.job.jobChangeAvailable) {
            console.log('🔮 Job change quest completed');
            this.dynamicData.job.jobChangeAvailable = false;
        }
    }
    
    // Handle attribute increases
    handleAttributeIncrease(playerData) {
        const attributes = playerData.Attributes;
        
        // Check for attribute milestones
        Object.entries(attributes).forEach(([attr, value]) => {
            if (value >= 50 && !this.dynamicData.title.earned.includes(`${attr} Master`)) {
                this.dynamicData.title.earned.push(`${attr} Master`);
            }
        });
    }
    
    // Handle location changes
    handleLocationChange(playerData) {
        // Track time spent in locations
        const currentLocation = this.dynamicData.location.current;
        if (!this.dynamicData.location.timeSpent) {
            this.dynamicData.location.timeSpent = {};
        }
        if (!this.dynamicData.location.timeSpent[currentLocation]) {
            this.dynamicData.location.timeSpent[currentLocation] = 0;
        }
        this.dynamicData.location.timeSpent[currentLocation] += 1;
    }
    
    // Handle job change
    handleJobChange(playerData) {
        const level = playerData.level || 1;
        const specializations = this.dynamicData.job.specializations;
        
        // Determine new job based on level and specializations
        if (level >= 200) {
            this.dynamicData.job.current = "Shadow Monarch";
        } else if (level >= 150 && specializations.includes("Necromancer")) {
            this.dynamicData.job.current = "Shadow Necromancer";
        } else if (level >= 100 && specializations.length >= 2) {
            this.dynamicData.job.current = "Hybrid Hunter";
        } else if (specializations.length > 0) {
            this.dynamicData.job.current = specializations[0];
        } else {
            this.dynamicData.job.current = "Hunter";
        }
        
        // Record job change
        this.dynamicData.job.jobHistory.push({
            from: this.dynamicData.job.current,
            to: this.dynamicData.job.current,
            level: level,
            timestamp: Date.now()
        });
    }
}

// Real Ping System
class PingSystem {
    constructor() {
        this.pingEndpoint = '/api/ping-test';
        this.lastPing = 60;
    }
    
    async initialize() {
        console.log('🔮 Initializing Ping System...');
        await this.measurePing();
    }
    
    async measurePing() {
        try {
            const start = performance.now();
            const response = await fetch(this.pingEndpoint, { 
                method: 'HEAD',
                cache: 'no-cache'
            });
            const end = performance.now();
            
            if (response.ok) {
                const ping = Math.round(end - start);
                this.lastPing = ping;
                return ping;
            } else {
                return this.lastPing;
            }
        } catch (error) {
            console.log('🔮 Ping measurement failed, using cached value');
            return this.lastPing;
        }
    }
}

// Real Location System (OpenStreetMap)
class LocationSystem {
    constructor() {
        this.nominatimUrl = 'https://nominatim.openstreetmap.org/reverse';
        this.lastLocation = null;
        this.locationCache = new Map();
    }
    
    async initialize() {
        console.log('🔮 Initializing Location System...');
        await this.getCurrentLocation();
    }
    
    async getCurrentLocation() {
        try {
            // Get GPS coordinates
            const position = await this.getGPSPosition();
            if (!position) {
                return this.lastLocation;
            }
            
            const { latitude, longitude } = position;
            
            // Use more precise coordinates for better accuracy
            const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
            
            // Check cache first
            if (this.locationCache.has(cacheKey)) {
                const cached = this.locationCache.get(cacheKey);
                if (Date.now() - cached.timestamp < 300000) { // 5 minutes cache
                    this.lastLocation = cached.data;
                    return cached.data;
                }
            }
            
            // Try multiple geocoding services for better accuracy
            let locationData = await this.tryMultipleGeocodingServices(latitude, longitude);
            
            // Cache the result
            this.locationCache.set(cacheKey, {
                data: locationData,
                timestamp: Date.now()
            });
            
            this.lastLocation = locationData;
            return locationData;
            
        } catch (error) {
            console.log('🔮 Location detection failed:', error);
            return this.lastLocation;
        }
    }
    
    // Try multiple geocoding services for better accuracy
    async tryMultipleGeocodingServices(latitude, longitude) {
        // First try OpenStreetMap with higher zoom level for more detail
        try {
            const osmAddress = await this.reverseGeocodeOSM(latitude, longitude, 18); // Maximum zoom
            if (osmAddress && osmAddress.display_name) {
                return this.createLocationData(osmAddress, latitude, longitude);
            }
        } catch (error) {
            console.log('🔮 OpenStreetMap geocoding failed, trying alternatives...');
        }
        
        // Fallback to OpenStreetMap with standard zoom
        try {
            const osmAddress = await this.reverseGeocodeOSM(latitude, longitude, 10);
            if (osmAddress && osmAddress.display_name) {
                return this.createLocationData(osmAddress, latitude, longitude);
            }
        } catch (error) {
            console.log('🔮 OpenStreetMap fallback failed');
        }
        
        // Final fallback - create location from coordinates
        return this.createLocationFromCoordinates(latitude, longitude);
    }
    
    // Create location data from geocoding result
    createLocationData(address, latitude, longitude) {
        // Extract country from address if not provided by API
        let country = address.country;
        if (!country && address.display_name) {
            country = this.extractCountryFromAddress(address.display_name);
        }
        
        return {
            coordinates: { lat: latitude, lng: longitude },
            address: address.display_name || "Unknown Location",
            country: country || "Unknown",
            countryCode: address.country_code?.toUpperCase() || "UN",
            timestamp: Date.now(),
            accuracy: "geocoded"
        };
    }
    
    // Create location data from coordinates when geocoding fails
    createLocationFromCoordinates(latitude, longitude) {
        // Try to determine approximate location from coordinates
        const approximateLocation = this.getApproximateLocationFromCoordinates(latitude, longitude);
        
        return {
            coordinates: { lat: latitude, lng: longitude },
            address: approximateLocation,
            country: this.extractCountryFromAddress(approximateLocation),
            countryCode: "UN",
            timestamp: Date.now(),
            accuracy: "approximate"
        };
    }
    
    // Get approximate location from coordinates
    getApproximateLocationFromCoordinates(latitude, longitude) {
        // This is a simplified approach - in a real app you might use a local database
        // For now, we'll create a readable coordinate-based location
        
        const latDir = latitude >= 0 ? 'N' : 'S';
        const lngDir = longitude >= 0 ? 'E' : 'W';
        const latAbs = Math.abs(latitude).toFixed(4);
        const lngAbs = Math.abs(longitude).toFixed(4);
        
        return `Coordinates: ${latAbs}°${latDir}, ${lngAbs}°${lngDir}`;
    }
    
    getGPSPosition() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }
            
            // Try to get high accuracy position first
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const accuracy = position.coords.accuracy;
                    console.log(`🔮 GPS position obtained with accuracy: ${accuracy} meters`);
                    
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: accuracy
                    });
                },
                (error) => {
                    console.log('🔮 High accuracy GPS failed, trying standard accuracy...');
                    
                    // Fallback to standard accuracy
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const accuracy = position.coords.accuracy;
                            console.log(`🔮 Standard GPS position obtained with accuracy: ${accuracy} meters`);
                            
                            resolve({
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                                accuracy: accuracy
                            });
                        },
                        (fallbackError) => {
                            console.log('🔮 GPS access denied or failed:', fallbackError.message);
                            resolve(null);
                        },
                        {
                            enableHighAccuracy: false,
                            timeout: 15000,
                            maximumAge: 600000 // 10 minutes
                        }
                    );
                },
                {
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 300000 // 5 minutes
                }
            );
        });
    }
    
    async reverseGeocodeOSM(lat, lng, zoom = 10) {
        try {
            const url = `${this.nominatimUrl}?format=json&lat=${lat}&lon=${lng}&zoom=${zoom}&addressdetails=1`;
            const response = await fetch(url);
            const data = await response.json();
            return data;
        } catch (error) {
            console.log('🔮 OpenStreetMap reverse geocoding failed:', error);
            return {
                display_name: "Unknown Location",
                country: "Unknown",
                country_code: "UN"
            };
        }
    }
    
    // Legacy method for backward compatibility
    async reverseGeocode(lat, lng) {
        return await this.reverseGeocodeOSM(lat, lng, 10);
    }
    
    // Extract country from address string
    extractCountryFromAddress(address) {
        if (!address) return "Unknown";
        
        // Common country names that might appear in addresses
        const countryNames = [
            'Tunisia', 'United States', 'United Kingdom', 'France', 'Germany', 'Canada', 'Australia',
            'Japan', 'China', 'India', 'Brazil', 'Mexico', 'Italy', 'Spain', 'Netherlands', 'Sweden',
            'Norway', 'Denmark', 'Finland', 'Poland', 'Russia', 'South Korea', 'Singapore', 'Malaysia',
            'Thailand', 'Vietnam', 'Philippines', 'Indonesia', 'Egypt', 'Morocco', 'Algeria', 'Libya',
            'Saudi Arabia', 'UAE', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Jordan', 'Lebanon', 'Syria',
            'Iraq', 'Iran', 'Turkey', 'Israel', 'Palestine', 'Yemen', 'Sudan', 'Ethiopia', 'Kenya',
            'Nigeria', 'South Africa', 'Ghana', 'Uganda', 'Tanzania', 'Rwanda', 'Burundi', 'DR Congo',
            'Congo', 'Central African Republic', 'Chad', 'Cameroon', 'Gabon', 'Equatorial Guinea',
            'São Tomé and Príncipe', 'Angola', 'Zambia', 'Zimbabwe', 'Botswana', 'Namibia', 'Lesotho',
            'Eswatini', 'Mozambique', 'Madagascar', 'Mauritius', 'Seychelles', 'Comoros', 'Mayotte', 'Réunion'
        ];
        
        const addressLower = address.toLowerCase();
        
        // Try to find country in address
        for (const countryName of countryNames) {
            if (addressLower.includes(countryName.toLowerCase())) {
                return countryName;
            }
        }
        
        // If no country found, try to extract from the last part of the address
        const parts = address.split(',').map(part => part.trim());
        const lastPart = parts[parts.length - 1];
        
        // Check if last part is a country
        for (const countryName of countryNames) {
            if (lastPart.toLowerCase().includes(countryName.toLowerCase())) {
                return countryName;
            }
        }
        
        return "Unknown";
    }
}

// Achievement System for tracking accomplishments
class AchievementSystem {
    constructor() {
        this.achievements = new Map();
        this.unlockedAchievements = new Set();
    }
    
    // Check and unlock achievements
    checkAchievements(playerData) {
        const level = playerData.level || 1;
        const attributes = playerData.Attributes || {};
        
        // Level achievements
        if (level >= 25 && !this.unlockedAchievements.has('level_25')) {
            this.unlockAchievement('level_25', 'Pathfinder', 'Reached level 25');
        }
        if (level >= 50 && !this.unlockedAchievements.has('level_50')) {
            this.unlockAchievement('level_50', 'Ascendant', 'Reached level 50');
        }
        if (level >= 100 && !this.unlockedAchievements.has('level_100')) {
            this.unlockAchievement('level_100', 'Transcendent', 'Reached level 100');
        }
        
        // Attribute achievements
        Object.entries(attributes).forEach(([attr, value]) => {
            if (value >= 50 && !this.unlockedAchievements.has(`${attr}_50`)) {
                this.unlockAchievement(`${attr}_50`, `${attr} Master`, `Reached ${attr} 50`);
            }
        });
    }
    
    unlockAchievement(id, title, description) {
        this.unlockedAchievements.add(id);
        this.achievements.set(id, { title, description, unlockedAt: Date.now() });
        console.log(`🏆 Achievement unlocked: ${title} - ${description}`);
    }
}

// Global instance
window.dynamicPlayerSystem = new DynamicPlayerSystem();
