// Captcha के लिए इस्तेमाल होने वाले अक्षर और संख्याएँ
const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
let currentCaptcha = '';

// सर्वर का URL (लोकल टेस्टिंग के लिए)
const API_URL ='https://captcha-7.onrender.com'; 
const FREE_TRIAL_LIMIT = 50; 

// DOM Elements
const captchaTextElement = document.getElementById('captchaText');
const captchaInput = document.getElementById('captchaInput');
const refreshBtn = document.getElementById('refreshBtn');
const submitBtn = document.getElementById('submitBtn');
const messageElement = document.getElementById('message');
const walletBalanceEl = document.getElementById('walletBalance');
const limitMessageEl = document.getElementById('limitMessage');
const chatOverlay = document.getElementById('chatOverlay');
const chatSendBtn = document.querySelector('#chatOverlay .chat-box button');
const chatTextarea = document.querySelector('#chatOverlay textarea');

// Global User Data (सर्वर से लोड होगा)
let walletBalance = 0;
let isSubscribed = false; 
let captchaRewardRate = 5; 


// 1. Captcha उत्पन्न करें (Generate Captcha)
function generateCaptcha() {
    let captcha = '';
    for (let i = 0; i < 6; i++) {
        captcha += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return captcha;
}

function displayNewCaptcha() {
    currentCaptcha = generateCaptcha();
    captchaTextElement.textContent = currentCaptcha;
    captchaInput.value = '';
    messageElement.textContent = '';
}

// 2. Wallet Balance को अपडेट करें और लिमिट चेक करें (UI Update)
function updateBalanceAndCheckLimit(isSubmit = false) {
    walletBalanceEl.textContent = `₹${walletBalance}`;
    
    if (!isSubscribed && walletBalance >= FREE_TRIAL_LIMIT) {
        limitMessageEl.textContent = `FREE TRIAL LIMIT REACHED (₹${FREE_TRIAL_LIMIT}). Please upgrade your plan.`;
        limitMessageEl.style.color = 'red';
        submitBtn.disabled = true;
    } else {
        if (!isSubscribed) {
             limitMessageEl.textContent = `Free Trial: Earn up to ₹${FREE_TRIAL_LIMIT} (Currently earning ₹5/captcha)`;
        } else {
             limitMessageEl.textContent = `Subscription Active: Earning ₹${captchaRewardRate}/captcha. No limit!`;
        }
        limitMessageEl.style.color = '#ffc107';
        submitBtn.disabled = false;
    }
}

// 3. Captcha सबमिट करें (Server API Call)
async function checkCaptcha() {
    const enteredCaptcha = captchaInput.value.trim();
    const token = localStorage.getItem('authToken');

    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    if (enteredCaptcha === '') {
        messageElement.textContent = 'Please enter the text in the image.';
        messageElement.style.color = '#ffc107'; 
        return;
    }

    if (enteredCaptcha === currentCaptcha) {
        messageElement.textContent = 'Correct! Updating balance...';
        messageElement.style.color = '#ffc107'; 
        submitBtn.disabled = true;

        try {
            const response = await fetch(`${API_URL}/api/captcha/solve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ enteredCaptcha })
            });

            const data = await response.json();
            submitBtn.disabled = false;
            
            if (response.status === 200 && data.success) {
                // सर्वर से अपडेटेड बैलेंस प्राप्त करें
                walletBalance = data.newBalance; 
                isSubscribed = data.isSubscribed;
                updateBalanceAndCheckLimit(true); 
                
                messageElement.textContent = data.message + ' New captcha generated.';
                messageElement.style.color = 'lightgreen';
                
                setTimeout(displayNewCaptcha, 1000); 
            } else if (response.status === 403) {
                 // फ्री ट्रायल लिमिट पहुँच गई
                 messageElement.textContent = data.message;
                 messageElement.style.color = 'red';
                 updateBalanceAndCheckLimit(false); 
            } else {
                messageElement.textContent = data.message || 'Server error. Try again.';
                messageElement.style.color = 'red';
            }

        } catch (error) {
            submitBtn.disabled = false;
            messageElement.textContent = 'Connection error. Check network and server.';
            messageElement.style.color = 'red';
        }
        
    } else {
        messageElement.textContent = 'Incorrect! Please try again.';
        messageElement.style.color = '#dc3545'; 
    }
}


// 4. सपोर्ट मैसेज भेजें (Support Message API)
async function sendSupportMessage() {
    const message = chatTextarea.value.trim();
    const token = localStorage.getItem('authToken');
    
    if (!message) return;

    chatSendBtn.disabled = true;
    chatSendBtn.textContent = 'Sending...';
    
    try {
        const response = await fetch(`${API_URL}/api/support/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        
        alert(data.message);
        chatTextarea.value = '';
        chatOverlay.style.display = 'none';

    } catch (error) {
        alert('Failed to send message. Please try again.');
    } finally {
        chatSendBtn.disabled = false;
        chatSendBtn.textContent = 'Send Message';
    }
}


// 5. पेज लोड होने पर सर्वर से डेटा लोड करें (Initial Load)
async function loadUserData() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/user/balance`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 200) {
            const data = await response.json();
            // सर्वर से डेटा लोड करें और ग्लोबल वैरिएबल अपडेट करें
            walletBalance = data.balance;
            isSubscribed = data.isSubscribed;
            captchaRewardRate = data.rewardRate;
            
            updateBalanceAndCheckLimit(false); 
            displayNewCaptcha();
        } else {
            // टोकन अमान्य है, लॉग आउट करें
            localStorage.removeItem('authToken');
            alert("Session expired. Please log in again.");
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error("Error loading user data:", error);
        messageElement.textContent = 'Cannot connect to the server. Please check network.';
        messageElement.style.color = 'red';
    }
}


// Event Listeners for Captcha/Balance
refreshBtn.addEventListener('click', displayNewCaptcha);
submitBtn.addEventListener('click', checkCaptcha);

// Support/Chat Logic Event Listener
if (chatSendBtn) {
    chatSendBtn.addEventListener('click', sendSupportMessage);
} 


captchaInput.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {
        checkCaptcha();
    }
});

// पेज लोड होते ही डेटा लोड करें

window.onload = loadUserData;
