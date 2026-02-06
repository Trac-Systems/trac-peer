# Tuxedex (Vite + React, JS)

This dapp is **frontend-only**. It talks directly to a `trac-peer` HTTP RPC (default `http://127.0.0.1:5001/v1`) and uses the TAP wallet browser extension for account + signing.

## Configure peer RPC

Set the peer base URL in `VITE_API_BASE` (include the `/v1` prefix):

```sh
VITE_API_BASE=http://127.0.0.1:5001/v1
```

Because this is a pure frontend app, the peer must allow CORS for the origin running the Vite dev server.

## CORS (trac-peer)

The peer RPC server supports CORS via `PEER_RPC_ALLOW_ORIGIN` (or `--rpc-allow-origin`).

Example:

```sh
PEER_RPC=1 PEER_RPC_ALLOW_ORIGIN=http://localhost:3000 node scripts/run-peer.mjs --rpc
```

You can also set a wildcard:

```sh
PEER_RPC_ALLOW_ORIGIN=*
```

## Run

```sh
npm install
npm run dev
```

## Peer endpoints used

- Contract interface: `GET /v1/contract/schema`
- Contract tx flow:
  - `GET /v1/contract/nonce`
  - `POST /v1/contract/tx/prepare`
  - `POST /v1/contract/tx` (`sim: true` then `sim: false`)
- State (Dex collection): `GET /v1/state?key=app/tuxedex/<pubKeyHex>&confirmed=false`
