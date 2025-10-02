const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');

const User = require('./models/user.js');

// --- 1. कॉन्फ़िगरेशन (CONFIGURATION) ---
const DB_PASSWORD = 'Sharma1020'; // यूजर द्वारा दिया गया पासवर्ड
const MONGO_URI = `mongodb+srv://sharma10:${DB_PASSWORD}@cluster0.y50ttjv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`; 

const JWT_SECRET = 'Rndm!SuperS3cr3tK3y@4CaptchaApp2025_Final'; // <<< यह गुप्त कोड है!
const PORT = 5000;
const FREE_TRIAL_LIMIT = 50;
const FRONTEND_URL = 'http://127.0.0.1:5500'; // <<< अगर आपकी वेबसाइट का पोर्ट अलग है, तो इसे बदलें!

// Middleware for authenticating the JWT Token
const auth = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).send({ message: 'Authentication failed. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Store user ID in request
        next();
    } catch (err) {
        res.status(401).send({ message: 'Invalid token.' });
    }
};

const app = express();

// CORS कॉन्फ़िगरेशन
app.use(cors({ origin: FRONTEND_URL })); 
app.use(bodyParser.json());

// --- 2. डेटाबेस कनेक्शन (DATABASE CONNECTION) ---
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Connected Successfully'))
    .catch(err => console.error('MongoDB connection error:', err));


// --- 3. ऑथेंटिकेशन और अन्य API एंडपॉइंट्स ---

// साइनअप (Signup)
app.post('/api/auth/signup', async (req, res) => {
    const { name, mobile, email, password } = req.body;
    try {
        if (await User.findOne({ email })) {
            return res.status(400).send({ message: 'Account with this email already exists.' });
        }
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = new User({ name, mobile, email, password: hashedPassword });
        await user.save();
        
        // Auto-login after signup
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).send({ success: true, message: 'Sign Up successful!', token });

    } catch (error) {
        res.status(500).send({ message: 'Server error during sign up. (Check if mobile/email is already used)' });
    }
});

// लॉगिन (Login)
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).send({ message: 'Invalid email or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).send({ message: 'Invalid email or password.' });
        }

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).send({ success: true, token });

    } catch (error) {
        res.status(500).send({ message: 'Server error during login.' });
    }
});

// वर्तमान यूजर डेटा और बैलेंस प्राप्त करें
app.get('/api/user/balance', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).send({ message: 'User not found.' });
        }
        // संवेदनशील डेटा (जैसे पासवर्ड) को छोड़कर बाकी भेजें
        res.status(200).send({
            success: true,
            balance: user.walletBalance,
            captchasSolved: user.captchasSolved,
            isSubscribed: user.isSubscribed,
            rewardRate: user.captchaRewardRate,
            name: user.name,
            email: user.email,
            mobile: user.mobile
        });
    } catch (error) {
        res.status(500).send({ message: 'Error fetching user data.' });
    }
});

// Captcha सॉल्व करें और बैलेंस अपडेट करें
app.post('/api/captcha/solve', auth, async (req, res) => {
    
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).send({ message: 'User not found.' });
        }

        const reward = user.isSubscribed ? user.captchaRewardRate : 5;
        
        // फ्री ट्रायल लिमिट चेक करें
        if (!user.isSubscribed && user.walletBalance >= FREE_TRIAL_LIMIT) {
             return res.status(403).send({ 
                 success: false, 
                 message: `FREE TRIAL LIMIT REACHED (₹${FREE_TRIAL_LIMIT}). Please buy a subscription.` 
             });
        }

        // बैलेंस अपडेट करें
        user.walletBalance += reward;
        user.captchasSolved += 1;
        await user.save();

        res.status(200).send({
            success: true,
            message: `+₹${reward} added.`,
            newBalance: user.walletBalance
        });

    } catch (error) {
        res.status(500).send({ message: 'Server error during captcha solve.' });
    }
});

// विथड्रॉवल रिक्वेस्ट
app.post('/api/withdraw/request', auth, async (req, res) => {
    const { amount, method, details } = req.body; 
    const withdrawAmount = parseInt(amount);

    if (withdrawAmount < 50) {
        return res.status(400).send({ message: 'Minimum withdrawal amount is ₹50.' });
    }
    
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).send({ message: 'User not found.' });
        }

        if (withdrawAmount > user.walletBalance) {
            return res.status(400).send({ message: 'Insufficient Balance!' });
        }
        
        user.walletBalance -= withdrawAmount;
        await user.save();
        
        res.status(200).send({
            success: true,
            message: `Withdrawal of ₹${withdrawAmount} requested via ${method}. Processing... (New Balance: ${user.walletBalance})`,
            newBalance: user.walletBalance
        });

    } catch (error) {
        res.status(500).send({ message: 'Server error during withdrawal request.' });
    }
});

// सपोर्ट मैसेज
app.post('/api/support/message', auth, async (req, res) => {
    const { message } = req.body;
    
    if (!message) {
        return res.status(400).send({ message: 'Message content cannot be empty.' });
    }
    
    // यह मैसेज आपके टर्मिनल पर दिखेगा
    console.log(`\n--- NEW SUPPORT MESSAGE ---\nUser ID: ${req.user.userId}\nMessage: ${message}\n---------------------------\n`);

    res.status(200).send({ 
        success: true, 
        message: 'Message sent! Our team will get back to you soon.' 
    });
});


// --- 4. सर्वर शुरू करें (START THE SERVER) ---
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);

});
