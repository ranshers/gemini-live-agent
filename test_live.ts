import { GoogleGenAI } from '@google/genai';
const aiVertex = new GoogleGenAI({ vertexai: { project: 'thoughtinvest-prod', location: 'us-south1' } });
async function test() {
    try {
        const session = await aiVertex.live.connect({
            model: 'gemini-2.0-flash-live-preview-04-09',
            config: { responseModalities: ['AUDIO', 'TEXT'] }
        });
        session.on('error', e => console.error('SESSION_ERROR', e));
        session.on('close', e => {
            console.error('SESSION_CLOSE');
            console.error(e);
            console.error(e.reason);
            console.error(String(e.reason));
        });
    } catch(e) { console.error('CAUGHT', e); }
}
test();
