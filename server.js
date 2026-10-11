const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cron = require('node-cron');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// আপনার মূল গুগল অ্যাপস স্ক্রিপ্ট ওয়েব অ্যাপের লিংক
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz9V9Fsqhxxqjd3mIPGWQBwwmHpNSOO01TuO_R3iUPbYbflJjYa9vj91T8PeXlhengtIg/exec";

// মেমোরি ক্যাশ স্টোরেজ
let cachedPosts = [];
let cachedUsers = [];

// সাধারণ ব্যাকগ্রাউন্ড সিঙ্ক (প্রতি ৫ সেকেন্ড পরপর নতুন ডেটা থাকলে ক্যাশ আপডেট করবে)
async function backgroundSync() {
    try {
        let postRes = await fetch(`${APPS_SCRIPT_URL}?type=posts&t=${Date.now()}`);
        let postData = await postRes.json();
        if (Array.isArray(postData) && postData.length > 0) {
            cachedPosts = postData; 
        }

        let userRes = await fetch(`${APPS_SCRIPT_URL}?type=users&t=${Date.now()}`);
        let userData = await userRes.json();
        if (Array.isArray(userData) && userData.length > 0) {
            cachedUsers = userData;
        }
    } catch (err) {
        console.error("Background Sync Error:", err.message);
    }
}

// সার্ভার চালু হওয়ার সাথে একবার ফেচ হবে এবং প্রতি ৫ সেকেন্ড পর পর চলতে থাকবে
backgroundSync();
setInterval(backgroundSync, 5000);

// --- প্রতিদিন রাত ৩:০০ টায় ক্যাশ রিসেট ও নতুন ডাটা নেওয়ার শিডিউল (Cron Job) ---
// ক্রন ফরম্যাট: '0 3 * * *' মানে প্রতিদিন রাত ৩টা ০ মিনিট ০ সেকেন্ডে রান হবে
cron.schedule('0 3 * * *', async () => {
    console.log("⏰ রাত ৩টা বেজে গেছে! পুরোনো ক্যাশ ক্লিয়ার করে নতুন ক্যাশ নেওয়া হচ্ছে...");
    
    // ক্যাশ সাময়িকভাবে খালি করা
    cachedPosts = [];
    cachedUsers = [];

    // সাথে সাথেই গুগল শিট থেকে একদম তাজা ক্যাশ টেনে আনা
    await backgroundSync();
    console.log("✨ রাতের শিডিউল অনুযায়ী ক্যাশ সফলভাবে রিফ্রেশ করা হয়েছে!");
}, {
    timezone: "Asia/Dhaka" // বাংলাদেশের সময় অনুযায়ী রাত ৩টা
});

// --- GET রিকোয়েস্ট: ইনস্ট্যান্ট ক্যাশ ডাটা পাঠানো ---
app.get('/', async (req, res) => {
    const type = req.query.type;
    
    if (type === 'posts') {
        return res.json(cachedPosts);
    } 
    else if (type === 'users') {
        return res.json(cachedUsers);
    } 
    else {
        try {
            let targetURL = `${APPS_SCRIPT_URL}?${new URLSearchParams(req.query).toString()}`;
            let r = await fetch(targetURL);
            let d = await r.json();
            return res.json(d);
        } catch (e) {
            return res.json([]);
        }
    }
});

// --- POST রিকোয়েস্ট ---
app.post('/', async (req, res) => {
    try {
        let response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        let result = await response.json();

        setTimeout(backgroundSync, 1000);

        res.json(result);
    } catch (err) {
        res.status(500).json({ status: "error", message: err.toString() });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`B_book Cron Cache Server is running on port ${PORT}`);
});
