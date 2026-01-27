import { jsonStringify } from '../../functions.js';
import { SetWhitelistStatusCheck } from './check.js';

const check = new SetWhitelistStatusCheck();

export class SetWhitelistStatusOperation {
    #wallet
    #check

    constructor({ wallet }) {
        this.#check = check
        this.#wallet = wallet
    }

    async handle(op, batch, base, node) {
        // Chat whitelist apply: admin-signed add/remove address from whitelist.
        if(false === this.#check.validate(op)) return;
        const admin = await batch.get('admin');
        const strValue = jsonStringify(op.value);
        if(null !== admin && null !== strValue &&
            null === await batch.get(`sh/${op.hash}`)){
            const verified = this.#wallet.verify(op.hash, `${strValue}${op.nonce}`, admin.value);
            if(true === verified) {
                await batch.put(`wl/${op.value.dispatch.user}`, op.value.dispatch.status);
                await batch.put(`sh/${op.hash}`, '');
                console.log(`Changed whitelist status ${op.value.dispatch.user} to ${op.value.dispatch.status}`);
            }
        }
    }
}
