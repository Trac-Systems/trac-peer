import { jsonStringify } from '../../functions.js';
import { SetModCheck } from './check.js';

const check = new SetModCheck();

export class SetModOperation {
    #check
    #wallet

    constructor({ wallet }) {
        this.#check = check
        this.#wallet = wallet
    }

    async handle(op, batch, base, node) {
        // Chat moderation apply: admin-signed set/unset mod role.
        if(false === this.#check.validate(op)) return;
        const admin = await batch.get('admin');
        const strValue = jsonStringify(op.value);
        if(null !== admin && null !== strValue &&
            null === await batch.get(`sh/${op.hash}`)){
            const verified = this.#wallet.verify(op.hash, `${strValue}${op.nonce}`, admin.value);
            if(true === verified) {
                await batch.put(`mod/${op.value.dispatch.user}`, op.value.dispatch.mod);
                await batch.put(`sh/${op.hash}`, '');
                console.log(`Changed mod status ${op.value.dispatch.user} to ${op.value.dispatch.mod}`);
            }
        }
    }
}
