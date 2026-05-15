/**
 * Diagnostic script to check account groups and GitHub accounts in MongoDB
 */

import { MongoClient } from 'mongodb';

const MONGODB_URI = "mongodb+srv://malikjaishasohail:luffyandsa123@cluster0.8zl9g3j.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const DB_NAME = 'github_automation';

async function checkAccounts() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(DB_NAME);
    const accountGroupsCollection = db.collection('accountGroups');
    const githubAccountsCollection = db.collection('githubAccounts');
    
    // Check account groups
    console.log('📋 ===== ACCOUNT GROUPS =====');
    const groups = await accountGroupsCollection.find({}).toArray();
    console.log(`Total groups: ${groups.length}\n`);
    
    for (const group of groups) {
      console.log(`Group: ${group.name}`);
      console.log(`  ID: ${group.id}`);
      console.log(`  Created: ${group.createdAt}`);
      
      // Count accounts in this group
      const accountCount = await githubAccountsCollection.countDocuments({ groupId: group.id });
      console.log(`  Accounts: ${accountCount}\n`);
    }
    
    // Check all GitHub accounts
    console.log('👥 ===== GITHUB ACCOUNTS =====');
    const accounts = await githubAccountsCollection.find({}).toArray();
    console.log(`Total accounts: ${accounts.length}\n`);
    
    for (const account of accounts) {
      console.log(`Account: ${account.username}`);
      console.log(`  ID: ${account.id}`);
      console.log(`  Group ID: ${account.groupId}`);
      console.log(`  Status: ${account.status}`);
      console.log(`  Repo Count: ${account.repoCount || 0}`);
      console.log(`  Last Used: ${account.lastUsed || 'Never'}`);
      console.log(`  Created: ${account.createdAt}\n`);
    }
    
    // Check for orphaned accounts (accounts without a valid group)
    console.log('🔍 ===== CHECKING FOR ORPHANED ACCOUNTS =====');
    const groupIds = new Set(groups.map(g => g.id));
    const orphanedAccounts = accounts.filter(acc => !groupIds.has(acc.groupId));
    
    if (orphanedAccounts.length > 0) {
      console.log(`⚠️ Found ${orphanedAccounts.length} orphaned accounts:\n`);
      for (const account of orphanedAccounts) {
        console.log(`  - ${account.username} (Group ID: ${account.groupId})`);
      }
    } else {
      console.log('✅ No orphaned accounts found\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

checkAccounts().catch(console.error);
