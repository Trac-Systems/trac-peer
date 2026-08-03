import Scheduler from '../utils/scheduler.js';
import b4a from 'b4a';

const PROCESS_INTERVAL_MS = 10_000
const ACK_OPERATION_TYPE = '_trac_peer_ack_v1'

// MAYHEM PATCH: ACKs must be ordinary signed operations. append(null) can crash
// under the Pear/Bare hypercore-storage encoder.
const createAckOperation = () => ({
    type: ACK_OPERATION_TYPE,
    value: { version: 1 }
})

const canSessionUseKeyPair = (session, keyPair) => {
    if (!keyPair?.publicKey) return false
    const signers = session.manifest?.signers ?? session.core?.header?.manifest?.signers ?? []
    return signers.some((signer) => b4a.equals(signer.publicKey, keyPair.publicKey))
}

const sessionSignerCount = (session) =>
    (session.manifest?.signers ?? session.core?.header?.manifest?.signers ?? []).length

const signingAppendOptions = (session, keyPairFor, opts = {}) => {
    if (opts?.keyPair || opts?.signature) return opts
    const keyPair = keyPairFor() ?? session.keyPair ?? session.core?.header?.keyPair ?? null
    return keyPair?.secretKey && canSessionUseKeyPair(session, keyPair)
        ? { ...opts, keyPair }
        : sessionSignerCount(session) === 0
            ? { ...opts, signature: b4a.alloc(0) }
        : opts
}

const normalizeAutobaseHead = (head) =>
    head && (head.signature === null || head.signature === undefined)
        ? { ...head, signature: b4a.alloc(0) }
        : head

const installSignedAutobaseStorage = (storage) => {
    if (!storage || typeof storage.write !== 'function') return storage
    if (storage.__tracPeerSignedCoreTxInstalled === true) return storage

    const write = storage.write.bind(storage)
    const createSession = typeof storage.createSession === 'function'
        ? storage.createSession.bind(storage)
        : null
    const createAtomicSession = typeof storage.createAtomicSession === 'function'
        ? storage.createAtomicSession.bind(storage)
        : null
    Object.defineProperty(storage, '__tracPeerSignedCoreTxInstalled', {
        value: true,
        enumerable: false,
        configurable: false
    })
    if (createSession) {
        storage.createSession = (name, head, ...args) =>
            createSession(name, normalizeAutobaseHead(head), ...args)
    }
    if (createAtomicSession) {
        storage.createAtomicSession = (atom, head, ...args) =>
            createAtomicSession(atom, normalizeAutobaseHead(head), ...args)
    }
    storage.write = (...args) => {
        const tx = write(...args)
        if (!tx || typeof tx.setHead !== 'function' ||
            tx.__tracPeerSignedCoreTxHeadInstalled === true) {
            return tx
        }
        const setHead = tx.setHead.bind(tx)
        Object.defineProperty(tx, '__tracPeerSignedCoreTxHeadInstalled', {
            value: true,
            enumerable: false,
            configurable: false
        })
        tx.setHead = (head, ...headArgs) => setHead(normalizeAutobaseHead(head), ...headArgs)
        return tx
    }
    return storage
}

const installSignedAutobaseCoreStorage = (core) => {
    if (!core) return core
    installSignedAutobaseStorage(core.storage)
    installSignedAutobaseStorage(core.state?.storage)
    return core
}

const installSignedCorestoreStorageFactory = (store) => {
    const storage = store?.storage ?? store
    if (!storage || storage.__tracPeerSignedStorageFactoryInstalled === true) return store

    Object.defineProperty(storage, '__tracPeerSignedStorageFactoryInstalled', {
        value: true,
        enumerable: false,
        configurable: false
    })

    for (const method of ['create', 'resume', '_create', '_resumeFromPointers']) {
        if (typeof storage[method] !== 'function') continue
        const original = storage[method].bind(storage)
        storage[method] = (...args) => {
            const result = original(...args)
            return result && typeof result.then === 'function'
                ? result.then(installSignedAutobaseStorage)
                : installSignedAutobaseStorage(result)
        }
    }
    return store
}

const installSignedAutobaseSessionState = (session, keyPairFor) => {
    if (!session?.state || typeof session.state.append !== 'function') return session
    if (session.state.__tracPeerSignedLocalAppendInstalled === true) return session

    const append = session.state.append.bind(session.state)
    Object.defineProperty(session.state, '__tracPeerSignedLocalAppendInstalled', {
        value: true,
        enumerable: false,
        configurable: false
    })
    session.state.append = (values, opts = {}) => append(values, signingAppendOptions(session, keyPairFor, opts))
    return session
}

const installSignedAutobaseSession = (session, keyPairFor) => {
    if (!session || typeof session.append !== 'function') return session
    installSignedAutobaseCoreStorage(session.core)
    if (session.__tracPeerSignedLocalAppendInstalled === true) {
        installSignedAutobaseSessionState(session, keyPairFor)
        return session
    }

    const append = session.append.bind(session)
    Object.defineProperty(session, '__tracPeerSignedLocalAppendInstalled', {
        value: true,
        enumerable: false,
        configurable: false
    })
    session.append = (blocks, opts = {}) => {
        return append(blocks, signingAppendOptions(session, keyPairFor, opts))
    }
    installSignedAutobaseSessionState(session, keyPairFor)
    if (typeof session.ready === 'function' &&
        session.__tracPeerSignedReadyInstalled !== true) {
        const ready = session.ready.bind(session)
        Object.defineProperty(session, '__tracPeerSignedReadyInstalled', {
            value: true,
            enumerable: false,
            configurable: false
        })
        session.ready = async (...args) => {
            const result = await ready(...args)
            installSignedAutobaseCoreStorage(session.core)
            installSignedAutobaseSessionState(session, keyPairFor)
            return result
        }
    }

    if (typeof session.session === 'function' &&
        session.__tracPeerSignedChildSessionInstalled !== true) {
        const createChildSession = session.session.bind(session)
        Object.defineProperty(session, '__tracPeerSignedChildSessionInstalled', {
            value: true,
            enumerable: false,
            configurable: false
        })
        session.session = (...args) => installSignedAutobaseSession(createChildSession(...args), keyPairFor)
    }
    return session
}

