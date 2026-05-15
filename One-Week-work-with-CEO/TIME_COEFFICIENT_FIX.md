# Time Coefficient Fix - Dynamic Delay System

## Problem

The current system uses a fixed delay between repos (e.g., 2 seconds), but doesn't account for the actual time it takes to create a repository. If a repo takes 2 minutes to create and you want 9 repos per hour (1 repo every ~6.67 minutes), the current system would create repos every 2min + 2sec instead of every 6.67 minutes.

## Solution

Implement a **slot-based timing system** where:

1. Each repo gets an allocated time slot (e.g., 6.67 minutes for 9 repos/hour)
2. The campaign manager measures how long it actually took to create the repo
3. It then waits for the remaining time to fill the allocated slot

### Example:

- **Target**: 9 repos per hour = 6.67 minutes (400,000ms) per repo
- **Actual creation time**: 2 minutes (120,000ms)
- **Additional delay needed**: 4.67 minutes (280,000ms)
- **Total time per repo**: Exactly 6.67 minutes ✅

## Files Changed

### 1. CreateCampaignModal.jsx

- Changed `minDelay` → `intervalMs` in timeCoefficients
- Calculate `slotIntervalMs` from repos per hour
- Send both `slotIntervalMs` and legacy `delayBetweenRepos` to backend

### 2. storage.js

- Store `slotIntervalMs` in campaign document
- Store `reposPerHour` for reference

### 3. campaignManager.js

- Track start time before creating each repo
- Measure actual creation time
- Calculate remaining time to reach slot interval
- Add dynamic delay (but minimum 2 seconds for safety)

## Testing

After this fix:

1. Create a campaign with "Custom" = 9 repos per hour
2. Watch the logs - you should see:
   - ⏱️ Slot allocated: 400000ms
   - ⏱️ Actual creation: 120000ms
   - ⏱️ Additional delay: 280000ms
3. Verify total campaign time matches estimate
