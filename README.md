# 🔐 Authenticator Pro (Liquid Glass Edition)

Google Authenticator-এর চেয়ে বেশি ক্ষমতাসম্পন্ন একটি 2FA অ্যাপ — **iOS Liquid Glass + Water Drop UI** (ডার্ক ও লাইট দুই মোডেই), **GitHub Pages-এ ১০০% ফ্রিতে হোস্ট হয় এবং ফোনে অ্যাপের মতো ইনস্টল হয়** (PWA)।

## ফিচার

| | |
|---|---|
| 💧 Liquid Glass UI | iOS-স্টাইল স্বচ্ছ কাচের কার্ড, ভাসমান হেডার, পানির ফোঁটার বাটন, ট্যাপে ঢেউ, এক-ট্যাপে ডার্ক/লাইট মোড |
| ✅ কোড | TOTP, HOTP, Steam Guard · SHA1/256/512 · ৫–৮ ডিজিট · পরবর্তী কোড প্রিভিউ (≤৮ সে.) |
| ☁️ Google সিঙ্ক | **Continue with Google** → Drive-এর লুকানো `appDataFolder`-এ AES-256-GCM অটো-ব্যাকআপ, নতুন ফোনে লগইন করলেই সব ফেরত |
| 📤 ২-মুখী Google Authenticator মাইগ্রেশন | Google Authenticator Export QR (`otpauth-migration://`) ইমপোর্ট (ব্যাচ প্রিভিউ সহ) **এবং** রিভার্স এক্সপোর্ট QR |
| ✏️ অ্যাডভান্স ম্যানেজ | কুইক অ্যাকশন গ্রিড, রিনেম, এডিট, পিন (⭐), গ্রুপ/ফোল্ডার, ম্যানুয়াল রিঅর্ডার (↑/↓), নোট, সার্চ, সর্ট |
| 🗑️ রিসাইকেল বিন | ডিলিট করা কোড ৩০ দিন ট্র্যাশে থাকে — যেকোনো সময় রিস্টোর বা স্থায়ীভাবে ডিলিট করা যায় |
| 🛡️ সিকিউরিটি | কাস্টম PIN লক, অটো-লক টাইমার, বায়োমেট্রিক আনলক (Fingerprint/Face ID), প্রাইভেসি ব্লার, অটো-কপি |

## সেটআপ (একবারই, ~৫–১০ মিনিট)

### ১) GitHub-এ আপলোড
```bash
cd authenticator-pro
git init && git add . && git commit -m "Authenticator Pro v3 Liquid Glass"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/authenticator-pro.git
git push -u origin main
```
তারপর GitHub রিপোতে **Settings → Pages → Source: GitHub Actions** সিলেক্ট করুন। পুশ করলেই টেস্ট চলে অটো-ডিপ্লয় হবে।

### ২) Google Client ID বানান (Continue with Google-এর জন্য)
1. <https://console.cloud.google.com> → নতুন Project
2. **APIs & Services → Library** → **Google Drive API** → Enable
3. **OAuth consent screen** → External → অ্যাপের নাম, ইমেইল দিন → Scopes-এ `.../auth/drive.appdata` যোগ করুন → Test users-এ নিজের Gmail দিন
4. **Credentials → Create credentials → OAuth client ID → Web application**
5. **Authorized JavaScript origins**-এ দিন: `https://YOUR-USERNAME.github.io`
6. কপি করা Client ID `js/config.js`-এ বসিয়ে পুশ করুন (অথবা অ্যাপের **Google ব্যাকআপ** মেনুতে সরাসরি পেস্ট করেও টেস্ট করতে পারবেন)

### ৩) ফোনে ইনস্টল
- **Android Chrome**: সাইট খুলুন → ⋮ → *Install app / Add to Home screen*
- **iPhone Safari**: Share → *Add to Home Screen*

## লোকালি টেস্ট
```bash
node tests/test.mjs
python3 -m http.server 8080
```
