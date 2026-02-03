import BaseContract from "trac-peer/src/artifacts/contract.js";

class AppContract extends BaseContract {
  constructor(protocol, config) {
    super(protocol, config);
    this.addFunction("ping");
    this.addFunction("set");
  }

  async ping() {
    const msg = this.value?.msg ?? "pong";
    await this.put(`app/ping/${this.tx}`, { msg });
  }

  async set() {
    const key = this.value?.key;
    const value = this.value?.value;
    if (!key) throw new Error("set requires a key");
    await this.put(`app/kv/${key}`, { value });
  }
}

export default AppContract;
