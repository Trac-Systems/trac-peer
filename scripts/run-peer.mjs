import b4a from "b4a";
import path from "path";
import fs from "fs";
import PeerWallet from "trac-wallet";

import { Peer, Wallet, Protocol as BaseProtocol, Contract as BaseContract } from "../src/index.js";
import { MainSettlementBus } from "trac-msb/src/index.js";
import { bufferToBigInt, bigIntToDecimalString } from "trac-msb/src/utils/amountSerialization.js";
import { startRpcServer } from "../rpc/rpc_server.js";
import { DEFAULT_RPC_HOST, DEFAULT_RPC_PORT, DEFAULT_MAX_BODY_BYTES } from "../rpc/constants.js";
import { startInteractiveCli } from "../src/cli.js";
import { ensureTextCodecs } from "../src/textCodec.js";

const toArgMap = (argv) => {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (!raw.startsWith("--")) continue;
    const eq = raw.indexOf("=");
    if (eq !== -1) {
      const k = raw.slice(2, eq);
      const v = raw.slice(eq + 1);
      out[k] = v;
      continue;
    }
    const k = raw.slice(2);
    const next = argv[i + 1];
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

const readHexFile = (filePath, byteLength) => {
  try {
    if (fs.existsSync(filePath)) {
      const hex = fs.readFileSync(filePath, "utf8").trim().toLowerCase();
      if (/^[0-9a-f]+$/.test(hex) && hex.length === byteLength * 2) return hex;
    }
  } catch (_e) {}
  return null;
};

const args = toArgMap(process.argv.slice(2));

const rpcEnabled =
  args["rpc"] === true || args["rpc"] === "true" || process.env.PEER_RPC === "true" || process.env.PEER_RPC === "1";
const rpcHost = (args["rpc-host"] && String(args["rpc-host"])) || process.env.PEER_RPC_HOST || DEFAULT_RPC_HOST;
const rpcPortRaw =
  (args["rpc-port"] && String(args["rpc-port"])) || process.env.PEER_RPC_PORT || String(DEFAULT_RPC_PORT);
const rpcPort = parseInt(rpcPortRaw);
if (rpcEnabled && (isNaN(rpcPort) || rpcPort < 1 || rpcPort > 65535)) {
  console.error("Invalid --rpc-port. Expected integer 1-65535.");
  process.exit(1);
}
const rpcAllowOrigin =
  (args["rpc-allow-origin"] && String(args["rpc-allow-origin"])) || process.env.PEER_RPC_ALLOW_ORIGIN || "*";
const rpcMaxBodyBytesRaw =
  (args["rpc-max-body-bytes"] && String(args["rpc-max-body-bytes"])) ||
  process.env.PEER_RPC_MAX_BODY_BYTES ||
  String(DEFAULT_MAX_BODY_BYTES);
const rpcMaxBodyBytes = parseInt(rpcMaxBodyBytesRaw);
if (rpcEnabled && (isNaN(rpcMaxBodyBytes) || rpcMaxBodyBytes < 1)) {
  console.error("Invalid --rpc-max-body-bytes. Expected a positive integer.");
  process.exit(1);
}

const msbStoresDirectory =
  (args["msb-stores-directory"] && String(args["msb-stores-directory"])) ||
  process.env.MSB_STORES_DIRECTORY ||
  "stores/";

const msbStoreName =
  (args["msb-store-name"] && String(args["msb-store-name"])) ||
  process.env.MSB_STORE_NAME ||
  "peer-msb";

const msbBootstrap =
  (args["msb-bootstrap"] && String(args["msb-bootstrap"])) ||
  process.env.MSB_BOOTSTRAP ||
  null;

const msbChannel =
  (args["msb-channel"] && String(args["msb-channel"])) ||
  process.env.MSB_CHANNEL ||
  null;

const peerStoresDirectory =
  (args["peer-stores-directory"] && String(args["peer-stores-directory"])) ||
  process.env.PEER_STORES_DIRECTORY ||
  "stores/";

const peerStoreNameRaw =
  (args["peer-store-name"] && String(args["peer-store-name"])) ||
  process.env.PEER_STORE_NAME ||
  "peer";
const peerStoreName = ensureTrailingSlash(peerStoreNameRaw);

const subnetBootstrapHex =
  (args["subnet-bootstrap"] && String(args["subnet-bootstrap"])) ||
  process.env.SUBNET_BOOTSTRAP ||
  null;

const subnetChannel =
  (args["subnet-channel"] && String(args["subnet-channel"])) ||
  process.env.SUBNET_CHANNEL ||
  "trac-peer-subnet";

const msbBootstrapHex = msbBootstrap ? String(msbBootstrap).trim().toLowerCase() : null;
if (msbBootstrapHex && !/^[0-9a-f]{64}$/.test(msbBootstrapHex)) {
  console.error(
    `Invalid --msb-bootstrap. Expected 32-byte hex (64 chars), got length ${msbBootstrapHex.length}.`
  );
  process.exit(1);
}

if (!msbBootstrapHex || !msbChannel) {
  console.error(
    "Missing MSB network params. Provide --msb-bootstrap=<hex32> and --msb-channel=<string> (or env MSB_BOOTSTRAP/MSB_CHANNEL)."
  );
  process.exit(1);
}

// Important: this starts a *local MSB node* (its own store) that joins your already-running MSB network.
// trac-peer currently requires an MSB instance to broadcast and to observe confirmed state.

const msbStoresFullPath = `${ensureTrailingSlash(msbStoresDirectory)}/${msbStoreName}`;
const msbKeyPairPath = `${msbStoresFullPath}/db/keypair.json`;
await ensureKeypairFile(msbKeyPairPath);

const peerKeyPairPath = path.join(
  peerStoresDirectory,
  peerStoreName,
  "db",
  "keypair.json"
);

await ensureKeypairFile(peerKeyPairPath);

const subnetBootstrapFile = path.join(
  peerStoresDirectory,
  peerStoreNameRaw,
  "subnet-bootstrap.hex"
);
let subnetBootstrap = subnetBootstrapHex ? subnetBootstrapHex.trim().toLowerCase() : null;
if (subnetBootstrap) {
  if (!/^[0-9a-f]{64}$/.test(subnetBootstrap)) {
    console.error("Invalid --subnet-bootstrap. Provide 32-byte hex (64 chars).");
    process.exit(1);
  }
  if (subnetBootstrap === msbBootstrap.trim().toLowerCase()) {
    console.error("Subnet bootstrap cannot equal MSB bootstrap.");
    process.exit(1);
  }
} else {
  subnetBootstrap = readHexFile(subnetBootstrapFile, 32);
  if (subnetBootstrap && subnetBootstrap === msbBootstrap.trim().toLowerCase()) {
    console.error("Stored subnet bootstrap equals MSB bootstrap. Delete the file and rerun.");
    process.exit(1);
  }
}

const msb = new MainSettlementBus({
  stores_directory: ensureTrailingSlash(msbStoresDirectory),
  store_name: `/${msbStoreName}`,
  bootstrap: msbBootstrapHex,
  channel: msbChannel,
  enable_interactive_mode: false,
  enable_wallet: true,
  enable_validator_observer: true,
  enable_role_requester: false,
  enable_tx_apply_logs: false,
  enable_error_apply_logs: false,
});
await msb.ready();

class DevProtocol extends BaseProtocol {
  mapTxCommand(command) {
    if (typeof command !== "string" || command.trim() === "") return null;
    const raw = command.trim();
    if (raw.startsWith("{")) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.type === "string" && parsed.value !== undefined) {
          return { type: parsed.type, value: parsed.value };
        }
      } catch (_e) {}
    }
    if (raw === "ping" || raw.startsWith("ping ")) {
      const msg = raw === "ping" ? "pong" : raw.slice(5);
      return { type: "ping", value: { msg } };
    }
    if (raw.startsWith("set ")) {
      const parts = raw.split(" ").filter(Boolean);
      if (parts.length >= 3) {
        const key = parts[1];
        const value = parts.slice(2).join(" ");
        return { type: "set", value: { key, value } };
      }
    }
    return { type: "ping", value: { msg: raw } };
  }

  async customCommand(input) {
    if (typeof input !== "string") return;
    if (input.startsWith("/get")) {
      const m = input.match(/(?:^|\s)--key(?:=|\s+)(.+)$/);
      const raw = m ? m[1].trim() : null;
      if (!raw) {
        console.log('Usage: /get --key "<hyperbee-key>"');
        return;
      }
      const key = raw.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
      const v = await this.getSigned(key);
      console.log(v);
      return;
    }
    if (input.startsWith("/msb")) {
      const txv = await this.peer.msbClient.getTxvHex();
      const peerMsbAddress = this.peer.msbClient.pubKeyHexToAddress(this.peer.wallet.publicKey);
      const entry = peerMsbAddress ? await this.peer.msb.state.getNodeEntryUnsigned(peerMsbAddress) : null;
      const balance = entry?.balance ? bigIntToDecimalString(bufferToBigInt(entry.balance)) : null;
      const fee = bigIntToDecimalString(bufferToBigInt(this.peer.msb.state.getFee()));
      const validators = this.peer.msb.network?.validatorConnectionManager?.connectionCount?.() ?? 0;
      console.log({
        networkId: this.peer.msbClient.networkId,
        msbBootstrap: this.peer.msbClient.bootstrapHex,
        txv,
        msbSignedLength: this.peer.msb.state.getSignedLength(),
        msbUnsignedLength: this.peer.msb.state.getUnsignedLength(),
        connectedValidators: validators,
        peerMsbAddress,
        peerMsbBalance: balance,
        msbFee: fee,
      });
      return;
    }
  }

  async printOptions() {
    console.log("");
    console.log("- Dev commands:");
    console.log('- /msb | prints MSB txv + lengths (local MSB node view).');
    console.log('- /get --key "<key>" | reads signed subnet state key.');
    console.log("");
    console.log("- Dev TX examples:");
    console.log('- /tx --command "ping hello"');
    console.log('- /tx --command "set foo bar"');
    console.log('- /tx --command "{\\"type\\":\\"ping\\",\\"value\\":{\\"msg\\":\\"hi\\"}}"');
  }
}

