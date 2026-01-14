import b4a from "b4a";
import path from "path";
import fs from "fs";
import { ensureTextCodecs } from "./src/textCodec.js";

import { Peer, Wallet, Protocol as BaseProtocol, Contract as BaseContract } from "./src/index.js";
import { MainSettlementBus } from "trac-msb/src/index.js";
import { bufferToBigInt, bigIntToDecimalString } from "trac-msb/src/utils/amountSerialization.js";
import { getPearRuntime } from "./src/runnerArgs.js";
import { resolvePeerRunnerConfig } from "./src/peerRunnerConfig.js";
import { startRpcServer } from "./rpc/rpc_server.js";
import { startInteractiveCli } from "./src/cli.js";

console.log("Starting trac-peer (Pear runner)...");

const ensureKeypairFile = async (keyPairPath) => {
  if (fs.existsSync(keyPairPath)) return;
  fs.mkdirSync(path.dirname(keyPairPath), { recursive: true });
  await ensureTextCodecs();
  const { default: PeerWallet } = await import("trac-wallet");
  const wallet = new PeerWallet();
  await wallet.ready;
  if (!wallet.secretKey) {
    await wallet.generateKeyPair();
    await wallet.ready;
  }
  wallet.exportToFile(keyPairPath, b4a.alloc(0));
};

const { env, storeLabel, flags } = getPearRuntime();

const die = (message) => {
  console.error(message);
  if (typeof process !== "undefined" && process.exit) process.exit(1);
  if (typeof Pear !== "undefined" && Pear.exit) Pear.exit(1);
  throw new Error(message);
};

let cfg;
try {
  cfg = resolvePeerRunnerConfig({ env, storeLabel, flags });
} catch (e) {
  die(e?.message || String(e));
}

await ensureKeypairFile(cfg.msbKeyPairPath);
await ensureKeypairFile(cfg.peerKeyPairPath);

const msb = new MainSettlementBus({
  stores_directory: cfg.msbStoresDirectory,
  store_name: `/${cfg.msbStoreName}`,
  bootstrap: cfg.msbBootstrapHex,
  channel: cfg.msbChannel,
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
      const m = input.match(/(?:^|\\s)--key(?:=|\\s+)(.+)$/);
      const raw = m ? m[1].trim() : null;
      if (!raw) {
        console.log('Usage: /get --key "<hyperbee-key>"');
        return;
      }
      const key = raw.replace(/^\"(.*)\"$/, "$1").replace(/^'(.*)'$/, "$1");
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
    console.log("- /msb | prints MSB txv + lengths (local MSB node view).");
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
    await this.put(`app/ping/${this.tx}`, { from: this.address, msg, tx: this.tx });
  }

  async set() {
    const key = this.value?.key != null ? String(this.value.key) : null;
    const value = this.value?.value != null ? String(this.value.value) : null;
    if (!key) throw new Error("Missing key");
    await this.put(`app/kv/${key}`, { value, tx: this.tx, from: this.address });
  }
}

const peer = new Peer({
  stores_directory: cfg.peerStoresDirectory,
  store_name: cfg.peerStoreName,
  msb,
  wallet: new Wallet(),
  protocol: DevProtocol,
  contract: DevContract,
  bootstrap: cfg.subnetBootstrap ? b4a.from(cfg.subnetBootstrap, "hex") : null,
  channel: cfg.subnetChannel,
  enable_interactive_mode: true,
});
await peer.ready();

let rpcServer = null;
if (cfg.rpcEnabled) {
  rpcServer = startRpcServer(peer, cfg.rpcHost, cfg.rpcPort, {
    allowOrigin: cfg.rpcAllowOrigin,
    maxBodyBytes: cfg.rpcMaxBodyBytes,
  });
}

const peerMsbAddress = peer.msbClient.pubKeyHexToAddress(peer.wallet.publicKey);
const effectiveSubnetBootstrapHex = peer.base?.key
  ? peer.base.key.toString("hex")
  : b4a.isBuffer(peer.bootstrap)
    ? peer.bootstrap.toString("hex")
    : String(peer.bootstrap);

if (!cfg.subnetBootstrap) {
  fs.mkdirSync(path.dirname(cfg.subnetBootstrapFile), { recursive: true });
  fs.writeFileSync(cfg.subnetBootstrapFile, `${effectiveSubnetBootstrapHex}\\n`);
}

console.log("");
console.log("==================== TRAC-PEER (PEAR) ====================");
console.log("Peer store:", path.join(cfg.peerStoresDirectory, cfg.peerStoreNameRaw));
console.log("Subnet bootstrap:", effectiveSubnetBootstrapHex);
console.log("Subnet channel:", cfg.subnetChannel);
console.log("Peer pubkey (hex):", peer.wallet.publicKey);
console.log("Peer MSB address:", peerMsbAddress);
console.log("----------------------------------------------------------");
console.log("MSB network bootstrap:", msb.bootstrap?.toString("hex") ?? null);
console.log("MSB channel:", b4a.toString(msb.channel, "utf8"));
console.log("MSB wallet address:", msb.wallet?.address ?? null);
console.log("----------------------------------------------------------");
console.log("Next steps:");
console.log("- Fund this Peer MSB address on your MSB admin node:");
console.log("  ", peerMsbAddress);
console.log("- In this peer console:");
console.log("  - /deploy_subnet");
console.log('  - /tx --command "ping hello"');
console.log("==========================================================");
console.log("");

await startInteractiveCli(peer);

const shutdown = async (code) => {
  if (rpcServer) await new Promise((resolve) => rpcServer.close(resolve));
  await Promise.allSettled([peer.close(), msb.close()]);
  if (typeof process !== "undefined") process.exit(code);
  if (typeof Pear !== "undefined" && Pear.exit) Pear.exit(code);
};

if (typeof process !== "undefined" && typeof process.on === "function") {
  process.on("SIGINT", () => shutdown(130));
}
