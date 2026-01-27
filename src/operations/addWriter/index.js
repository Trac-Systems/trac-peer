import b4a from 'b4a';
import { AddWriterCheck } from './check.js';
import { jsonStringify } from '../../functions.js';

const check = new AddWriterCheck();

export class AddWriterOperation {
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
        // Membership apply: admin-signed add writer (Autobase writer with isIndexer: false).
        if(false === this.#check.validate(op)) return;
        const strMsg = jsonStringify(op.value.msg);
        const admin = await batch.get('admin');
        if(null !== admin && op.value.msg.key === op.key && op.value.msg.type === 'addWriter' && null === await batch.get(`sh/${op.hash}`)) {
            const verified = this.#wallet.verify(op.hash, `${strMsg}${op.nonce}`, admin.value);
            if(true === verified){
                const writerKey = b4a.from(op.key, 'hex');
                await base.addWriter(writerKey, { isIndexer : false });
                await batch.put(`sh/${op.hash}`, '');
                console.log(`Writer added: ${op.key}`);
            }
        }
    }
}
