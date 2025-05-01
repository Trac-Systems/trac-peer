import b4a from "b4a";
import {jsonStringify} from "./functions.js";

export class ProtocolApi{

    /**
     * Exposes read and write functions.
     * May be extended by contract protocol instances.
     *
     * @param peer
     * @param options
     */
    constructor(peer, options = {}) {
        this.peer = peer;
        this.api_tx_exposed = options.api_tx_exposed === true;
        this.api_msg_exposed = options.api_msg_exposed === true;
        this.options = options;
    }

    /**
     *
     * @returns {null|string}
     */
    getPeerValidatorAddress(){
        return this.peer.msb.getNetwork().validator;
    }

    /**
     *
     * @returns {null|string}
     */
    getPeerBootstrap(){
        return this.peer.bootstrap;
    }

    /**
     *
     * @returns {null|string}
     */
    getPeerMsbBootstrap(){
        return this.peer.msb.bootstrap;
    }

    /**
     *
     * @returns {null|string}
     */
    getPeerWriterKey(){
        return this.peer.writerLocalKey;
    }

    /**
     *
     * @returns {string}
     */
    generateNonce(){
        return this.peer.protocol_instance.generateNonce();
    }

    /**
     * @throws Error
     * @param msg
     * @param address
     * @param reply_to
     * @param attachments
     * @returns {{dispatch: {type: string, msg: string, address, attachments: *[], deleted_by: null, reply_to: (number|null), pinned: boolean, pin_id: null}}}
     */
    prepareMessage(msg, address, reply_to = null, attachments = []){
        if(typeof msg !== 'string') throw new Error('Msg must be a string');
        if(b4a.byteLength(jsonStringify(address)) !== 66) throw new Error('Address too large.');
        if(reply_to !== null && isNaN(parseInt(reply_to))) throw new Error('Reply to not a number.');
        if(false === Array.isArray(attachments)) throw new Error('attachments must be an array.');
        if(attachments.length > 20) throw new Error('Too many attachments');
        for(let i = 0; i < attachments.length; i++){
            if(typeof attachments[i] !== 'string') throw new Error('Attachment at index ' + i + ' is not a string.');
        }
        const prepared = {
            dispatch : {
                type : 'msg',
                msg: msg,
                address : address,
                attachments : attachments,
                deleted_by : null,
                reply_to : reply_to !== null ? parseInt(reply_to) : null,
                pinned : false,
                pin_id : null
            }};
        if(b4a.byteLength(jsonStringify(prepared)) > this.peer.protocol_instance.msgMaxBytes()) throw new Error('Message too large.');
        return prepared;
    }

    /**
     *
     * @returns {boolean}
     */
    msgExposed(){
        return true === this.api_msg_exposed;
    }

