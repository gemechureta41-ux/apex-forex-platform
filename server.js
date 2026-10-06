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

// Telegram Bot Setup - Bot Token haaraa galchuuf
const TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '8961524303:AAEWW1I_wp9wKXsbGNRBunGiPORgCXWLI6E';

if (!TOKEN) {
    console.error("❌ ERROR: BOT_TOKEN Environment Variable keessatti hin argamne!");
}

// Bot instance (Polling mode)
const bot = new TelegramBot(TOKEN, { polling: true });

// Handle Polling Errors (409 Conflict akka hin uumamneef)
bot.on('polling_error', (error) => {
    if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
        console.warn("⚠️ Warning: 409 Conflict detected. Process biraatu botii kana run gochaa jira.");
    } else {
        console.error("Bot Polling Error:", error.message);
    }
});

// Store OTP temporal memory
const userOTPStore = {}; // { email: { code: '123456', expires: timestamp } }

// 🤖 Telegram Bot Commands
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || 'Trader';

    bot.sendMessage(chatId, `👋 Baga nagaan dhuftan ${name}!\n\n🏛️ *APEX FOREX ACADEMY*\n*Founder:* Gemechu Reta\n\nVerification code (OTP) Web App irraa ergame asitti isiniif dhaqqaba.\n\nEmail keessan Web Portal irratti galchitanii 'Continue' cuqaasaa.`, {
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

    const targetChatId = chatId || process.env.ADMIN_CHAT_ID;

    if (targetChatId) {
        try {
            await bot.sendMessage(targetChatId, `🔐 *APEX FOREX ACADEMY - Verification Code*\n\nKoodii Seensaa Keessan: *${otpCode}*\n\n(Koodiin kun daqiiqaa 5 qofaaf tura.)`, {
                parse_mode: 'Markdown'
            });
            return res.json({ success: true, message: "Koodiin verification Telegram Bot keessaniif ergameera!" });
        } catch (err) {
            console.error("Error sending Telegram message:", err.message);
            return res.status(500).json({ success: false, message: "Telegram Bot ergaa erguu dadhabeera." });
        }
    } else {
        console.log(`[LOCAL OTP] Email: ${email} | Code: ${otpCode}`);
        return res.json({ 
            success: true, 
            message: "OTP generated successfully!" 
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
        return res.json({ success: true, message: "Mirkanaa'eera! Welcome to Apex Forex Academy." });
    } else {
        return res.status(400).json({ success: false, message: "Koodiin galchitan sirrii miti!" });
    }
});

// Fallback Route for Web App Single Page
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
