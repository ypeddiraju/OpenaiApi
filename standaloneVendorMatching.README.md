# Standalone Vendor Matching Script

## Overview
This standalone JavaScript file performs vendor matching by comparing Phase 1 data (invoice data) with a vendor database CSV file. It can be run independently for testing, debugging, and development purposes.

## File Location
`standaloneVendorMatching.js`

## Prerequisites
- Node.js installed (version 14 or higher)
- Dependencies installed via `npm install` (specifically `csv-parser`)

## Input Files

### 1. Phase 1 JSON Data
**Default location:** `phase1data.json` (in the same directory)

**Structure:**
```json
{
  "vendorCompanyName": "Company Name",
  "remitToAddress": {
    "companyName": "Company Name",
    "address1": "123 Main St",
    "state": "CA",
    "zipCode": "90210"
  },
  "otherSupplierAddresses": [
    {
      "companyName": "...",
      "address1": "...",
      "state": "...",
      "zipCode": "..."
    }
  ]
}
```

### 2. Vendor CSV File
**Default location:** `vendors/vendor_addr_20251126.csv`

**Required columns:**
- VENDORORGANIZATIONNAME
- VENDORACCOUNTNUMBER
- ADDRESSSTREET
- ADDRESSCITY
- ADDRESSSTATEID
- ADDRESSZIPCODE
- ADDRESSDESCRIPTION
- ADDRESSCOUNTRYREGIONID

## Configuration

You can modify the configuration at the top of the file:

```javascript
const CONFIG = {
  jsonFilePath: path.join(__dirname, "phase1data.json"),
  csvFilePath: path.join(__dirname, "vendors", "vendor_addr_20251126.csv"),
  isCanadian: false,  // Set to true to match only Canadian vendors (VCA prefix)
  minScore: 38,       // Minimum score threshold for matches
};
```

## How to Run

### Basic Usage
```bash
node standaloneVendorMatching.js
```

### Using VS Code Debugger
1. Open `standaloneVendorMatching.js` in VS Code
2. Set breakpoints where needed
3. Press F5 or click "Run and Debug"
4. Select "Node.js" as the debugger

### Creating a Debug Configuration
Add this to your `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Vendor Matching",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/standaloneVendorMatching.js"
    }
  ]
}
```

## Output

### Console Output
The script provides detailed console output including:
- File loading status
- Number of vendor records loaded
- Matching progress for each address
- Top matches with scores and details
- Execution summary

### Output File
Results are automatically saved to: `vendorMatchingOutput.json`

**Structure:**
```json
{
  "timestamp": "2025-11-28T...",
  "inputFiles": {
    "jsonFile": "...",
    "csvFile": "..."
  },
  "config": {
    "isCanadian": false,
    "minScore": 38
  },
  "vendorCompanyName": "Company Name",
  "totalMatches": 1,
  "topMatches": [
    {
      "VENDORORGANIZATIONNAME": "...",
      "VENDORACCOUNTNUMBER": "...",
      "ADDRESSSTREET": "...",
      "score": 150,
      "noOfMatches": 2,
      "companyMatchScore": 75,
      "zipNineMatch": true
    }
  ]
}
```

## Scoring System

### Matching Criteria
The script scores matches based on:

1. **ZIP Code Matching (50-100 points)**
   - 9-digit ZIP match: 100 points + sets `zipNineMatch` flag
   - 5-digit ZIP match: 75 points
   - Partial ZIP match: 50 points

2. **PO Box Matching (up to 40 points)**
   - Distributed across PO Box components

3. **Address Matching (variable points)**
   - Based on matching address parts (2 points per character length)

4. **Company Name Matching (up to 100 points)**
   - Exact name parts: 100 points divided by number of parts
   - Description match: 100 points divided by description parts
   - Vendor company name gets +10 bonus points

### Filtering Logic
- Matches must have:
  - More than 1 match type OR
  - Company match score ≥ 99 OR
  - Single 9-digit ZIP match in entire dataset
- Score must exceed `minScore` threshold (default: 38)

### Top Scorers Selection
- Returns top 6 matches with highest scores
- If single match with score ≥ 99, returns only that match

## Debugging Tips

### Enable Verbose Logging
Set `logit = true` for specific vendors in the `scoreAddressMatch` function:

```javascript
const logit = companyName === "VENDOR NAME TO DEBUG";
```

### Check Specific Address
Add console.log statements in the matching loop:

```javascript
for (let i = 0; i < addresses.length; i++) {
  const address = addresses[i];
  console.log("Debugging address:", JSON.stringify(address, null, 2));
  // ... rest of code
}
```

### Inspect All Scores
Before filtering, log all scored data:

```javascript
console.log("All scores:", scoredData.slice(0, 10)); // First 10 records
```

## Common Use Cases

### 1. Test with Different Data
Simply replace `phase1data.json` with your test data:
```bash
cp test-data.json phase1data.json
node standaloneVendorMatching.js
```

### 2. Match Canadian Vendors Only
Modify the CONFIG:
```javascript
isCanadian: true
```

### 3. Lower Score Threshold
To see more potential matches:
```javascript
minScore: 20  // Lower from default 38
```

### 4. Use Different Vendor File
Update the CSV file path:
```javascript
csvFilePath: path.join(__dirname, "vendors", "other-vendor-file.csv")
```

## Troubleshooting

### No Matches Found
- Check that address fields in phase1data.json are populated
- Lower the `minScore` threshold
- Verify vendor CSV file has correct column names
- Check if `isCanadian` setting matches your vendor data

### Script Crashes
- Ensure CSV file path is correct
- Verify JSON file is valid JSON format
- Check that all required dependencies are installed

### Incorrect Matches
- Review scoring logic in `scoreAddressMatch` function
- Adjust company name words to ignore list
- Modify minimum score threshold

## Integration with Main Application

This standalone script uses the same matching logic as `vendorMatching.js`. To integrate changes:

1. Test your changes in this standalone file
2. Once satisfied, port the changes to `vendorMatching.js`
3. Ensure both files stay in sync

## File Structure

```
standaloneVendorMatching.js
├── Configuration (CONFIG object)
├── Utility Functions (lc, r, countLeadingZeros, etc.)
├── Scoring Functions (companyNameScore, scoreAddressMatch)
├── Top Scorers Function (getTopScorers)
├── Main Vendor Matching (runVendorMatching)
├── File Reading Functions (readCSV, readJSON)
└── Main Execution (main)
```

## Contributing

When modifying the scoring logic:
1. Document the change and reasoning
2. Test with multiple data samples
3. Verify output file is generated correctly
4. Update this README if configuration changes
