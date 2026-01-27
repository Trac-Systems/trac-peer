import { jsonStringify } from '../../functions.js';

export class SetChatStatusOperation {
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
        // Chat config apply: admin-signed chat on/off toggle.
        if(false === this.#check.setChatStatus(op)) return;
        const strMsg = jsonStringify(op.value.msg);
        const admin = await batch.get('admin');
        if(null !== admin && op.value.msg.key === op.key && op.value.msg.type === 'setChatStatus' && (op.key === 'on' || op.key === 'off') && null === await batch.get(`sh/${op.hash}`)) {
            const verified = this.#wallet.verify(op.hash, `${strMsg}${op.nonce}`, admin.value);
            if(true === verified){
                await batch.put('chat_status', op.key);
                await batch.put(`sh/${op.hash}`, '');
                console.log(`Set chat_status: ${op.key}`);
            }
        }
    }
}