class DevContract extends BaseContract {
  constructor(protocol) {
    super(protocol);
    this.addFunction("ping");
    this.addFunction("set");
  }

  async ping() {
    const msg = this.value?.msg != null ? String(this.value.msg) : null;
    await this.put(`app/ping/${this.tx}`, {
      from: this.address,
      msg,
      tx: this.tx,
    });
  }

  async set() {
    const key = this.value?.key != null ? String(this.value.key) : null;
    const value = this.value?.value != null ? String(this.value.value) : null;
    if (!key) throw new Error("Missing key");
    await this.put(`app/kv/${key}`, { value, tx: this.tx, from: this.address });
  }
}

const peer = new Peer({
  stores_directory: ensureTrailingSlash(peerStoresDirectory),
  store_name: peerStoreName,
  msb,
  wallet: new Wallet(),
  protocol: DevProtocol,
  contract: DevContract,
  bootstrap: subnetBootstrap ? b4a.from(subnetBootstrap, "hex") : null,
  channel: subnetChannel,
  enable_interactive_mode: true,
});
await peer.ready();

let rpcServer = null;
if (rpcEnabled) {
  rpcServer = startRpcServer(peer, rpcHost, rpcPort, { allowOrigin: rpcAllowOrigin, maxBodyBytes: rpcMaxBodyBytes });
}

