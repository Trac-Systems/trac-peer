import BaseProtocol from "trac-peer/src/artifacts/protocol.js";

class AppProtocol extends BaseProtocol {
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

  async printOptions() {
    console.log("");
    console.log("- Example commands:");
    console.log('- /tx --command "ping hello"');
    console.log('- /tx --command "set foo bar"');
    console.log('- /tx --command "{\\"type\\":\\"ping\\",\\"value\\":{\\"msg\\":\\"hi\\"}}"');
  }
}

export default AppProtocol;
