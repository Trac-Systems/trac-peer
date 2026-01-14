import b4a from "b4a";
import PeerWallet from "trac-wallet";

import { Peer, Wallet, Protocol, Contract } from "../src/index.js";
import { deploySubnet } from "../src/functions.js";

import {
  initTemporaryDirectory,
  removeTemporaryDirectory,
  setupMsbAdmin,
  setupMsbWriter,
  setupMsbPeer,
  tryToSyncWriters,
  randomBytes,
  initDirectoryStructure,
  fundPeer,
} from "trac-msb/tests/helpers/setupApplyTests.js";
import {
  testKeyPair1,
  testKeyPair2,
  testKeyPair3,
  testKeyPair4,
} from "trac-msb/tests/fixtures/apply.fixtures.js";
import { getDeploymentCommand } from "trac-msb/src/utils/cliCommands.js";
import { $TNK } from "trac-msb/src/core/state/utils/balance.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let tmp = null;
let admin = null;
let writer = null;
let reader = null;
let peer = null;

async function cleanupAndExit(code) {
  await Promise.allSettled([
    peer?.close?.(),
    reader?.msb?.close?.(),
    writer?.msb?.close?.(),
    admin?.msb?.close?.(),
  ]);
  if (tmp) await removeTemporaryDirectory(tmp).catch(() => {});
  process.exit(code);
}

process.on("SIGINT", () => cleanupAndExit(130));

try {
  tmp = await initTemporaryDirectory();

  const opts = {
    bootstrap: randomBytes(32).toString("hex"),
    channel: randomBytes(32).toString("hex"),
    enable_role_requester: false,
    enable_wallet: true,
    enable_validator_observer: true,
    enable_interactive_mode: false,
    disable_rate_limit: true,
    enable_tx_apply_logs: false,
    enable_error_apply_logs: false,
    stores_directory: `${tmp}/stores/`,
  };

  admin = await setupMsbAdmin(testKeyPair1, tmp, opts);
  writer = await setupMsbWriter(admin, "writer", testKeyPair2, tmp, admin.options);
  reader = await setupMsbPeer("reader", testKeyPair3, tmp, admin.options);
  await tryToSyncWriters(admin, writer, reader);

  // Fund a non-validator account that will be used as the subnet deployer.
  const deployerWallet = new PeerWallet(testKeyPair4);
  await deployerWallet.ready;
  await fundPeer(admin, { wallet: deployerWallet }, $TNK(10n));
  await sleep(250);
  await tryToSyncWriters(admin, writer, reader);

  // Create a Peer keypair file for the same deployer account.
  const peerDir = await initDirectoryStructure("subnetpeer", testKeyPair4, tmp);

  peer = new Peer({
    stores_directory: peerDir.storesDirectory,
    store_name: peerDir.storeName,
    msb: reader.msb,
    wallet: new Wallet(),
    protocol: Protocol,
    contract: Contract,
    bootstrap: randomBytes(32),
    channel: "subnet-peer-test",
    enable_interactive_mode: false,
    replicate: false,
  });

  await peer.ready();

  const subnetBootstrapHex = b4a.isBuffer(peer.bootstrap)
    ? peer.bootstrap.toString("hex")
    : String(peer.bootstrap);

  console.log("Peer ready.");
  console.log("Subnet bootstrap:", subnetBootstrapHex);

  const payload = await deploySubnet("/deploy_subnet", peer);
  console.log("deploySubnet tx:", payload?.bdo?.tx ?? null);

  await sleep(2000);
  await reader.msb.state.base.view.update();

  await getDeploymentCommand(reader.msb.state, subnetBootstrapHex);

  await cleanupAndExit(0);
} catch (e) {
  console.error(e);
  await cleanupAndExit(1);
}
