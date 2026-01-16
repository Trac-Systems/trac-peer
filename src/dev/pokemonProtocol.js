import BaseProtocol from "../protocol.js";
import { bufferToBigInt, bigIntToDecimalString } from "trac-msb/src/utils/amountSerialization.js";

class PokemonProtocol extends BaseProtocol {
  mapTxCommand(command) {
    if (typeof command !== "string" || command.trim() === "") return null;
    const raw = command.trim();
    if (raw.startsWith("{")) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.type === "string" && parsed.value !== undefined) {
          return { type: parsed.type, value: parsed.value };
        }
      } catch (_e) {}
    }
    if (raw === "ping" || raw.startsWith("ping ")) {
      const msg = raw === "ping" ? "pong" : raw.slice(5);
      return { type: "ping", value: { msg } };
    }
    if (raw.startsWith("set ")) {
      const parts = raw.split(" ").filter(Boolean);
      if (parts.length >= 3) {
        const key = parts[1];
        const value = parts.slice(2).join(" ");
        return { type: "set", value: { key, value } };
      }
    }
    return { type: "ping", value: { msg: raw } };
  }

  async customCommand(input) {
    if (typeof input !== "string") return;
    if (input.startsWith("/get")) {
      const m = input.match(/(?:^|\s)--key(?:=|\s+)(.+)$/);
      const raw = m ? m[1].trim() : null;
      if (!raw) {
        console.log('Usage: /get --key "<hyperbee-key>"');
        return;
      }
      const key = raw.replace(/^\"(.*)\"$/, "$1").replace(/^'(.*)'$/, "$1");
      const v = await this.getSigned(key);
      console.log(v);
      return;
    }
    if (input.startsWith("/msb")) {
      const txv = await this.peer.msbClient.getTxvHex();
      const peerMsbAddress = this.peer.msbClient.pubKeyHexToAddress(this.peer.wallet.publicKey);
      const entry = peerMsbAddress ? await this.peer.msb.state.getNodeEntryUnsigned(peerMsbAddress) : null;
      const balance = entry?.balance ? bigIntToDecimalString(bufferToBigInt(entry.balance)) : null;
      const fee = bigIntToDecimalString(bufferToBigInt(this.peer.msb.state.getFee()));
      const validators = this.peer.msb.network?.validatorConnectionManager?.connectionCount?.() ?? 0;
      console.log({
        networkId: this.peer.msbClient.networkId,
        msbBootstrap: this.peer.msbClient.bootstrapHex,
        txv,
        msbSignedLength: this.peer.msb.state.getSignedLength(),
        msbUnsignedLength: this.peer.msb.state.getUnsignedLength(),
        connectedValidators: validators,
        peerMsbAddress,
        peerMsbBalance: balance,
        msbFee: fee,
      });
      return;
    }
  }

  async printOptions() {
    console.log("");
    console.log("- Dev commands:");
    console.log('- /msb | prints MSB txv + lengths (local MSB node view).');
    console.log('- /get --key "<key>" | reads signed subnet state key.');
    console.log("");
    console.log("- Dev TX examples:");
    console.log('- /tx --command "ping hello"');
    console.log('- /tx --command "set foo bar"');
    console.log('- /tx --command "{\\"type\\":\\"ping\\",\\"value\\":{\\"msg\\":\\"hi\\"}}"');
  }
}

export default PokemonProtocol;