    /**
     * To post a message, an ed25519 signature has to be provided over the given message + nonce.
     *
     * Signing steps:
     *
     * let address = your_ed25519_wallet.getAccountAddress()
     * let nonce = api.generateNonce()
     * let prepared_message = api.prepareMessage("my message", address)
     * let signature = your_ed25519_wallet.sign(JSON.stringify(prepared_message) + nonce)
     * let result = api.post(prepared_message, signature, nonce)
     *
     * Note: new messages can be read from this api's msg functions.
     *
     * @throws Error
     * @param prepared_message
     * @param signature
     * @param nonce
     * @returns {Promise<void>}
     */
    async post(prepared_message, signature, nonce){
        if(true !== this.api_msg_exposed) throw new Error('Posting messages not exposed in API.');
        if(this.peer.base.writable === false) throw new Error('Peer is not writable.');
        if(b4a.byteLength(jsonStringify(prepared_message)) > this.peer.protocol_instance.msgMaxBytes()) throw new Error('Prepared message too large.');
        if(typeof prepared_message !== 'object') throw new Error('Prepared message must be an object generated with api.prepareMessage().');
        if(prepared_message.dispatch === undefined || prepared_message.dispatch.type === undefined ||
            prepared_message.dispatch.msg === undefined || prepared_message.dispatch.address === undefined ||
            prepared_message.dispatch.attachments === undefined || prepared_message.dispatch.deleted_by === undefined ||
            prepared_message.dispatch.reply_to === undefined || prepared_message.dispatch.pinned === undefined ||
            prepared_message.dispatch.pin_id === undefined) throw new Error('Invalid prepared message.');
        if(prepared_message.dispatch.type !== 'msg') throw new Error('Invalid type.');
        if(typeof prepared_message.dispatch.msg !== 'string') throw new Error('Msg must be a string');
        if(b4a.toString(b4a.from(prepared_message.dispatch.address, 'hex'), 'hex') !== prepared_message.dispatch.address) throw new Error('Invalid address.');
        if(b4a.toString(b4a.from(signature, 'hex'), 'hex') !== signature) throw new Error('Invalid signature.');
        if(b4a.toString(b4a.from(nonce, 'hex'), 'hex') !== nonce) throw new Error('Invalid nonce.');
        if(false === Array.isArray(prepared_message.dispatch.attachments)) throw new Error('attachments must be an array.');
        if(prepared_message.dispatch.attachments.length > 20) throw new Error('Too many attachments');
        for(let i = 0; i < prepared_message.dispatch.attachments.length; i++){
            if(typeof prepared_message.dispatch.attachments[i] !== 'string') throw new Error('Attachment at index ' + i + ' is not a string.');
        }
        if(prepared_message.dispatch.deleted_by !== null) throw new Error('deleted_by must be null');
        if(prepared_message.dispatch.reply_to !== null && isNaN(parseInt(prepared_message.dispatch.reply_to))) throw new Error('Reply to not a number.');
        if(prepared_message.dispatch.pinned !== false) throw new Error('pinned must be false');
        if(prepared_message.dispatch.pin_id !== null) throw new Error('pin_id must be null');
        const verified = this.peer.wallet.verify(signature, JSON.stringify(prepared_message) + nonce, prepared_message.dispatch.address);
        if(false === verified) throw new Error('Invalid signature. Please sign your prepared message.');
        await this.peer.base.append({type: 'msg', value: prepared_message, hash : signature, nonce: nonce });
    }

    /**
     * @throws Error
     * @param address
     * @param command_hash
     * @param nonce
     * @returns {Promise<*>}
     */
    async generateTx(address, command_hash, nonce) {
        if(this.getPeerValidatorAddress() === null) throw new Error('Peer not connected to a validator.');
        return await this.peer.protocol_instance.generateTx(this.getPeerBootstrap(),
            this.getPeerMsbBootstrap(), this.getPeerValidatorAddress(), this.getPeerWriterKey(),
            address, command_hash, nonce);
    }

    /**
     *
     * @param command
     * @returns {*}
     */
    prepareTxCommand(command){
        return this.peer.protocol_instance.mapTxCommand(command);
    }

    /**
     *
     * @returns {boolean}
     */
    txExposed(){
        return true === this.api_tx_exposed;
    }

