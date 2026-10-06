const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Public folder (Frontend static files)
app.use(express.static(path.join(__dirname, 'public')));

// Telegram Bot Setup
const TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

if (!TOKEN) {
    console.error("❌ ERROR: BOT_TOKEN Environment Variable keessatti hin argamne!");
}

// Bot instance (Polling mode)
const bot = new TelegramBot(TOKEN, { polling: true });

// Handle Polling Errors (409 Conflict akka hin uumamneef)
bot.on('polling_error', (error) => {
    if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
        console.warn("⚠️ Warning: 409 Conflict detected. Process biraatu botii kana run gochaa jira ta'a.");
    } else {
        console.error("Bot Polling Error:", error.message);
    }
});

// Database yeroo gabaabaa (OTP fi Chat ID store gochuuf)
const userOTPStore = {}; // { email: { code: '123456', expires: timestamp } }
const userTelegramMap = {}; // { chatId: email }

// 🤖 Telegram Bot Commands
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'Trader';

    bot.sendMessage(chatId, `👋 Baga nagaan dhuftan ${name}!\n\n🏛️ *APEX FOREX ACADEMY* (Hundeessaa: Gemechu Reta)\n\nVerification code (OTP) Web App irraa ergame asitti isiniif dhaqqaba.\n\nEemail keessan Web Portal irratti galchiti 'Continue' cuqaasaa.`, {
        parse_mode: 'Markdown'
    });
});

// 📩 API: Send Verification Code (OTP)
app.post('/api/send-otp', async (req, res) => {
    const { email, chatId } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: "Email galchuu dhiistanisa!" });
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    userOTPStore[email.toLowerCase()] = {
        code: otpCode,
        expires: Date.now() + 5 * 60 * 1000 // 5 Minutes valid
    };

    // If direct Chat ID is provided or broadcast to active user
    const targetChatId = chatId || process.env.ADMIN_CHAT_ID;

    if (targetChatId) {
        try {
            await bot.sendMessage(targetChatId, `🔐 *APEX FOREX ACADEMY - Verification Code*\n\nKoodii Seensaa Keessan: *${otpCode}*\n\n(Koodiin kun daqiiqaa 5 qofaaf tura. Namatti hin argasiisinaa!)`, {
                parse_mode: 'Markdown'
            });
            return res.json({ success: true, message: "Koodiin verification Telegram Bot keessaniif ergameera!" });
        } catch (err) {
            console.error("Error sending Telegram message:", err.message);
            return res.status(500).json({ success: false, message: "Telegram Bot ergaa erguu dadhabeera." });
        }
    } else {
        // Broadcast test mode or fallback response
        console.log(`[LOCAL DEV OTP] Email: ${email} | Code: ${otpCode}`);
        return res.json({ 
            success: true, 
            message: "OTP generated (Bot Chat ID hin hammatamne, Admin Chat ID Env irratti galchaa)." 
        });
    }
});

// 🔑 API: Verify OTP Code
app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    const record = userOTPStore[email.toLowerCase()];

    if (!record) {
        return res.status(400).json({ success: false, message: "Koodiin hin argamne. Deebistanii 'Resend' godhaa." });
    }

    if (Date.now() > record.expires) {
        delete userOTPStore[email.toLowerCase()];
        return res.status(400).json({ success: false, message: "Koodiin kun yeroon isaa darbeera (Expired)." });
    }

    if (record.code === otp.trim()) {
        delete userOTPStore[email.toLowerCase()];
        return res.json({ success: true, message: "Mirkanaa'eera! Welcome to Portal." });
    } else {
        return res.status(400).json({ success: false, message: "Koodiin galchitan sirrii miti!" });
    }
});

// Fallback Route for Web App Single Page (index.html)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Server Listening
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Apex Forex Platform Server-n port ${PORT} irratti ka'eera...`);
});

// Process Cleanup
process.once('SIGINT', () => bot.stopPolling());
process.once('SIGTERM', () => bot.stopPolling());
