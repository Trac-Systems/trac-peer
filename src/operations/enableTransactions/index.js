import { jsonStringify } from '../../functions.js';

export class EnableTransactionsOperation {
    #wallet
    #check

    constructor({ wallet, check }) {
        this.#check = check
        this.#wallet = wallet
    }

    async handle(op, batch, base, node) {
        if(false === this.#check.enableTransactions(op)) return;
        const admin = await batch.get('admin');
        const strValue = jsonStringify(op.value);
        if(null !== admin && null !== strValue &&
            null === await batch.get(`sh/${op.hash}`)){
            const verified = this.#wallet.verify(op.hash, `${strValue}${op.nonce}`, admin.value);
            if(true === verified) {
                await batch.put('txen', op.value.dispatch.enabled);
                await batch.put(`sh/${op.hash}`, '');
                console.log(`Changed transactions enabled ${op.value.dispatch.enabled}`);
            }
        }
    }
}
