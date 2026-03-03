import { OpenAI } from 'openai';
import dotenv from 'dotenv';
dotenv.config();

console.log("Starting test-openai", { apiKey: process.env.OPENAI_API_KEY?.substring(0, 10) + "..." });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function main() {
    try {
        console.log("Calling OpenAI...");
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: "Sag hallo" }],
        });
        console.log("Success:", response.choices[0].message.content);
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
