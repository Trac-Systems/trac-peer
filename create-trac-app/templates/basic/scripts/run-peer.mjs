import b4a from "b4a";
import path from "path";
import fs from "fs";
import PeerWallet from "trac-wallet";
import { Peer, Wallet, createConfig as createPeerConfig, ENV as PEER_ENV } from "trac-peer";
import { MainSettlementBus } from "trac-msb/src/index.js";
import { createConfig as createMsbConfig, ENV as MSB_ENV } from "trac-msb/src/config/env.js";
import { Terminal } from "trac-peer/src/terminal/index.js";
import { ensureTextCodecs } from "trac-peer/src/textCodec.js";
import { CONFIG } from "../config.js";
import Protocol from "../src/protocol.js";
import Contract from "../src/contract.js";

let processRef = globalThis.process;
if (globalThis.Pear !== undefined) {
  const { default: bareProcess } = await import("bare-process");
  processRef = bareProcess;
}

const pearApp = typeof Pear !== "undefined" ? (Pear.app ?? Pear.config) : undefined;
const runtimeArgs = typeof processRef !== "undefined" ? processRef.argv.slice(2) : [];
const argv = pearApp?.args ?? runtimeArgs;

const toArgMap = (argvList) => {
  const out = {};
  for (let i = 0; i < argvList.length; i++) {
    const raw = argvList[i];
    if (!raw.startsWith("--")) continue;
    const eq = raw.indexOf("=");
    if (eq !== -1) {
      const k = raw.slice(2, eq);
      const v = raw.slice(eq + 1);
      out[k] = v;
      continue;
    }
    const k = raw.slice(2);
    const next = argvList[i + 1];
    if (next !== undefined && !String(next).startsWith("--")) {
      out[k] = next;
      i++;
    } else {
      out[k] = true;
    }
  }
  return out;
};

const ensureTrailingSlash = (value) => (value.endsWith("/") ? value : `${value}/`);

const readHexFile = (filePath, byteLength) => {
  try {
    if (fs.existsSync(filePath)) {
      const hex = fs.readFileSync(filePath, "utf8").trim().toLowerCase();
      if (/^[0-9a-f]+$/.test(hex) && hex.length === byteLength * 2) return hex;
    }
  } catch (_e) {}
  return null;
};

const ensureKeypairFile = async (keyPairPath) => {
  if (fs.existsSync(keyPairPath)) return;
  fs.mkdirSync(path.dirname(keyPairPath), { recursive: true });
  await ensureTextCodecs();
  const wallet = new PeerWallet();
  await wallet.ready;
  if (!wallet.secretKey) {
    await wallet.generateKeyPair();
    await wallet.ready;
  }
  wallet.exportToFile(keyPairPath, b4a.alloc(0));
};

const args = toArgMap(argv);
const peerEnv = PEER_ENV.DEVELOPMENT;
const msbEnv = MSB_ENV.DEVELOPMENT;

const peerStoresDirectory =
  (args["peer-stores-directory"] && String(args["peer-stores-directory"])) ||
  CONFIG.peer?.storesDirectory ||
  "stores/";

const peerStoreName =
  (args["peer-store-name"] && String(args["peer-store-name"])) ||
  CONFIG.peer?.storeName ||
  "peer";

const subnetChannel =
  (args["subnet-channel"] && String(args["subnet-channel"])) ||
  CONFIG.peer?.subnetChannel ||
  "trac-peer-subnet";

const subnetBootstrapHex =
  (args["subnet-bootstrap"] && String(args["subnet-bootstrap"])) ||
  CONFIG.peer?.subnetBootstrap ||
  null;

const msbStoresDirectory =
  (args["msb-stores-directory"] && String(args["msb-stores-directory"])) ||
  CONFIG.msb?.storesDirectory ||
  "stores/";

const msbStoreName =
  (args["msb-store-name"] && String(args["msb-store-name"])) ||
  CONFIG.msb?.storeName ||
  `${peerStoreName}-msb`;

const msbBootstrap =
  (args["msb-bootstrap"] && String(args["msb-bootstrap"])) ||
  CONFIG.msb?.bootstrap ||
  null;

const msbChannel =
  (args["msb-channel"] && String(args["msb-channel"])) ||
  CONFIG.msb?.channel ||
  null;

const msbBootstrapHex = msbBootstrap ? String(msbBootstrap).trim().toLowerCase() : null;
if (msbBootstrapHex && !/^[0-9a-f]{64}$/.test(msbBootstrapHex)) {
  console.error(`Invalid --msb-bootstrap. Expected 32-byte hex (64 chars), got length ${msbBootstrapHex.length}.`);
  process.exit(1);
}

