# Trac Peer

A peer-to-peer crypto contract network. Interacts with the Main Settlement Bus (MSB) to settle transactions.

Release 1 (R1) must be used alongside Trac Network R1 releases to maintain contract consistency.

Trac Peer is utilizing the [Pear Runtime and Holepunch](https://pears.com/).

## Install

```shell
git clone -b trac-peer-r1 --single-branch git@github.com:Trac-Systems/trac-peer.git
```

## Usage

Trac Peer must be used in combination the MSB and a Protocol/Contract pair in a unified setup.
Please check our repos for sample setups.

### Local runner (interactive)

If you already have an MSB network running (same `bootstrap` + `channel`), you can start a local MSB node (new store) that joins that network, and run `trac-peer` on top of it (this runner uses the `trac-msb` package, so it does not require a local `main_settlement_bus` repo checkout).

This is currently required because `trac-peer` needs an in-process MSB instance to:
- broadcast `/deploy_subnet` + `/tx` payloads, and
- observe MSB confirmed state to decide when to execute subnet ops locally.

```sh
npm run peer:run -- --msb-bootstrap=<32-byte-hex> --msb-channel=<channel-string>
```

### Pear runner (interactive)

Runs `trac-peer` using the Pear runtime (similar to `trac-msb`). You can control stores via flags (recommended); an optional first positional arg can be used as a “store label” fallback if `--peer-store-name` is omitted.

```sh
npm run peer:pear -- \
  --msb-bootstrap=<32-byte-hex> \
  --msb-channel=<channel-string> \
  --msb-store-name=peer-msb-1 \
  --peer-store-name=peer1
```

Example (second node joining an existing subnet):

```sh
npm run peer:pear -- \
  --msb-bootstrap=<32-byte-hex> \
  --msb-channel=<channel-string> \
  --msb-store-name=peer-msb-2 \
  --peer-store-name=peer2 \
  --subnet-bootstrap=<subnet-bootstrap-hex32>
```

If you prefer multi-line in `zsh`, use `\` line continuations:

```sh
npm run peer:run -- \
  --msb-bootstrap <32-byte-hex> \
  --msb-channel <channel-string> \
  --msb-stores-directory stores \
  --msb-store-name peer-msb-client \
  --peer-stores-directory stores \
  --peer-store-name subnet-peer \
  --subnet-channel subnet-1
```

The runner prints the Peer MSB address. Fund that address on MSB (so the node entry exists and fee checks pass), then in the peer console run:
- `/deploy_subnet`
- `/tx --command "ping hello"` (dev protocol)
- If you want to use admin-only commands (writer/indexer management, chat moderation), run `/add_admin --address "<peer-publicKey-hex>"` and verify with `/get --key admin`.

Notes:
- The subnet bootstrap key is auto-generated the first time and persisted to `stores/<peer-store>/subnet-bootstrap.hex`.
- To start a fresh subnet, delete that file (and optionally the corresponding `stores/<peer-store>/` directory).
- To join an existing subnet explicitly, pass `--subnet-bootstrap <hex32>`.

### Start a second peer (separate store)

To run another peer on the same machine without clobbering the first one, use a different `--peer-store-name` (and a different `--msb-store-name` for the embedded MSB client node):

```sh
# peer 1 prints (or stores) its subnet bootstrap in: stores/peer/subnet-bootstrap.hex
npm run peer:run -- \
  --msb-bootstrap <32-byte-hex> \
  --msb-channel <channel-string> \
  --msb-store-name peer-msb-2 \
  --peer-store-name peer2 \
  --subnet-bootstrap <subnet-bootstrap-hex32>
```

## RPC API (HTTP)

You can start an HTTP API alongside the interactive peer:

```sh
npm run peer:run -- \
  --msb-bootstrap <32-byte-hex> \
  --msb-channel <channel-string> \
  --rpc \
  --rpc-host 127.0.0.1 \
  --rpc-port 5001
```

Endpoints (all JSON):
- `GET /v1/health`
- `GET /v1/status`
- `GET /v1/state?key=<hyperbee-key>&confirmed=true|false`
- `GET /v1/contract/schema` (JSON Schema; contract tx types + Protocol API methods)
- `POST /v1/tx` body: `{ "command": "ping hello", "sim": false }`
- `POST /v1/deploy-subnet`
- `POST /v1/chat/status` body: `{ "enabled": true }`
- `POST /v1/chat/post` body: `{ "message": "hello", "reply_to": 1 }`
- `POST /v1/chat/nick` body: `{ "nick": "alice" }`
- `POST /v1/admin/add-admin` body: `{ "address": "<pubkey-hex32>" }`
- `POST /v1/admin/add-writer` body: `{ "key": "<writerKey-hex32>" }`
- `POST /v1/admin/add-indexer` body: `{ "key": "<writerKey-hex32>" }`
- `POST /v1/admin/remove-writer` body: `{ "key": "<writerKey-hex32>" }`
- `POST /v1/msb/join-validator` body: `{ "address": "<msb-bech32m-address>" }`

Notes:
- Write endpoints require the node to be subnet-writable (`/v1/status` shows `peer.baseWritable`).
- RPC request bodies are limited to `1_000_000` bytes by default (override with `--rpc-max-body-bytes`).
