// Official Brand Vector SVGs and Dynamic Avatar Rendering Engine for Authenticator Pro
// Provides automatic brand logo detection (Google, GitHub, Binance, Microsoft, etc.) and unique multi-color profiles.

export const BRAND_SVGS = {
  google: `<svg viewBox="0 0 24 24" class="brand-svg"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>`,
  
  github: `<svg viewBox="0 0 24 24" class="brand-svg" fill="#ffffff"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>`,
  
  binance: `<svg viewBox="0 0 24 24" class="brand-svg" fill="#F3BA2F"><path d="M16.624 13.92l2.715 2.715-7.34 7.34-7.34-7.34 2.716-2.715 4.624 4.624 4.625-4.624zm4.66-4.66l2.716 2.716-2.716 2.715-2.715-2.715 2.715-2.716zm-9.285-9.26l7.34 7.34-2.716 2.715-4.624-4.624-4.625 4.624-2.715-2.715 7.34-7.34zm-9.284 9.26l2.715 2.716-2.715 2.715-2.716-2.715 2.716-2.716zm9.284 1.83l2.83 2.83-2.83 2.83-2.83-2.83 2.83-2.83z"/></svg>`,
  
  microsoft: `<svg viewBox="0 0 24 24" class="brand-svg"><rect x="2" y="2" width="9.5" height="9.5" fill="#F25022"/><rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00"/><rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF"/><rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900"/></svg>`,
  
  discord: `<svg viewBox="0 0 24 24" class="brand-svg" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>`,
  
  telegram: `<svg viewBox="0 0 24 24" class="brand-svg" fill="#24A1DE"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>`,
  
  meta: `<svg viewBox="0 0 24 24" class="brand-svg" fill="#0081FB"><path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02z"/></svg>`,
  
  x: `<svg viewBox="0 0 24 24" class="brand-svg" fill="#ffffff"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
  
  apple: `<svg viewBox="0 0 24 24" class="brand-svg" fill="#ffffff"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.78 1.06-1.85.94-2.94-.92.04-2.02.61-2.67 1.38-.58.67-1.09 1.76-.95 2.82 1.03.08 2.05-.48 2.68-1.26z"/></svg>`,
  
  amazon: `<svg viewBox="0 0 24 24" class="brand-svg"><path fill="#FF9900" d="M13.92 18.04c-3.18 2.34-7.8 3.59-11.78 1.21-.56-.34-.1-1.05.44-.73 3.55 2.12 7.68 1.13 10.51-.97.43-.32.96.18.83.49zm1.09-1.44c-.4-.51-2.67-.24-3.69-.12-.31.04-.36-.23-.08-.42 1.83-1.28 4.84-.91 5.19-.47.35.43-.09 3.47-1.8 4.87-.26.22-.51.1-.39-.19.41-.98.98-2.8.77-3.67zm-3.12-6.52c0-1.77-.92-2.73-2.6-2.73-1.63 0-2.62 1.15-2.62 2.76 0 1.69.95 2.71 2.59 2.71 1.65 0 2.63-1.04 2.63-2.74zm2.14 4.54c-.16.14-.38.16-.58.07-.84-.71-.98-1.05-1.44-1.7-.87 1.44-2.07 1.95-3.65 1.95-2.31 0-4.04-1.49-4.04-4.05 0-2.39 1.58-3.95 3.84-3.95 1.47 0 2.45.54 3.09 1.37V8.5c0-.28.21-.5.5-.5h1.76c.28 0 .5.22.5.5v5.52c0 1.36.06 2.37.93 3.32.25.27.02.66-.3.66h-1.61z"/></svg>`,
  
  steam: `<svg viewBox="0 0 24 24" class="brand-svg" fill="#38bdf8"><path d="M12 2a10 10 0 0 0-10 9.77l5.37 2.2a3.5 3.5 0 0 1 1.95-.59l2.7-3.91a2.5 2.5 0 1 1 3.48 3.48l-3.91 2.7a3.5 3.5 0 0 1-.59 1.95l2.2 5.37A10 10 0 1 0 12 2zm-2.5 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm6-5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>`,
  
  crypto: `<svg viewBox="0 0 24 24" class="brand-svg" fill="#F59E0B"><path d="M12 2L2 9.5 12 22 22 9.5 12 2zm0 3.2L18.4 9.5 12 13.7 5.6 9.5 12 5.2zm-5.4 5.5l4.4 2.9v6.5L4.8 12.3l1.8-1.6zm10.8 0l1.8 1.6-6.2 7.8v-6.5l4.4-2.9z"/></svg>`,
  
  dropbox: `<svg viewBox="0 0 24 24" class="brand-svg" fill="#0061FF"><path d="M6 3l6 4-6 4-6-4 6-4zm12 0l6 4-6 4-6-4 6-4zM0 11l6 4 6-4-6-4-6 4zm18-4l6 4-6 4-6-4 6-4zm-6 9.5l6-4 6 4-6 4-6-4zm-6 0l6 4-6 4-6-4 6-4z"/></svg>`,
  
  reddit: `<svg viewBox="0 0 24 24" class="brand-svg" fill="#FF4500"><circle cx="12" cy="12" r="10"/><circle cx="8.5" cy="11.5" r="1.5" fill="#fff"/><circle cx="15.5" cy="11.5" r="1.5" fill="#fff"/><path d="M9 15.5c1 .8 5 .8 6 0" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`,
  
  whatsapp: `<svg viewBox="0 0 24 24" class="brand-svg" fill="#25D366"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.78 14.12c-.24.68-1.2 1.24-1.66 1.32-.42.07-.98.11-2.84-.66-2.38-.99-3.92-3.41-4.04-3.57-.12-.16-.97-1.29-.97-2.46 0-1.17.61-1.75.83-1.98.22-.24.48-.3.64-.3.16 0 .32 0 .46.01.15.01.35-.06.55.42.2.49.69 1.68.75 1.8.06.12.1.27.02.43-.08.16-.12.26-.24.4-.12.14-.25.31-.36.42-.12.12-.25.25-.11.49.14.24.63 1.04 1.35 1.68.93.83 1.71 1.09 1.95 1.21.24.12.38.1.53-.06.14-.16.61-.71.77-.95.16-.24.32-.2.55-.12.22.08 1.41.67 1.65.79.24.12.4.18.46.28.06.1.06.58-.18 1.26z"/></svg>`,
};

