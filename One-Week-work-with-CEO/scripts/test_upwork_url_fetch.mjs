#!/usr/bin/env node
// Quick debug script to exercise URL-based Upwork fetch with payment verification.
import { upworkJobService } from '../src/services/upworkJobService.js';

async function run() {
  const sampleUrl = process.argv[2] || 'https://www.upwork.com/nx/search/jobs/?payment_verified=1&q=browser%20automation&sort=recency&per_page=5';
  console.log('\n=== Test Upwork URL Fetch ===');
  console.log('Input URL:', sampleUrl);
  try {
    const jobs = await upworkJobService.fetchJobs(sampleUrl, 10);
    console.log(`\nReturned ${jobs.length} jobs after payment verification filter.`);
    jobs.forEach((j, i) => {
      const id = j.id || j.ciphertext || j.openingId || 'unknown';
      console.log(`${i + 1}. ${j.title} | id=${id}`);
    });
  } catch (e) {
    console.error('Test failed:', e);
    process.exitCode = 1;
  }
}
run();
