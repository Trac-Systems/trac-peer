import { jsonStringify } from '../../functions.js';

export class EnableWhitelistOperation {
    #wallet
    #check

    constructor({ wallet, check }) {
        this.#check = check
        this.#wallet = wallet
    }

    async handle(op, batch, base, node) {
        // Chat whitelist config apply: admin-signed enable/disable whitelist enforcement.
        if(false === this.#check.enableWhitelist(op)) return;
        const admin = await batch.get('admin');
        const strValue = jsonStringify(op.value);
        if(null !== admin && null !== strValue &&
            null === await batch.get(`sh/${op.hash}`)){
            const verified = this.#wallet.verify(op.hash, `${strValue}${op.nonce}`, admin.value);
            if(true === verified) {
                await batch.put('wlst', op.value.dispatch.enabled);
                await batch.put(`sh/${op.hash}`, '');
                console.log(`Changed whitelist enabled ${op.value.dispatch.enabled}`);
            }
        }
    }
}
