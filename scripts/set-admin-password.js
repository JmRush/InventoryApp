#!/usr/bin/env node

/**
 * Set or rotate the admin password hash and ensure a session secret exists.
 *
 * Usage:
 *   node scripts/set-admin-password.js "your-strong-password"
 *   node scripts/set-admin-password.js "your-strong-password" admin
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");

const envPath = path.join(__dirname, "..", ".env");
const BCRYPT_ROUNDS = 12;
dotenv.config({ path: envPath });

async function main() {
  const password = process.argv[2];
  const username = process.argv[3] || process.env.ADMIN_USERNAME || "admin";

  if (!password || password.length < 12) {
    console.error(
      "Usage: node scripts/set-admin-password.js \"your-strong-password\" [username]\n" +
        "Password must be at least 12 characters."
    );
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const sessionSecret =
    process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32
      ? process.env.SESSION_SECRET
      : crypto.randomBytes(48).toString("hex");

  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  }

  envContent = upsertEnv(envContent, "ADMIN_USERNAME", username);
  envContent = upsertEnv(envContent, "ADMIN_PASSWORD_HASH", hash);
  envContent = upsertEnv(envContent, "SESSION_SECRET", sessionSecret);
  // Remove any leftover plaintext password if present
  envContent = removeEnv(envContent, "ADMIN_PASSWORD");

  fs.writeFileSync(envPath, envContent.endsWith("\n") ? envContent : `${envContent}\n`, {
    mode: 0o600,
  });

  console.log(`Updated ${envPath}`);
  console.log(`Admin username: ${username}`);
  console.log("ADMIN_PASSWORD_HASH and SESSION_SECRET are set.");
  console.log("Restart the server for changes to take effect.");
}

function upsertEnv(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  const trimmed = content.replace(/\s*$/, "");
  return trimmed.length ? `${trimmed}\n${line}\n` : `${line}\n`;
}

function removeEnv(content, key) {
  return content
    .split(/\r?\n/)
    .filter((line) => !line.startsWith(`${key}=`))
    .join("\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
