import test from 'brittle';
import { Updater } from '../../src/tasks/updater.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

test('updater acknowledges unsigned indexer entries without raw null append', async (t) => {
    let ackCalls = 0;
    let appendCalls = 0;

    const updater = new Updater({
        base: {
            isIndexer: true,
            view: {
                core: {
                    length: 1,
                    signedLength: 0
                }
            },
            async ack() {
                ackCalls++;
            },
            async append(value) {
                appendCalls++;
                throw new Error(`unexpected raw append: ${value}`);
            }
        }
    }, { updaterIntervalMs: 5 });

    await updater.start();
    await sleep(25);
    await updater.stop();

    t.ok(ackCalls > 0, 'unsigned entries are acknowledged');
    t.is(appendCalls, 0, 'raw null append is not used for acknowledgements');
});
