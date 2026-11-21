// Google Cloud Console Web OAuth Client ID for Authenticator Pro
// Authorized JavaScript origin: https://mdsafiislam894-star.github.io

export const APP_VERSION = '3.0.0';

export const GOOGLE_CLIENT_ID = '685192227575-g6vens1ihouer90l2sbtpe24oav14e8a.apps.googleusercontent.com';

// Drive-এ শুধু এই অ্যাপের নিজস্ব লুকানো ফোল্ডারে ফাইল থাকবে (appDataFolder)।
// আপনার অন্য কোনো Drive ফাইল অ্যাপ দেখতে পারে না।
export const SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'openid',
  'email',
  'profile',
].join(' ');

export const BACKUP_FILE_NAME = 'authenticator-pro-backup.json';
