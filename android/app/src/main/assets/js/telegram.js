// Direct encrypted backup to Telegram (via Telegram Bot API)
import { TELEGRAM_CONFIG_KEY } from './config.js';

export function getTelegramConfig() {
  try {
    return JSON.parse(localStorage.getItem(TELEGRAM_CONFIG_KEY)) || { botToken: '', chatId: '' };
  } catch {
    return { botToken: '', chatId: '' };
  }
}

export function saveTelegramConfig(cfg) {
  if (!cfg || (!cfg.botToken && !cfg.chatId)) {
    localStorage.removeItem(TELEGRAM_CONFIG_KEY);
  } else {
    localStorage.setItem(TELEGRAM_CONFIG_KEY, JSON.stringify({
      botToken: String(cfg.botToken || '').trim(),
      chatId: String(cfg.chatId || '').trim(),
      updatedAt: Date.now(),
    }));
  }
}

export function isTelegramConfigured() {
  const { botToken, chatId } = getTelegramConfig();
  return Boolean(botToken && chatId);
}

// Test Telegram bot & chat id by sending a test ping message
export async function testTelegram(botToken, chatId) {
  const url = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: '🤖 *Authenticator Pro*: টেলিগ্রাম কানেকশন সফল হয়েছে! ✅\nএখন থেকে এই চ্যাটে আপনার সব ২FA কোডের এনক্রিপ্টেড ব্যাকআপ স্বয়ংক্রিয়ভাবে সংরক্ষিত হবে।',
      parse_mode: 'Markdown',
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'টেলিগ্রাম কানেকশন ব্যর্থ হয়েছে');
  return true;
}

// Send encrypted backup file directly to Telegram chat
export async function sendBackupToTelegram(encryptedEnvelope, accountCount = 0) {
  const { botToken, chatId } = getTelegramConfig();
  if (!botToken || !chatId) {
    throw new Error('টেলিগ্রাম বট টোকেন বা চ্যাট আইডি সেট করা নেই');
  }

  const jsonStr = JSON.stringify(encryptedEnvelope, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const fileName = `authpro-backup-${new Date().toISOString().slice(0, 10)}.json`;

  const fd = new FormData();
  fd.append('chat_id', chatId);
  fd.append('document', blob, fileName);
  fd.append('caption', `🔐 *Authenticator Pro এনক্রিপ্টেড ব্যাকআপ*\n📅 তারিখ: ${new Date().toLocaleString('bn-BD')}\n📦 অ্যাকাউন্ট সংখ্যা: ${accountCount}\n🛡️ এনক্রিপশন: AES-256-GCM\n\n💡 _যেকোনো ফোনে এই ফাইলটি Authenticator Pro অ্যাপে ইমপোর্ট করে পাসফ্রেজ দিলে সব কোড ফিরে পাবেন।_`);
  fd.append('parse_mode', 'Markdown');

  const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendDocument`, {
    method: 'POST',
    body: fd,
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'টেলিগ্রামে ব্যাকআপ পাঠাতে সমস্যা হয়েছে');
  return data.result;
}
