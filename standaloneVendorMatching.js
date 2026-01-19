/**
 * Standalone Vendor Matching Script
 * 
 * This script reads phase1data.json and vendor CSV file, 
 * then performs vendor matching and outputs the results.
 * 
 * Usage: node standaloneVendorMatching.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csvParser from "csv-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  jsonFilePath: path.join(__dirname, "phase1data.json"),
  csvFilePath: path.join(__dirname, "vendors", "vendor.csv"),
  isCanadian: false,
  minScore: 38,
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

const companyNameWordsToIgnore = [
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "co",
  "company",
  "lp",
  "limited",
  "partnership",
  "pc",
  "professional",
  "llc",
  "services",
  "dba",
];

function lc(s) {
  return (s ? s + "" : "").toLowerCase();
}

function r(str, del) {
  let retVal = str;
  for (const d of del) {
    retVal = retVal?.split(d).join("");
  }
  return retVal;
}

function countLeadingZeros(input) {
  const match = input.match(/^0+/);
  return match ? match[0].length : 0;
}

function chupUp(str) {
  return lc(str ?? "")
    .split(",")
    .join("")
    .split(".")
    .join("")
    .split("'")
    .join("")
    .split(" ");
}

function isPOBox(address) {
  if (!address) return false;
  return r(address, [".", " "]).toLowerCase().indexOf("pobox") >= 0;
}

// =============================================================================
// SCORING FUNCTIONS
// =============================================================================

function companyNameScore(a, b, Desc) {
  // If either name is missing, we can't score
  if (!a || !b) return 0;
  
  const aNameParts = chupUp(a);
  const bNameParts = chupUp(b).filter(
    (v) => !companyNameWordsToIgnore.includes(v)
  );
  const bDescParts = chupUp(Desc).filter(
    (v) => !companyNameWordsToIgnore.includes(v)
  );

  const bNamePartsFiltered = bNameParts.filter((v) => v.length >= 2);
  const bDescPartsFiltered = bDescParts.filter((v) => v.length >= 2);

  const nameScorePart = Math.round(100 / bNamePartsFiltered.length);
  const descScorePart = Math.round(100 / bDescPartsFiltered.length);

  let found = false;
  let evalScore = 0;
  aNameParts
		.filter(v => !companyNameWordsToIgnore.includes(v))
		.filter(v => v.length >= 2)
		.forEach(v => {
			let nameMatch = bNamePartsFiltered.indexOf(v) >= 0 ? nameScorePart : 0
			let descMatch = bDescPartsFiltered.indexOf(v) >= 0 ? descScorePart : 0
			let maxScore = Math.max(nameMatch, descMatch)
			if (maxScore > 0) {
				found = true
				evalScore += maxScore
			}
		})
		return evalScore;
}

function scoreAddressMatch(a, vendorCompanyName, b, logIt = false) {
  let score = 0;
  let companyMatchScore = 0;
  let noOfMatches = 0;
  let zipNineMatch = false;

  if (b.companyName == "PECCO, INC.") {
    console.log("score", score, "matches", noOfMatches);
  }

  if (!a || !b) return { score, noOfMatches, companyMatchScore, zipNineMatch };

  // ZIP Code Matching
  if (a.zipCode && b.zipCode) {
    let txtZipCode = b.zipCode + "";
    const remitLeadingZeros = countLeadingZeros(a.zipCode);
    const vLeadingZeros = countLeadingZeros(txtZipCode);
    const diff = remitLeadingZeros - vLeadingZeros;
    if (diff > 0) txtZipCode = "0".repeat(diff) + txtZipCode;

    let azipcodeLength = a.zipCode.split("-").join("").length;

    if (lc(txtZipCode).indexOf(lc(a.zipCode)) >= 0) {
      noOfMatches++;
      if (azipcodeLength >= 9) {
        score += 100;
        zipNineMatch = true;
      } else {
        score += 75;
      }
      if (logIt) {
        console.log(
          azipcodeLength >= 9
            ? "ZIPCODE MATCH A = 100 points"
            : "ZIPCODE MATCH A = 50 points"
        );
      }
    } else if (lc(b.zipCode + "").indexOf(lc(a.zipCode?.split("-")[0])) >= 0) {
      noOfMatches++;
      score += 50;
      if (logIt) console.log("ZIPCODE MATCH B = 50 points");
    }
  } else if (a.zipCode && b.address1) {
    if (lc(b.address1 + "").indexOf(lc(a.zipCode)) >= 0) {
      noOfMatches++;
      score += 100;
      if (logIt) console.log("ZIPCODE MATCH C = 100 points");
    } else if (
      a.zipCode.indexOf("-") > 0 &&
      lc(b.address1 + "").indexOf(lc(a.zipCode?.split("-")[0])) >= 0
    ) {
      noOfMatches++;
      score += 50;
      if (logIt) console.log("ZIPCODE MATCH D = 50 points");
    }
  }

  // PO Box Matching
  if (isPOBox(a.address1) && isPOBox(b.address1)) {
    const aPOBox = r(a.address1 ?? "", [".", " "]).toLowerCase();
    const aPOBoxArray = r(aPOBox ?? "", [" "])
      .toLowerCase()
      .split(",");

    const bPOBox = r(b.address1 ?? "", [".", " "]).toLowerCase();
    const bPOBoxArray = r(bPOBox ?? "", [" "])
      .toLowerCase()
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s);

    const scorePart = 40 / bPOBoxArray.length;
    let found = false;
    let matchScorePOBox = 0;
    aPOBoxArray.forEach((element) => {
      if (bPOBox.indexOf(element) >= 0) {
        found = true;
        matchScorePOBox += scorePart;
      }
    });
    score += matchScorePOBox;
    if (found) noOfMatches++;

    if (logIt) console.log(`POBOX MATCH A = ${matchScorePOBox} points`);
  } else if (a.address1 && b.address1) {
    // Regular Address Matching
    const aAddrParts = lc(a.address1 ?? "").split(" ");
    const bAddrParts = lc(b.address1 ?? "").split(" ");
    let found = false;
    aAddrParts
      .filter((v) => v.length > 2)
      .forEach((v) => {
        if (bAddrParts.indexOf(r(v, [","])) >= 0) {
          found = true;
          score += v.length * 2;
        }
      });
    if (found) {
      noOfMatches++;
      if (logIt) console.log("ADDRESS MATCH A = Some points");
    }
  }

  // Company Name Matching
  if ((a.companyName || vendorCompanyName) && b.companyName) {
    let found = false;
    let vcnScore = 0;
    let cnScore = 0;
    if (vendorCompanyName) {
      vcnScore = companyNameScore(
        vendorCompanyName,
        b.companyName,
        b.description
      );
    }
    cnScore = companyNameScore(a.companyName, b.companyName, b.description);
    if (vcnScore != 0 && vcnScore >= cnScore) {
      vcnScore += 10;
      score += vcnScore;
      companyMatchScore = vcnScore;
      found = true;
      if (logIt)
        console.log(" VENDOR COMPANY NAME MATCH A = " + vcnScore + " points");
    } else if (cnScore != 0 && cnScore >= vcnScore) {
      found = true;
      score += cnScore;
      companyMatchScore = cnScore;
      if (logIt) console.log(" COMPANY NAME MATCH A = " + cnScore + " points");
    }

    if (found) {
      noOfMatches++;
    }
  }

  return { score, noOfMatches, companyMatchScore, zipNineMatch };
}

// =============================================================================
// TOP SCORERS FUNCTION
// =============================================================================

function getTopScorers(scoredData, minScore) {
  let singleZipNineMatch = false;
  let zipNineMatchCount = 0;

  scoredData.forEach(({ zipNineMatch }) => {
    if (zipNineMatch) {
      zipNineMatchCount++;
    }
  });
  if (zipNineMatchCount === 1) {
    singleZipNineMatch = true;
  }

  const rankedData = scoredData
    .filter(({ noOfMatches, companyMatchScore, zipNineMatch }) => {
      if (singleZipNineMatch) {
        return noOfMatches > 1 || companyMatchScore >= 99 || zipNineMatch;
      }
      return noOfMatches > 1 || companyMatchScore >= 99;
    })
    .filter(({ score }) => score > minScore);

  rankedData.sort((a, b) => b.score - a.score);
  const topScore = rankedData[0]?.score ?? 0;

  const rankedDataArray = rankedData.filter(
    (v) => v.score === topScore || v.score >= 99
  );
  if (rankedDataArray.length == 1) {
    return rankedDataArray.filter(
      (v) => v.score === topScore && v.score >= 99
    );
  }
  return rankedDataArray.slice(0, 6);
}

// =============================================================================
// MAIN VENDOR MATCHING FUNCTION
// =============================================================================

function runVendorMatching(
  phase1Data,
  csvData,
  isCanadian = false,
  minScore = 38
) {
  console.log("\n=== Starting Vendor Matching ===");
  console.log(`Canadian vendors only: ${isCanadian}`);
  console.log(`Minimum score threshold: ${minScore}`);
  console.log(`Total vendor records: ${csvData.length}`);

  // Extract addresses from Phase 1 Data
  const addresses = [
    phase1Data.remitToAddress,
    ...(phase1Data.otherSupplierAddresses ?? []),
  ].filter(Boolean);

  console.log(`\nPhase 1 Data:`);
  console.log(`  Vendor Company Name: ${phase1Data.vendorCompanyName}`);
  console.log(`  Number of addresses to match: ${addresses.length}`);

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    console.log(`\n--- Matching Address ${i + 1} ---`);
    console.log(`  Company: ${address.companyName || "N/A"}`);
    console.log(`  Address: ${address.address1 || "N/A"}`);
    console.log(`  State: ${address.state || "N/A"}`);
    console.log(`  Zip: ${address.zipCode || "N/A"}`);

    const scoredData = csvData
      .filter((d) =>
        isCanadian
          ? d.VENDORACCOUNTNUMBER.toLowerCase().startsWith("vca")
          : !d.VENDORACCOUNTNUMBER.toLowerCase().startsWith("vca")
      )
      .map((d) => {
        const companyName =
          d.VENDORORGANIZATIONNAME ?? d["﻿VENDORORGANIZATIONNAME"];
        const logit = false; // Set to true to debug specific vendor
        const { score, noOfMatches, companyMatchScore, zipNineMatch } =
          scoreAddressMatch(
            address,
            phase1Data.vendorCompanyName,
            {
              companyName,
              address1: d.ADDRESSSTREET,
              zipCode: d.ADDRESSZIPCODE,
              description: d.ADDRESSDESCRIPTION,
            },
            logit
          );
        return { ...d, score, noOfMatches, companyMatchScore, zipNineMatch };
      });

    const topScorers = getTopScorers(scoredData, minScore);

    console.log(`  Top matches found: ${topScorers.length}`);

    if (topScorers.length) {
      return topScorers;
    }
  }

  console.log("\n!!! No matches found above minimum score threshold !!!");
  // Return empty array if no matches found
  return [];
}

// =============================================================================
// FILE READING FUNCTIONS
// =============================================================================

async function readCSV(filePath) {
  console.log(`\nReading CSV file: ${filePath}`);
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (row) => results.push(row))
      .on("end", () => {
        console.log(`CSV loaded: ${results.length} records`);
        resolve(results);
      })
      .on("error", (error) => reject(error));
  });
}

async function readJSON(filePath) {
  console.log(`Reading JSON file: ${filePath}`);
  const data = await fs.promises.readFile(filePath, "utf8");
  const jsonData = JSON.parse(data);
  console.log(`JSON loaded successfully`);
  return jsonData;
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
  console.log("=".repeat(60));
  console.log("STANDALONE VENDOR MATCHING SCRIPT");
  console.log("=".repeat(60));

  try {
    // Read input files
    const csvData = await readCSV(CONFIG.csvFilePath);
    const phase1Data = await readJSON(CONFIG.jsonFilePath);

    // Run vendor matching
    const results = runVendorMatching(
      phase1Data,
      csvData,
      CONFIG.isCanadian,
      CONFIG.minScore
    );

    // Output results
    console.log("\n" + "=".repeat(60));
    console.log("RESULTS");
    console.log("=".repeat(60));

    if (results.length > 0) {
      console.log(`\n✓ Found ${results.length} top match(es):\n`);
      results.forEach((match, index) => {
        console.log(`\n[${index + 1}] Match Score: ${match.score}`);
        console.log(`    Vendor: ${match.VENDORORGANIZATIONNAME}`);
        console.log(`    Account #: ${match.VENDORACCOUNTNUMBER}`);
        console.log(`    Address: ${match.ADDRESSSTREET || "N/A"}`);
        console.log(`    City: ${match.ADDRESSCITY || "N/A"}`);
        console.log(`    State: ${match.ADDRESSSTATEID || "N/A"}`);
        console.log(`    Zip: ${match.ADDRESSZIPCODE || "N/A"}`);
        console.log(`    Description: ${match.ADDRESSDESCRIPTION || "N/A"}`);
        console.log(`    # of Matches: ${match.noOfMatches}`);
        console.log(`    Company Match Score: ${match.companyMatchScore}`);
        console.log(`    Zip-9 Match: ${match.zipNineMatch}`);
      });

      // Write results to output file
      const outputPath = path.join(__dirname, "vendorMatchingOutput.json");
      const output = {
        timestamp: new Date().toISOString(),
        inputFiles: {
          jsonFile: CONFIG.jsonFilePath,
          csvFile: CONFIG.csvFilePath,
        },
        config: {
          isCanadian: CONFIG.isCanadian,
          minScore: CONFIG.minScore,
        },
        vendorCompanyName: phase1Data.vendorCompanyName,
        totalMatches: results.length,
        topMatches: results,
      };

      await fs.promises.writeFile(
        outputPath,
        JSON.stringify(output, null, 2),
        "utf8"
      );
      console.log(`\n✓ Results written to: ${outputPath}`);
    } else {
      console.log("\n✗ No matching vendors found.");
    }

    console.log("\n" + "=".repeat(60));
    console.log("EXECUTION COMPLETED");
    console.log("=".repeat(60) + "\n");
  } catch (err) {
    console.error("\n" + "=".repeat(60));
    console.error("ERROR OCCURRED");
    console.error("=".repeat(60));
    console.error("\nError details:", err);
    console.error("\nStack trace:", err.stack);
    process.exit(1);
  }
}

// Run the script
main();
