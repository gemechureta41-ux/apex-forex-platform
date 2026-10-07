const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Kuusaa OTP yeroof (Production irratti Database/Redis fayyadami)
const otpDatabase = {};

// Nodemailer SMTP Transporter setup (Gmail)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Endpoint 1: OTP Dijiitii 4 uumee Email userichaatti erguu
app.post('/api/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: "Email address is required!" });
    }

    // Dijiitii 4 uumuu (Fkn: 4819)
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    // OTP fi yeroo irra darbu (minutes 5) kuusuu
    otpDatabase[email] = {
        otp: otp,
        expiresAt: Date.now() + 5 * 60 * 1000 
    };

    const mailOptions = {
        from: `"Apex Exchange Security" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🔐 Your Apex Exchange Verification Code',
        text: `Hello,\n\nYour 4-digit email verification code is: ${otp}\n\nThis code is valid for 5 minutes. Do not share it with anyone.\n\nBest regards,\nApex Exchange Team`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[OTP SENT] Code ${otp} sent to ${email}`);
        res.json({ success: true, message: "4-digit verification code successfully sent to your email!" });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ success: false, message: "Failed to send email. Check your SMTP configurations." });
    }
});

// Endpoint 2: OTP Mirkaneessuu (Verify)
app.post('/api/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
        return res.status(400).json({ success: false, message: "Email and OTP are required!" });
    }

    const record = otpDatabase[email];

    if (!record) {
        return res.status(400).json({ success: false, message: "No OTP request found for this email." });
    }

    if (Date.now() > record.expiresAt) {
        delete otpDatabase[email];
        return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
    }

    if (record.otp === otp) {
        delete otpDatabase[email]; // Verified ta'ee booda haqamuu qaba
        res.json({ success: true, message: "Email verified successfully!" });
    } else {
        res.status(400).json({ success: false, message: "Invalid 4-digit OTP code." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Apex Exchange Backend Server running on port ${PORT}`);
});
