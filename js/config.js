// Google Cloud Console Web OAuth Client ID for Authenticator Pro
// Authorized JavaScript origin: https://mdsafiislam894-star.github.io

export const APP_VERSION = '3.0.0';

// Your Google Cloud Console OAuth 2.0 Web Client ID
export const GOOGLE_CLIENT_ID = '27606258719-02kr9qcjnelt3j5hloq2sgsjutlc2ol1.apps.googleusercontent.com';

// Drive-এ শুধু এই অ্যাপের নিজস্ব লুকানো ফোল্ডারে ফাইল থাকবে (appDataFolder)।
// আপনার অন্য কোনো Drive ফাইল অ্যাপ দেখতে পারে না।
export const SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'openid',
  'email',
  'profile',
].join(' ');

export const BACKUP_FILE_NAME = 'authenticator-pro-backup.json';
