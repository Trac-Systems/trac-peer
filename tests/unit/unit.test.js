// This runner is intentionally small (mirrors MSB's brittle runner style).
import test from 'brittle';

test.pause();
await import('./applyGuards.test.js');
await import('./baseContractProtocol.test.js');
test.resume();
