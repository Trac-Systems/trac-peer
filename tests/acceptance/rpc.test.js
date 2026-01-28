import test from "brittle";
import path from "path";
import os from "os";
import fs from "fs/promises";
import b4a from "b4a";

import { createServer } from "../../rpc/create_server.js";
import { Peer, Protocol, Contract } from "../../src/index.js";
import PokemonContract from "../../src/dev/pokemonContract.js";
import PokemonProtocol from "../../src/dev/pokemonProtocol.js";
import HyperMallContract from "../../src/dev/HyperMallConctract.js";
import HyperMallProtocol from "../../src/dev/HyperMallProtocol.js";
import Wallet from "../../src/wallet.js";
import { mkdtempPortable, rmrfPortable } from "../helpers/tmpdir.js";

async function withTempDir(fn) {
  const tmpRoot = await mkdtempPortable(path.join(os.tmpdir(), "trac-peer-acceptance-"));
  const storesDirectory = tmpRoot.endsWith(path.sep) ? tmpRoot : tmpRoot + path.sep;
  try {
    return await fn({ tmpRoot, storesDirectory });
  } finally {
    await rmrfPortable(tmpRoot);
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

async function startRpc(peer, { maxBodyBytes = 1_000_000 } = {}) {
  const server = createServer(peer, { maxBodyBytes });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  return { server, baseUrl };
}

async function httpJson(method, url, body = null) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_e) {}
  return { status: res.status, json, text };
}

const createMsbStub = () => {
  return {
    config: { bootstrap: b4a.alloc(32), networkId: 918, addressPrefix: "trac", channel: b4a.from("test", "utf8") },
    bootstrap: b4a.alloc(32),
    state: {
      getIndexerSequenceState: async () => b4a.alloc(32),
      getSignedLength: () => 0,
    },
    network: {},
    broadcastTransactionCommand: async (payload) => ({ message: "ok", tx: payload?.txo?.tx ?? payload?.tro?.tx ?? null }),
  };
};

test("rpc: health/status/state", async (t) => {
  await withTempDir(async ({ storesDirectory }) => {
    const storeName = "peer";
    const wallet = await prepareWallet(storesDirectory, storeName);

    const peer = new Peer({
      stores_directory: storesDirectory,
      store_name: storeName,
      wallet,
      protocol: Protocol,
      contract: Contract,
      msb: null,
      replicate: false,
      enable_interactive_mode: false,
      enable_background_tasks: false,
      enable_updater: false,
    });

    let server = null;
    try {
      await peer.ready();
      const rpc = await startRpc(peer);
      server = rpc.server;
      const baseUrl = rpc.baseUrl;

      // Unversioned health route should not exist.
      {
        const r = await httpJson("GET", `${baseUrl}/health`);
        t.is(r.status, 404);
      }

      // Versioned health route exists.
      {
        const r = await httpJson("GET", `${baseUrl}/v1/health`);
        t.is(r.status, 200);
        t.is(r.json?.ok, true);
      }

      // Status includes our pubkey and no MSB readiness.
      {
        const r = await httpJson("GET", `${baseUrl}/v1/status`);
        t.is(r.status, 200);
        t.is(r.json?.msb?.ready, false);
        t.is(r.json?.peer?.pubKeyHex, wallet.publicKey);
      }

      // Chat status is null by default.
      {
        const r = await httpJson("GET", `${baseUrl}/v1/state?key=chat_status&confirmed=true`);
        t.is(r.status, 200);
        t.is(r.json?.value ?? null, null);
      }
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await closePeer(peer);
    }
  });
});

test("rpc: body size limit returns 413", async (t) => {
  await withTempDir(async ({ storesDirectory }) => {
    const storeName = "peer";
    const wallet = await prepareWallet(storesDirectory, storeName);

    const peer = new Peer({
      stores_directory: storesDirectory,
      store_name: storeName,
      wallet,
      protocol: Protocol,
      contract: Contract,
      msb: null,
      replicate: false,
      enable_interactive_mode: false,
      enable_background_tasks: false,
      enable_updater: false,
    });

    let server = null;
    try {
      await peer.ready();
      const rpc = await startRpc(peer, { maxBodyBytes: 32 });
      server = rpc.server;
      const baseUrl = rpc.baseUrl;

      const big = "x".repeat(100);
      const r = await httpJson("POST", `${baseUrl}/v1/contract/tx/prepare`, {
        prepared_command: { type: big, value: {} },
        address: wallet.publicKey,
        nonce: "0".repeat(64),
      });
      t.is(r.status, 413);
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await closePeer(peer);
    }
  });
});

