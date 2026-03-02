import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const aiVertex = new GoogleGenAI({
    vertexai: { project: 'thoughtinvest-prod', location: 'us-west1' }
});

async function main() {
    console.log("Connecting...");
    try {
        const session = await aiVertex.live.connect({
            model: "gemini-2.0-flash-exp",
            config: {
                systemInstruction: { parts: [{ text: "Hello" }] },
                tools: [
                    {
                        retrieval: {
                            vertexRagStore: {
                                ragResources: [{ ragCorpus: "projects/225213488414/locations/us-west1/ragCorpora/4611686018427387904" }]
                            }
                        }
                    }
                ]
            }
        });
        console.log("Connected.");
        for await (const msg of session.receive()) {
            console.log("Message:", msg);
        }
    } catch (e) {
        console.error("Error connecting:", e);
    }
}
main();
