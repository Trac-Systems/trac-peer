import test from 'brittle';
import { ACK_OPERATION_TYPE, Updater, installNonNullAutobaseAck, installSignedAutobaseStore } from '../../src/tasks/updater.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

test('updater acknowledges unsigned indexer entries with signed no-op values', async (t) => {
    const appended = [];

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
                throw new Error('autobase null ack path must not be used');
            },
            async append(value) {
                appended.push(value);
            }
        }
    }, { updaterIntervalMs: 5 });

    await updater.start();
    await sleep(25);
    await updater.stop();

    t.ok(appended.length > 0, 'unsigned entries are acknowledged');
    t.ok(appended.every(value => value !== null), 'raw null append is not used for acknowledgements');
    t.is(appended[0].type, ACK_OPERATION_TYPE, 'acknowledgement uses the reserved no-op operation');
});

test('installNonNullAutobaseAck maps Autobase null acknowledgements to signed no-op values', async (t) => {
    const appended = [];
    const base = {
        async append(value) {
            appended.push(value);
            return value;
        }
    };

    installNonNullAutobaseAck(base);
    installNonNullAutobaseAck(base);

    const ack = await base.append(null);
    const payload = { type: 'msg', value: 'hello' };
    const passthrough = await base.append(payload);

    t.is(appended.length, 2, 'append is wrapped once');
    t.ok(ack !== null, 'null acknowledgement is replaced');
    t.is(ack.type, ACK_OPERATION_TYPE, 'replacement uses reserved ack operation');
    t.is(appended[0].type, ACK_OPERATION_TYPE, 'stored append value is non-null ack operation');
    t.is(passthrough, payload, 'non-null appends are unchanged');
    t.is(appended[1], payload, 'non-null stored value is unchanged');
});

test('installNonNullAutobaseAck signs Autobase local named-session appends', async (t) => {
    const keyPair = { publicKey: Buffer.alloc(32, 1), secretKey: Buffer.alloc(64, 2) };
    const appendCalls = [];
    const local = {
        manifest: { signers: [{ publicKey: keyPair.publicKey }] },
        async append(blocks, opts = {}) {
            appendCalls.push({ blocks, opts });
        }
    };
    const localStore = {
        getLocal() {
            return local;
        }
    };
    const rootStore = {
        getLocal() {
            return local;
        },
        atomize() {
            return localStore;
        }
    };
    const base = {
        local: { keyPair },
        _viewStore: rootStore,
        async append(value) {
            return value;
        }
    };

    installNonNullAutobaseAck(base);

    await rootStore.getLocal().append(['root']);
    await rootStore.atomize().getLocal().append(['local']);
    const explicit = { signature: Buffer.alloc(64, 3) };
    await rootStore.getLocal().append(['explicit'], explicit);

    t.is(appendCalls.length, 3, 'local append wrappers are installed');
    t.is(appendCalls[0].opts.keyPair, keyPair, 'root local append receives the writer keypair');
    t.is(appendCalls[1].opts.keyPair, keyPair, 'atomized local append receives the writer keypair');
    t.is(appendCalls[2].opts, explicit, 'explicit signing options are preserved');
});

test('installNonNullAutobaseAck signs Autobase view batch session appends', async (t) => {
    const keyPair = { publicKey: Buffer.alloc(32, 4), secretKey: Buffer.alloc(64, 5) };
    const appendCalls = [];
    const makeSession = () => ({
        manifest: { signers: [{ publicKey: keyPair.publicKey }] },
        async append(blocks, opts = {}) {
            appendCalls.push({ blocks, opts });
        },
        session() {
            return makeSession();
        }
    });
    const view = {
        core: makeSession(),
        batch: null,
        atomicBatch: null,
        createSession() {
            this.batch = makeSession();
            return this.batch.session();
        }
    };
    const rootStore = {
        getLocal() {
            return makeSession();
        },
        getViewByName() {
            return view;
        },
        get(name) {
            return this.getViewByName(name).createSession();
        },
        atomize() {
            return this;
        }
    };
    const base = {
        local: { keyPair },
        _viewStore: rootStore,
        async append(value) {
            return value;
        }
    };

    installNonNullAutobaseAck(base);

    const viewSession = rootStore.get('view');
    await view.batch.append(['batch']);
    await viewSession.append(['child']);

    t.is(appendCalls.length, 2, 'view batch and child session append were captured');
    t.is(appendCalls[0].opts.keyPair, keyPair, 'view batch append receives the writer keypair');
    t.is(appendCalls[1].opts.keyPair, keyPair, 'view child append receives the writer keypair');
});

