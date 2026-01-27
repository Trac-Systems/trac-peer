import b4a from 'b4a';
import { AddAdminCheck } from './check.js';

const check = new AddAdminCheck();

export class AddAdminOperation {
    #config
    #check

    constructor({ config }) {
        this.#check = check
        this.#config = config
    }

    async handle(op, batch, base, node) {
        // Admin apply: bootstrap node can set the initial admin once.
        if(false === this.#check.validate(op)) return;
        const bootstrapWriterKeyHex = b4a.toString(node.from.key, 'hex');
        const subnetBootstrapHex = (b4a.isBuffer(this.#config.bootstrap) ? this.#config.bootstrap.toString('hex') : `${this.#config.bootstrap}`).toLowerCase();
        if(null === await batch.get('admin') && bootstrapWriterKeyHex === subnetBootstrapHex){
            await batch.put('admin', op.key);
            console.log(`Admin added: ${op.key}`);
        }
    }
}
