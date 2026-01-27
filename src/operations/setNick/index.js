import b4a from 'b4a';
import { jsonStringify, visibleLength } from '../../functions.js';
import { SetNickCheck } from './check.js';

const check = new SetNickCheck();

export class SetNickOperation {
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
        // Chat apply: nickname changes (user/mod/admin-signed, uniqueness-enforced).
        if(false === this.#check.validate(op)) return;
        const taken = await batch.get(`kcin/${op.value.dispatch.nick}`);
        const chatStatus = await batch.get('chat_status');
        const strValue = jsonStringify(op.value);
        const admin = await batch.get('admin');
        const mod = await batch.get(`mod/${op.value.dispatch.initiator}`);
        let adminVerified = false;
        if(null !== admin) {
            adminVerified = this.#wallet.verify(op.hash, `${strValue}${op.nonce}`, admin.value);
        }
        let modVerified = false;
        if(null !== mod && true === mod.value && op.value.dispatch.address !== op.value.dispatch.initiator) {
            const targetMod = await batch.get(`mod/${op.value.dispatch.address}`);
            if((null === targetMod || false === targetMod.value) && (null === admin || admin.value !== op.value.dispatch.address)){
                modVerified = this.#wallet.verify(op.hash, `${strValue}${op.nonce}`, op.value.dispatch.initiator);
            }
        }
        const verified = this.#wallet.verify(op.hash, `${strValue}${op.nonce}`, op.value.dispatch.address);
        if(null === taken &&
            null !== strValue &&
            ( true === verified || true === modVerified || true === adminVerified ) &&
            null !== chatStatus &&
            chatStatus.value === 'on' &&
            null === await batch.get(`sh/${op.hash}`) &&
            b4a.byteLength(strValue) <= 256 &&
            visibleLength(op.value.dispatch.nick) <= 32){
            const old = await batch.get(`nick/${op.value.dispatch.address}`);
            if(old !== null){
                await batch.del(`nick/${op.value.dispatch.address}`);
                await batch.del(`kcin/${old.value}`);
            }
            await batch.put(`nick/${op.value.dispatch.address}`, op.value.dispatch.nick);
            await batch.put(`kcin/${op.value.dispatch.nick}`, op.value.dispatch.address);
            await batch.put(`sh/${op.hash}`, '');
            console.log(`Changed nick to ${op.value.dispatch.nick} (${op.value.dispatch.address})`);
        }
    }
}
