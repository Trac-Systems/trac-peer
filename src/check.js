import Validator from 'fastest-validator';
import WAValidator from 'multicoin-address-validator';

class Check {

    constructor() {
        this.validator = new Validator({
            useNewCustomCheckerFunction: true,
            messages: {
                bufferedHex: "The '{field}' field must a hex! Actual: {actual}",
                bigint: "The '{field}' field must a biginteger or a biginteger string! Actual: {actual}",
                bitcoin: "The '{field}' field must a valid Bitcoin address! Actual: {actual}"
            },
            customFunctions : {
                bitcoinAddress : (value, errors)=>{
                    let result = false
                    try{
                        result = WAValidator.validate(value, 'Bitcoin', { networkType : 'both' });
                    } catch (e) {}
                    if (false === result)
                        return false;
                    return true;
                }
            }
        });

        this.validator.add("bigint", function({ schema, messages }, path, context) {
            return {
                source: `
                    let result = false
                    try{ 
                        BigInt(value);
                     } catch (e) {}
                    if (false === result)
                        ${this.makeError({ type: "bigint",  actual: "value", messages })}
                    return value
                `
            };
        });

        this.validator.add("is_hex", function({ schema, messages }, path, context) {
            return {
                source: `
                    let buf = null
                    let result = false
                    try{ 
                        buf = Buffer.from(value, 'hex')
                        result = value === buf.toString('hex')
                     } catch (e) {}
                    if (false === result)
                        ${this.makeError({ type: "bufferedHex",  actual: "value", messages })}
                    return value
                `
            };
        });

        this.validator.add("bitcoin_address", function({ schema, messages }, path, context) {
            return {
                source: `
                    const result = context.customFunctions.bitcoinAddress(value, errors);
                    if(false === result) ${this.makeError({ type: "bitcoin",  actual: "value", messages })}
                    return value;
                `
            };
        });

        this._node = this.compileNode();
        this._tx = this.compileTx();
        this._post_tx = this.compilePostTx();
        this._msg = this.compileMsg();
        this._feature = this.compileFeature();
        this._add_writer = this.compileAddWriter();
        this._auto_add_writers = this.compileSetAutoAddWriters();
        this._key = this.compileKey();
        this._chat_status = this.compileSetChatStatus();
        this._update_admin = this.compileUpdateAdmin();
        this._nick = this.compileNick();
        this._mute = this.compileMute();
        this._delete_message = this.compileDeleteMessage();
        this._mod = this.compileMod();
        this._whitelist_status = this.compileWhitelistStatus();
        this._enable_whitelist = this.compileEnableWhitelist();
    }

