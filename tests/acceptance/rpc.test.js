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
import Wallet from "../../src/wallet.js";

async function withTempDir(fn) {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "trac-peer-acceptance-"));
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

test("rpc: health/status/state + chat flow", async (t) => {
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

      // Set admin to ourselves.
      {
        const r = await httpJson("POST", `${baseUrl}/v1/admin/add-admin`, { address: wallet.publicKey });
        t.is(r.status, 200);
      }
      {
        const r = await httpJson("GET", `${baseUrl}/v1/state?key=admin&confirmed=true`);
        t.is(r.status, 200);
        t.is(r.json?.value, wallet.publicKey);
      }

      // Enable chat.
      {
        const r = await httpJson("POST", `${baseUrl}/v1/chat/status`, { enabled: true });
        t.is(r.status, 200);
      }
      {
        const r = await httpJson("GET", `${baseUrl}/v1/state?key=chat_status&confirmed=true`);
        t.is(r.status, 200);
        t.is(r.json?.value, "on");
      }

      // Set nick.
      {
        const r = await httpJson("POST", `${baseUrl}/v1/chat/nick`, { nick: "alice" });
        t.is(r.status, 200);
      }
      {
        const r = await httpJson("GET", `${baseUrl}/v1/state?key=${encodeURIComponent(`nick/${wallet.publicKey}`)}&confirmed=true`);
        t.is(r.status, 200);
        t.is(r.json?.value, "alice");
      }

      // Post message.
      {
        const r = await httpJson("POST", `${baseUrl}/v1/chat/post`, { message: "hello" });
        t.is(r.status, 200);
      }
      {
        const r = await httpJson("GET", `${baseUrl}/v1/state?key=msgl&confirmed=true`);
        t.is(r.status, 200);
        t.is(r.json?.value, 1);
      }
      {
        const r = await httpJson("GET", `${baseUrl}/v1/state?key=msg%2F0&confirmed=true`);
        t.is(r.status, 200);
        t.is(r.json?.value?.msg, "hello");
        t.is(r.json?.value?.address, wallet.publicKey);
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
      const r = await httpJson("POST", `${baseUrl}/v1/chat/post`, { message: big });
      t.is(r.status, 413);
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await closePeer(peer);
    }
  });
});

test("rpc: contract metadata (pokemon)", async (t) => {
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

      const r = await httpJson("GET", `${baseUrl}/v1/contract/metadata`);
      t.is(r.status, 200);
      t.is(r.json?.metadata?.contractClass, "PokemonContract");
      t.is(typeof r.json?.metadata?.functions?.catch, "object");
      t.is(Object.keys(r.json?.metadata?.schemas ?? {}).length, 0);
      t.is(Object.keys(r.json?.metadata?.features ?? {}).length, 0);
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await closePeer(peer);
    }
  });
});

test("rpc: contract metadata (hypermall)", async (t) => {
  await withTempDir(async ({ storesDirectory }) => {
    const storeName = "peer";
    const wallet = await prepareWallet(storesDirectory, storeName);

    const peer = new Peer({
      stores_directory: storesDirectory,
      store_name: storeName,
      wallet,
      protocol: Protocol,
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

      const r = await httpJson("GET", `${baseUrl}/v1/contract/metadata`);
      t.is(r.status, 200);
      t.is(r.json?.metadata?.contractClass, "HyperMallContract");
      t.is(typeof r.json?.metadata?.schemas?.stake, "object");
      t.is(r.json?.metadata?.schemas?.stake?.value?.tick?.type, "string");
      t.is(typeof r.json?.metadata?.schemas?.tap_hypermall_feature_deposit, "object");
      t.is(r.json?.metadata?.features?.tap_hypermall_feature?.name != null, true);
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await closePeer(peer);
    }
  });
});
