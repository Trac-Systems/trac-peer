import { jsonStringify } from '../../functions.js';

export class MuteStatusOperation {
    #check
    #wallet
    #protocolInstance
    #contractInstance

    constructor({ check, wallet, protocolInstance, contractInstance }) {
        this.#check = check
        this.#wallet = wallet
        this.#protocolInstance = protocolInstance
        this.#contractInstance = contractInstance
    }

    async handle(op, batch, base, node) {
        // Chat moderation apply: admin/mod-signed mute/unmute (stored under mtd/<user>).
        if(false === this.#check.mute(op)) return;
        const admin = await batch.get('admin');
        const strValue = jsonStringify(op.value);
        if(null !== strValue &&
            null === await batch.get(`sh/${op.hash}`)){
            const mod = await batch.get(`mod/${op.value.dispatch.address}`);
            let modVerified = false;
            if(null !== mod && true === mod.value && admin.value !== op.value.dispatch.user) {
                const targetMod = await batch.get(`mod/${op.value.dispatch.user}`);
                if(null === targetMod || false === targetMod.value) {
                    modVerified = this.#wallet.verify(op.hash, `${strValue}${op.nonce}`, op.value.dispatch.address);
                }
            }
            const verified = this.#wallet.verify(op.hash, `${strValue}${op.nonce}`, admin.value);
            if(true === verified || true === modVerified) {
                await batch.put(`mtd/${op.value.dispatch.user}`, op.value.dispatch.muted);
                await batch.put(`sh/${op.hash}`, '');
                console.log(`Changed mute status ${op.value.dispatch.user} to ${op.value.dispatch.muted}`);
            }
        }
    }
}
