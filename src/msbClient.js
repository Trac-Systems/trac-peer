import b4a from 'b4a';
import PeerWallet from 'trac-wallet';
import ReadyResource from 'ready-resource';
import PartialTransactionValidator from 'trac-msb/src/core/network/protocols/shared/validators/PartialTransactionValidator.js';
import { normalizeTransactionOperation } from 'trac-msb/src/utils/normalizers.js';
import { createReadRecovery } from './network/readRecovery.js';

export const MSB_OPERATION_TYPE = Object.freeze({
    BOOTSTRAP_DEPLOYMENT: 11,
    TX: 12,
});

export class MsbClient extends ReadyResource {
    #msb
    #partialTransactionValidator
    #readSliceMs
    #onReadStall
    #log
    #now

    constructor(msbInstance, { readSliceMs = 30000, onReadStall = null, log = console.log, now = Date.now } = {}) {
        super();
        this.#msb = msbInstance || null;
        this.#partialTransactionValidator = null;
        this.#readSliceMs = readSliceMs;
        this.#onReadStall = onReadStall;
        this.#log = log;
        this.#now = now;
    }

    async _open() {
        await this.#msb.ready()
        this.#partialTransactionValidator = new PartialTransactionValidator(this.#msb.state, null, this.#msb.config)
        const swarm = this.#msb.network?.swarm;
        const topic = this.#msb.config?.channel;
        if (this.#onReadStall === null && swarm && topic) {
            this.#onReadStall = createReadRecovery({
                base: this.#msb.state.base, swarm, topic, label: 'MSB', rotate: false,
                now: this.#now, log: this.#log,
            });
        }
    }

    recoverRead(event) {
        try { return this.#onReadStall?.(event) ?? false; }
        catch { return false; }
    }

    #report(event) {
        try { this.#log(`[trac-peer] ${JSON.stringify({ chain: 'MSB', ...event })}`); }
        catch {}
    }

    #orchestratorCompatiblePayload(payload) {
        if (!payload || typeof payload !== 'object') return payload;
        if (payload.tro && payload.tro.tx) return payload;
        const tx =
            payload?.tro?.tx ??
            payload?.txo?.tx ??
            payload?.bdo?.tx ??
            payload?.rao?.tx ??
            null;
        if (!tx) return payload;
        return { ...payload, tro: { ...(payload.tro || {}), tx } };
    }

    get addressPrefix() {
        return this.#msb.config.addressPrefix
    }

    get derivationPath() {
        return this.#msb.config.derivationPath
    }

    get networkId() {
        return this.#msb.config.networkId
    }

    get bootstrapHex() {
        const buf = this.#msb.config.bootstrap
        return b4a.isBuffer(buf) ? buf.toString('hex') : null;
    }

    async getTxvHex() {
        const txv = await this.#msb.state.getIndexerSequenceState();
        return txv.toString('hex');
    }

    pubKeyHexToAddress(pubKeyHex) {
        return PeerWallet.encodeBech32mSafe(this.addressPrefix, b4a.from(pubKeyHex, 'hex'));
    }

    addressToPubKeyHex(address) {
        const decoded = PeerWallet.decodeBech32mSafe(address);
        return b4a.toString(decoded, 'hex');
    }

    getSignedLength() {
        return this.#msb.state.getSignedLength();
    }

    getUnsignedLength() {
        return this.#msb.state.getUnsignedLength();
    }

    getFee() {
        if (typeof this.#msb.state.getFee !== 'function') return null;
        return this.#msb.state.getFee();
    }

    async getNodeEntryUnsigned(address) {
        return await this.#msb.state.getNodeEntryUnsigned(address);
    }

    getConnectedValidatorsCount() {
        try {
            return this.#msb.network?.validatorConnectionManager?.connectionCount?.() ?? 0;
        } catch (_e) {
            return 0;
        }
    }

    async tryConnect(pubKeyHex, role = 'validator') {
        return await this.#msb.network.tryConnect(pubKeyHex, role);
    }

    async waitForSignedLengthAtLeast(targetSignedLength, { pollMs = 1_000 } = {}) {
        const core = this.#msb.state?.base?.view?.core ?? null;
        if (!core) throw new Error('MSB view core not available.');
        if (!Number.isSafeInteger(targetSignedLength) || targetSignedLength < 0) {
            throw new Error('Invalid MSB signed length target.');
        }
        if (!Number.isSafeInteger(pollMs) || pollMs < 1) {
            throw new Error('Invalid MSB signed length wait poll interval.');
        }
        const started = this.#now();
        const reporter = setInterval(() => this.#report({
            event: 'msb_wait_signed_length', msbsl: targetSignedLength,
            signedLength: core.signedLength, elapsedMs: Math.max(0, this.#now() - started),
        }), this.#readSliceMs);
        reporter.unref?.();
        try {
            while (core.signedLength < targetSignedLength) {
                await new Promise((resolve) => {
                    const onAppend = () => {
                        cleanup();
                        resolve();
                    };
                    const cleanup = () => {
                        clearTimeout(timer);
                        if (typeof core.off === 'function') {
                            core.off('append', onAppend);
                        } else if (typeof core.removeListener === 'function') {
                            core.removeListener('append', onAppend);
                        }
                    };
                    const timer = setTimeout(() => {
                        cleanup();
                        resolve();
                    }, pollMs);
                    core.once('append', onAppend);
                });
            }
        } finally { clearInterval(reporter); }
    }

    async getSignedAtLength(key, signedLength) {
        const started = this.#now();
        for (let attempt = 1; ; attempt++) {
            let waitingSeq = null;
            const base = this.#msb.state.base;
            const viewSession = base.view.checkout(signedLength);
            try {
                return await viewSession.get(key, {
                    timeout: this.#readSliceMs,
                    onwait: seq => { waitingSeq = seq; },
                    onseq: () => { waitingSeq = null; },
                });
            } catch (error) {
                if (error?.code !== 'REQUEST_TIMEOUT' || base.closing || base.closed) throw error;
                const core = base.view.core;
                const event = {
                    code: 'MSB_APPLY_READ_STALLED', event: 'msb_read_stalled', key, msbsl: signedLength,
                    attempt, waitingSeq, signedLength: core?.signedLength ?? null,
                    corePeers: core?.peers?.length ?? 0,
                    coreKey: core?.key ? b4a.toString(core.key, 'hex') : null,
                    elapsedMs: Math.max(0, this.#now() - started),
                };
                this.#report(event);
                try { this.emit('read-stall', event); } catch {}
                this.recoverRead(event);
            } finally {
                // Closing a checkout must not replace the read's result or error.
                try { await viewSession.close(); } catch {}
            }
        }
    }

    async validateTransaction(payload) {
        try {
            const normalized = normalizeTransactionOperation(payload, this.#msb.config);
            await this.#partialTransactionValidator.validate(normalized);
            return true;
        } catch (e) {
            const msg = typeof e?.message === 'string' ? e.message : 'MSB transaction validation failed.';
            throw new Error(`Invalid MSB tx: ${msg}`);
        }
    }

    async broadcastTransaction(payload) {
        const safePayload = this.#orchestratorCompatiblePayload(payload);
        const ok = await this.#msb.network.validatorMessageOrchestrator.send(safePayload);
        return { message: ok ? 'Transaction broadcasted successfully.' : 'Transaction broadcast failed.', tx: null };
    }

    async broadcastBootstrapDeployment(payload) {
        const safePayload = this.#orchestratorCompatiblePayload(payload);
        return await this.#msb.network.validatorMessageOrchestrator.send(safePayload);
    }
}
