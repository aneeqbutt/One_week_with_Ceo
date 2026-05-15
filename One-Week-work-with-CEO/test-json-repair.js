import { extractAndRepairJSON, normalizeJobFilterResponse } from './src/utils/jsonRepairUtil.js';

/**
 * Test suite for JSON repair utility
 * Tests various malformed JSON scenarios from GPT responses
 */

console.log('🧪 Testing JSON Repair Utility\n');

const testCases = [
  {
    name: 'Valid JSON',
    input: '```json\n{"saas_viable": "Yes", "niche": "Scraping"}\n```',
    expected: { saas_viable: 'Yes', niche: 'Scraping' }
  },
  {
    name: 'Trailing comma',
    input: '{"saas_viable": "Yes", "niche": "Automation",}',
    expected: { saas_viable: 'Yes', niche: 'Automation' }
  },
  {
    name: 'Unquoted keys',
    input: '{saas_viable: "No", niche: "None"}',
    expected: { saas_viable: 'No', niche: 'None' }
  },
  {
    name: 'Single quotes',
    input: "{'saas_viable': 'Yes', 'niche': 'Scraping'}",
    expected: { saas_viable: 'Yes', niche: 'Scraping' }
  },
  {
    name: 'Mixed quotes and trailing comma',
    input: '{saas_viable: "Yes", niche: \'Automation\',}',
    expected: { saas_viable: 'Yes', niche: 'Automation' }
  },
  {
    name: 'With comments',
    input: '{\n  "saas_viable": "Yes", // This looks good\n  "niche": "Scraping"\n}',
    expected: { saas_viable: 'Yes', niche: 'Scraping' }
  },
  {
    name: 'Boolean instead of string',
    input: '{"saas_viable": true, "niche": "Automation"}',
    expected: { saas_viable: 'Yes', niche: 'Automation' }
  },
  {
    name: 'Nested in markdown',
    input: 'Here is my analysis:\n\n```json\n{\n  "saas_viable": "Yes",\n  "niche": "Scraping"\n}\n```\n\nThis looks promising.',
    expected: { saas_viable: 'Yes', niche: 'Scraping' }
  },
  {
    name: 'Extra text around JSON',
    input: 'Based on the job description, here is my assessment: {"saas_viable": "No", "niche": "None"} I hope this helps!',
    expected: { saas_viable: 'No', niche: 'None' }
  },
  {
    name: 'Alternative field names',
    input: '{"viable": true, "category": "Automation"}',
    expected: { saas_viable: 'Yes', niche: 'Automation' }
  }
];

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  console.log(`\n📝 Test: ${testCase.name}`);
  console.log(`   Input: ${testCase.input.substring(0, 60)}...`);
  
  try {
    // Extract and repair
    const parsed = extractAndRepairJSON(testCase.input, '   ');
    
    // Normalize
    const normalized = normalizeJobFilterResponse(parsed);
    
    // Check if it matches expected
    const matches = 
      normalized.saas_viable === testCase.expected.saas_viable &&
      normalized.niche === testCase.expected.niche;
    
    if (matches) {
      console.log(`   ✅ PASS - Got: ${JSON.stringify(normalized)}`);
      passed++;
    } else {
      console.log(`   ❌ FAIL - Expected: ${JSON.stringify(testCase.expected)}`);
      console.log(`           Got: ${JSON.stringify(normalized)}`);
      failed++;
    }
    
  } catch (error) {
    console.log(`   ❌ FAIL - Error: ${error.message}`);
    failed++;
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(60)}\n`);

if (failed === 0) {
  console.log('🎉 All tests passed!');
  process.exit(0);
} else {
  console.log('⚠️ Some tests failed.');
  process.exit(1);
}
