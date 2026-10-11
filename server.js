const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// আপনার মূল গুগল অ্যাপস স্ক্রিপ্ট ওয়েব অ্যাপের লিংক
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz9V9Fsqhxxqjd3mIPGWQBwwmHpNSOO01TuO_R3iUPbYbflJjYa9vj91T8PeXlhengtIg/exec";

// মেমোরি ক্যাশ স্টোরেজ (সার্ভার আগে থেকেই ডাটা এনে রাখবে)
let cachedPosts = [];
let cachedUsers = [];

// প্রতি ৩ সেকেন্ড পর পর ব্যাকগ্রাউন্ডে গুগল শিট থেকে ডাটা টেনে ক্যাশ করে রাখবে
async function syncDataFromGoogleSheet() {
    try {
        let postRes = await fetch(`${APPS_SCRIPT_URL}?type=posts`);
        let postData = await postRes.json();
        if (Array.isArray(postData)) cachedPosts = postData;

        let userRes = await fetch(`${APPS_SCRIPT_URL}?type=users`);
        let userData = await userRes.json();
        if (Array.isArray(userData)) cachedUsers = userData;

        console.log("Background Cache Synced at:", new Date().toLocaleTimeString());
    } catch (err) {
        console.error("Sync Error:", err.message);
    }
}

// সার্ভার চালু হওয়ার সাথে একবার ফেচ হবে এবং প্রতি ৩ সেকেন্ড পর পর চলতে থাকবে
syncDataFromGoogleSheet();
setInterval(syncDataFromGoogleSheet, 3000);

// --- GET রিকোয়েস্ট (ক্যাশ থেকে ইনস্ট্যান্ট ডাটা পাঠাবে) ---
app.get('/', async (req, res) => {
    const type = req.query.type;
    
    if (type === 'posts') {
        return res.json(cachedPosts);
    } 
    else if (type === 'users') {
        return res.json(cachedUsers);
    } 
    else {
        // ফ্রেন্ডস বা মেসেজের মতো রিয়েলটাইম ডাটা সরাসরি শিট থেকে ফেচ হবে
        let targetURL = `${APPS_SCRIPT_URL}?${new URLSearchParams(req.query).toString()}`;
        let r = await fetch(targetURL);
        let d = await r.json();
        return res.json(d);
    }
});

// --- POST রিকোয়েস্ট (লগইন, রেজিস্ট্রেশন, পোস্ট, লাইক, মেসেজ ইত্যাদি গুগল শিটে পাঠাবে) ---
app.post('/', async (req, res) => {
    try {
        let response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        let result = await response.json();

        // নতুন পোস্ট বা লাইক হলে সাথে সাথে ক্যাশ আপডেট করে নেবে
        if (["addPost", "likePost", "addComment", "register", "updateProfilePic"].includes(req.body.action)) {
            setTimeout(syncDataFromGoogleSheet, 300); 
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ status: "error", message: err.toString() });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`B_book Server is running on port ${PORT}`);
});
