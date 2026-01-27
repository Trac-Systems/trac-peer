import b4a from 'b4a';
import { jsonStringify } from '../../functions.js';

export class MsgOperation {
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
        // Chat apply: user-signed message + whitelist/mute checks + replay protection.
        if (b4a.byteLength(jsonStringify(op)) > this.#protocolInstance.msgMaxBytes()) return;
        if (false === this.#check.msg(op)) return;
        const admin = await batch.get('admin');
        let muted = false;
        let whitelisted = true;
        const whitelistStatus = await batch.get('wlst');
        if (null !== whitelistStatus && true === whitelistStatus.value) {
            const whitelistedEntry = await batch.get(`wl/${op.value.dispatch.address}`);
            if (null === whitelistedEntry || false === whitelistedEntry.value) {
                whitelisted = false;
            }
        }
        const muteStatus = await batch.get(`mtd/${op.value.dispatch.address}`);
        if (null !== muteStatus) {
            muted = muteStatus.value;
        }
        if (null !== admin && admin.value === op.value.dispatch.address) {
            muted = false;
            whitelisted = true;
        }
        const strValue = jsonStringify(op.value);
        const chatStatus = await batch.get('chat_status');
        const verified = this.#wallet.verify(op.hash, `${strValue}${op.nonce}`, op.value.dispatch.address);

        if (true === verified && false === muted && true === whitelisted && null !== strValue && null !== chatStatus && null === await batch.get(`sh/${op.hash}`) && chatStatus.value === 'on' && null === this.#protocolInstance.getError(await this.#contractInstance.execute(op, batch))) {
            let len = await batch.get('msgl');
            if (null === len) {
                len = 0;
            } else {
                len = len.value;
            }

            let userLen = await batch.get(`umsgl/${op.value.dispatch.address}`);
            if (null === userLen) {
                userLen = 0;
            } else {
                userLen = userLen.value;
            }

            await batch.put(`msg/${len}`, op.value.dispatch);
            await batch.put(`umsg/${op.value.dispatch.address}/${userLen}`, `msg/${len}`);
            await batch.put('msgl', len + 1);
            await batch.put(`umsgl/${op.value.dispatch.address}`, userLen + 1);
            await batch.put(`sh/${op.hash}`, '');
            const nick = await batch.get(`nick/${op.value.dispatch.address}`);
            console.log(`#${len + 1} | ${nick !== null ? nick.value : op.value.dispatch.address}: ${op.value.dispatch.msg}`);
        }
    }
}