    compileEnableWhitelist (){
        const schema = {
            nonce: { type : "string", min : 1 },
            hash: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    enabled : { type : "boolean" },
                    type : { type : "string", min : 1 },
                    address : { type : "is_hex" }
                }
            }
        };
        return this.validator.compile(schema);
    }

    enableWhitelist(op){
        const res = this._enable_whitelist(op);
        return res === true;
    }

    compileWhitelistStatus (){
        const schema = {
            nonce: { type : "string", min : 1 },
            hash: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    status : { type : "boolean" },
                    type : { type : "string", min : 1 },
                    address : { type : "is_hex" },
                    user : { type : "is_hex" }
                }
            }
        };
        return this.validator.compile(schema);
    }

    whitelistStatus(op){
        const res = this._whitelist_status(op);
        return res === true;
    }

    compileMod (){
        const schema = {
            nonce: { type : "string", min : 1 },
            hash: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    mod : { type : "boolean" },
                    type : { type : "string", min : 1 },
                    address : { type : "is_hex" },
                    user : { type : "is_hex" }
                }
            }
        };
        return this.validator.compile(schema);
    }

    mod(op){
        const res = this._mod(op);
        return res === true;
    }

    compileDeleteMessage (){
        const schema = {
            nonce: { type : "string", min : 1 },
            hash: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    id : { type : "number", integer: true, min : 0 },
                    type : { type : "string", min : 1 },
                    address : { type : "is_hex" },
                    deleted_by : { type : "is_hex", nullable : true }
                }
            }
        };
        return this.validator.compile(schema);
    }

    deleteMessage(op){
        const res = this._delete_message(op);
        return res === true;
    }

    compileMute (){
        const schema = {
            nonce: { type : "string", min : 1 },
            hash: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    muted : { type : "boolean" },
                    type : { type : "string", min : 1 },
                    address : { type : "is_hex" },
                    user : { type : "is_hex" }
                }
            }
        };
        return this.validator.compile(schema);
    }

    mute(op){
        const res = this._mute(op);
        return res === true;
    }

    compileNick (){
        const schema = {
            nonce: { type : "string", min : 1 },
            hash: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    nick : { type : "string", min : 1 },
                    type : { type : "string", min : 1 },
                    address : { type : "is_hex" },
                    initiator : { type : "is_hex" }
                }
            }
        };
        return this.validator.compile(schema);
    }

    nick(op){
        const res = this._nick(op);
        return res === true;
    }

    compileKey() {
        const schema = {
            key: { type : "is_hex" }
        };
        return this.validator.compile(schema);
    }

    key(op){
        const res = this._key(op);
        return res === true;
    }

    compileUpdateAdmin() {
        const schema = {
            nonce: { type : "string", min : 1 },
            hash: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    admin : { type : "is_hex", nullable : true },
                    type : { type : "string", min : 1 },
                    address : { type : "is_hex" }
                }
            }
        };
        return this.validator.compile(schema);
    }

    updateAdmin(op){
        const res = this._update_admin(op);
        return res === true;
    }

    compileSetAutoAddWriters (){
        const schema = {
            key: { type : "string", min : 1 },
            hash : { type : "is_hex" },
            nonce : { type : "string", min : 1 },
            value : {
                $$type: "object",
                msg : {
                    $$type : "object",
                    type : { type : "string", min : 1 },
                    key: { type : "string", min : 1 }
                }
            }
        };
        return this.validator.compile(schema);
    }

    setAutoAddWriters(op){
        const res = this._auto_add_writers(op);
        return res === true;
    }

    compileSetChatStatus (){
        const schema = {
            key: { type : "string", min : 1 },
            hash : { type : "is_hex" },
            nonce : { type : "string", min : 1 },
            value : {
                $$type: "object",
                msg : {
                    $$type : "object",
                    type : { type : "string", min : 1 },
                    key: { type : "string", min : 1 }
                }
            }
        };
        return this.validator.compile(schema);
    }

    setChatStatus(op){
        const res = this._chat_status(op);
        return res === true;
    }

    compileAddWriter (){
        const schema = {
            key: { type : "is_hex" },
            hash : { type : "is_hex" },
            nonce : { type : "string", min : 1 },
            value : {
                $$type: "object",
                msg : {
                    $$type : "object",
                    type : { type : "string", min : 1 },
                    key: { type : "is_hex" }
                }
            }
        };
        return this.validator.compile(schema);
    }

    addIndexer(op){
        // currently same as addWriter
        return this.addWriter(op);
    }

    addWriter(op){
        const res = this._add_writer(op);
        return res === true;
    }

    compileFeature (){
        const schema = {
            key: { type : "string", min : 1 },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    value : { type : "any", nullable : true },
                    nonce: { type : "string", min : 1 },
                    hash: { type : "is_hex" }
                }
            }
        };
        return this.validator.compile(schema);
    }

    feature(op){
        const res = this._feature(op);
        return res === true;
    }

    compileMsg (){
        const schema = {
            nonce: { type : "string", min : 1 },
            hash: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    attachments : { type : "array", items : "string" },
                    msg : { type : "string", min : 1 },
                    type : { type : "string", min : 1 },
                    address : { type : "is_hex" },
                    deleted_by : { type : "is_hex", nullable : true },
                    reply_to : { type : "number", integer : true, min : 0, nullable : true },
                }
            }
        };
        return this.validator.compile(schema);
    }

    msg(op){
        const res = this._msg(op);
        return res === true;
    }

    compilePostTx() {
        const schema = {
            value : {
                $$type: "object",
                tx : { type : "is_hex" },
                ch : { type : "is_hex" }
            }
        };
        return this.validator.compile(schema);
    }

    postTx(post_tx){
        const res = this._post_tx(post_tx);
        return res === true;
    }

    compileNode() {
        const schema = {
            /*from : {
                $$type: "object",
                key : { type : 'string', hex : null, instanceof: Buffer }
            },*/
            value: {
                $$type: "object",
                type: { type : "string", min : 1 }
            }
        };
        return this.validator.compile(schema);
    }

    node(node){
        const res = this._node(node);
        return res === true;
    }

    compileTx() {
        const schema = {
            key: { type : "string", hex : null },
            value : {
                $$type: "object",
                dispatch : { type : "object" },
                msbsl : { type : "number", integer : true, min : 0 }
            }
        };
        return this.validator.compile(schema);
    }

    tx(op){
        const res = this._tx(op);
        return res === true;
    }
}

export default Check;