import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { storage } from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize default GPT account from cookies.json if not already exists
 */
export async function initializeDefaultGPTAccount() {
  try {
    console.log('🔍 Checking for default GPT account...');
    
    // Check if any accounts exist
    const existingAccounts = await storage.getGPTAccounts();
    
    // If "zeeshan ahmed" already exists, skip
    const zeeshanExists = existingAccounts.some(
      acc => acc.name.toLowerCase() === 'zeeshan ahmed'
    );
    
    if (zeeshanExists) {
      console.log('✅ Default GPT account "zeeshan ahmed" already exists');
      return;
    }
    
    // Read cookies.json from root
    const cookiesPath = path.join(__dirname, '..', '..', 'cookies.json');
    
    if (!fs.existsSync(cookiesPath)) {
      console.warn('⚠️ cookies.json not found, skipping default account creation');
      return;
    }
    
    const cookiesContent = fs.readFileSync(cookiesPath, 'utf8');
    const cookies = JSON.parse(cookiesContent);
    
    // Create default account
    await storage.createGPTAccount({
      name: 'zeeshan ahmed',
      cookies: cookies
    });
    
    console.log('✅ Default GPT account "zeeshan ahmed" created successfully');
  } catch (error) {
    console.error('❌ Error initializing default GPT account:', error);
    // Don't throw - this is optional initialization
  }
}
