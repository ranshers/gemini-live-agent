import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Since I am testing from CLI, I will generate a temporary token from gcloud explicitly
// OR just rely on GoogleAuth locally via gcloud auth application-default login
// Let's test using the API Key to Vertex REST if possible?
// Oh wait, for Vertex Live WebSockets I must use ADC. Do I have ADC locally? Let's check.
const aiCentral = new GoogleGenAI({ vertexai: true, project: 'thoughtinvest-prod', location: 'us-central1' });

async function main() {
    try {
        const session = await aiCentral.live.connect({
            model: "gemini-2.0-flash-exp"
        });
        console.log("Connected to us-central1 successfully!");
        session.close();
    } catch(e: any) {
        console.error("us-central1 error:", e.message);
    }
}
main();