test("rpc: contract schema (pokemon)", async (t) => {
  await withTempDir(async ({ storesDirectory }) => {
    const storeName = "peer";
    const wallet = await prepareWallet(storesDirectory, storeName);

    const peer = new Peer({
      stores_directory: storesDirectory,
      store_name: storeName,
      wallet,
      protocol: PokemonProtocol,
      contract: PokemonContract,
      msb: null,
      replicate: false,
      enable_interactive_mode: false,
      enable_background_tasks: false,
      enable_updater: false,
    });

    let server = null;
    try {
      await peer.ready();
      const rpc = await startRpc(peer);
      server = rpc.server;
      const baseUrl = rpc.baseUrl;

      const r = await httpJson("GET", `${baseUrl}/v1/contract/schema`);
      t.is(r.status, 200);
      t.is(r.json?.schemaFormat, "json-schema");
      t.is(r.json?.contract?.contractClass, "PokemonContract");
      t.ok(Array.isArray(r.json?.contract?.txTypes));
      t.ok(r.json.contract.txTypes.includes("catch"));
      t.is(typeof r.json?.api?.methods?.tx, "object");
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await closePeer(peer);
    }
  });
});

test("rpc: contract schema (hypermall)", async (t) => {
  await withTempDir(async ({ storesDirectory }) => {
    const storeName = "peer";
    const wallet = await prepareWallet(storesDirectory, storeName);

    const peer = new Peer({
      stores_directory: storesDirectory,
      store_name: storeName,
      wallet,
      protocol: HyperMallProtocol,
      contract: HyperMallContract,
      msb: null,
      replicate: false,
      enable_interactive_mode: false,
      enable_background_tasks: false,
      enable_updater: false,
    });

    let server = null;
    try {
      await peer.ready();
      const rpc = await startRpc(peer);
      server = rpc.server;
      const baseUrl = rpc.baseUrl;

      const r = await httpJson("GET", `${baseUrl}/v1/contract/schema`);
      t.is(r.status, 200);
      t.is(r.json?.schemaFormat, "json-schema");
      t.is(r.json?.contract?.contractClass, "HyperMallContract");
      t.ok(r.json?.contract?.txTypes?.includes("stake"));
      t.is(typeof r.json?.contract?.ops?.stake?.value, "object");
      t.is(typeof r.json?.api?.methods?.getListingsLength, "object");
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await closePeer(peer);
    }
  });
});

test("rpc: wallet-signed tx simulate via prepare+sign+broadcast", async (t) => {
  await withTempDir(async ({ storesDirectory }) => {
    const storeName = "peer";
    const peerWallet = await prepareWallet(storesDirectory, storeName);
    const externalWallet = new Wallet();
    await externalWallet.generateKeyPair();

    const peer = new Peer({
      stores_directory: storesDirectory,
      store_name: storeName,
      wallet: peerWallet,
      protocol: PokemonProtocol,
      contract: PokemonContract,
      msb: createMsbStub(),
      replicate: false,
      enable_interactive_mode: false,
      enable_background_tasks: false,
      enable_updater: false,
      api_tx_exposed: true,
    });

    let server = null;
    try {
      await peer.ready();
      const rpc = await startRpc(peer);
      server = rpc.server;
      const baseUrl = rpc.baseUrl;

      const nonceRes = await httpJson("GET", `${baseUrl}/v1/contract/nonce`);
      t.is(nonceRes.status, 200);
      const nonce = nonceRes.json?.nonce;

      const prepared_command = { type: "catch", value: {} };
      const prep = await httpJson("POST", `${baseUrl}/v1/contract/tx/prepare`, {
        prepared_command,
        address: externalWallet.publicKey,
        nonce,
      });
      t.is(prep.status, 200);
      const tx = prep.json?.tx;

      const signature = externalWallet.sign(b4a.from(tx, "hex"));
      const simRes = await httpJson("POST", `${baseUrl}/v1/contract/tx`, {
        tx,
        prepared_command,
        address: externalWallet.publicKey,
        signature,
        nonce,
        sim: true,
      });
      t.is(simRes.status, 200);
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await closePeer(peer);
    }
  });
});
