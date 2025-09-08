import { promises as fs } from 'fs';
import path from 'path';
import fsSync from 'fs';

async function loadImagesB64(imagesDir) {
	const files = await fs.readdir(imagesDir).catch(() => []);
	const imageFiles = files.filter((f) => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
	const out = [];
	for (const f of imageFiles) {
		try {
			const p = path.join(imagesDir, f);
			const buf = await fs.readFile(p);
			const b64 = buf.toString('base64');
			let mime = 'image/jpeg';
			const ext = path.extname(f).toLowerCase();
			if (ext === '.png') mime = 'image/png';
			else if (ext === '.gif') mime = 'image/gif';
			else if (ext === '.webp') mime = 'image/webp';
			out.push({ name: f, b64, mime });
		} catch {}
	}
	return out;
}

async function callLmStudioOcr(imagesDir) {
	const url = 'http://172.16.7.50:1234/v1/chat/completions';
	const model = 'nanonets-ocr-s';
	const userPrompt = `Extract all text from the document. Present the output as a continuous stream of text, preserving the original reading order as much as possible. Do not format the text into tables or identify key-value pairs. Just return the raw text content.`;
	const imgs = await loadImagesB64(imagesDir);
	if (!imgs.length) throw new Error('No images to OCR');

	// Try native fetch if available (Node 18+), else lazy require('node-fetch')
	const fetchFn = (typeof fetch === 'function') ? fetch : (await import('node-fetch')).default;

	// Build a single user message with text + image_url parts (OpenAI-style payload)
	const content = [
		{ type: 'text', text: userPrompt },
		...imgs.map((img) => ({ type: 'image_url', image_url: { url: `data:${img.mime};base64,${img.b64}` } })),
	];
	const body = {
		model,
		messages: [ { role: 'user', content } ],
		temperature: 0,
		max_tokens: 8192,
	};
	const resp = await fetchFn(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	if (!resp.ok) throw new Error(`LM Studio HTTP ${resp.status}`);
	const json = await resp.json();
	const text = json?.choices?.[0]?.message?.content || '';
	if (!text) throw new Error('Empty OCR result');
	// Wrap as single Page for downstream consumers
	return `# Page 1\n${text}\n\n`;
}

/**
 * Reads all .txt files from a "text" directory and aggregates them into a single string
 * in the format: "# Page {n}\n{file contents}\n\n".
 *
 * Uses a hard-coded directory path for the text files.
 * @returns {Promise<string>} Aggregated text content
 */
export async function promptText() {
	// Hard-coded absolute path to the project's text directory (Windows)
	const dirToUse = 'C:\\codebase\\OpenaiApi\\text';
	const imagesDir = 'C:\\codebase\\OpenaiApi\\images';

	// If USE_LM_OCR enabled, try LM Studio first, then fallback to file-based aggregation
	if (String(process.env.USE_LM_OCR || '') === '1') {
		try {
			const ocrText = await callLmStudioOcr(imagesDir);
			return ocrText;
		} catch (e) {
			// Fallback silently to file-based aggregation
			// console.warn('LM Studio OCR failed, falling back:', e?.message || e);
		}
	}

	const stat = await fs.stat(dirToUse).catch(() => null);
	if (!stat || !stat.isDirectory()) {
		throw new Error(`text directory not found at: ${dirToUse}`);
	}

	const entries = await fs.readdir(dirToUse);
	const txtFiles = entries
		.filter((f) => f.toLowerCase().endsWith('.txt'))
		.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

	let theText = '';
	for (let pageNo = 0; pageNo < txtFiles.length; pageNo++) {
		const file = txtFiles[pageNo];
		const pageText = await fs.readFile(path.join(dirToUse, file), 'utf-8');
		theText += `# Page ${pageNo + 1}\n${pageText}\n\n`;
	}
    //console.log(theText);
	return theText;
}

