import OpenAI from "openai";
import 'dotenv/config';
import { prompt } from "./const.js";
import fs from 'fs';
import path from 'path';
import { json } from "stream/consumers";

async function loadImages(directoryPath, filePattern) {
    // -----------------
    // Load the images from local directory
    const images = [];
    
    try {
        const files = fs.readdirSync(directoryPath);
        const imageFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
        });
        
        for (const imageFile of imageFiles) {
            const imagePath = path.join(directoryPath, imageFile);
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Data = imageBuffer.toString('base64');
            
            // Determine mime type based on file extension
            const ext = path.extname(imageFile).toLowerCase();
            let mimeType;
            switch (ext) {
                case '.jpg':
                case '.jpeg':
                    mimeType = 'image/jpeg';
                    break;
                case '.png':
                    mimeType = 'image/png';
                    break;
                case '.gif':
                    mimeType = 'image/gif';
                    break;
                case '.webp':
                    mimeType = 'image/webp';
                    break;
                default:
                    mimeType = 'image/jpeg';
            }
            
            images.push({ data: base64Data, mime: mimeType });
        }
    } catch (error) {
        console.error('Error loading images:', error);
        throw new Error(`Cannot load images from directory: ${directoryPath}`);
    }
    
    // -----------------
    // Done, return
    return images;
}

function numOrDefault(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }
async function main() {
    const aiconfig = {
    model: process.env.MODEL || 'gpt-4o',
    timeout: numOrDefault(process.env.TIMEOUT_MS, 1000 * 60),
    max_tokens: numOrDefault(process.env.MAX_TOKENS, 2048),
    temperature: numOrDefault(process.env.TEMPERATURE, 0.5),
    top_p: numOrDefault(process.env.TOP_P, 1),
    frequency_penalty: numOrDefault(process.env.FREQUENCY_PENALTY, 0),
    presence_penalty: numOrDefault(process.env.PRESENCE_PENALTY, 0),
    dimensions: 512
};
    const content = prompt;
    if (String(process.env.SHOW_PROMPT || '') === '1') {
        console.log('AI Prompt:', content);
    }
    const images = await loadImages('C:/codebase/OpenaiApi/images', '*.jpg'); // Load images from hardcoded images directory
    return await doOpenAIQuickie(aiconfig, content, images);
}

const result = await main();
// Print the AI response exactly as returned
console.log('AI Result:', result);



async function doOpenAIQuickie(aiconfig,content,images=[]) {
    const response = await handleRequest(aiconfig,content,images);
    // Log usage if available so the server can surface it to the UI
    try {
        const usage = extractUsage(response);
        if (usage && Object.keys(usage).length) {
            console.log('AI Usage:', JSON.stringify(usage));
        }
    } catch {}
    return await handleResponse(response);

}
async function handleRequest(aiconfig,content,images=[]) {
    try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const ai={...aiconfig};
    const c = { ...aiconfig };
    const reasoningModels = ['gpt-5', 'o3', 'o1'];
    const needsReasoningAPI = reasoningModels.some(prefix => String(c.model).toLowerCase().startsWith(prefix));
        if (needsReasoningAPI) {
            const input = eventToResponsesInput({ type: 'user', content, images });
            const request = {
                input,
                model: c.model,
                max_output_tokens: c.max_tokens, // renamed
                top_p: c.top_p,
                //temperature: c.temperature,
                reasoning: {
                    effort: String(process.env.REASONING_EFFORT || 'high')
                },
                store: false,
                // frequency_penalty/presence_penalty not directly supported by Responses API
                text: {
                    format: ai.jsonMode ? { type: 'json_object' } : undefined, // JSON mode under text.format
                },
            };
            try {
                return await openai.responses.create(request)
            }
            catch (e) {
                console.log('OpenAI Responses API failed', {
                    message: e?.message,
                    status: e?.status ?? e?.response?.status,
                    code: e?.code,
                    data: e?.response?.data,
                });
                throw e;
            }
        } 
        const request = {
            messages: [aiEvent2OpenAIMessage({ type: 'user', content, images })],
            model: c.model,
            max_tokens: c.max_tokens,
            top_p: c.top_p,
            temperature: c.temperature,
            frequency_penalty: c.frequency_penalty,
            presence_penalty: c.presence_penalty,
            response_format: ai.jsonMode ? { type: 'json_object' } : undefined,
        };
        return await openai.chat.completions.create(request);
    }
    catch (e) {
        console.log('Problem processing AI Request', { message: e.message });
        throw e;
    }
}

// ---------------
// HANDLE RESPONSE
// ---------------
async function handleResponse(response) {
    try {
        // Responses API first, then Chat Completions
        return (response?.output_text ??
            response?.choices?.[0]?.message?.content ??
            response?.content?.[0]?.text ??
            '');
    }
    catch (e) {
        console.log('Problem processing AI response', { message: e.message });
        throw e;
    }
}

// Try to normalize usage across Responses API and Chat Completions
function extractUsage(resp) {
    const u = resp?.usage || resp?.response?.usage || null;
    if (!u) return {};
    const out = {};
    if (typeof u.prompt_tokens === 'number') out.prompt_tokens = u.prompt_tokens;
    if (typeof u.completion_tokens === 'number') out.completion_tokens = u.completion_tokens;
    if (typeof u.total_tokens === 'number') out.total_tokens = u.total_tokens;
    if (typeof u.input_tokens === 'number') out.input_tokens = u.input_tokens;
    if (typeof u.output_tokens === 'number') out.output_tokens = u.output_tokens;
    return out;
}
// Adapter: build Responses API input from your event
function eventToResponsesInput(event) {
    if (event?.images?.length) {
        // For Responses API, input should be an array with message objects
        return [
            {
                role: "user",
                content: [
                    { type: "input_text", text: event.content },
                    ...(event.images ?? []).map((image) => ({
                        type: "input_image",
                        image_url: `data:${image?.mime};base64,${image?.data}`,
                    })),
                ],
            },
        ];
    }
    // Plain text-only
    return [
        {
            role: "user",
            content: event.content,
        },
    ];
}

// Adapter: build Responses API input from your event
function aiEvent2OpenAIMessage(event) {
    if (event?.images?.length) {
        return {
            role: 'user',
            content: [
                { type: 'text', text: event.content }, // Responses accepts 'text' part
                ...(event.images ?? []).map((image) => ({
                    type: 'image_url',
                    image_url: {
                        url: `data:${image?.mime};base64,${image?.data}`,
                    },
                })),
            ],
        };
    }
    // Plain text-only
    return {
        role: 'user',
        content: event.content, // Responses API accepts string for text-only
    };
}
