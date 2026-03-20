import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
console.log('Type of pdfParse:', typeof pdfParse);
if (typeof pdfParse === 'object') {
    console.log('Keys:', Object.keys(pdfParse));
    console.log('Type of default:', typeof pdfParse.default);
}