const peerMsbAddress = peer.msbClient.pubKeyHexToAddress(peer.wallet.publicKey);
const effectiveSubnetBootstrapHex = peer.base?.key ? peer.base.key.toString("hex") : (b4a.isBuffer(peer.bootstrap) ? peer.bootstrap.toString("hex") : String(peer.bootstrap));
if (!subnetBootstrap) {
  fs.mkdirSync(path.dirname(subnetBootstrapFile), { recursive: true });
  fs.writeFileSync(subnetBootstrapFile, `${effectiveSubnetBootstrapHex}\n`);
}

console.log("");
console.log("==================== TRAC-PEER RUNNER ====================");
console.log("MSB network bootstrap:", msb.bootstrap?.toString("hex") ?? null);
console.log("MSB channel:", b4a.toString(msb.channel, "utf8"));
console.log("MSB wallet address:", msb.wallet?.address ?? null);
console.log("----------------------------------------------------------");
console.log("Peer store:", path.join(peerStoresDirectory, peerStoreNameRaw));
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
console.log("  - Fund this Peer MSB address (this creates the MSB node entry + covers fee checks):");
console.log("    ", peerMsbAddress);
console.log("- In this peer console:");
console.log("  - /deploy_subnet");
console.log('  - /tx --command "ping hello"');
console.log('  - /get --key "txl"');
console.log("==========================================================");
console.log("");

await startInteractiveCli(peer);

process.on("SIGINT", async () => {
  if (rpcServer) await new Promise((resolve) => rpcServer.close(resolve));
  await Promise.allSettled([peer.close(), msb.close()]);
  process.exit(130);
});
