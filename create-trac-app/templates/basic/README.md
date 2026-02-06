# __APP_NAME__

Scaffolded with `create-trac-app`.

## Purpose

The purpose of this setup is to provide a quick dev-only scaffold to build and test your trac app.

## Basic Concepts

It is required to have a working [MSB](https://github.com/Trac-Systems/main_settlement_bus) and a funded [wallet](https://github.com/Trac-Systems/tap-wallet-extension). The funding doesn't happen in the subnetwork (in this context the peer "server") but on the MSB layer. It is possible to think of the subnetwork ([trac-peer](https://github.com/Trac-Systems/trac-peer)) as a beam for the application logic, i.e., contract and protocol, while MSB is the beam for traffic (transaction handling and fees). The currency that governs over MSB is $TNK.

A [contract](./src/contract.js) is the logical entity that the local network can interact with (through transactions). A [protocol](./src/protocol.js) is a processing entity that happens regardless. Since the transaction life-cycle is network bound, any heavier processing should be done at the protocol level. To use Ethereum as an analogy, a contract would be indeed closer to an Ethereum contract, while the protocol would be closer to an oracle. Furthermore, protocols are included in the context so they can extend functionality.

## Premises

- The current configuration assumes a dev environment.
- MSB is running, can fund addresses, and run transactions.
- A tap wallet extension is installed to interact with the dapp (frontend).
- The wallet selected in the TAP wallet also has funds to run transactions.

## Subnetwork contract and protocol

```sh
npm install
npm run dev
```

After executing both, the peer will run in a command-line context and, among other things, it should display the relationship between Peer and MSB.

```
==================== TRAC-PEER RUNNER ====================
MSB network bootstrap: cf6851dc8159e94d5223e810bf519cf89370268f1c8ac656d8e8abf0743ff19b
MSB channel: 21313123322131312332213131233221
MSB wallet address: trac1krjpplf7cxkc06rakxegwpa8ffv20u9hgrga90np0r4cpvs8a7rsakcysk
----------------------------------------------------------
```
MSB channel and bootstrap should reflect the configuration in [config](./config.js). They should match that of your local instance of MSB. Two actions are required at this time (on the peer): `/add_admin` and `/deploy_subnet`. Both actions will require $TNK funded to the displayed MSB wallet address. Leaving the subnet address null on the peer node in the config will assume the current instance as the bootstrap. That value should be changed in case you want to participate on someone else's network (subnet).

Running the following command will expose the current [contract](./src/contract.js) and [protocol](./src/protocol.js) in the current subnet instance.

```sh
npm run dev-rpc
```
There is no live reload, and state is consolidated in the local storage as well as other entities participating in the subnet. Therefore it is recommended to finish up the contract and protocol development before you get to testing it.

As far as development is concerned, the expected files to change are: the [./src/contract.js](./src/contract.js), [./src/protocol.js](./src/protocol.js) and [./config.js](./config.js).

## The dapp

The dapp lives in `trac-dapp-example` and, in this example, is a Vite + React frontend. It interacts with the network through RPC.

Run it from the project root (same `package.json`):

```sh
npm run dev:dapp
```
