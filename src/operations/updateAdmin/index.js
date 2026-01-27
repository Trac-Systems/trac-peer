import { jsonStringify } from '../../functions.js';

export class UpdateAdminOperation {
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
        // Admin apply: current admin transfers admin rights (replay-protected by sh/<hash>).
        if(false === this.#check.updateAdmin(op)) return;
        const admin = await batch.get('admin');
        const strValue = jsonStringify(op.value);
        if(null !== admin && null !== strValue &&
            null === await batch.get(`sh/${op.hash}`)){
            const verified = this.#wallet.verify(op.hash, `${strValue}${op.nonce}`, admin.value);
            if(true === verified) {
                await batch.put('admin', op.value.dispatch.admin);
                await batch.put(`sh/${op.hash}`, '');
                console.log(`Changed admin ${admin.value} to ${op.value.dispatch.admin}`);
            }
        }
    }
}
