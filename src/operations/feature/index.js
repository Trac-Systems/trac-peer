import b4a from 'b4a';
import { jsonStringify } from '../../functions.js';
import { FeatureCheck } from './check.js';

const check = new FeatureCheck();

export class FeatureOperation {
    #check
    #wallet
    #protocolInstance
    #contractInstance

    constructor({ wallet, protocolInstance, contractInstance }) {
        this.#check = check
        this.#wallet = wallet
        this.#protocolInstance = protocolInstance
        this.#contractInstance = contractInstance
    }

    async handle(op, batch, base, node) {
        // Feature apply: admin-signed feature/contract op (replay-protected by sh/<hash>).
        if(b4a.byteLength(jsonStringify(op)) > this.#protocolInstance.featMaxBytes()) return;
        if(false === this.#check.validate(op)) return;
        const strDispatchValue = jsonStringify(op.value.dispatch.value);
        const admin = await batch.get('admin');
        if(null !== admin &&
            null === await batch.get(`sh/${op.value.dispatch.hash}`)){
            const verified = this.#wallet.verify(op.value.dispatch.hash, `${strDispatchValue}${op.value.dispatch.nonce}`, admin.value);
            if(true === verified) {
                await this.#contractInstance.execute(op, batch);
                await batch.put(`sh/${op.value.dispatch.hash}`, '');
                //console.log(`Feature ${op.key} appended`);
            }
        }
    }
}
