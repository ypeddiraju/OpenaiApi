import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';
import multer from 'multer';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import csvParser from 'csv-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'web')));
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/run', async (req, res) => {
  const {
    model,
    max_tokens,
    temperature,
    top_p,
    frequency_penalty,
    presence_penalty,
    timeout,
  reasoning,
  } = req.body || {};

  const env = {
    ...process.env,
    MODEL: model ?? '',
    MAX_TOKENS: String(max_tokens ?? ''),
    TEMPERATURE: String(temperature ?? ''),
    TOP_P: String(top_p ?? ''),
    FREQUENCY_PENALTY: String(frequency_penalty ?? ''),
    PRESENCE_PENALTY: String(presence_penalty ?? ''),
    TIMEOUT_MS: String(timeout ?? ''),
  REASONING_EFFORT: String(reasoning ?? ''),
  SHOW_PROMPT: String(req.body?.showPrompt ? '1' : ''),
  };

  const child = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let out = '';
  let err = '';
  child.stdout.on('data', (d) => (out += d.toString()));
  child.stderr.on('data', (d) => (err += d.toString()));

  child.on('close', (code) => {
    // Capture the full AI result (may span multiple lines)
    const m = out.match(/AI Result:\s*([\s\S]*?)(?:\r?\nAI Usage:|$)/i);
    const rawText = m ? m[1].trim() : undefined;
  // Optional: capture prompt if index.js printed it
  const pm = out.match(/AI Prompt:\s*([\s\S]*?)(?:\r?\nAI Result:|\r?\nAI Usage:|$)/i);
  const promptText = pm ? pm[1].trim() : undefined;
    // Optional: try to infer a docType if rawText is JSON with docType
    let docType;
    try {
      const parsed = JSON.parse(rawText || '');
      if (parsed && typeof parsed === 'object' && 'docType' in parsed) docType = parsed.docType;
    } catch {}
    let usage;
    const usageLine = out.split(/\r?\n/).find(l => l.startsWith('AI Usage:'));
    if (usageLine) {
      try { usage = JSON.parse(usageLine.replace(/^AI Usage:\s*/, '')); } catch {}
    }
    res.status(code === 0 ? 200 : 500).json({
      ok: code === 0,
      code,
      docType,
      text: rawText,
  prompt: promptText,
      usage,
      stdout: out,
      stderr: err,
    });
  });
});

// Chat endpoint for the Chat Completion tab (supports multiple files)
app.post('/api/chat', upload.array('files', 10), async (req, res) => {
  try {
    let body;
    if (req.is('application/json')) {
      body = req.body;
    } else if ((req.files && req.files.length) || req.body?.payload) {
      // Expect payload as a JSON string field in multipart form-data
      try {
        body = JSON.parse(req.body?.payload || '{}');
      } catch {
        body = {};
      }
    } else {
      body = {};
    }

    const {
      model,
      max_tokens = 2048,
      temperature,
      top_p,
      frequency_penalty,
      presence_penalty,
      timeout,
      reasoning,
      messages = [],
    } = body || {};

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const reasoningModels = ['gpt-5', 'o3', 'o1'];
    const needsReasoningAPI = reasoningModels.some((p) => String(model || '').toLowerCase().startsWith(p));

    // Optional: attach uploaded files as image inputs if present
    let images = [];
    if (Array.isArray(req.files)) {
      for (const f of req.files) {
        if (/^image\//i.test(f.mimetype)) {
          const b64 = f.buffer.toString('base64');
          images.push({ data: b64, mime: f.mimetype });
        }
      }
    }

    if (needsReasoningAPI) {
      // Build Responses API input from chat-like messages
      const input = [
        {
          role: 'user',
          content: [
            ...messages.map((m) => ({ type: 'input_text', text: m.content || '' })),
            ...images.map((image) => ({ type: 'input_image', image_url: `data:${image.mime};base64,${image.data}` })),
          ],
        },
      ];
      const request = {
        model,
        input,
        max_output_tokens: max_tokens,
        top_p,
        //temperature, // not supported in Responses for reasoning models
        reasoning: { effort: String(reasoning || 'high') },
        store: false,
        text: undefined,
      };
      const response = await openai.responses.create(request, typeof timeout === 'number' ? { timeout } : undefined);
      const text = response?.output_text || '';
      const usage = response?.usage || undefined;
      return res.json({ ok: true, text, usage });
    }

    // Chat Completions path
    const params = {
      model,
      messages: images.length
        ? [
            { role: 'user', content: [{ type: 'text', text: messages.map(m => m.content).join('\n\n') }, ...images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mime};base64,${i.data}` } }))] },
          ]
        : messages,
      max_tokens,
      temperature,
      top_p,
      frequency_penalty,
      presence_penalty,
    };
    const response = await openai.chat.completions.create(params, typeof timeout === 'number' ? { timeout } : undefined);
    const text = response?.choices?.[0]?.message?.content || '';
    const usage = response?.usage || undefined;
    return res.json({ ok: true, text, usage });
  } catch (e) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Vendor Matching endpoint: expects { phase1Data, csvData, isCanadian?, minScore? }
import { runVendorMatching } from './vendorMatching.js';
app.post('/api/vendor-matching', async (req, res) => {
  try {
    const { phase1Data, csvData, isCanadian = false, minScore = 38 } = req.body || {};
    if (!phase1Data) {
      return res.status(400).json({ ok: false, error: 'phase1Data is required' });
    }

    // Helper to read a CSV file into array of row objects
    const readCSV = (filePath) => new Promise((resolve, reject) => {
      const rows = [];
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row) => rows.push(row))
        .on('end', () => resolve(rows))
        .on('error', (err) => reject(err));
    });

    // If csvData was not provided, auto-load all CSV files from vendors/ folder
    let vendorRows = csvData;
    if (!Array.isArray(vendorRows) || vendorRows.length === 0) {
      const vendorsDir = path.join(__dirname, 'vendors');
      try {
        const all = await fs.promises.readdir(vendorsDir);
        const csvFiles = all.filter((f) => f.toLowerCase().endsWith('.csv'));
        if (!csvFiles.length) {
          return res.status(400).json({ ok: false, error: `No CSV files found in ${vendorsDir}` });
        }
        const allRows = [];
        for (const f of csvFiles) {
          const filePath = path.join(vendorsDir, f);
          const rows = await readCSV(filePath);
          allRows.push(...rows);
        }
        vendorRows = allRows;
      } catch (e) {
        return res.status(500).json({ ok: false, error: `Failed to read vendors folder: ${e?.message || e}` });
      }
    }

    const results = runVendorMatching(phase1Data, vendorRows, isCanadian, minScore);
    return res.json({ ok: true, results });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

// Ensure errors (including Multer) return JSON instead of HTML
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err) {
    console.error('Server error:', err);
    const status = err.status || 400;
    return res.status(status).json({ ok: false, error: err.message || String(err) });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
