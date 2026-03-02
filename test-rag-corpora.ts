import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const aiCentral = new GoogleGenAI({ vertexai: true, project: 'thoughtinvest-prod', location: 'us-central1' });

async function main() {
    try {
        const session = await aiCentral.live.connect({
            model: "gemini-2.0-flash-exp",
            config: {
                tools: [
                    {
                        retrieval: {
                            vertexRagStore: {
                                ragCorpora: ["projects/225213488414/locations/us-west1/ragCorpora/4611686018427387904"],
                                storeContext: true
                            }
                        }
                    }
                ]
            }
        });
        console.log("Connected to us-central1 with ragCorpora!");
        session.close();
    } catch(e: any) {
         console.error("us-central1 error:", e);
    }
}
main();