// Brand detection rules: checks issuer and name/email
export const BRAND_DETECTORS = [
  { id: 'google', re: /google|gmail|youtube|alphabet/i, bg: 'linear-gradient(145deg, rgba(255,255,255,0.95), rgba(240,245,255,0.85))', border: 'rgba(66, 133, 244, 0.4)' },
  { id: 'github', re: /github/i, bg: 'linear-gradient(145deg, #1f2937, #111827)', border: 'rgba(255, 255, 255, 0.35)' },
  { id: 'binance', re: /binance|bnb/i, bg: 'linear-gradient(145deg, #2b2310, #18150c)', border: 'rgba(243, 186, 47, 0.5)' },
  { id: 'microsoft', re: /microsoft|outlook|azure|hotmail|live\.com|office365/i, bg: 'linear-gradient(145deg, #112238, #0a1424)', border: 'rgba(0, 164, 239, 0.45)' },
  { id: 'discord', re: /discord/i, bg: 'linear-gradient(145deg, #2a2c5a, #1a1b38)', border: 'rgba(88, 101, 242, 0.5)' },
  { id: 'telegram', re: /telegram/i, bg: 'linear-gradient(145deg, #0d384d, #082230)', border: 'rgba(36, 161, 222, 0.5)' },
  { id: 'meta', re: /facebook|meta|fb\.com|instagram/i, bg: 'linear-gradient(145deg, #0e2a52, #08172e)', border: 'rgba(0, 129, 251, 0.5)' },
  { id: 'x', re: /twitter|x\.com|\bx\b/i, bg: 'linear-gradient(145deg, #1f242b, #0d0f12)', border: 'rgba(255, 255, 255, 0.4)' },
  { id: 'apple', re: /apple|icloud/i, bg: 'linear-gradient(145deg, #27272a, #18181b)', border: 'rgba(255, 255, 255, 0.35)' },
  { id: 'amazon', re: /amazon|aws/i, bg: 'linear-gradient(145deg, #2a2015, #140f09)', border: 'rgba(255, 153, 0, 0.5)' },
  { id: 'steam', re: /steam/i, bg: 'linear-gradient(145deg, #172b42, #0d1b2a)', border: 'rgba(56, 189, 248, 0.45)' },
  { id: 'crypto', re: /crypto|coinbase|bybit|kucoin|kraken|bitcoin|btc|eth|trust/i, bg: 'linear-gradient(145deg, #2e2008, #191104)', border: 'rgba(245, 158, 11, 0.5)' },
  { id: 'dropbox', re: /dropbox/i, bg: 'linear-gradient(145deg, #0d224d, #07132e)', border: 'rgba(0, 97, 255, 0.5)' },
  { id: 'reddit', re: /reddit/i, bg: 'linear-gradient(145deg, #381a12, #1c0b07)', border: 'rgba(255, 69, 0, 0.5)' },
  { id: 'whatsapp', re: /whatsapp/i, bg: 'linear-gradient(145deg, #103322, #071c11)', border: 'rgba(37, 211, 102, 0.5)' },
];

