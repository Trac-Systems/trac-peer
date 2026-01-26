import { buildRequestUrl } from "./utils/url.js";
import { readJsonBody } from "./utils/body.js";
import {
  getStatus,
  getState,
  getContractSchema,
  broadcastTx,
  deploySubnet,
  setChatStatus,
  postChatMessage,
  setNick,
  addAdmin,
  addWriter,
  addIndexer,
  removeWriter,
  removeIndexer,
  joinValidator,
} from "./services.js";

export async function handleHealth({ respond }) {
  respond(200, { ok: true });
}

export async function handleStatus({ respond, peer }) {
  respond(200, await getStatus(peer));
}

export async function handleGetState({ req, respond, peer }) {
  const url = buildRequestUrl(req);
  const key = url.searchParams.get("key");
  const confirmed = url.searchParams.get("confirmed");
  const confirmedBool = confirmed == null ? true : confirmed === "true";
  const value = await getState(peer, key, { confirmed: confirmedBool });
  respond(200, { key, confirmed: confirmedBool, value });
}

export async function handleGetContractSchema({ respond, peer }) {
  const schema = await getContractSchema(peer);
  respond(200, schema);
}

export async function handleBroadcastTx({ req, respond, peer, maxBodyBytes }) {
  const body = await readJsonBody(req, { maxBytes: maxBodyBytes });
  if (!body || typeof body !== "object") return respond(400, { error: "Missing JSON body." });
  const payload = await broadcastTx(peer, { command: body.command, sim: body.sim });
  respond(200, { payload });
}

export async function handleDeploySubnet({ req, respond, peer, maxBodyBytes }) {
  // Optional body for future compatibility.
  await readJsonBody(req, { maxBytes: maxBodyBytes }).catch(() => null);
  const payload = await deploySubnet(peer);
  respond(200, { payload });
}

export async function handleSetChatStatus({ req, respond, peer, maxBodyBytes }) {
  const body = await readJsonBody(req, { maxBytes: maxBodyBytes });
  if (!body || typeof body !== "object") return respond(400, { error: "Missing JSON body." });
  await setChatStatus(peer, body.enabled);
  respond(200, { ok: true });
}

export async function handlePostChatMessage({ req, respond, peer, maxBodyBytes }) {
  const body = await readJsonBody(req, { maxBytes: maxBodyBytes });
  if (!body || typeof body !== "object") return respond(400, { error: "Missing JSON body." });
  await postChatMessage(peer, { message: body.message, reply_to: body.reply_to });
  respond(200, { ok: true });
}

export async function handleSetNick({ req, respond, peer, maxBodyBytes }) {
  const body = await readJsonBody(req, { maxBytes: maxBodyBytes });
  if (!body || typeof body !== "object") return respond(400, { error: "Missing JSON body." });
  await setNick(peer, { nick: body.nick, user: body.user });
  respond(200, { ok: true });
}

export async function handleAddAdmin({ req, respond, peer, maxBodyBytes }) {
  const body = await readJsonBody(req, { maxBytes: maxBodyBytes });
  if (!body || typeof body !== "object") return respond(400, { error: "Missing JSON body." });
  await addAdmin(peer, { address: body.address });
  respond(200, { ok: true });
}

export async function handleAddWriter({ req, respond, peer, maxBodyBytes }) {
  const body = await readJsonBody(req, { maxBytes: maxBodyBytes });
  if (!body || typeof body !== "object") return respond(400, { error: "Missing JSON body." });
  await addWriter(peer, { key: body.key });
  respond(200, { ok: true });
}

export async function handleAddIndexer({ req, respond, peer, maxBodyBytes }) {
  const body = await readJsonBody(req, { maxBytes: maxBodyBytes });
  if (!body || typeof body !== "object") return respond(400, { error: "Missing JSON body." });
  await addIndexer(peer, { key: body.key });
  respond(200, { ok: true });
}

export async function handleRemoveWriter({ req, respond, peer, maxBodyBytes }) {
  const body = await readJsonBody(req, { maxBytes: maxBodyBytes });
  if (!body || typeof body !== "object") return respond(400, { error: "Missing JSON body." });
  await removeWriter(peer, { key: body.key });
  respond(200, { ok: true });
}

export async function handleRemoveIndexer({ req, respond, peer, maxBodyBytes }) {
  const body = await readJsonBody(req, { maxBytes: maxBodyBytes });
  if (!body || typeof body !== "object") return respond(400, { error: "Missing JSON body." });
  await removeIndexer(peer, { key: body.key });
  respond(200, { ok: true });
}

export async function handleJoinValidator({ req, respond, peer, maxBodyBytes }) {
  const body = await readJsonBody(req, { maxBytes: maxBodyBytes });
  if (!body || typeof body !== "object") return respond(400, { error: "Missing JSON body." });
  await joinValidator(peer, { address: body.address });
  respond(200, { ok: true });
}
