import { askChatGPTForRepoMetadata } from './chatgptScraper.js'; // Adjust path as needed
import fs from 'fs';
import path from 'path';
import electron from 'electron';
const { app } = electron;

// Test function for the ChatGPT scraper
async function testChatGPTScraper() {
  console.log('\n🧪 ===== STARTING CHATGPT SCRAPER TEST =====');
  console.log('📅 Test started at:', new Date().toISOString());
  console.log('===========================================\n');

  // Test configurations
  const testCases = [
    {
      name: 'Basic Test - Simple Keyword',
      config: {
        keyword: 'weather app',
        questions: [],
        projectName: 'github repo generator'
      }
    },
    {
      name: 'Test with Questions',
      config: {
        keyword: 'task manager',
        questions: [
          'Should it support multiple users?',
          'What database should it use?',
          'Should it have a REST API?'
        ],
        projectName: 'github repo generator'
      }
    },
    {
      name: 'Complex Project Test',
      config: {
        keyword: 'e-commerce platform',
        questions: [
          'Include payment gateway integration',
          'Support for multiple currencies',
          'Admin dashboard required',
          'Mobile responsive design',
          'Real-time inventory tracking'
        ],
        projectName: 'github repo generator'
      }
    }
  ];

  // Progress callback to track execution
  const onProgress = (message) => {
    console.log(`⏳ [${new Date().toLocaleTimeString()}] ${message}`);
  };

  // Results array to store all test results
  const results = [];

  // Pre-test: Check if cookies.json exists
  console.log('📋 ===== PRE-TEST CHECKS =====');
  try {
    const userDataPath = app.getPath('userData');
    const cookiesPath = path.join(userDataPath, 'cookies.json');
    const altCookiesPath = path.join(process.cwd(), 'cookies.json');
    
    console.log('📁 Checking for cookies.json...');
    console.log('  - userData path:', cookiesPath);
    console.log('  - Current dir path:', altCookiesPath);
    
    if (fs.existsSync(cookiesPath)) {
      console.log('✅ cookies.json found in userData');
      const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
      console.log('✅ Cookie structure:', Object.keys(cookies));
    } else if (fs.existsSync(altCookiesPath)) {
      console.log('✅ cookies.json found in current directory');
      const cookies = JSON.parse(fs.readFileSync(altCookiesPath, 'utf-8'));
      console.log('✅ Cookie structure:', Object.keys(cookies));
    } else {
      console.error('❌ cookies.json not found!');
      console.log('\n📝 Please create cookies.json with the following structure:');
      console.log(JSON.stringify({ sessionToken: "your_session_token_here" }, null, 2));
      return;
    }
  } catch (error) {
    console.error('❌ Pre-test check failed:', error.message);
    return;
  }
  console.log('=============================\n');

  // Run test cases
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`\n📊 ===== TEST CASE ${i + 1}/${testCases.length} =====`);
    console.log(`📝 Name: ${testCase.name}`);
    console.log(`🔑 Keyword: ${testCase.config.keyword}`);
    console.log(`❓ Questions: ${testCase.config.questions.length}`);
    console.log('=====================================\n');

    const startTime = Date.now();
    
    try {
      console.log('🚀 Starting scraper...');
      const result = await askChatGPTForRepoMetadata(testCase.config, onProgress);
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      console.log('\n✅ ===== TEST PASSED =====');
      console.log(`⏱️ Duration: ${duration} seconds`);
      console.log('\n📦 Result Summary:');
      console.log('  - Repo Name:', result.repo_name);
      console.log('  - Description:', result.description?.substring(0, 100) + '...');
      console.log('  - Topics:', result.topics?.join(', ') || 'None');
      console.log('  - README Length:', result.readme?.length || 0, 'characters');
      console.log('  - Issues Count:', result.issues?.length || 0);
      
      // Validate result structure
      console.log('\n✔️ Validation:');
      const validations = {
        'repo_name exists': !!result.repo_name,
        'description exists': !!result.description,
        'readme exists': !!result.readme,
        'topics is array': Array.isArray(result.topics),
        'issues is array': Array.isArray(result.issues),
        'readme is markdown': result.readme?.includes('#') || result.readme?.includes('##'),
      };
      
      Object.entries(validations).forEach(([check, passed]) => {
        console.log(`  ${passed ? '✅' : '❌'} ${check}`);
      });
      
      // Store result
      results.push({
        testCase: testCase.name,
        success: true,
        duration,
        result,
        validations
      });
      
      // Save result to file
      const outputDir = path.join(process.cwd(), 'test-results');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filename = `test-${i + 1}-${Date.now()}.json`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
      console.log(`\n💾 Result saved to: ${filepath}`);
      
    } catch (error) {
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      console.error('\n❌ ===== TEST FAILED =====');
      console.error(`⏱️ Duration: ${duration} seconds`);
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
      
      // Store error result
      results.push({
        testCase: testCase.name,
        success: false,
        duration,
        error: error.message,
        stack: error.stack
      });
    }
    
    console.log('==========================\n');
    
    // Add delay between tests to avoid rate limiting
    if (i < testCases.length - 1) {
      console.log('⏳ Waiting 5 seconds before next test...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Final summary
  console.log('\n📊 ===== TEST SUMMARY =====');
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  console.log('\nDetailed Results:');
  
  results.forEach((result, idx) => {
    const icon = result.success ? '✅' : '❌';
    const status = result.success ? 'PASSED' : 'FAILED';
    console.log(`\n${idx + 1}. ${icon} ${result.testCase} - ${status}`);
    console.log(`   Duration: ${result.duration}s`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    if (result.validations) {
      const failedValidations = Object.entries(result.validations)
        .filter(([_, passed]) => !passed)
        .map(([check]) => check);
      if (failedValidations.length > 0) {
        console.log(`   Failed validations: ${failedValidations.join(', ')}`);
      }
    }
  });
  
  // Save summary
  const summaryPath = path.join(process.cwd(), 'test-results', `summary-${Date.now()}.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Summary saved to: ${summaryPath}`);
  
  console.log('\n🧪 ===== TEST COMPLETE =====\n');
}

// Individual component test functions
async function testCookieLoading() {
  console.log('\n🍪 ===== TESTING COOKIE LOADING =====');
  
  try {
    const userDataPath = app.getPath('userData');
    const cookiesPath = path.join(userDataPath, 'cookies.json');
    
    // Test 1: Check if file exists
    console.log('Test 1: File existence');
    if (fs.existsSync(cookiesPath)) {
      console.log('✅ cookies.json exists');
    } else {
      console.log('❌ cookies.json not found');
      return false;
    }
    
    // Test 2: Check if file is valid JSON
    console.log('\nTest 2: JSON validity');
    const data = fs.readFileSync(cookiesPath, 'utf-8');
    const cookies = JSON.parse(data);
    console.log('✅ Valid JSON');
    
    // Test 3: Check if sessionToken exists
    console.log('\nTest 3: Session token presence');
    if (cookies.sessionToken) {
      console.log('✅ Session token found');
      console.log('Token length:', cookies.sessionToken.length);
    } else {
      console.log('❌ Session token missing');
      return false;
    }
    
    console.log('\n✅ All cookie tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Cookie test failed:', error.message);
    return false;
  }
}

// Quick test with minimal configuration
async function quickTest() {
  console.log('\n⚡ ===== QUICK TEST =====');
  
  try {
    const result = await askChatGPTForRepoMetadata({
      keyword: 'calculator app',
      questions: ['Should it have scientific functions?'],
      projectName: 'github repo generator'
    }, (msg) => console.log(`  > ${msg}`));
    
    console.log('\n✅ Quick test successful!');
    console.log('Result:', {
      repo_name: result.repo_name,
      topics: result.topics,
      issues_count: result.issues?.length || 0
    });
    
    return result;
  } catch (error) {
    console.error('❌ Quick test failed:', error.message);
    return null;
  }
}

// Mock test without actual browser (for testing the structure)
async function mockTest() {
  console.log('\n🎭 ===== MOCK TEST (No Browser) =====');
  
  // Simulate the response structure
  const mockResponse = {
    repo_name: "awesome-weather-app",
    description: "A modern weather application with real-time updates",
    topics: ["weather", "javascript", "api", "frontend"],
    readme: "# Awesome Weather App\n\n## Description\nA modern weather application...",
    issues: [
      { title: "Add geolocation support", body: "Implement automatic location detection" },
      { title: "Dark mode", body: "Add dark mode toggle" }
    ]
  };
  
  console.log('📦 Mock response generated');
  console.log('Structure validation:');
  console.log('  ✅ repo_name:', typeof mockResponse.repo_name === 'string');
  console.log('  ✅ description:', typeof mockResponse.description === 'string');
  console.log('  ✅ topics:', Array.isArray(mockResponse.topics));
  console.log('  ✅ readme:', typeof mockResponse.readme === 'string');
  console.log('  ✅ issues:', Array.isArray(mockResponse.issues));
  
  return mockResponse;
}

// Export test functions
export { 
  testChatGPTScraper, 
  testCookieLoading, 
  quickTest,
  mockTest
};

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    console.log('🚀 Running ChatGPT Scraper Tests...\n');
    
    // Choose which test to run based on command line argument
    const testType = process.argv[2] || 'full';
    
    switch(testType) {
      case 'cookie':
        await testCookieLoading();
        break;
      case 'quick':
        await quickTest();
        break;
      case 'mock':
        await mockTest();
        break;
      case 'full':
      default:
        await testChatGPTScraper();
        break;
    }
    
    process.exit(0);
  })();
}