test('installSignedAutobaseStore signs view sessions created during Autobase open', async (t) => {
    const keyPair = { publicKey: Buffer.alloc(32, 6), secretKey: Buffer.alloc(64, 7) };
    const appendCalls = [];
    const base = { local: null };
    const makeSession = () => ({
        manifest: { signers: [{ publicKey: keyPair.publicKey }] },
        async append(blocks, opts = {}) {
            appendCalls.push({ blocks, opts });
        },
        session() {
            return makeSession();
        }
    });
    const view = {
        core: makeSession(),
        batch: null,
        atomicBatch: null,
        createSession() {
            this.batch = makeSession();
            return this.batch.session();
        }
    };
    const store = {
        base,
        getLocal() {
            return makeSession();
        },
        getViewByName() {
            return view;
        },
        get(name) {
            return this.getViewByName(name).createSession();
        },
        atomize() {
            return this;
        }
    };

    installSignedAutobaseStore(store);
    const viewSession = store.get('view');
    base.local = { keyPair };

    await view.batch.append(['batch']);
    await viewSession.append(['child']);

    t.is(appendCalls.length, 2, 'open-created view sessions are wrapped');
    t.is(appendCalls[0].opts.keyPair, keyPair, 'open-created batch append receives the writer keypair');
    t.is(appendCalls[1].opts.keyPair, keyPair, 'open-created child append receives the writer keypair');
});

test('installSignedAutobaseStore uses empty signatures for unsigned genesis views', async (t) => {
    const appendCalls = [];
    const makeSession = () => ({
        manifest: { signers: [] },
        core: { header: { manifest: { signers: [] } } },
        async append(blocks, opts = {}) {
            appendCalls.push({ blocks, opts });
        },
        session() {
            return makeSession();
        }
    });
    const view = {
        core: makeSession(),
        batch: null,
        atomicBatch: null,
        createSession() {
            this.batch = makeSession();
            return this.batch.session();
        }
    };
    const store = {
        getLocal() {
            return makeSession();
        },
        getViewByName() {
            return view;
        },
        get(name) {
            return this.getViewByName(name).createSession();
        }
    };

    installSignedAutobaseStore(store);
    const viewSession = store.get('view');
    await view.batch.append(['genesis-batch']);
    await viewSession.append(['genesis-child']);

    t.is(appendCalls.length, 2, 'unsigned genesis appends are captured');
    t.is(appendCalls[0].opts.signature.length, 0, 'genesis batch append receives an empty signature buffer');
    t.is(appendCalls[1].opts.signature.length, 0, 'genesis child append receives an empty signature buffer');
});

test('installSignedAutobaseStore covers direct session-state genesis appends', async (t) => {
    const appendCalls = [];
    const makeSession = () => ({
        manifest: { signers: [] },
        core: { header: { manifest: { signers: [] } } },
        state: {
            async append(values, opts = {}) {
                appendCalls.push({ values, opts });
            }
        },
        async append() {
            throw new Error('test must exercise direct state append');
        },
        session() {
            return makeSession();
        }
    });
    const view = {
        core: makeSession(),
        batch: null,
        atomicBatch: null,
        createSession() {
            this.batch = makeSession();
            return this.batch.session();
        }
    };
    const store = {
        getLocal() {
            return makeSession();
        },
        getViewByName() {
            return view;
        },
        get(name) {
            return this.getViewByName(name).createSession();
        }
    };

    installSignedAutobaseStore(store);
    const viewSession = store.get('view');

    await viewSession.state.append(['encoded-genesis']);

    t.is(appendCalls.length, 1, 'direct state append is wrapped');
    t.is(appendCalls[0].opts.signature.length, 0, 'direct state append receives an empty signature buffer');
});

test('installSignedAutobaseStore installs state append wrapper after session ready', async (t) => {
    const appendCalls = [];
    const makeSession = () => ({
        manifest: { signers: [] },
        core: { header: { manifest: { signers: [] } } },
        state: null,
        async ready() {
            this.state = {
                async append(values, opts = {}) {
                    appendCalls.push({ values, opts });
                }
            };
        },
        async append() {
            throw new Error('test must exercise ready-installed state append');
        },
        session() {
            return makeSession();
        }
    });
    const view = {
        core: makeSession(),
        batch: null,
        atomicBatch: null,
        createSession() {
            this.batch = makeSession();
            return this.batch.session();
        }
    };
    const store = {
        getLocal() {
            return makeSession();
        },
        getViewByName() {
            return view;
        },
        get(name) {
            return this.getViewByName(name).createSession();
        }
    };

    installSignedAutobaseStore(store);
    const viewSession = store.get('view');
    await viewSession.ready();
    await viewSession.state.append(['encoded-after-ready']);

    t.is(appendCalls.length, 1, 'state append created during ready is wrapped');
    t.is(appendCalls[0].opts.signature.length, 0, 'ready-created state append receives an empty signature buffer');
});

