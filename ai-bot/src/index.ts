import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import dotenv from 'dotenv';
import { generateResponse } from './services/ai.service';
import { getTelegramUser, linkTelegramAccount } from './services/db.service';

// Load environment variables
dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is missing in .env');
}

// Initialize Telegram Bot
const bot = new Telegraf(botToken);

// Handle /start command
bot.start((ctx) => {
    ctx.reply('Moin Chef! Dein HandwerkOS Praktikant meldet sich zum Dienst. Nutze /link <CODE> um dich mit deinem Firmen-Konto zu verbinden.');
});

// Handle /link command
bot.command('link', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length !== 2) {
        return ctx.reply('Bitte nutze das Format: /link <DEIN_CODE>');
    }

    const code = args[1];
    const chatId = ctx.chat.id;

    const result = await linkTelegramAccount(chatId, code);
    ctx.reply(result.message);
});

// Handle regular text messages
bot.on(message('text'), async (ctx) => {
    const userMessage = ctx.message.text;
    const chatId = ctx.chat.id;

    // Check if user is authenticated
    const user = await getTelegramUser(chatId);
    if (!user) {
        return ctx.reply('Du bist noch nicht mit HandwerkOS verknüpft. Bitte generiere einen Code in der Software und nutze /link <CODE>.');
    }

    console.log(`[Message receive] Company ID: ${user.company_id} | User: ${userMessage}`);

    // Show typing status in Telegram while OpenAI thinks
    await ctx.sendChatAction('typing');

    try {
        // Forward to OpenAI service with the user's company ID
        const responseText = await generateResponse(userMessage, user.company_id);

        // Send AI answer back to Telegram
        await ctx.reply(responseText);

    } catch (error) {
        console.error('Error processing message:', error);
        await ctx.reply('Da ging was beim Nachdenken schief. Versuchs nochmal!');
    }
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Launch the bot locally
bot.launch(() => {
    console.log('🤖 HandwerkOS AI Bot runs successfully! Send a message to your bot in Telegram.');
});
