const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    
    // Wallet and Subscription Details
    walletBalance: { type: Number, default: 0 },
    captchasSolved: { type: Number, default: 0 },
    isSubscribed: { type: Boolean, default: false },
    captchaRewardRate: { type: Number, default: 5 } // Default rate
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);