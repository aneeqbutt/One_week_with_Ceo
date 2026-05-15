# Account Group - GitHub Accounts Issue Fix

## Problem

You're getting the error: **"No accounts found in the selected group"** when trying to run a campaign with an Apify URL.

## Root Cause

The campaign is trying to fetch GitHub accounts from the selected account group, but the database query is returning 0 accounts. This could happen for several reasons:

1. **No accounts added to the group**: The account group exists but has no GitHub accounts
2. **Account groupId mismatch**: The accounts' `groupId` doesn't match the campaign's `accountGroupId`
3. **Database state issue**: Accounts were deleted or not properly saved

## Solution Steps

### Step 1: Run the Diagnostic Script

Run this command to check your database state:

```powershell
node scripts/check-accounts.mjs
```

This will show:

- All account groups and their IDs
- All GitHub accounts and their group associations
- Any orphaned accounts (accounts without valid groups)

### Step 2: Verify Account Group Has Accounts

1. Go to the **Account Groups** section in your dashboard
2. Check if your selected account group shows **"X accounts"**
3. If it shows **"0 accounts"**, you need to add accounts to this group

### Step 3: Add GitHub Accounts to the Group

1. Click on your account group
2. Click **"Add Account"**
3. Enter:
   - Username (GitHub username)
   - Access Token (GitHub personal access token)
4. Click **"Save"**
5. Repeat for all accounts you want to add

### Step 4: Verify in Console

After adding accounts, when you create a campaign, check the console output:

```
💾 Creating campaign in MongoDB: <campaign-id>
  Name: <campaign-name>
  Category: apify
  Account Group: <account-group-id>
  🔍 DEBUG: Type of accountGroupId: string
  GPT Account: <gpt-account-id>
```

When you start the campaign, you should see:

```
🔍 DEBUG: Querying accounts with groupId: <account-group-id>
🔍 DEBUG: Type of accountGroupId: string
🔍 DEBUG: Accounts returned: 1 (or more)
✅ Selected account: <username> (0 repos)
```

### Step 5: Check for Common Issues

#### Issue A: Empty String Account Group ID

If you see:

```
Account Group:
🔍 DEBUG: Type of accountGroupId: string
```

**Fix**: The campaign was created without selecting an account group. Delete and recreate the campaign, making sure to select an account group from the dropdown.

#### Issue B: Wrong Group ID Format

If you see:

```
🔍 DEBUG: Type of accountGroupId: number
```

**Fix**: The account group ID should be a string (usually generated with nanoid). This indicates a data integrity issue. Check the database directly.

#### Issue C: Orphaned Accounts

If the diagnostic script shows orphaned accounts, those accounts belong to a deleted group.

**Fix**: Delete and recreate those accounts in a valid group.

## Enhanced Error Messages

The code has been updated with better debugging. Now when the error occurs, you'll see:

```
Failed to process "<url>": No accounts found in the selected group (Group ID: <group-id>). Please add at least one GitHub account to this group before starting the campaign.
```

This tells you exactly which group ID is being queried.

## Prevention

To prevent this issue:

1. **Always add accounts after creating a group**
2. **Verify account count before creating campaigns**
3. **Don't delete account groups that are used in active campaigns**
4. **Check console logs** for debugging information

## Quick Test

To quickly test if your setup is working:

1. Create a new account group: "Test Group"
2. Add one GitHub account to "Test Group"
3. Create a new campaign with category "Apify"
4. Select "Test Group" as the account group
5. Add one Apify URL
6. Start the campaign
7. Check console - should see account selection successful

## Files Modified

1. `src/services/campaignManager.js` - Enhanced debugging in `getBestAccountFromGroup()`
2. `src/services/storage.js` - Enhanced debugging in `getGithubAccounts()` and campaign creation
3. `scripts/check-accounts.mjs` - New diagnostic script

## Need More Help?

If the issue persists:

1. Run the diagnostic script and share the output
2. Check the browser console (F12) for errors
3. Check the Electron main process console
4. Look for the debug logs with 🔍 emoji
