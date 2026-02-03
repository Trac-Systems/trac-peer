# __APP_NAME__

Scaffolded with `create-trac-peer`.

## Quick start

```sh
npm install
npm run dev
```

To run with Pear:

```sh
npm run prod
```

## Config

Edit `config.js` to set your MSB bootstrap/channel, subnet channel, and store names.

## First run notes

- The peer prints a "Peer MSB address". Fund that address on MSB before sending txs.
- In the peer console, run:
  - `/deploy_subnet`
  - `/tx --command "ping hello"`
  - `/get --key "app/ping/<tx-hash>" --confirmed false`

## Contract + protocol

- `src/protocol.js` parses CLI commands and maps them to contract calls.
- `src/contract.js` contains your contract logic.

## Scripts

- `npm run dev` uses Node and the dev config.
- `npm run prod` uses Pear and the prod config.
