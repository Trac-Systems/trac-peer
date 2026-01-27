import { jsonStringify } from '../../functions.js';

export class UnpinMessageOperation {
    #check
    #wallet

    constructor({ check, wallet }) {
        this.#check = check
        this.#wallet = wallet
    }

    async handle(op, batch, base, node) {
        // Chat moderation apply: admin/mod-signed unpin.
        if(false === this.#check.unpinMessage(op)) return;
        const strValue = jsonStringify(op.value);
        if(null !== strValue &&
            null === await batch.get(`sh/${op.hash}`)){
            const mod = await batch.get(`mod/${op.value.dispatch.address}`);
            const pin = await batch.get(`pni/${op.value.dispatch.id}`);
            if(null !== pin) {
                const admin = await batch.get('admin');
                let modVerified = false;
                if(null !== mod && true === mod.value) {
                    modVerified = this.#wallet.verify(op.hash, `${strValue}${op.nonce}`, op.value.dispatch.address);
                }
                const verified = this.#wallet.verify(op.hash, `${strValue}${op.nonce}`, admin.value);
                if(true === verified || true === modVerified) {
                    const message = await batch.get(`msg/${pin.value.msg}`)
                    if(null !== message){
                        message.value.pinned = false;
                        message.value.pin_id = null;
                        await batch.put(`msg/${pin.value.msg}`, message.value);
                        await batch.put(`pni/${op.value.dispatch.id}`, { msg : pin.value.msg, pinned : false });
                    }
                    await batch.put(`sh/${op.hash}`, '');
                    console.log(`Unpinned message ${pin.value.msg} by ${op.value.dispatch.address}`);
                }
            }
        }
    }
}
