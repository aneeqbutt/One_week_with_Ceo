/**
 * VA Campaign Prompt Generator
 * Generates prompts for single and multiple repository VA campaigns
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load prompt template from file
 */
function loadPromptTemplate(filename) {
  try {
    const promptPath = path.join(__dirname, '..', '..', 'prompts', filename);
    return fs.readFileSync(promptPath, 'utf-8');
  } catch (error) {
    console.error(`Failed to load prompt template: ${filename}`, error);
    throw new Error(`Prompt template file not found: ${filename}`);
  }
}

/**
 * Generate prompt for single repository with multiple features
 */
export function generateSingleRepoPrompt(descriptions, platform = 'bitbash') {
  // Parse comma-separated descriptions
  const features = descriptions
    .split(',')
    .map(d => d.trim())
    .filter(d => d.length > 0);

  if (features.length === 0) {
    throw new Error('No valid descriptions provided');
  }

  // Use first description as main keyword
  const mainKeyword = features[0];
  const additionalFeatures = features.slice(1);
  
  // Load prompt template
  let promptTemplate = loadPromptTemplate('va-single-repo.txt');
  
  // Replace placeholders
  promptTemplate = promptTemplate
    .replace(/{KEYWORD}/g, mainKeyword)
    .replace(/{FEATURES}/g, features.join(', '))
    .replace(/{AUTOMATION_IDEA}/g, features.join('; '))
    .replace(/{REPO_NAME}/g, 'automation-bot')
    .replace(/{ADDITIONAL_FEATURES}/g, 
      additionalFeatures.map(feature => 
        `| ${feature} | Explain how this feature works, focusing on automation behavior and purpose. |`
      ).join('\n')
    );

  return promptTemplate;
}

/**
 * Generate prompt for multiple repositories (one per keyword)
 */
export function generateMultipleRepoPrompt(keyword, platform = 'bitbash') {
  // Load prompt template
  let promptTemplate = loadPromptTemplate('va-multiple-repo.txt');
  
  // Replace placeholders
  promptTemplate = promptTemplate
    .replace(/{KEYWORD}/g, keyword)
    .replace(/{REPO_NAME}/g, 'automation-bot');

  return promptTemplate;
}

/**
 * Process VA campaign and generate prompts based on type
 */
export function processVACampaign(vaRepoType, descriptions, platform = 'bitbash') {
  // Validate descriptions parameter
  if (!descriptions || typeof descriptions !== 'string') {
    console.error('Invalid descriptions parameter:', descriptions);
    throw new Error('VA Campaign descriptions are required and must be a string');
  }

  if (vaRepoType === 'single') {
    return [{
      type: 'single',
      platform,
      prompt: generateSingleRepoPrompt(descriptions, platform)
    }];
  } else {
    // Multiple repos - one prompt per line
    const keywords = descriptions
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (keywords.length === 0) {
      throw new Error('No valid descriptions found for multiple repo VA campaign');
    }

    return keywords.map(keyword => ({
      type: 'multiple',
      keyword,
      platform,
      prompt: generateMultipleRepoPrompt(keyword, platform)
    }));
  }
}
