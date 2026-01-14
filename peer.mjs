import { ensureTextCodecs } from "./src/textCodec.js";

await ensureTextCodecs();

await import("./peer-main.mjs");
