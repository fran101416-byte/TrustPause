import { nanoid } from "nanoid";
import qrcode from "qrcode";
import fs from "fs";
import "dotenv/config"; // Load environment variables from .env file

// --- Configuration ---
// The base URL is now read from your .env file for easy configuration.
const APP_BASE_URL = process.env.APP_BASE_URL;
if (!APP_BASE_URL) {
  console.error("Error: APP_BASE_URL is not set in your .env file.");
  console.log('Please create a .env file and add: APP_BASE_URL="https://your-live-app-url.com"');
  process.exit(1); // Exit if the URL isn't configured
}

const QR_CODE_DIR = "./qr_codes";

// --- Main Function ---
async function generateUniqueQrCode() {
  const uniqueId = nanoid(10); // e.g., 'a9_V-s8s_b'
  const profileUrl = `${APP_BASE_URL}/profile/${uniqueId}`;
  const outputPath = `${QR_CODE_DIR}/trustpause-qr-${uniqueId}.png`;

  if (!fs.existsSync(QR_CODE_DIR)) fs.mkdirSync(QR_CODE_DIR);

  await qrcode.toFile(outputPath, profileUrl, { width: 500 });
  console.log(`Success! QR Code saved to: ${outputPath}`);
  console.log(`It links to: ${profileUrl}`);
}

generateUniqueQrCode();