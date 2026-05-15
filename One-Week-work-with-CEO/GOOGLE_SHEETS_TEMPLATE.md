# Google Sheets Template

## Expected Sheet Structure

Your Google Sheet should have the following columns:

| RowId | Keyword | Status | RepoUrl | Error |
|-------|---------|--------|---------|-------|
| 1 | react component library | Pending | | |
| 2 | python data analysis tool | Pending | | |
| 3 | node.js api framework | Pending | | |

### Column Descriptions

1. **RowId** (Number)
   - Unique identifier for each row
   - Used to update the status after processing
   - Should start from 1 and increment

2. **Keyword** (String)
   - The keyword/topic that will be sent to ChatGPT
   - ChatGPT will generate repo metadata based on this keyword
   - Example: "react component library", "python data analysis"

3. **Status** (String)
   - Initial value: `Pending`
   - Updated automatically by the app to: `Done` or `Failed`
   - Filter rows with "Pending" status to process

4. **RepoUrl** (String)
   - Initially empty
   - Filled with GitHub repo URL after successful creation
   - Example: https://github.com/username/repo-name

5. **Error** (String)
   - Initially empty
   - Filled with error message if creation fails
   - Used for debugging and retry logic

## Setting Up Your Sheet

### Option 1: Manual Setup
1. Create a new Google Sheet
2. Add the column headers in the first row: `RowId`, `Keyword`, `Status`, `RepoUrl`, `Error`
3. Add your keywords in subsequent rows with Status = "Pending"

### Option 2: Import Template
1. Copy this template: [Google Sheets Template Link]
2. File → Make a copy
3. Fill in your keywords

## Getting Sheet ID

The Sheet ID is found in the URL:
```
https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit
                                  ^^^^^^^^^^^^^^^^^^^^^^^^
                                  This is your Sheet ID
```

## API Integration

### Current Implementation
The `src/services/googleSheets.js` file contains placeholder functions.

### To Enable Real Integration
Replace the mock implementation with Google Sheets API calls:

```javascript
import { google } from 'googleapis';

const sheets = google.sheets('v4');

export async function fetchPendingRows({ sheetId }) {
  // Authenticate with service account or OAuth
  const auth = await authenticate();
  
  const response = await sheets.spreadsheets.values.get({
    auth,
    spreadsheetId: sheetId,
    range: 'Sheet1!A2:E', // Adjust range as needed
  });
  
  const rows = response.data.values || [];
  return rows
    .map((row, idx) => ({
      rowId: parseInt(row[0]),
      keyword: row[1],
      status: row[2],
    }))
    .filter(r => r.status === 'Pending');
}

export async function markRowStatus({ sheetId, rowId, status, repoUrl, error }) {
  const auth = await authenticate();
  const range = `Sheet1!C${rowId}:E${rowId}`;
  
  await sheets.spreadsheets.values.update({
    auth,
    spreadsheetId: sheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[status, repoUrl || '', error || '']],
    },
  });
}
```

## Permissions

Ensure your Service Account or OAuth credentials have:
- Read access to fetch pending rows
- Write access to update status and results
