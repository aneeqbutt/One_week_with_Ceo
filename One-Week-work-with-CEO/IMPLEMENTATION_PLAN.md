# Time Coefficient Implementation Plan

## Changes Required

### 1. CreateCampaignModal.jsx

**Lines 23-47: Update timeCoefficients object**

```javascript
const timeCoefficients = {
  fast: {
    label: "Fast",
    description: "12 repos per hour", // Changed from "1 repo per 5 minutes"
    reposPerHour: 12,
    intervalMs: 300000, // 5 minutes - Changed from minDelay
  },
  balanced: {
    label: "Balanced",
    description: "4 repos per hour", // Changed from "1 repo per 15 minutes"
    reposPerHour: 4,
    intervalMs: 900000, // 15 minutes - Changed from minDelay
  },
  slow: {
    label: "Slow",
    description: "2 repos per hour", // Changed from "1 repo per 30 minutes"
    reposPerHour: 2,
    intervalMs: 1800000, // 30 minutes - Changed from minDelay
  },
  custom: {
    label: "Custom",
    description: "Set your own pace",
    reposPerHour: null,
    intervalMs: null, // Changed from minDelay
  },
};
```

**Lines 150-175: Update payload calculation**

```javascript
try {
  setLoading(true);

  // Calculate slot interval (allocated time per repo) based on coefficient
  let reposPerHour = null;
  if (formData.timeCoefficient === 'custom') {
    reposPerHour = formData.customReposPerHour;
  } else {
    reposPerHour = timeCoefficients[formData.timeCoefficient].reposPerHour;
  }

  const slotIntervalMs = reposPerHour ? Math.round(3600000 / reposPerHour) : 120000;

  const payload = {
    name: formData.name.trim(),
    category: formData.category,
    accountGroupId: formData.accountGroupId,
    gptAccountId: formData.gptAccountId,
    timeCoefficient: formData.timeCoefficient,
    // slotIntervalMs = allocated time per repo
    slotIntervalMs,
    reposPerHour,
  };
```

### 2. storage.js (createCampaign method)

**Add slotIntervalMs and reposPerHour to campaign document:**

```javascript
const campaign = {
  id: uuidv4(),
  name: campaignData.name,
  category: campaignData.category || "keywords",
  accountGroupId: campaignData.accountGroupId,
  gptAccountId: campaignData.gptAccountId,
  keywords: campaignData.keywords || "",
  apifyUrls: campaignData.apifyUrls || "",
  questions: campaignData.questions || "",
  slotIntervalMs: campaignData.slotIntervalMs || 120000, // NEW
  reposPerHour: campaignData.reposPerHour || 30, // NEW
  status: "Idle",
  progress: {
    processed: 0,
    total:
      campaignData.category === "apify"
        ? campaignData.apifyUrls?.split("\n").filter((l) => l.trim()).length ||
          0
        : campaignData.keywords?.split("\n").filter((l) => l.trim()).length ||
          0,
  },
  results: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
```

### 3. campaignManager.js

**In startCampaign method, add dynamic delay logic:**

Around line 265 (in the Apify flow):

```javascript
for (let i = 0; i < urls.length; i++) {
  if (!this.running.get(id)) {
    this.log(id, "info", "Campaign stopped by user");
    break;
  }

  const url = urls[i];
  this.log(id, "info", `\n📍 Processing URL ${i + 1}/${urls.length}: ${url}`);

  const startTime = Date.now(); // Track start time

  try {
    // ... existing repo creation logic ...

    this.log(id, "success", `✅ Successfully created: ${workflowResult.url}`);
  } catch (error) {
    // ... existing error handling ...
  }

  // Update progress
  this.updateProgress(id, i + 1, urls.length);

  // Dynamic delay based on allocated slot and actual creation time
  if (i < urls.length - 1) {
    const actualCreationTime = Date.now() - startTime;
    const slotInterval = campaign.slotIntervalMs || 120000; // Default 2 minutes
    const remainingTime = Math.max(2000, slotInterval - actualCreationTime); // Minimum 2s

    this.log(id, "info", `⏱️  Slot allocated: ${slotInterval}ms`);
    this.log(id, "info", `⏱️  Actual creation: ${actualCreationTime}ms`);
    this.log(id, "info", `⏱️  Additional delay: ${remainingTime}ms`);

    await new Promise((resolve) => setTimeout(resolve, remainingTime));
  }
}
```

Around line 450 (in the Keywords flow):

```javascript
for (let i = 0; i < metadataList.length; i++) {
  if (!this.running.get(id)) {
    this.log(id, "info", "Campaign stopped by user");
    break;
  }

  const meta = metadataList[i];
  const item = items[i];

  if (!meta) {
    results.push({
      item,
      status: "failed",
      error: "Metadata generation failed",
    });
    continue;
  }

  const startTime = Date.now(); // Track start time

  try {
    // ... existing repo creation logic ...

    this.log(id, "success", `✅ Successfully created: ${repo.html_url}`);
  } catch (error) {
    // ... existing error handling ...
  }

  processedCount++;
  this.updateProgress(id, processedCount, totalRepos);

  // Dynamic delay based on allocated slot and actual creation time
  if (processedCount < totalRepos) {
    const actualCreationTime = Date.now() - startTime;
    const slotInterval = campaign.slotIntervalMs || 120000; // Default 2 minutes
    const remainingTime = Math.max(2000, slotInterval - actualCreationTime); // Minimum 2s

    this.log(id, "info", `⏱️  Slot allocated: ${slotInterval}ms`);
    this.log(id, "info", `⏱️  Actual creation: ${actualCreationTime}ms`);
    this.log(id, "info", `⏱️  Additional delay: ${remainingTime}ms`);

    await new Promise((resolve) => setTimeout(resolve, remainingTime));
  }
}
```

## Expected Behavior After Fix

When creating a campaign with 9 repos per hour:

1. **Slot interval**: 3600000ms / 9 = 400,000ms (~6.67 minutes)
2. **If repo takes 2 minutes to create**: Additional delay = 400,000ms - 120,000ms = 280,000ms (~4.67 minutes)
3. **Total time per repo**: Exactly 6.67 minutes
4. **Total campaign time**: 9 repos × 6.67 min = ~60 minutes ✅

The campaign will finish in EXACTLY the estimated time, regardless of how long each individual repo takes to create.
