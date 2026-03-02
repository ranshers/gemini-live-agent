import { GoogleGenAI } from '@google/genai';
// Determine project explicitly or use default.
// Assumes user is authenticated via Application Default Credentials
// For Cloud Run, ADC will automatically pick up the Compute Engine service account.
const ai = new GoogleGenAI({
    vertexai: true,
    project: 'thoughtinvest-prod',
    location: 'us-central1'
});
async function main() {
    console.log("Creating MemoryCorpus mapping to Gemini 2.5 Pro as LLM Parser...");
    const corpus = await ai.rag.createCorpus({
        corpus: {
            displayName: "idexx-procyte-memory-corpus",
            corpusTypeConfig: {
                memoryCorpus: {
                    llmParser: {
                        modelName: "gemini-2.5-pro"
                    }
                }
            }
        }
    });
    console.log("Memory Corpus created successfully!");
    console.log("Corpus Name:", corpus.name);
    console.log("Use this corpus NAME in the server/index.ts LiveConfig tool configuration.");
}
main().catch(console.error);
