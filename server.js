require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = './database.json';

function loadData() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ users: {} }, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveData(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

let db = loadData();
const userStates = {}; 
const otpStore = {};   

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.error("ERROR: TELEGRAM_BOT_TOKEN file .env keessatti hin argamne!");
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    userStates[chatId] = 'AWAITING_EMAIL';

    bot.sendMessage(
        chatId,
        "👋 **Baga Nagaan Dhuftan Apex Forex Assistant Bot'tti!**\n\nWebsaayitii keenya irratti verification OTP argachuuf, Maaloo **Email** keessan asitti ergaa:",
        { parse_mode: 'Markdown' }
    );
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim().toLowerCase() : '';

    if (text === '/start') return;

    if (userStates[chatId] === 'AWAITING_EMAIL') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(text)) {
            bot.sendMessage(chatId, "⚠️ Maaloo Email sirrii ta'e galchaa! (Fkn: `example@gmail.com`)", { parse_mode: 'Markdown' });
            return;
        }

        db = loadData();
        db.users[text] = {
            chatId: chatId,
            registeredAt: new Date().toISOString()
        };
        saveData(db);
        delete userStates[chatId];

        bot.sendMessage(
            chatId,
            `✅ **Milkaa'inaan Galmaa'ee Jira!**\n\nEmail: \`${text}\`\n\nAmma websaayitii irratti Email kanaan Login / Register gochuu dandeessu.`,
            { parse_mode: 'Markdown' }
        );
    }
});

app.post('/api/send-otp', (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Maaloo Email keessan galchaa!' });
    }

    const cleanEmail = email.trim().toLowerCase();
    db = loadData();
    const userRecord = db.users[cleanEmail];

    if (!userRecord) {
        return res.status(400).json({
            success: false,
            message: 'Email kun bot irratti hin galmaa\'ne! Dura Telegram irratti @apex_forex_assistant_bot start godhaatii Email keessan galmeessaa.'
        });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore[cleanEmail] = {
        otp: otp,
        expiresAt: Date.now() + 5 * 60 * 1000
    };

    const message = `🔑 *Koodii Verification Kee:* \`${otp}\` \n\nDaqiiqaa 5 keessatti koodii kana websaayitii irratti galchi. Nama biraatf hin kennin!`;

    bot.sendMessage(userRecord.chatId, message, { parse_mode: 'Markdown' })
        .then(() => {
            res.json({ success: true, message: 'OTP gara Telegram Bot keetiatti ergameera!' });
        })
        .catch((err) => {
            console.error('Telegram Error:', err);
            res.status(500).json({ success: false, message: 'OTP erguun hin danda\'amne. Bot start gochuu kee mirkaneeffadhu.' });
        });
});

app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ success: false, message: 'Email fi OTP ni barbaachisa!' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const record = otpStore[cleanEmail];

    if (!record) {
        return res.status(400).json({ success: false, message: 'OTP hin argamne ykn yeroon isaa darbeera.' });
    }

    if (Date.now() > record.expiresAt) {
        delete otpStore[cleanEmail];
        return res.status(400).json({ success: false, message: 'Koodiin OTP yeroon isaa darbeera!' });
    }

    if (record.otp === otp.trim()) {
        delete otpStore[cleanEmail];
        return res.json({ success: true, message: 'Verification Milkaa\'eera!' });
    } else {
        return res.status(400).json({ success: false, message: 'Koodiin OTP galchitan sirrii miti!' });
    }
});

app.listen(PORT, () => {
    console.log(`Server-n port ${PORT} irratti ka'eera...`);
});
