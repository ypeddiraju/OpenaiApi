import { promises as fs } from 'fs';
import path from 'path';

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

