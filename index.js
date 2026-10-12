const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

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
let lastFetchTime = 0;
const CACHE_DURATION = 15 * 1000; // ১৫ সেকেন্ড ক্যাশ ভ্যালিড থাকবে

async function fetchAndCacheData() {
    let now = Date.now();
    // যদি ক্যাশ খালি থাকে বা ১৫ সেকেন্ড পার হয়ে যায়, তবে নতুন করে ডাটা এনে ক্যাশ আপডেট করবে
    if (cachedPosts.length === 0 || (now - lastFetchTime > CACHE_DURATION)) {
        try {
            let postRes = await fetch(`${APPS_SCRIPT_URL}?type=posts&t=${now}`);
            let postData = await postRes.json();
            if (Array.isArray(postData)) {
                cachedPosts = postData;
            }

            let userRes = await fetch(`${APPS_SCRIPT_URL}?type=users&t=${now}`);
            let userData = await userRes.json();
            if (Array.isArray(userData)) {
                cachedUsers = userData;
            }
            lastFetchTime = now;
        } catch (err) {
            console.error("Cache Fetch Error:", err.message);
        }
    }
}

// --- GET রিকোয়েস্ট ---
app.get('/', async (req, res) => {
    const type = req.query.type;
    
    // প্রতি GET রিকোয়েস্টে ব্যাকগ্রাউন্ডে ক্যাশ চেক ও আপডেট করে নেবে
    await fetchAndCacheData();

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
            body: JSON.stringify(req.body),
            redirect: 'follow'
        });
        
        let result = await response.json();

        // ডাটা পরিবর্তন হলে ক্যাশ রিসেট করে দেওয়া যাতে পরের গেট রিকোয়েস্টে ফ্রেশ ডাটা আসে
        cachedPosts = [];
        cachedUsers = [];

        res.json(result);
    } catch (err) {
        console.error("POST to Google Sheet Error:", err);
        res.status(500).json({ status: "error", message: err.toString() });
    }
});

// Vercel-এর জন্য লোকাল পোর্ট লিসেন বাদ দিয়ে অ্যাপ এক্সপোর্ট করা হলো
module.exports = app;
