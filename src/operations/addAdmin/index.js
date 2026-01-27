import b4a from 'b4a';

export class AddAdminOperation {
    #bootstrap
    #check

    constructor({ bootstrap, check }) {
        this.#check = check
        this.#bootstrap = bootstrap
    }

    async handle(op, batch, base, node) {
        // Admin apply: bootstrap node can set the initial admin once.
        if(false === this.#check.key(op)) return;
        const bootstrapWriterKeyHex = b4a.toString(node.from.key, 'hex');
        const subnetBootstrapHex = (b4a.isBuffer(this.#bootstrap) ? this.#bootstrap.toString('hex') : `${this.#bootstrap}`).toLowerCase();
        if(null === await batch.get('admin') && bootstrapWriterKeyHex === subnetBootstrapHex){
            await batch.put('admin', op.key);
            console.log(`Admin added: ${op.key}`);
        }
    }
}
