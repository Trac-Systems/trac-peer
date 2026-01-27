import test from "brittle";
import b4a from "b4a";
import path from "path";
import os from "os";
import fs from "fs/promises";

import { Peer } from "../../src/index.js";
import Wallet from "../../src/wallet.js";
import PokemonContract from "../../src/dev/pokemonContract.js";
import PokemonProtocol from "../../src/dev/pokemonProtocol.js";
import { tx as cliTx } from "../../src/functions.js";

async function withTempDir(fn) {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "trac-peer-cli-tx-"));
  const storesDirectory = tmpRoot.endsWith(path.sep) ? tmpRoot : tmpRoot + path.sep;
  try {
    return await fn({ tmpRoot, storesDirectory });
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
}

async function prepareWallet(storesDirectory, storeName) {
  const wallet = new Wallet();
  await wallet.generateKeyPair();
  const keypairPath = path.join(storesDirectory, storeName, "db", "keypair.json");
  await fs.mkdir(path.dirname(keypairPath), { recursive: true });
  await wallet.exportToFile(keypairPath, b4a.alloc(0));
  return wallet;
}

async function closePeer(peer) {
  if (!peer) return;
  try {
    await peer.close();
  } catch (_e) {}
  try {
    await peer.store.close();
  } catch (_e) {}
}

function createMsbStub() {
  return {
    config: { bootstrap: b4a.alloc(32), networkId: 918, addressPrefix: "trac" },
    network: {},
    state: {
      getIndexerSequenceState: async () => b4a.alloc(32),
      getSignedLength: () => 0,
    },
  };
}

test("cli tx: /tx --command JSON can simulate Pokemon catch", async (t) => {
  await withTempDir(async ({ storesDirectory }) => {
    const storeName = "peer";
    const wallet = await prepareWallet(storesDirectory, storeName);

    const peer = new Peer({
      stores_directory: storesDirectory,
      store_name: storeName,
      wallet,
      protocol: PokemonProtocol,
      contract: PokemonContract,
      msb: createMsbStub(),
      replicate: false,
      enable_interactive_mode: false,
      enable_background_tasks: false,
      enable_updater: false,
    });

    try {
      await peer.ready();

      // PokemonProtocol doesn't map a plain "catch" string, so we use the JSON command format.
      // This exercises CLI arg parsing (parseArgs) + tx() + mapTxCommand() + simulateTransaction().
      const cmd = `/tx --command "{\\\"type\\\":\\\"catch\\\",\\\"value\\\":{}}" --sim 1`;
      const res = await cliTx(cmd, peer);

      // PokemonContract.catch() returns undefined; simulate path should not throw.
      t.is(res ?? null, null);
    } finally {
      await closePeer(peer);
    }
  });
});