// Rich palette for generic accounts (16 distinct luxury gradients)
export const VIBRANT_PALETTES = [
  { bg: 'linear-gradient(145deg, #3b82f6, #1d4ed8)', text: '#ffffff' },
  { bg: 'linear-gradient(145deg, #10b981, #047857)', text: '#ffffff' },
  { bg: 'linear-gradient(145deg, #f59e0b, #b45309)', text: '#ffffff' },
  { bg: 'linear-gradient(145deg, #8b5cf6, #5b21b6)', text: '#ffffff' },
  { bg: 'linear-gradient(145deg, #ec4899, #be185d)', text: '#ffffff' },
  { bg: 'linear-gradient(145deg, #06b6d4, #0e7490)', text: '#ffffff' },
  { bg: 'linear-gradient(145deg, #f97316, #c2410c)', text: '#ffffff' },
  { bg: 'linear-gradient(145deg, #14b8a6, #0f766e)', text: '#ffffff' },
  { bg: 'linear-gradient(145deg, #6366f1, #3730a3)', text: '#ffffff' },
  { bg: 'linear-gradient(145deg, #d946ef, #86198f)', text: '#ffffff' },
  { bg: 'linear-gradient(145deg, #84cc16, #4d7c0f)', text: '#ffffff' },
  { bg: 'linear-gradient(145deg, #e11d48, #9f1239)', text: '#ffffff' },
  { bg: 'linear-gradient(145deg, #0ea5e9, #0369a1)', text: '#ffffff' },
  { bg: 'linear-gradient(145deg, #a855f7, #6b21a8)', text: '#ffffff' },
  { bg: 'linear-gradient(145deg, #f43f5e, #be123c)', text: '#ffffff' },
  { bg: 'linear-gradient(145deg, #22c55e, #15803d)', text: '#ffffff' },
];

export function detectBrand(account) {
  const full = `${account.issuer || ''} ${account.name || ''}`.trim();
  for (const b of BRAND_DETECTORS) {
    if (b.re.test(full)) return b;
  }
  return null;
}

// Generates unique avatar HTML for an account:
// 1. If brand detected, renders authentic SVG inside a micro-glass badge.
// 2. Otherwise renders unique hashed vibrant gradient with initial letter.
export function renderAccountAvatar(account) {
  const title = (account.issuer || account.name || 'Account').trim();
  const brand = detectBrand(account);

  if (brand && BRAND_SVGS[brand.id]) {
    return `
      <div class="avatar brand-avatar brand-${brand.id}" style="background:${brand.bg};border:1.5px solid ${brand.border};box-shadow:0 4px 14px rgba(0,0,0,0.25)">
        ${BRAND_SVGS[brand.id]}
      </div>
    `;
  }

  // Generic distinct color hashing
  let hash = 0;
  const seed = `${account.issuer || ''}:${account.name || ''}:${account.id || ''}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 37 + seed.charCodeAt(i)) >>> 0;
  }
  const pal = VIBRANT_PALETTES[hash % VIBRANT_PALETTES.length];
  const char = (title[0] || 'A').toUpperCase();

  return `
    <div class="avatar generic-avatar" style="background:${pal.bg};color:${pal.text};box-shadow:0 4px 14px rgba(0,0,0,0.2)">
      <span class="avatar-letter">${char}</span>
    </div>
  `;
}

// Master Luxury App Vector Logo (Cyber-Shield with Quantum Core)
export const MASTER_LOGO_SVG = `
<svg viewBox="0 0 100 100" class="master-app-logo" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="lockCoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="60%" stop-color="#a5f3fc"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    </linearGradient>
    <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3.5" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  
  <!-- Outer faceted cyber shield -->
  <path d="M50 8 L84 22 C84 62 50 88 50 92 C50 88 16 62 16 22 Z" 
        fill="url(#shieldGrad)" stroke="rgba(255,255,255,0.6)" stroke-width="2.5" filter="url(#logoGlow)"/>
  
  <!-- Inner optical glass refraction contour -->
  <path d="M50 14 L78 26 C78 58 50 80 50 84 C50 80 22 58 22 26 Z" 
        fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" stroke-dasharray="4 2"/>
  
  <!-- Quantum Keyhole & Biometric Lock -->
  <circle cx="50" cy="45" r="14" fill="none" stroke="url(#lockCoreGrad)" stroke-width="3.5"/>
  <path d="M50 31 C43 31 38 36 38 43 C38 47 40 51 43 53 L41 65 C41 66.5 42.5 68 44 68 L56 68 C57.5 68 59 66.5 59 65 L57 53 C60 51 62 47 62 43 C62 36 57 31 50 31 Z" 
        fill="url(#lockCoreGrad)"/>
  <circle cx="50" cy="43" r="3.5" fill="#0f172a"/>
  <path d="M50 46.5 L50 56" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round"/>
</svg>
`;
