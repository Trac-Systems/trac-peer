import b4a from 'b4a';
import { TRAC_NETWORK_MSB_MAINNET_PREFIX } from 'trac-wallet/constants.js';
import PeerWallet from 'trac-wallet';

export const MSB_OPERATION_TYPE = Object.freeze({
    BOOTSTRAP_DEPLOYMENT: 11,
    TX: 12,
});

export class MsbClient {
    constructor(msbInstance) {
        this.msb = msbInstance || null;
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

    isReady() {
        return !!(this.msb && this.msb.state && this.msb.network && (this.msb.config || this.msb.options || this.msb.bootstrap));
    }

    get addressPrefix() {
        if (!this.isReady()) return null;
        const fromConfig = this.msb.config?.addressPrefix;
        if (fromConfig) return fromConfig;
        const addr = this.msb.wallet?.address;
        if (typeof addr === 'string') {
            const i = addr.indexOf('1');
            if (i > 0) return addr.slice(0, i);
        }
        return TRAC_NETWORK_MSB_MAINNET_PREFIX;
    }

    get networkId() {
        if (!this.isReady()) return null;
        return this.msb.config?.networkId ?? this.msb.options?.networkId ?? this.msb.options?.network_id ?? 918;
    }

    get bootstrapHex() {
        if (!this.isReady()) return null;
        const buf = this.msb.config?.bootstrap ?? this.msb.bootstrap;
        return b4a.isBuffer(buf) ? buf.toString('hex') : null;
    }

    async getTxvHex() {
        if (!this.isReady()) return null;
        const txv = await this.msb.state.getIndexerSequenceState();
        return txv.toString('hex');
    }

    pubKeyHexToAddress(pubKeyHex) {
        if (!this.addressPrefix) return null;
        return PeerWallet.encodeBech32mSafe(this.addressPrefix, b4a.from(pubKeyHex, 'hex'));
    }

    addressToPubKeyHex(address) {
        const decoded = PeerWallet.decodeBech32mSafe(address);
        if (!decoded) return null;
        return b4a.toString(decoded, 'hex');
    }

    getSignedLength() {
        if (!this.isReady()) return 0;
        return this.msb.state.getSignedLength();
    }

    async getSignedAtLength(key, signedLength) {
        if (!this.isReady()) return null;
        const viewSession = this.msb.state.base.view.checkout(signedLength);
        try {
            return await viewSession.get(key);
        } finally {
            await viewSession.close();
        }
    }

    async broadcastTransaction(payload) {
        if (!this.isReady()) throw new Error('MSB is not ready.');
        const safePayload = this.#orchestratorCompatiblePayload(payload);
        if (typeof this.msb.broadcastTransactionCommand === 'function') {
            return await this.msb.broadcastTransactionCommand(safePayload);
        }
        if (this.msb.network?.validatorMessageOrchestrator?.send) {
            const ok = await this.msb.network.validatorMessageOrchestrator.send(safePayload);
            return { message: ok ? 'Transaction broadcasted successfully.' : 'Transaction broadcast failed.', tx: null };
        }
        throw new Error('MSB does not support transaction broadcasting.');
    }

    async broadcastBootstrapDeployment(payload) {
        if (!this.isReady()) throw new Error('MSB is not ready.');
        const safePayload = this.#orchestratorCompatiblePayload(payload);
        if (this.msb.network?.validatorMessageOrchestrator?.send) {
            return await this.msb.network.validatorMessageOrchestrator.send(safePayload);
        }
        if (typeof this.msb.broadcastPartialTransaction === 'function') {
            return await this.msb.broadcastPartialTransaction(safePayload);
        }
        throw new Error('MSB does not support bootstrap deployment broadcasting.');
    }
}
