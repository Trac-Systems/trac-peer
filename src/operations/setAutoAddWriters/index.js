import { jsonStringify } from '../../functions.js';

export class SetAutoAddWritersOperation {
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
        // Membership config apply: admin-signed toggle for auto-adding writers.
        if(false === this.#check.setAutoAddWriters(op)) return;
        const strMsg = jsonStringify(op.value.msg);
        const admin = await batch.get('admin');
        if(null !== admin && op.value.msg.key === op.key &&
            op.value.msg.type === 'setAutoAddWriters' &&
            (op.key === 'on' || op.key === 'off') &&
            null === await batch.get(`sh/${op.hash}`)) {
            const verified = this.#wallet.verify(op.hash, `${strMsg}${op.nonce}`, admin.value);
            if(true === verified){
                await batch.put('auto_add_writers', op.key);
                await batch.put(`sh/${op.hash}`, '');
                console.log(`Set auto_add_writers: ${op.key}`);
            }
        }
    }
}
