import b4a from 'b4a';

export class AutoAddWritersOperation {
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
        if(false === this.#check.key(op)) return;
        const autoAddWriters = await batch.get('auto_add_writers');
        const banned = await batch.get(`bnd/${op.key}`);
        if(null === banned && null !== autoAddWriters && autoAddWriters.value === 'on'){
            const writerKey = b4a.from(op.key, 'hex');
            await base.addWriter(writerKey, { isIndexer : false });
        }
        console.log(`Writer auto added: ${op.key}`);
    }
}
