import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import { getCustomers, getProjects } from './db.service';

// Configure dotenv
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_PROMPT = `
Du bist der digitale KI-Praktikant für das HandwerkOS Betriebssystem. 
Du unterstützt Handwerker auf der Baustelle per Chat. 
Antworte pragmatisch, direkt und auf den Punkt. Kein langes Gerede.
Dein Ton ist professionell, aber handwerkergerecht. Du bist fleißig und proaktiv.

WICHTIG: Dir stehen externe Tools (Werkzeuge) zur Verfügung. Wenn der Nutzer nach Kunden oder Projekten fragt, nutze ZWINGEND diese Tools, um echte Daten aus dem System abzurufen, bevor du antwortest!
`;

const tools = [
    {
        type: "function" as const,
        function: {
            name: "get_customers",
            description: "Hole eine Liste aller Kunden aus der HandwerkOS Datenbank."
        }
    },
    {
        type: "function" as const,
        function: {
            name: "get_projects",
            description: "Hole eine Liste aller aktuellen Handwerks-Projekte aus der Datenbank."
        }
    }
];

export async function generateResponse(userMessage: string, companyId?: string): Promise<string> {
    try {
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage }
        ];

        console.log('[AI] Asking OpenAI...');
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Very fast and cost effective
            messages: messages,
            tools: tools,
            tool_choice: "auto",
        });

        const responseMessage = response.choices[0]?.message;

        // Check if OpenAI decided to call a function
        if (responseMessage && responseMessage.tool_calls) {
            const functionNames = responseMessage.tool_calls
                .filter(t => t.type === 'function')
                .map(t => t.function.name);
            console.log('[AI] OpenAI called tools:', functionNames);

            // OpenAI expects the assistant's request to be part of the history
            messages.push(responseMessage);

            // Execute each requested tool
            for (const toolCall of responseMessage.tool_calls) {
                if (toolCall.type !== 'function') continue;

                if (toolCall.function.name === 'get_customers') {
                    const customers = await getCustomers(companyId || '');
                    messages.push({
                        tool_call_id: toolCall.id,
                        role: "tool",
                        content: JSON.stringify(customers),
                    });
                } else if (toolCall.function.name === 'get_projects') {
                    const projects = await getProjects(companyId || '');
                    messages.push({
                        tool_call_id: toolCall.id,
                        role: "tool",
                        content: JSON.stringify(projects),
                    });
                }
            }

            // Ask OpenAI again, now with the tool results
            console.log('[AI] Asking OpenAI again with tool results...');
            const secondResponse = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: messages,
            });

            return secondResponse.choices[0]?.message?.content || "Entschuldigung, Chef. Da gabs ein Problem mit den Daten.";
        }

        return responseMessage?.content || "Entschuldigung, da ist was schiefgelaufen, Chef.";
    } catch (error) {
        console.error("Error calling OpenAI:", error);
        return "Fehler bei der Verbindung zur KI. Bitte prüfe das Backend.";
    }
}
