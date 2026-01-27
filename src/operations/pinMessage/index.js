import { jsonStringify } from '../../functions.js';

export class PinMessageOperation {
    #check
    #wallet

    constructor({ check, wallet }) {
        this.#check = check
        this.#wallet = wallet
    }

    async handle(op, batch, base, node) {
        // Chat moderation apply: admin/mod-signed pin/unpin (by pinned flag).
        if(false === this.#check.pinMessage(op)) return;
        const strValue = jsonStringify(op.value);
        if(null !== strValue &&
            null === await batch.get(`sh/${op.hash}`)){
            const mod = await batch.get(`mod/${op.value.dispatch.address}`);
            const message = await batch.get(`msg/${op.value.dispatch.id}`);
            if(null !== message && null !== message.value) {
                const admin = await batch.get('admin');
                let modVerified = false;
                if(null !== mod && true === mod.value) {
                    modVerified = this.#wallet.verify(op.hash, `${strValue}${op.nonce}`, op.value.dispatch.address);
                }
                const verified = this.#wallet.verify(op.hash, `${strValue}${op.nonce}`, admin.value);
                if(true === verified || true === modVerified) {
                    if(null === message.value.pin_id){
                        let pinLen = await batch.get('pnl');
                        if(null === pinLen) {
                            pinLen = 0;
                        } else {
                            pinLen = pinLen.value;
                        }
                        message.value.pin_id = pinLen;
                        await batch.put(`pni/${pinLen}`, { msg : op.value.dispatch.id, pinned : op.value.dispatch.pinned });
                        await batch.put('pnl', pinLen + 1);
                    } else {
                        await batch.put(`pni/${message.value.pin_id}`, { msg : op.value.dispatch.id, pinned : op.value.dispatch.pinned });
                    }
                    message.value.pinned = op.value.dispatch.pinned;
                    await batch.put(`msg/${op.value.dispatch.id}`, message.value);
                    await batch.put(`sh/${op.hash}`, '');
                    console.log(`Pinned message ${op.value.dispatch.id} by ${op.value.dispatch.address}`);
                }
            }
        }
    }
}
