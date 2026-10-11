const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cron = require('node-cron');

const app = express();

// বড় সাইজের ছবি ও Base64 ডেটা রিসিভ করার জন্য ৫০ মেগাবাইট লিমিট দেওয়া হলো
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// আপনার গুগল অ্যাপস স্ক্রিপ্ট ডেটাবেজ লিংক
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz9V9Fsqhxxqjd3mIPGWQBwwmHpNSOO01TuO_R3iUPbYbflJjYa9vj91T8PeXlhengtIg/exec";

// মেমোরি ক্যাশ স্টোরেজ
let cachedPosts = [];
let cachedUsers = [];

// ব্যাকগ্রাউন্ডে গুগল শিট থেকে ডেটা টেনে ক্যাশ করার ফাংশন
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
        console.log("Auto-Cache Synced at:", new Date().toLocaleTimeString());
    } catch (err) {
        console.error("Sync Error (Old Cache Preserved):", err.message);
    }
}

// প্রতি ৫ সেকেন্ড পর পর ব্যাকগ্রাউন্ড সিঙ্ক চলবে
backgroundSync();
setInterval(backgroundSync, 5000);

// প্রতিদিন রাত ৩:০০ টায় ক্যাশ ক্লিয়ার ও ফ্রেশ রিলোড (বাংলাদেশ সময়)
cron.schedule('0 3 * * *', async () => {
    console.log("⏰ রাত ৩:০০ টা! পুরোনো ক্যাশ ক্লিয়ার করে নতুন ক্যাশ নেওয়া হচ্ছে...");
    cachedPosts = [];
    cachedUsers = [];
    await backgroundSync();
}, {
    timezone: "Asia/Dhaka"
});

// --- GET রিকোয়েস্ট (মেমোরি ক্যাশ থেকে ইনস্ট্যান্ট ডেটা পাঠাবে) ---
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

// --- POST রিকোয়েস্ট (সরাসরি গুগল শিটে নিশ্চিতভাবে ডেটা সেভ করার ব্যবস্থা) ---
app.post('/', async (req, res) => {
    try {
        // redirect: 'follow' যুক্ত করা হয়েছে যাতে গুগল অ্যাপস স্ক্রিপ্টের রিডাইরেক্ট সঠিকভাবে কাজ করে
        let response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body),
            redirect: 'follow'
        });
        
        let result = await response.json();

        // পোস্ট, রেজিস্ট্রেশন বা আপডেট হলে ১ সেকেন্ড পর ক্যাশ আপডেট হবে
        setTimeout(backgroundSync, 1000);

        res.json(result);
    } catch (err) {
        console.error("POST to Google Sheet Error:", err);
        res.status(500).json({ status: "error", message: err.toString() });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`B_book Server running on port ${PORT}`);
});