test('installSignedAutobaseStore covers Autobase migrated view cores', async (t) => {
    const heads = [];
    const viewCoreSession = {
        manifest: { signers: [] },
        core: {
            header: { manifest: { signers: [] } },
            storage: {
                write() {
                    return {
                        setHead(head) {
                            heads.push(head);
                        }
                    };
                }
            }
        },
        async ready() {},
        async append() {}
    };
    const store = {
        getViewCore() {
            return viewCoreSession;
        }
    };

    installSignedAutobaseStore(store);
    const migrated = store.getViewCore();
    await migrated.ready();
    migrated.core.storage.write().setHead({
        fork: 0,
        length: 1,
        rootHash: Buffer.alloc(32, 8),
        signature: null
    });

    t.is(heads.length, 1, 'migrated view core storage transaction is wrapped');
    t.is(heads[0].signature.length, 0, 'null prologue head signature becomes an empty signature buffer');
});

test('installSignedAutobaseStore covers named session head creation', async (t) => {
    const heads = [];
    const viewCoreSession = {
        manifest: { signers: [] },
        core: {
            header: { manifest: { signers: [] } },
            storage: {
                write() {
                    return { setHead() {} };
                },
                async createSession(name, head) {
                    heads.push({ name, head });
                    return {};
                }
            }
        },
        async ready() {},
        async append() {}
    };
    const store = {
        getViewCore() {
            return viewCoreSession;
        }
    };

    installSignedAutobaseStore(store);
    const migrated = store.getViewCore();
    await migrated.ready();
    await migrated.core.storage.createSession('batch', {
        fork: 0,
        length: 1,
        rootHash: Buffer.alloc(32, 9),
        signature: null
    });

    t.is(heads.length, 1, 'named session creation is wrapped');
    t.is(heads[0].head.signature.length, 0, 'null session head signature becomes an empty signature buffer');
});

test('installSignedAutobaseStore covers atomic session head creation', async (t) => {
    const heads = [];
    const viewCoreSession = {
        manifest: { signers: [] },
        core: {
            header: { manifest: { signers: [] } },
            storage: {
                write() {
                    return { setHead() {} };
                },
                async createAtomicSession(atom, head) {
                    heads.push({ atom, head });
                    return {};
                }
            }
        },
        async ready() {},
        async append() {}
    };
    const store = {
        getViewCore() {
            return viewCoreSession;
        }
    };

    installSignedAutobaseStore(store);
    const migrated = store.getViewCore();
    await migrated.ready();
    await migrated.core.storage.createAtomicSession({ view: {} }, {
        fork: 0,
        length: 1,
        rootHash: Buffer.alloc(32, 10),
        signature: null
    });

    t.is(heads.length, 1, 'atomic session creation is wrapped');
    t.is(heads[0].head.signature.length, 0, 'null atomic session head signature becomes an empty signature buffer');
});

test('installSignedAutobaseStore covers core state atomic session heads', async (t) => {
    const heads = [];
    const viewCoreSession = {
        manifest: { signers: [] },
        core: {
            header: { manifest: { signers: [] } },
            storage: {
                write() {
                    return { setHead() {} };
                }
            },
            state: {
                storage: {
                    write() {
                        return { setHead() {} };
                    },
                    async createAtomicSession(atom, head) {
                        heads.push({ atom, head });
                        return {};
                    }
                }
            }
        },
        async ready() {},
        async append() {}
    };
    const store = {
        getViewCore() {
            return viewCoreSession;
        }
    };

    installSignedAutobaseStore(store);
    const migrated = store.getViewCore();
    await migrated.ready();
    await migrated.core.state.storage.createAtomicSession({ view: {} }, {
        fork: 0,
        length: 1,
        rootHash: Buffer.alloc(32, 11),
        signature: null
    });

    t.is(heads.length, 1, 'core state atomic session creation is wrapped');
    t.is(heads[0].head.signature.length, 0, 'null state atomic session head signature becomes an empty signature buffer');
});
