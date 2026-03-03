import { generateResponse } from './src/services/ai.service';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    console.log("Testing generateResponse...");
    try {
        const result = await generateResponse("Zeig mir alle Kunden", "00000000-0000-0000-0000-000000000000");
        console.log("Result:", result);
    } catch (e) {
        console.error("Error calling generateResponse:", e);
    }
}
main();