    /**
     * To broadcast a TX, an ed25519 signature has to be provided over the given tx + nonce.
     *
     * Signing steps:
     *
     * let address = your_ed25519_wallet.getAccountAddress()
     * let nonce = api.generateNonce()
     * let tx_hash = api.generateTx(address, a_sha256_function(JSON.stringify(api.prepareTxCommand(command))), nonce)
     * let signature = your_ed25519_wallet.sign(tx + nonce)
     * // simulating
     * let sim_result = api.tx(tx_hash, api.prepareTxCommand(command), address, signature, nonce, true)
     * // broadcasting
     * let result = api.tx(tx_hash, api.prepareTxCommand(command), address, signature, nonce)
     *
     * @throws Error
     * @param tx
     * @param prepared_command
     * @param address
     * @param signature
     * @param nonce
     * @param sim
     * @returns {Promise<boolean|object>}
     */
    async tx(tx, prepared_command, address, signature, nonce, sim = false ){
        if(true !== this.api_tx_exposed) throw new Error('Transactions not exposed in API.');
        if(this.peer.base.writable === false) throw new Error('Peer is not writable.');
        if(this.getPeerValidatorAddress() === null) throw new Error('Peer not connected to a validator.');
        if(typeof prepared_command !== 'object') throw new Error('prepared_command must be an object.');
        if(typeof prepared_command.type !== 'string') throw new Error('prepared_command.type must exist and be a string.');
        if(prepared_command.value === undefined) throw new Error('prepared_command.value is missing.');
        if(b4a.byteLength(jsonStringify(prepared_command)) > this.peer.protocol_instance.txMaxBytes()) throw new Error('prepared_command too large.');
        if(b4a.byteLength(jsonStringify(address)) !== 66) throw new Error('Address length invalid.');
        if(b4a.byteLength(jsonStringify(signature)) !== 130) throw new Error('Signature length invalid.');
        if(b4a.byteLength(jsonStringify(nonce)) !== 66) throw new Error('Nonce length invalid.');
        if(b4a.toString(b4a.from(address, 'hex'), 'hex') !== address) throw new Error('Invalid address.');
        if(b4a.toString(b4a.from(signature, 'hex'), 'hex') !== signature) throw new Error('Invalid signature.');
        if(b4a.toString(b4a.from(nonce, 'hex'), 'hex') !== nonce) throw new Error('Invalid nonce.');
        const verified = this.peer.wallet.verify(signature, tx + nonce, address);
        if(false === verified) throw new Error('Invalid signature.');
        const content_hash = await this.peer.createHash('sha256', this.peer.protocol_instance.safeJsonStringify(prepared_command));
        let _tx = await this.generateTx(address, content_hash, nonce);
        if(tx !== _tx) throw new Error('Invalid TX.');
        const surrogate = { tx : _tx, nonce : ''+nonce, signature : ''+signature, address : ''+address };
        let res = false;
        try{
            const subject = { command : prepared_command.value, validator : this.getPeerValidatorAddress() };
            res = await this.peer.protocol_instance.tx(subject, sim === true, surrogate);
        } catch(e){ console.log(e) }
        if(res !== false) {
            const err = this.peer.protocol_instance.getError(res);
            if (null !== err) {
                console.log(err.message);
            }
        }
        return res;
    }

    /**
     *
     * @param signed
     * @returns {Promise<null>}
     */
    async getAdmin(signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('admin');
        if(false === signed) res = await this.peer.protocol_instance.get('admin');
        if(null !== res) return res;
        return null;
    }

    /**
     *
     * @param signed
     * @returns {Promise<boolean|null>}
     */
    async getWhitelistEnabled(signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('wlst');
        if(false === signed) res = await this.peer.protocol_instance.get('wlst');
        if(null !== res) return res;
        return false;
    }

    /**
     *
     * @param address
     * @param signed
     * @returns {Promise<boolean|null>}
     */
    async getWhitelistStatus(address, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('wl/'+address);
        if(false === signed) res = await this.peer.protocol_instance.get('wl/'+address);
        if(null !== res) return res;
        return false;
    }

    /**
     *
     * @param address
     * @param signed
     * @returns {Promise<boolean|null>}
     */
    async getModStatus(address, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('mod/'+address);
        if(false === signed) res = await this.peer.protocol_instance.get('mod/'+address);
        if(null !== res) return res;
        return false;
    }

    /**
     *
     * @param address
     * @param signed
     * @returns {Promise<boolean|null>}
     */
    async getMuteStatus(address, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('mtd/'+address);
        if(false === signed) res = await this.peer.protocol_instance.get('mtd/'+address);
        if(null !== res) return res;
        return false;
    }

    /**
     *
     * @param signed
     * @returns {Promise<boolean>}
     */
    async getAutoAddWritersStatus(signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('auto_add_writers');
        if(false === signed) res = await this.peer.protocol_instance.get('auto_add_writers');
        if(null !== res) {
            return res === 'on';
        }
        return false;
    }

    /**
     *
     * @param signed
     * @returns {Promise<boolean>}
     */
    async getChatStatus(signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('chat_status');
        if(false === signed) res = await this.peer.protocol_instance.get('chat_status');
        if(null !== res) {
            return res === 'on';
        }
        return false;
    }

    /**
     *
     * @param nick
     * @param signed
     * @returns {Promise<null>}
     */
    async getAddressFromNick(nick, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('kcin/'+nick);
        if(false === signed) res = await this.peer.protocol_instance.get('kcin/'+nick);
        return res;
    }

    /**
     *
     * @param address
     * @param signed
     * @returns {Promise<null>}
     */
    async getNick(address, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('nick/'+address);
        if(false === signed) res = await this.peer.protocol_instance.get('nick/'+address);
        return res;
    }

