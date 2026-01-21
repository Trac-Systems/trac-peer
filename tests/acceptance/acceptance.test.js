// This runner is intentionally small (mirrors MSB's brittle runner style).
import test from "brittle";

test.pause();
await import("./rpc.test.js");
test.resume();

