const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Public static files
app.use(express.static(path.join(__dirname, 'public')));

// Environment Variables
const TOKEN = process.env.BOT_TOKEN || '8961524303:AAEc_T_YgDadX5-qYy_bdxzkkk6MM35EPNw';
const bot = new TelegramBot(TOKEN, { polling: true });

// Prevent 409 Conflict Errors
bot.on('polling_error', (error) => {
    if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
        console.warn("⚠️ Warning: 409 Conflict - Process biraatu botii kana run gochaa jira.");
    } else {
        console.error("Bot Polling Error:", error.message);
    }
});

// Database temporal storage
const registeredUsers = {}; // { 'user@email.com': { chatId: 12345678, name: 'Gemechu' } }
const userOTPStore = {};     // { 'user@email.com': { code: '123456', expires: 1700000000000 } }
const botAwaitingEmail = {}; // { chatId: true }

// 🤖 Telegram Bot Flow: Strict Email Registration
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'Trader';
    botAwaitingEmail[chatId] = true;

    bot.sendMessage(chatId, 
        `👋 *Baga nagaan dhuftan ${name}!*\n\n🏛️ *APEX FOREX ACADEMY* (Founder: Gemechu Reta)\n\nWeb Portal irratti galmaa'uufi OTP dhaqqabachuuf, *Teessoo Email* keessan isa web irratti itti fayyadamuu barbaaddan asitti naaf ergaa:`, 
        { parse_mode: 'Markdown' }
    );
});

// Bot Email Capture
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim().toLowerCase() : '';

    if (text.startsWith('/')) return; // Ignore commands

    if (botAwaitingEmail[chatId]) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(text)) {
            registeredUsers[text] = {
                chatId: chatId,
                name: msg.from.first_name || 'Trader',
                registeredAt: new Date()
            };
            delete botAwaitingEmail[chatId];

            bot.sendMessage(chatId, 
                `✅ *Email Keessan Mirkanaa'eera!*\n\n📧 Email: \`${text}\`\n\nAmma gara Web Portal Apex Forex Academy deemuun Email kana galchitani 'Continue' tuquun OTP dajiitii 6 akka isiniif ergamu gochuu dandeessu!`,
                { parse_mode: 'Markdown' }
            );
        } else {
            bot.sendMessage(chatId, `❌ *Email sirrii miti!* Maaloo teessoo Email sirrii ta'e deebisaatii ergaa (Fakkeenya: name@gmail.com).`);
        }
    }
});

// 📩 API: Send Verification Code (OTP)
app.post('/api/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email galchuu dhiistanisa!" });

    const normalizedEmail = email.trim().toLowerCase();
    const userData = registeredUsers[normalizedEmail];

    // Check if Email is registered via Telegram Bot first
    if (!userData || !userData.chatId) {
        return res.status(403).json({ 
            success: false, 
            message: "Email kun Bot Telegram irratti hin galmaa'e! Maaloo dursa Telegram Bot (@smcfxpro_bot) banaati Email keessan galmeessaa." 
        });
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    userOTPStore[normalizedEmail] = {
        code: otpCode,
        expires: Date.now() + 5 * 60 * 1000 // Valid 5 mins
    };

    try {
        await bot.sendMessage(userData.chatId, 
            `🔐 *APEX FOREX ACADEMY - Verification Code*\n\nKoodii Seensaa (OTP) Keessan: *${otpCode}*\n\n(Koodiin kun daqiiqaa 5 qofaaf tura. Namatti hin argasiisinaa!)`, 
            { parse_mode: 'Markdown' }
        );
        return res.json({ success: true, message: "Koodiin verification Telegram Bot keessaniif ergameera!" });
    } catch (err) {
        console.error("Error sending OTP via bot:", err.message);
        return res.status(500).json({ success: false, message: "Botiin ergaa erguu dadhabeera. Bot banaa jiraachuu keessan mirkaneessaa." });
    }
});

// 🔑 API: Verify OTP Code
app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const record = userOTPStore[normalizedEmail];

    if (!record) return res.status(400).json({ success: false, message: "Koodiin hin argamne. Deebistanii 'Resend' godhaa." });
    if (Date.now() > record.expires) {
        delete userOTPStore[normalizedEmail];
        return res.status(400).json({ success: false, message: "Koodiin kun yeroon isaa darbeera (Expired)." });
    }

    if (record.code === otp.trim()) {
        delete userOTPStore[normalizedEmail];
        const user = registeredUsers[normalizedEmail];
        return res.json({ 
            success: true, 
            message: "Mirkanaa'eera!",
            user: { email: normalizedEmail, name: user ? user.name : 'Trader' }
        });
    } else {
        return res.status(400).json({ success: false, message: "Koodiin galchitan sirrii miti!" });
    }
});

// Fallback Single Page Route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Server Listen
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Apex Forex Platform Server-n port ${PORT} irratti ka'eera...`);
});

process.once('SIGINT', () => bot.stopPolling());
process.once('SIGTERM', () => bot.stopPolling());