const installSignedAutobaseView = (view, keyPairFor) => {
    if (!view || typeof view.createSession !== 'function') return view
    if (view.__tracPeerSignedViewInstalled === true) return view

    const createSession = view.createSession.bind(view)
    Object.defineProperty(view, '__tracPeerSignedViewInstalled', {
        value: true,
        enumerable: false,
        configurable: false
    })
    view.createSession = (...args) => {
        const session = createSession(...args)
        installSignedAutobaseSession(view.core, keyPairFor)
        installSignedAutobaseSession(view.batch, keyPairFor)
        installSignedAutobaseSession(view.atomicBatch, keyPairFor)
        return installSignedAutobaseSession(session, keyPairFor)
    }
    return view
}

const installSignedAutobaseStore = (store, keyPairFor = null) => {
    if (!store) return store
    if (store.__tracPeerSignedLocalStoreInstalled === true) return store

    const resolveKeyPair = typeof keyPairFor === 'function'
        ? keyPairFor
        : () => keyPairFor ?? store.base?.local?.keyPair ?? store.base?.local?.core?.header?.keyPair ?? null
    const getLocal = typeof store.getLocal === 'function'
        ? store.getLocal.bind(store)
        : null
    const getViewByName = typeof store.getViewByName === 'function'
        ? store.getViewByName.bind(store)
        : null
    const getViewCore = typeof store.getViewCore === 'function'
        ? store.getViewCore.bind(store)
        : null
    const get = typeof store.get === 'function'
        ? store.get.bind(store)
        : null
    Object.defineProperty(store, '__tracPeerSignedLocalStoreInstalled', {
        value: true,
        enumerable: false,
        configurable: false
    })
    if (getLocal) {
        store.getLocal = (...args) => installSignedAutobaseSession(getLocal(...args), resolveKeyPair)
    }
    if (getViewByName) {
        store.getViewByName = (...args) => installSignedAutobaseView(getViewByName(...args), resolveKeyPair)
    }
    if (getViewCore) {
        store.getViewCore = (...args) => installSignedAutobaseSession(getViewCore(...args), resolveKeyPair)
    }
    if (get) {
        store.get = (...args) => installSignedAutobaseSession(get(...args), resolveKeyPair)
    }
    if (typeof store.atomize === 'function' &&
        store.__tracPeerSignedAtomizeInstalled !== true) {
        const atomize = store.atomize.bind(store)
        Object.defineProperty(store, '__tracPeerSignedAtomizeInstalled', {
            value: true,
            enumerable: false,
            configurable: false
        })
        store.atomize = (...args) => installSignedAutobaseStore(atomize(...args), resolveKeyPair)
    }
    return store
}

const installSignedLocalAutobaseAppend = (base) => {
    if (!base?._viewStore) return base
    return installSignedAutobaseStore(base._viewStore, () => base.local?.keyPair ?? base.local?.core?.header?.keyPair ?? null)
}

const installNonNullAutobaseAck = (base) => {
    if (!base || typeof base.append !== 'function') return base
    if (base.__tracPeerNonNullAckInstalled === true) return base

    const append = base.append.bind(base)
    Object.defineProperty(base, '__tracPeerNonNullAckInstalled', {
        value: true,
        enumerable: false,
        configurable: false
    })
    base.append = (value, ...args) => append(value === null ? createAckOperation() : value, ...args)
    installSignedLocalAutobaseAppend(base)
    return base
}

class Updater {
    #base
    #scheduler
    #isInterrupted
    #processIntervalMs

    constructor({ base }, config = {}) {
        this.#base = base
        this.#processIntervalMs = Number(config?.updaterIntervalMs ?? PROCESS_INTERVAL_MS)
    }

    async start() {
        if (this.#scheduler?.isRunning) {
            console.info('Updater is already started');
            return;
        }

        if (!this.#scheduler) {
            this.#scheduler = this.#createScheduler();
        }
        this.#scheduler.start();
    }

    async #worker(next) {
        await this.#update();
        next(this.#processIntervalMs);
    }

    async #update() {
        if (!this.#shouldRun()) return

        if (this.#base.view.core.length > this.#base.view.core.signedLength)
            await this.#base.append(createAckOperation())
    }

    #createScheduler() {
        return new Scheduler((next) => this.#worker(next), this.#processIntervalMs);
    }

    #sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    #shouldRun() {
        return this.#base.isIndexer && !this.#isInterrupted
    }

    async stop(waitForCurrent = true) {
        this.#isInterrupted = true;
        await this.#scheduler.stop(waitForCurrent);
        console.info('Updater: closing gracefully...');
    }
}

export { Updater, ACK_OPERATION_TYPE, createAckOperation, installNonNullAutobaseAck, installSignedAutobaseStore, installSignedCorestoreStorageFactory }
