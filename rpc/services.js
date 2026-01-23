import b4a from "b4a";
import { deploySubnet as deploySubnetFn, setChatStatus as setChatStatusFn, setNick as setNickFn, dumpContractMetadata } from "../src/functions.js";
import { addAdminKey, addWriterKey, addIndexerKey, removeWriterKey, removeIndexerKey, joinValidator as joinValidatorFn } from "../src/functions.js";

const asHex32 = (value, field) => {
  const hex = String(value ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error(`Invalid ${field}. Expected 32-byte hex (64 chars).`);
  return hex;
};

export async function getStatus(peer) {
  const subnetBootstrapHex = b4a.isBuffer(peer.bootstrap)
    ? b4a.toString(peer.bootstrap, "hex")
    : peer.bootstrap != null
      ? String(peer.bootstrap)
      : null;

  const peerMsbAddress = peer.msbClient?.isReady() ? peer.msbClient.pubKeyHexToAddress(peer.wallet.publicKey) : null;

  const admin = peer.base?.view ? await peer.base.view.get("admin") : null;
  const chatStatus = peer.base?.view ? await peer.base.view.get("chat_status") : null;

  return {
    peer: {
      pubKeyHex: peer.wallet?.publicKey ?? null,
      writerKeyHex: peer.writerLocalKey ?? null,
      msbAddress: peerMsbAddress,
      baseWritable: !!peer.base?.writable,
      isIndexer: !!peer.base?.isIndexer,
      isWriter: !!peer.base?.writable,
      subnetBootstrapHex,
      subnetChannelUtf8: peer.channel ? b4a.toString(peer.channel, "utf8") : null,
      subnetSignedLength: peer.base?.view?.core?.signedLength ?? null,
      subnetUnsignedLength: peer.base?.view?.core?.length ?? null,
      admin: admin?.value ?? null,
      chatStatus: chatStatus?.value ?? null,
    },
    msb: {
      ready: peer.msbClient?.isReady?.() ?? false,
      bootstrapHex: peer.msbClient?.bootstrapHex ?? null,
      networkId: peer.msbClient?.networkId ?? null,
      signedLength: peer.msbClient?.isReady?.() ? peer.msbClient.getSignedLength() : null,
    },
  };
}

export async function getContractMetadata(peer) {
  if (!peer?.contract_instance) throw new Error("Contract instance not initialized.");
  return dumpContractMetadata(peer.contract_instance);
}

export async function getState(peer, key, { confirmed = true } = {}) {
  const k = String(key ?? "");
  if (!k) throw new Error("Missing key.");
  if (!peer.base?.view) throw new Error("Peer view not ready.");
  if (confirmed) {
    const viewSession = peer.base.view.checkout(peer.base.view.core.signedLength);
    try {
      const res = await viewSession.get(k);
      return res?.value ?? null;
    } finally {
      await viewSession.close();
    }
  }
  const res = await peer.base.view.get(k);
  return res?.value ?? null;
}

export async function broadcastTx(peer, { command, sim = false } = {}) {
  if (!peer.base?.writable) throw new Error("Peer subnet is not writable (writer required for /tx).");
  const cmd = command;
  if (!cmd) throw new Error("Missing command.");
  return await peer.protocol_instance.tx({ command: cmd }, !!sim);
}

export async function deploySubnet(peer) {
  if (!peer.base?.writable) throw new Error("Peer subnet is not writable (writer required for /deploy-subnet).");
  return await deploySubnetFn("/deploy_subnet", peer);
}

export async function setChatStatus(peer, enabled) {
  if (!peer.base?.writable) throw new Error("Peer subnet is not writable (writer required).");
  const on = enabled === true || enabled === 1 || enabled === "1";
  return await setChatStatusFn(`/set_chat_status --enabled ${on ? 1 : 0}`, peer);
}

export async function postChatMessage(peer, { message, reply_to = null } = {}) {
  if (!peer.base?.writable) throw new Error("Peer subnet is not writable (writer required).");
  const chatStatus = await peer.base.view.get('chat_status');
  if (chatStatus === null || chatStatus.value !== 'on') throw new Error('Chat is disabled.');
  const msg = String(message ?? "");
  if (!msg.trim()) throw new Error("Empty message not allowed.");
  if (b4a.byteLength(msg) > peer.protocol_instance.msgMaxBytes()) throw new Error("Message too large.");
  const nonce = peer.protocol_instance.generateNonce();
  const signature = {
    dispatch: {
      type: "msg",
      msg,
      address: peer.wallet.publicKey,
      attachments: [],
      deleted_by: null,
      reply_to: reply_to != null ? parseInt(reply_to) : null,
      pinned: false,
      pin_id: null,
    },
  };
  const hash = peer.wallet.sign(JSON.stringify(signature) + nonce);
  await peer.base.append({ type: "msg", value: signature, hash, nonce });
  return { ok: true };
}

export async function setNick(peer, { nick, user = null } = {}) {
  if (!peer.base?.writable) throw new Error("Peer subnet is not writable (writer required).");
  const n = String(nick ?? "").trim();
  if (!n) throw new Error("Missing nick.");
  const u = user != null ? String(user).trim().toLowerCase() : null;
  const input = u ? `/set_nick --nick "${n}" --user "${u}"` : `/set_nick --nick "${n}"`;
  return await setNickFn(input, peer);
}

export async function addAdmin(peer, { address }) {
  if (!peer.base?.writable) throw new Error("Peer subnet is not writable (writer required).");
  const pk = asHex32(address, "address");
  return await addAdminKey(pk, peer);
}

export async function addWriter(peer, { key }) {
  if (!peer.base?.writable) throw new Error("Peer subnet is not writable (writer required).");
  const wk = asHex32(key, "key");
  return await addWriterKey(wk, peer);
}

export async function addIndexer(peer, { key }) {
  if (!peer.base?.writable) throw new Error("Peer subnet is not writable (writer required).");
  const wk = asHex32(key, "key");
  return await addIndexerKey(wk, peer);
}

export async function removeWriter(peer, { key }) {
  if (!peer.base?.writable) throw new Error("Peer subnet is not writable (writer required).");
  const wk = asHex32(key, "key");
  return await removeWriterKey(wk, peer);
}

export async function removeIndexer(peer, { key }) {
  if (!peer.base?.writable) throw new Error("Peer subnet is not writable (writer required).");
  const wk = asHex32(key, "key");
  return await removeIndexerKey(wk, peer);
}

export async function joinValidator(peer, { address }) {
  const addr = String(address ?? "").trim();
  if (!addr) throw new Error("Missing address.");
  return await joinValidatorFn(`/join_validator --address ${addr}`, peer);
}