    /**
     *
     * @param signed
     * @returns {Promise<number>}
     */
    async getPinnedMessageLength(signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('pnl');
        if(false === signed) res = await this.peer.protocol_instance.get('pnl');
        res = res !== null ? res : 0;
        return res;
    }

    /**
     *
     * @param index
     * @param signed
     * @returns {Promise<null>}
     */
    async getPinnedMessage(index, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('pni/'+parseInt(index));
        if(false === signed) res = await this.peer.protocol_instance.get('pni/'+parseInt(index));
        if(null === res) {
            return null
        }
        return await this.getMessage(res.msg, signed);
    }

    /**
     *
     * @param signed
     * @returns {Promise<number>}
     */
    async getDeletedMessageLength(signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('delml');
        if(false === signed) res = await this.peer.protocol_instance.get('delml');
        res = res !== null ? res : 0;
        return res;
    }

    /**
     *
     * @param index
     * @param signed
     * @returns {Promise<null>}
     */
    async getDeletedMessage(index, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('delm/'+parseInt(index));
        if(false === signed) res = await this.peer.protocol_instance.get('delm/'+parseInt(index));
        if(null === res) {
            return null
        }
        return await this.getMessage(res, signed);
    }

    /**
     *
     * @param signed
     * @returns {Promise<number>}
     */
    async getMessageLength(signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('msgl');
        if(false === signed) res = await this.peer.protocol_instance.get('msgl');
        res = res !== null ? res : 0;
        return res;
    }

    /**
     *
     * @param index
     * @param signed
     * @returns {Promise<null>}
     */
    async getMessage(index, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('msg/'+parseInt(index));
        if(false === signed) res = await this.peer.protocol_instance.get('msg/'+parseInt(index));
        return res;
    }

    /**
     *
     * @param address
     * @param signed
     * @returns {Promise<number>}
     */
    async getUserMessageLength(address, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('umsgl/'+address);
        if(false === signed) res = await this.peer.protocol_instance.get('umsgl/'+address);
        res = res !== null ? res : 0;
        return res;
    }

    /**
     *
     * @param address
     * @param index
     * @param signed
     * @returns {Promise<null>}
     */
    async getUserMessage(address, index, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('umsg/'+address+'/'+parseInt(index));
        if(false === signed) res = await this.peer.protocol_instance.get('umsg/'+address+'/'+parseInt(index));
        if(null === res) {
            return null
        }
        return await this.getMessage(res, signed);
    }

    /**
     *
     * @param signed
     * @returns {Promise<number>}
     */
    async getTxLength(signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('txl');
        if(false === signed) res = await this.peer.protocol_instance.get('txl');
        res = res !== null ? res : 0;
        return res;
    }

    /**
     *
     * @param index
     * @param signed
     * @returns {Promise<null>}
     */
    async getTx(index, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('txi/'+parseInt(index));
        if(false === signed) res = await this.peer.protocol_instance.get('txi/'+parseInt(index));
        return res;
    }

    /**
     *
     * @param tx
     * @param signed
     * @returns {Promise<null>}
     */
    async getTxData(tx, signed = true){
        let index = null;
        if(true === signed) index = await this.peer.protocol_instance.getSigned('tx/'+tx);
        if(false === signed) index = await this.peer.protocol_instance.get('tx/'+tx);
        if(null !== index) {
            return await this.getTx(index, signed);
        }
        return null;
    }

    /**
     *
     * @param address
     * @param signed
     * @returns {Promise<number>}
     */
    async getUserTxLength(address, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('utxl/'+address);
        if(false === signed) res = await this.peer.protocol_instance.get('utxl/'+address);
        res = res !== null ? res : 0;
        return res;
    }

    /**
     *
     * @param address
     * @param index
     * @param signed
     * @returns {Promise<null>}
     */
    async getUserTx(address, index, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('utxi/'+address+'/'+parseInt(index));
        if(false === signed) res = await this.peer.protocol_instance.get('utxi/'+address+'/'+parseInt(index));
        if(null !== res){
            return await this.getTx(res, signed);
        }
        return res;
    }
}

export default ProtocolApi;