if (!msbBootstrapHex || !msbChannel) {
  console.error(
    "Missing MSB network params. Update config.js or provide --msb-bootstrap=<hex32> and --msb-channel=<string>."
  );
  process.exit(1);
}

const msbStoresFullPath = path.join(ensureTrailingSlash(msbStoresDirectory), msbStoreName);
const msbKeyPairPath = path.join(msbStoresFullPath, "db", "keypair.json");
await ensureKeypairFile(msbKeyPairPath);

const peerKeyPairPath = path.join(peerStoresDirectory, peerStoreName, "db", "keypair.json");
await ensureKeypairFile(peerKeyPairPath);

const subnetBootstrapFile = path.join(peerStoresDirectory, peerStoreName, "subnet-bootstrap.hex");
let subnetBootstrap = subnetBootstrapHex ? subnetBootstrapHex.trim().toLowerCase() : null;
if (subnetBootstrap) {
  if (!/^[0-9a-f]{64}$/.test(subnetBootstrap)) {
    console.error("Invalid --subnet-bootstrap. Provide 32-byte hex (64 chars). ");
    process.exit(1);
  }
  if (subnetBootstrap === msbBootstrapHex) {
    console.error("Subnet bootstrap cannot equal MSB bootstrap.");
    process.exit(1);
  }
} else {
  subnetBootstrap = readHexFile(subnetBootstrapFile, 32);
  if (subnetBootstrap && subnetBootstrap === msbBootstrapHex) {
    console.error("Stored subnet bootstrap equals MSB bootstrap. Delete the file and rerun.");
    process.exit(1);
  }
}

const msb = new MainSettlementBus(
  createMsbConfig(msbEnv, {
    bootstrap: msbBootstrapHex,
    channel: msbChannel,
    storeName: msbStoreName,
    storesDirectory: msbStoresDirectory
  })
);
await msb.ready();

const peerConfig = createPeerConfig(peerEnv, {
  storesDirectory: ensureTrailingSlash(peerStoresDirectory),
  storeName: peerStoreName,
  bootstrap: subnetBootstrap ? b4a.from(subnetBootstrap, "hex") : null,
  channel: subnetChannel,
  enableInteractiveMode: true
});

const peer = new Peer({
  config: peerConfig,
  msb,
  wallet: new Wallet(),
  protocol: Protocol,
  contract: Contract
});
await peer.ready();

const peerMsbAddress = peer.msbClient.pubKeyHexToAddress(peer.wallet.publicKey);
const effectiveSubnetBootstrapHex = peer.base?.key
  ? b4a.toString(peer.base.key, "hex")
  : b4a.isBuffer(peer.config.bootstrap)
    ? b4a.toString(peer.config.bootstrap, "hex")
    : String(peer.config.bootstrap);

if (!subnetBootstrap) {
  fs.mkdirSync(path.dirname(subnetBootstrapFile), { recursive: true });
  fs.writeFileSync(subnetBootstrapFile, `${effectiveSubnetBootstrapHex}\n`);
}

console.log("");
console.log("==================== TRAC-PEER RUNNER ====================");
console.log("MSB network bootstrap:", b4a.toString(msb.config.bootstrap, "hex") ?? null);
console.log("MSB channel:", b4a.toString(msb.config.channel, "utf8"));
console.log("MSB wallet address:", msb.wallet?.address ?? null);
console.log("----------------------------------------------------------");
console.log("Peer store:", path.join(peerStoresDirectory, peerStoreName));
console.log("Peer subnet bootstrap:", effectiveSubnetBootstrapHex);
console.log("Peer subnet channel:", subnetChannel);
console.log("Peer pubkey (hex):", peer.wallet.publicKey);
console.log("Peer MSB address:", peerMsbAddress);
console.log("Subnet writable:", !!peer.base?.writable);
if (peer.base && peer.base.writable === false) {
  console.log("WARNING: Subnet is read-only for this keypair. If you're trying to create a new subnet, delete:");
  console.log("  ", subnetBootstrapFile);
}
console.log("----------------------------------------------------------");
console.log("Next steps:");
console.log("- On your already-running MSB admin node:");
console.log("  - Fund this Peer MSB address (creates MSB node entry + covers fee checks):");
console.log("    ", peerMsbAddress);
console.log("- In this peer console:");
console.log("  - /deploy_subnet");
console.log('  - /tx --command "catch"');
console.log('  - /get --key "app/tuxedex/<peer-pubkey-hex>" --confirmed false');
console.log("==========================================================");
console.log("");

if (peer.config.enableInteractiveMode) {
  const terminal = new Terminal(peer);
  await terminal.start();
} else {
  console.log("Interactive CLI disabled.");
}

if (processRef?.on) {
  processRef.on("SIGINT", async () => {
    await Promise.allSettled([peer.close(), msb.close()]);
    process.exit(130);
  });
}
