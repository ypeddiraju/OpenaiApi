# OpenAI Invoice Runner

A simple Node + Express web app to test invoice extraction prompts, chat with OpenAI models, and run vendor matching. It has three tabs:

- Home: Runs a one-shot prompt against your local invoice text and images, and shows token usage.
- Chat Completion: A chat UI with optional multi-file image upload, include-history toggle, and "New chat" button.
- Vendor Matching: Finds best vendor matches from CSVs in the `vendors/` folder based on a Phase 1 JSON payload.

## Features
- Reads OCR text from `text/` and aggregates it into the prompt.
- Loads all images from `images/` and sends them to the model.
- Optional LM Studio OCR: when enabled in the Home tab, sends images to a local LM Studio server (model `nanonets-ocr-s`) to extract raw text, with automatic fallback to the `text/` files if LM Studio is unavailable.
- Routes reasoning models (gpt-5, o3, o1) to the Responses API with configurable reasoning effort.
- Routes other models (gpt-4o, gpt-4o-mini, gpt-5-mini) to Chat Completions API.
- Token usage displayed on the Home tab; chat endpoint also returns usage.
- Multi-file image uploads in Chat tab (files are not stored on disk).
- Vendor Matching using `vendorMatching.js`, with auto-loaded CSVs from `vendors/` and adjustable `minScore` and `isCanadian` flags.
 - Home UI: optional "Show prompt" toggle to include and display the exact prompt used; sections (Result, Prompt Used, Logs) are collapsible with arrow toggles; Copy buttons for Result and Prompt Used.

## Prerequisites
- Node.js 18+ (LTS recommended)
- OpenAI API Key
- (Optional) LM Studio running with an OCR-capable model (tested with `nanonets-ocr-s`) at `http://172.16.7.50:1234`.

## Quick start
1. Clone the repo
2. Copy the example env and set your key

   Windows (cmd):
   - Copy `c:\codebase\OpenaiApi\.env.example` to `.env`
   - Edit `.env` and set `OPENAI_API_KEY=...`

3. Install dependencies

   - Run: `npm install`

4. Start the server

   - Run: `npm start`
   - Open: http://localhost:3000

5. (Vendor Matching) Place your vendor CSV file(s)

  - Put one or more `.csv` files under: `c:\codebase\OpenaiApi\vendors\`
  - Example: `vendors\vendor 1.csv`

## Configuration
- API key: `.env`
  - `OPENAI_API_KEY=your_key_here`
  - Optional: `PORT=3000`
- Hardcoded paths (Windows):
  - Text directory: `C:\\codebase\\OpenaiApi\\text` (see `utils/PromptText.js`)
  - Images directory: `C:/codebase/OpenaiApi/images` (see `index.js`)
  - Vendors directory: `C:\\codebase\\OpenaiApi\\vendors` (CSV files auto-loaded by `server.js`)
- LM Studio OCR:
  - Enable per run in the Home tab by checking "Use LM Studio OCR".
  - The UI sets an env flag `USE_LM_OCR=1` for the run; alternatively you can set it manually if you invoke the runner yourself.
  - Endpoint and model are currently hardcoded in `utils/PromptText.js`:
    - URL: `http://172.16.7.50:1234/v1/chat/completions`
    - Model: `nanonets-ocr-s`
  - If the LM Studio call fails, the app falls back to aggregating `.txt` files from `text/`.
- Reasoning models and effort:
  - Reasoning models: `['gpt-5', 'o3', 'o1']` are routed to Responses API
  - Effort set via UI (Home/Chat) and passed through to the backend
 - Vendor Matching CSV columns (expected):
   - `VENDORORGANIZATIONNAME` (or BOM-prefixed variant `﻿VENDORORGANIZATIONNAME`)
   - `ADDRESSSTREET`, `ADDRESSZIPCODE`, `ADDRESSDESCRIPTION`, `VENDORACCOUNTNUMBER`

## Project structure
- `server.js` — Express server, static web, `/api/run`, `/api/chat`, and `/api/vendor-matching`
- `index.js` — Runner for Home tab; prepares prompt + images and calls OpenAI
- `const.js` — Prompt template and JSON schema description
- `utils/PromptText.js` — Aggregates `.txt` files in `text/` into a single string
- `utils/makeJSONBlock.js` — Helper to render a JSON schema block in the prompt
- `vendorMatching.js` — Scoring and match selection logic used by the Vendor Matching tab
- `vendors/` — Folder containing one or more vendor CSV files (auto-loaded by the server)
- `web/` — UI (HTML/CSS/JS)

## Using the app
- Home tab
  - Choose model and parameters; click Run
  - (Optional) Toggle "Use LM Studio OCR" to extract raw text via LM Studio; the app automatically falls back to local `text/` files if LM Studio fails
  - (Optional) Toggle "Show prompt" to include and display the exact prompt that will be sent to the model
  - The app aggregates the OCR text and images, sends to OpenAI, and shows the full response
  - Result and Prompt Used are shown in collapsible sections with arrow toggles; both expand automatically after a run and include Copy buttons
  - Logs are also collapsible (collapsed by default); Token usage is shown in its own section
- Chat Completion tab
  - Type a message and optionally attach one or more images
  - Include history toggle controls whether to send prior exchanges
  - New chat clears the conversation in the browser

- Vendor Matching tab
  - Paste your Phase 1 JSON (shape: `{ remitToAddress, otherSupplierAddresses?, vendorCompanyName? }`)
  - Set `minScore` (default 38) and `isCanadian` (filters VCA accounts)
  - Click Run; the server loads all CSVs in `vendors/`, combines them, and returns the top matches
  - Results include score details per candidate

## Notes
- The server does not save uploaded files; it reads them to memory and forwards as data URLs
- For non-image files, the server will ignore them
- Timeout is passed as an SDK client option
 - Vendor CSVs are read at request time; you can add/remove files without restarting the server

## Troubleshooting
- Missing API key: ensure `.env` exists with `OPENAI_API_KEY`
- HTML parsing error in client: server now returns JSON for errors; check the browser console/network panel
- 400 Unrecognized request argument `timeout`: already handled by passing timeout as client option
 - Vendor Matching: "No CSV files found" — ensure CSVs exist under `vendors/`
 - Vendor Matching: Empty results — verify Phase 1 addresses and that CSVs contain expected columns
 - LM Studio OCR: If you enabled the toggle but still see text from the `text/` folder, LM Studio likely failed and the app used the fallback. Ensure LM Studio is running and reachable at `http://172.16.7.50:1234`. To change the URL/model, edit `utils/PromptText.js`.

## Security
- Do not commit `.env` or any API keys
- `.gitignore` excludes `node_modules/`, `.env`, logs, and common local files

## License
ISC (see `package.json`).
