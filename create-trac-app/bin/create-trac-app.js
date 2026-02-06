#!/usr/bin/env node
import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import PeerWallet from "trac-wallet";

const TRAC_PEER_VERSION = "^0.4.1";
const TRAC_MSB_VERSION = "^0.2.9";
const TRAC_WALLET_VERSION = "^1.0.1";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_DIR = path.resolve(__dirname, "../templates/basic");

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  console.log("Usage: create-trac-app <project-directory>");
  process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const ask = (q) => new Promise((resolve) => rl.question(q, (answer) => resolve(String(answer ?? "").trim())));

const confirm = async (q, defaultYes = true) => {
  const suffix = defaultYes ? " [Y/n] " : " [y/N] ";
  const ans = (await ask(q + suffix)).toLowerCase();
  if (!ans) return defaultYes;
  return ans === "y" || ans === "yes";
};

const askWithDefault = async (q, fallback) => {
  const ans = await ask(`${q} (default: ${fallback}): `);
  return ans.length > 0 ? ans : fallback;
};

const toPackageName = (value) => {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
  return raw.length > 0 ? raw : "trac-peer-app";
};

const isValidHex32 = (value) => /^[0-9a-fA-F]{64}$/.test(value || "");

const ensureEmptyDir = (dir) => {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  if (files.length > 0) {
    console.error(`Target directory is not empty: ${dir}`);
    process.exit(1);
  }
};

const copyDir = (srcDir, destDir, replacements) => {
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, replacements);
      continue;
    }
    const raw = fs.readFileSync(srcPath, "utf8");
    const replaced = applyReplacements(raw, replacements);
    fs.writeFileSync(destPath, replaced);
  }
};

const applyReplacements = (content, replacements) => {
  let out = content;
  for (const [needle, value] of replacements) {
    out = out.split(needle).join(value);
  }
  return out;
};

const writeKeypair = async (keypairPath, mnemonic) => {
  fs.mkdirSync(path.dirname(keypairPath), { recursive: true });
  const wallet = new PeerWallet();
  await wallet.ready;
  if (mnemonic) {
    await wallet.generateKeyPair(mnemonic);
  } else {
    await wallet.generateKeyPair();
  }
  await wallet.ready;
  wallet.exportToFile(keypairPath, Buffer.alloc(0));
  return wallet.mnemonic;
};

const promptMnemonic = async () => {
  const wallet = new PeerWallet();
  await wallet.ready;
  while (true) {
    const raw = await ask("Enter your 12/24-word mnemonic: ");
    const sanitized = wallet.sanitizeMnemonic(raw);
    if (sanitized) return sanitized;
    console.log("Mnemonic is invalid. Please try again.");
  }
};

const main = async () => {
  let targetDir = args[0] || "";
  if (!targetDir) {
    targetDir = await ask("Project directory: ");
  }
  if (!targetDir) {
    console.error("Project directory is required.");
    process.exit(1);
  }

  const resolvedDir = path.resolve(process.cwd(), targetDir);
  ensureEmptyDir(resolvedDir);

  const projectName = path.basename(resolvedDir);
  const packageName = toPackageName(projectName);

  console.log("");
  console.log("MSB network settings (dev)");
  let msbBootstrap = await ask("MSB bootstrap (hex32): ");
  while (!isValidHex32(msbBootstrap)) {
    console.log("Invalid bootstrap. Expected 64 hex characters.");
    msbBootstrap = await ask("MSB bootstrap (hex32): ");
  }
  const msbChannel = await ask("MSB channel: ");
  if (!msbChannel) {
    console.error("MSB channel is required.");
    process.exit(1);
  }
  const subnetChannel = await askWithDefault("Subnet channel", "trac-peer-subnet");

  console.log("");
  const peerStoreName = await askWithDefault("Peer store name", "peer");

  console.log("");
  const restore = await confirm("Restore peer keypair from mnemonic?", false);
  let mnemonic = null;
  if (restore) {
    mnemonic = await promptMnemonic();
  }

  fs.mkdirSync(resolvedDir, { recursive: true });

  const replacements = new Map([
    ["__APP_NAME__", projectName],
    ["__PACKAGE_NAME__", packageName],
    ["__MSB_BOOTSTRAP__", msbBootstrap.toLowerCase()],
    ["__MSB_CHANNEL__", msbChannel],
    ["__SUBNET_CHANNEL__", subnetChannel],
    ["__PEER_STORE_NAME__", peerStoreName],
    ["__MSB_STORE_NAME__", `${peerStoreName}-msb`],
    ["__TRAC_PEER_VERSION__", TRAC_PEER_VERSION],
    ["__TRAC_MSB_VERSION__", TRAC_MSB_VERSION],
    ["__TRAC_WALLET_VERSION__", TRAC_WALLET_VERSION]
  ]);

  copyDir(TEMPLATE_DIR, resolvedDir, replacements);

  const keypairPath = path.join(resolvedDir, "stores", peerStoreName, "db", "keypair.json");
  const mnemonicOut = await writeKeypair(keypairPath, mnemonic);

  if (!restore) {
    console.log("");
    console.log("New keypair created. Store this mnemonic safely:");
    console.log(mnemonicOut);
  }

  console.log("");
  console.log("Scaffolded:", resolvedDir);
  console.log("Next:");
  console.log("- npm install");
  console.log("- npm run dev (pear)");

  rl.close();
};

main().catch((err) => {
  rl.close();
  console.error(err?.stack || err);
  process.exit(1);
});
