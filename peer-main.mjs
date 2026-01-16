import b4a from "b4a";
import path from "path";
import fs from "fs";
import { ensureTextCodecs } from "./src/textCodec.js";

import { Peer, Wallet } from "./src/index.js";
import { MainSettlementBus } from "trac-msb/src/index.js";
import { getPearRuntime } from "./src/runnerArgs.js";
import { resolvePeerRunnerConfig } from "./src/peerRunnerConfig.js";
import { startRpcServer } from "./rpc/rpc_server.js";
import { startInteractiveCli } from "./src/cli.js";
import PokemonProtocol from "./src/dev/pokemonProtocol.js";
import PokemonContract from "./src/dev/pokemonContract.js";

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

// DevProtocol and DevContract moved to separate files for reuse.

const peer = new Peer({
  stores_directory: cfg.peerStoresDirectory,
  store_name: cfg.peerStoreName,
  msb,
  wallet: new Wallet(),
  protocol: PokemonProtocol,
  contract: PokemonContract,
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
