// config.js - Configuration settings for GoLogin automation

module.exports = {
    // GoLogin API Configuration
    gologin: {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NjdkZjY2MDAwMjUxYmVhZTBlNzE4NTMiLCJ0eXBlIjoiZGV2Iwiand0aWQiOiI2OTAxZWFkMWQ5ZDQwMGQwNWVhNTRlOGYifQ.V1bHwt59yXUbP8wODHM_K0Pa2Ipf0wv8l06cP8zthmc',
        apiUrl: 'https://api.gologin.com'
    },

    // Timing Configuration (in milliseconds)
    delays: {
        // Delay between processing profiles
        betweenProfiles: {
            min: 5000,    // 5 seconds
            max: 10000    // 10 seconds
        },
        
        // Delay before starring after scrolling
        beforeStar: {
            min: 1000,    // 1 second
            max: 3000     // 3 seconds
        },
        
        // Delay between scroll actions
        betweenScrolls: {
            min: 1000,    // 1 second
            max: 3000     // 3 seconds
        },
        
        // Delay after starring before closing
        afterStar: {
            min: 2000,    // 2 seconds
            max: 5000     // 5 seconds
        }
    },

    // Scrolling Behavior Configuration
    scrolling: {
        // Number of scroll actions
        actions: {
            min: 3,
            max: 5
        },
        
        // Scroll distance in pixels
        distance: {
            min: 300,
            max: 800
        },
        
        // Probability of scrolling down (0-1)
        // 0.7 means 70% chance of scrolling down, 30% up
        downProbability: 0.7
    },

    // Browser Configuration
    browser: {
        // Page timeout for navigation (in milliseconds)
        navigationTimeout: 30000,  // 30 seconds
        
        // Timeout for waiting for elements
        elementTimeout: 10000      // 10 seconds
    },

    // Logging Configuration
    logging: {
        // Filename for logs
        logFile: 'gologin-automation-logs.txt',
        
        // Console output verbosity
        verbose: true
    }
};
