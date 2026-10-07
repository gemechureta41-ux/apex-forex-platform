const express = require('express');
const cors = require('cors');
require('dotenv').config();
const fetch = require('node-fetch');

const app = express();
app.use(express.json());
app.use(cors());

// Database memory naannoo (Production irratti Database dhugaa akka PostgreSQL ykn MongoDB fayyadamuu dandeessa)
const users = []; 
const telegramSubscribers = new Map(); // Email fi Telegram Chat ID walqabsiisuuf

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// 1. Telegram Bot Webhook ykn /start tracking (Bot irratti namni galchuuf)
app.post('/api/telegram-webhook', (express.json()), async (req, res) => {
    const { email, chatId } = req.body;
    if(email && chatId) {
        telegramSubscribers.set(email.toLowerCase().trim(), chatId);
        return res.json({ success: true, message: "Email registered with Telegram bot successfully!" });
    }
    res.status(400).json({ success: false, message: "Invalid data" });
});

// 2. Request OTP (Karaa Telegram Bot code digit 4 erguu)
app.post('/api/request-otp', async (req, res) => {
    const { email } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    // Check if email registered on Telegram bot first
    const chatId = telegramSubscribers.get(cleanEmail);
    if (!chatId) {
        return res.status(400).json({ 
            success: false, 
            message: "Durstee Bot Telegram keenya (@smcfxpro_bot) start godhiitii email kee galchuu qabda!" 
        });
    }

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Store OTP temporarily for user
    let user = users.find(u => u.email === cleanEmail);
    if(user) {
        user.otp = otp;
    } else {
        users.push({ email: cleanEmail, otp: otp, verified: false });
    }

    // Send OTP via Telegram Bot API
    try {
        const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: `🔐 Apex Forex Academy OTP Code kee: *${otp}*\nDeebisiitii galchi (Koodii kana namni biraa akka argitu hin hayyaminaa).`,
                parse_mode: 'Markdown'
            })
        });

        res.json({ success: true, message: "OTP code sent to your Telegram Bot successfully!" });
    } catch (error) {
        console.error("Telegram Error:", error);
        res.status(500).json({ success: false, message: "Failed to send OTP via Telegram." });
    }
});

// 3. Verify OTP & Complete Registration / Login
app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    const cleanEmail = email.toLowerCase().trim();
    
    const user = users.find(u => u.email === cleanEmail);
    if(user && user.otp === otp) {
        user.verified = true;
        return res.json({ success: true, message: "Verification successful!" });
    }
    
    res.status(400).json({ success: false, message: "Koodiin OTP sirrii miti ykn dogoggora." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Apex Forex Server is running on port ${PORT}`);
});
