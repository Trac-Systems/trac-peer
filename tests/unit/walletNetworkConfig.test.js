import test from "brittle";
import b4a from "b4a";
import PeerWallet from "trac-wallet";

import Wallet from "../../src/wallet.js";
import { createConfig, ENV } from "../../src/index.js";

const TESTNET_PREFIX = "testtrac";
const TESTNET_DERIVATION_PATH = "m/919'/0'/0'/0'";
const MNEMONIC = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

test("wallet: constructor options are forwarded and reused by generateKeyPair", async (t) => {
  const wallet = new Wallet({
    networkPrefix: TESTNET_PREFIX,
    derivationPath: TESTNET_DERIVATION_PATH,
  });
  await wallet.ready;
  await wallet.generateKeyPair(MNEMONIC);

  const expected = new PeerWallet({ networkPrefix: TESTNET_PREFIX });
  await expected.ready;
  await expected.generateKeyPair(MNEMONIC, TESTNET_DERIVATION_PATH);

  t.is(wallet.address, expected.address);
  t.is(wallet.publicKey, b4a.toString(expected.publicKey, "hex"));
  t.is(wallet.secretKey, b4a.toString(expected.secretKey, "hex"));
  t.is(wallet.derivationPath, TESTNET_DERIVATION_PATH);
});

test("config: TESTNET1 preset is exported and can be instantiated", async (t) => {
  t.is(ENV.TESTNET1, "testnet1");

  const config = createConfig(ENV.TESTNET1, {});

  t.is(config.storeName, "testnet");
  t.ok(b4a.isBuffer(config.channel));
  t.is(config.bootstrap, null);
});
