export const companyNameWordsToIgnore = [
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
  "dba"
];
export function scoreAddressMatch(a,vendorCompanyName, b, logIt = false) {
  let score = 0;
  let companyMatchScore = 0;
  let noOfMatches = 0;
  let zipNineMatch = false;

  if (b.companyName == "CUMMINGS, MCCLOREY, DAVIS, & ACHO PLC") {
    console.log("score", score, "matches", noOfMatches);
  }
  if (!a || !b) return { score, noOfMatches,companyMatchScore ,zipNineMatch};
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
  if (isPOBox(a.address1) && isPOBox(b.address1)) {
    const aPOBox = r(a.address1 ?? "", [".", " "]).toLowerCase();
    const aPOBoxArray = r(aPOBox ?? "", [" "])
      .toLowerCase()
      .split(",");

    const bPOBox = r(b.address1 ?? "", [".", " "]).toLowerCase();
    const bPOBoxArray = r(bPOBox ?? "", [" "])
      .toLowerCase()
      .split(/[\n,]+/)  // split by newline OR comma (one or more)
            .map(s => s.trim())  // optional: trims spaces around each item
            .filter(s => s);

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
    // if (lc(bPOBox).indexOf(lc(aPOBox)) >= 0) {
    //     noOfMatches++;
    //     score += 40;
    //     if (logIt)
    //         console.log('POBOX MATCH A = 40 points');
    // }
  } else if (a.address1 && b.address1) {
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

  if (a.companyName && b.companyName) {
    let found = false
    let vcnScore=0;
    let cnScore=0;
    if(vendorCompanyName){
        vcnScore = companyNameScore(vendorCompanyName, b.companyName,b.description)   
    }
    cnScore = companyNameScore(a.companyName, b.companyName,b.description)
    if(vcnScore !=0 && vcnScore>=cnScore){
        vcnScore+=10;
        score += vcnScore 
        companyMatchScore = vcnScore
        found= true
        if (logIt) console.log(' VENDOR COMPANY NAME MATCH A = ' + vcnScore + ' points')
    }
    else if(cnScore !=0 && cnScore>=vcnScore){
        found= true
        score += cnScore
        companyMatchScore = cnScore
        if (logIt) console.log(' COMPANY NAME MATCH A = ' + cnScore + ' points')
    }
    
    if (found) {
        noOfMatches++
    }
}

  return { score, noOfMatches, companyMatchScore,zipNineMatch };
}
export function companyNameScore(a, b, Desc) {
  const aNameParts = chupUp(a)
  const bNameParts = chupUp(b).filter(v => !companyNameWordsToIgnore.includes(v))
  const bDescParts = chupUp(Desc).filter(v => !companyNameWordsToIgnore.includes(v))

  const bNamePartsFiltered = bNameParts.filter(v => v.length >= 2)
  const bDescPartsFiltered = bDescParts.filter(v => v.length >= 2)

  const nameScorePart = Math.round(100 / bNamePartsFiltered.length)
  const descScorePart = Math.round(100 / bDescPartsFiltered.length)

  let found = false
  let evalScore = 0
  aNameParts
      .filter(v => !companyNameWordsToIgnore.includes(v))
      .filter(v => v.length >= 2)
      .forEach(v => {
          if (bNameParts.indexOf(v) >= 0) {
              found = true
              evalScore += nameScorePart


          }
           else if (bDescParts.indexOf(v) >= 0) {
              found = true
              evalScore += descScorePart
          }
      })
      return evalScore;
  
}
function isPOBox(address) {
  if (!address) return false;
  return r(address, [".", " "]).toLowerCase().indexOf("pobox") >= 0;
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
function lc(s) {
  return (s ? s + "" : "").toLowerCase();
}

export function getTopScorers(scoredData, minScore) {
    let singleZipNineMatch = false;
    let zipNineMatchCount = 0;

    scoredData.forEach(({ noOfMatches, companyMatchScore,zipNineMatch }) => {
      if (zipNineMatch ) {
        zipNineMatchCount++;
      }
    });
    if (zipNineMatchCount === 1) {
      singleZipNineMatch = true;
    }

  const rankedData = scoredData
    .filter(
      ({ noOfMatches, companyMatchScore,zipNineMatch }) =>{
        if(singleZipNineMatch){
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
  return rankedDataArray.slice(0,6);
}

export function runVendorMatching(phase1Data, csvData, isCanadian = false, minScore = 38) {
  // Extract addresses from Phase 1 Data
  const addresses = [
    phase1Data.remitToAddress,
    ...(phase1Data.otherSupplierAddresses ?? []),
  ].filter(Boolean);

  for (const address of addresses) {
    const scoredData = csvData
      .filter((d) =>
        isCanadian
          ? d.VENDORACCOUNTNUMBER.toLowerCase().startsWith("vca")
          : !d.VENDORACCOUNTNUMBER.toLowerCase().startsWith("vca")
      )
      .map((d) => {
        const companyName =
          d.VENDORORGANIZATIONNAME ?? d["﻿VENDORORGANIZATIONNAME"];
        const logit = companyName === "EMD MILLIPORE";
        const { score, noOfMatches, companyMatchScore,zipNineMatch } = scoreAddressMatch(
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
        return { ...d, score, noOfMatches, companyMatchScore,zipNineMatch };
      });

    const topScorers = getTopScorers(scoredData, minScore);

    if (topScorers.length) {
      return topScorers;
    }
  }

  // Return empty array if no matches found
  return [];
}
// Optional CLI runner if invoked directly: load default files and print results
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import csvParser from "csv-parser";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (row) => results.push(row))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
}

async function readJSON(filePath) {
  const data = await fs.promises.readFile(filePath, "utf8");
  return JSON.parse(data);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const csvFilePath = path.join(__dirname, "vendor 1.csv");
  const jsonFilePath = path.join(__dirname, "phase1json.json");
  try {
    const csvData = await readCSV(csvFilePath);
    const phase1Data = await readJSON(jsonFilePath);
    const results = runVendorMatching(phase1Data, csvData, false, 38);
    console.log(JSON.stringify({ topMatches: results }, null, 2));
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}
