import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const INPUT_DIR = path.join(process.cwd(), 'tmp', 'manuals');
const OUTPUT_FILE = path.join(process.cwd(), 'server', 'knowledge.txt');

async function extractManuals() {
    console.log(`Reading PDFs from ${INPUT_DIR}...`);
    const files = await fs.readdir(INPUT_DIR);
    const pdfFiles = files.filter(f => f.endsWith('.pdf'));

    console.log(`Found ${pdfFiles.length} PDFs to parse.`);

    let combinedText = '';

    for (const file of pdfFiles) {
        console.log(`Parsing: ${file}`);
        try {
            const buffer = await fs.readFile(path.join(INPUT_DIR, file));
            const data = await pdfParse(buffer);
            combinedText += `\n--- START OF DOCUMENT: ${file} ---\n`;
            combinedText += data.text;
            combinedText += `\n--- END OF DOCUMENT: ${file} ---\n`;
            console.log(`  Parsed ${data.numpages} pages.`);
        } catch (err) {
            console.error(`Failed to parse ${file}:`, err);
        }
    }

    console.log(`Writing ${combinedText.length} characters to ${OUTPUT_FILE}...`);
    await fs.writeFile(OUTPUT_FILE, combinedText, 'utf-8');
    console.log('Extraction complete!');
}

extractManuals().catch(console.error);
