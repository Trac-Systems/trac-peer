# __APP_NAME__

Scaffolded with `create-trac-app`.

## Purpose

The purpose of this setup is to provide a quick dev-only scaffold to build and test your trac app.

## Basic Concepts

It is required to have a working [MSB](https://github.com/Trac-Systems/main_settlement_bus) and a funded [wallet](https://github.com/Trac-Systems/tap-wallet-extension). The funding doesnt happen in the subnetwork (in this context the peer "server") but on msb layer. It is possible to think of the subnetwork ([trac-peer](https://github.com/Trac-Systems/trac-peer)) as a beam for the application logic i.e.: contract and protocol while msb is the beam for traffic (transaction handling and fees). The currency that governs over msb is $TNK.

## Quick start

```sh
npm install
npm run dev
```

`npm run dev` uses Pear.

## Config

Edit `config.js` to set your MSB bootstrap/channel, subnet channel, and store names (dev only).

## First run notes

- The peer prints a "Peer MSB address". Fund that address on MSB before sending txs.
- In the peer console, run:
  - `/deploy_subnet`
  - `/tx --command "catch"`
  - `/get --key "app/tuxedex/<peer-pubkey-hex>" --confirmed false`

## Contract + protocol (Tuxemon)

- `src/protocol.js` maps CLI commands to the Tuxemon contract.
- `src/contract.js` stores caught Tuxemon entries under `app/tuxedex/<address>`.

## Scripts

- `npm run dev` uses Pear with the dev config.
