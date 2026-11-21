// Security Health Audit Engine for Authenticator Pro
// Audits 2FA vault health, backup coverage, duplicate secrets, and app security settings.

import * as drive from './drive.js';
import { isTelegramConfigured } from './telegram.js';

export function runSecurityAudit(vault, settings) {
  const accounts = vault.accounts || [];
  const issues = [];
  const strengths = [];
  let score = 100;

  // 1. Secret duplication check
  const secretMap = new Map();
  accounts.forEach((acc) => {
    const sec = (acc.secret || '').toUpperCase().replace(/[\s=-]/g, '');
    if (!sec) return;
    if (!secretMap.has(sec)) secretMap.set(sec, []);
    secretMap.get(sec).push(acc.issuer || acc.name || 'Unnamed');
  });

  const duplicates = [];
  for (const [, names] of secretMap.entries()) {
    if (names.length > 1) duplicates.push(names);
  }

  if (duplicates.length > 0) {
    score -= 25;
    issues.push({
      level: 'high',
      title: 'ডুপ্লিকেট সিক্রেট কী শনাক্ত হয়েছে',
      desc: `${duplicates.length}টি ক্ষেত্রে একাধিক অ্যাকাউন্টে একই ২FA সিক্রেট কী ব্যবহৃত হচ্ছে (${duplicates[0].join(', ')} ইত্যাদি)। এটি নিরাপত্তা দুর্বলতা।`,
      recommendation: 'প্রতিটি সার্ভিসের জন্য আলাদা নতুন ২FA সিক্রেট তৈরি করুন।'
    });
  } else if (accounts.length > 0) {
    strengths.push('প্রতিটি অ্যাকাউন্টে সম্পূর্ণ স্বতন্ত্র সিক্রেট কী ব্যবহৃত হচ্ছে।');
  }

  // 2. Lock & Biometric Protection
  if (!settings.pinHash && !settings.bioCredId) {
    score -= 25;
    issues.push({
      level: 'high',
      title: 'অ্যাপ লক বা বায়োমেট্রিক বন্ধ',
      desc: 'অ্যাপে কোনো PIN কোড বা ফিঙ্গারপ্রিন্ট লক সেট করা নেই। ফোন আনলক থাকলে যে কেউ কোডগুলো দেখতে পারবে।',
      action: 'openSecurity',
      actionLabel: 'PIN লক চালু করুন 🔒'
    });
  } else {
    strengths.push('PIN অথবা বায়োমেট্রিক অ্যাপ লক সক্রিয় আছে।');
  }

  // 3. Cloud / Offline Backup Status
  const hasGoogle = !!drive.getUser();
  const hasTelegram = isTelegramConfigured();

  if (!hasGoogle && !hasTelegram) {
    score -= 25;
    issues.push({
      level: 'medium',
      title: 'কোনো ক্লাউড অটো-ব্যাকআপ সক্রিয় নেই',
      desc: 'ফোন হারিয়ে গেলে বা নষ্ট হলে কোডগুলো পুনরুদ্ধার করা সম্ভব নাও হতে পারে।',
      action: 'openBackup',
      actionLabel: 'অটো-ব্যাকআপ চালু করুন ☁️'
    });
  } else {
    const methods = [];
    if (hasGoogle) methods.push('Google Drive');
    if (hasTelegram) methods.push('Telegram');
    strengths.push(`ক্লাউড ব্যাকআপ সক্রিয় রয়েছে (${methods.join(' + ')} - AES-256-GCM এনক্রিপ্টেড)।`);
  }

  // 4. Recycle Bin Cleanup
  const trashCount = (vault.trash || []).length;
  if (trashCount >= 5) {
    score -= 5;
    issues.push({
      level: 'low',
      title: `রিসাইকেল বিনে ${trashCount}টি অপ্রয়োজনীয় অ্যাকাউন্ট আছে`,
      desc: 'মুছে ফেলা পুরনো অ্যাকাউন্ট রিসাইকেল বিনে জমা হয়ে আছে।',
      action: 'openTrash',
      actionLabel: 'রিসাইকেল বিন পরিষ্কার করুন 🗑️'
    });
  }

  // 5. Account count check
  if (accounts.length === 0) {
    score = 50;
    issues.push({
      level: 'info',
      title: 'ভল্টে কোনো অ্যাকাউন্ট নেই',
      desc: 'নতুন অ্যাকাউন্ট যোগ করতে নিচের + বাটন ব্যবহার করুন।'
    });
  }

  score = Math.max(10, Math.min(100, score));

  let grade = 'চমৎকার 🛡️';
  let gradeColor = '#10b981';
  if (score < 60) { grade = 'উন্নতি প্রয়োজন ⚠️'; gradeColor = '#ef4444'; }
  else if (score < 85) { grade = 'ভালো তবে সতর্কতা দরকার 💡'; gradeColor = '#f59e0b'; }

  return {
    score,
    grade,
    gradeColor,
    accountCount: accounts.length,
    issues,
    strengths
  };
}
