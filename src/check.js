import Validator from 'fastest-validator';
import WAValidator from 'multicoin-address-validator';
import b4a from "b4a";

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
                    let result2 = false
                    let result3 = false
                    let result4 = false
                    let result5 = false
                    try{
                        result = WAValidator.validate(value, 'Bitcoin', { networkType : 'both' });
                        if(false === result){
                            result2 = WAValidator.validate(value, 'Solana', { networkType : 'both' });
                            if(false === result2){
                                result3 = WAValidator.validate(value, 'DogeCoin', { networkType : 'both' });
                                if(false === result3){
                                    result4 = WAValidator.validate(value, 'BinanceSmartChain', { networkType : 'both' });
                                    if(false === result4){
                                        // check for Trac public key hex
                                        let buf = null
                                        try{
                                            buf = b4a.from(value, 'hex')
                                            result5 = value === b4a.toString(buf, 'hex')
                                            if(result5){
                                                result5 = value.length === 64
                                            }
                                        } catch (e) {}
                                    }
                                }
                            }
                        }
                    } catch (e) {}
                    return result || result2 || result3 || result4 || result5;
                },
                hexCheck : (value, errors) => {
                    let buf = null
                    let result = false
                    try{
                        buf = b4a.from(value, 'hex')
                        result = value === b4a.toString(buf, 'hex')
                    } catch (e) {}
                    return result;
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
                    const result = context.customFunctions.hexCheck(value, errors);
                    if(false === result) ${this.makeError({ type: "bufferedHex",  actual: "value", messages })}
                    return value;
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
        this._remove_writer = this.compileRemoveWriter();
        this._auto_add_writers = this.compileSetAutoAddWriters();
        this._key = this.compileKey();
        this._chat_status = this.compileSetChatStatus();
        this._update_admin = this.compileUpdateAdmin();
        this._nick = this.compileNick();
        this._mute = this.compileMute();
        this._delete_message = this.compileDeleteMessage();
        this._pin_message = this.compilePinMessage();
        this._unpin_message = this.compileUnpinMessage();
        this._mod = this.compileMod();
        this._whitelist_status = this.compileWhitelistStatus();
        this._enable_whitelist = this.compileEnableWhitelist();
        this._enable_transactions = this.compileEnableTransactions();
    }

    compileEnableTransactions (){
        const schema = {
            nonce: { type : "string", min : 1, max : 256 },
            hash: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    enabled : { type : "boolean" },
                    type : { type : "string", min : 1, max : 256 },
                    address : { type : "is_hex" }
                }
            }
        };
        return this.validator.compile(schema);
    }

    enableTransactions(op){
        const res = this._enable_transactions(op);
        return res === true;
    }

    compileEnableWhitelist (){
        const schema = {
            nonce: { type : "string", min : 1, max : 256 },
            hash: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    enabled : { type : "boolean" },
                    type : { type : "string", min : 1, max : 256 },
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
            nonce: { type : "string", min : 1, max : 256 },
            hash: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    status : { type : "boolean" },
                    type : { type : "string", min : 1, max : 256 },
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
            nonce: { type : "string", min : 1, max : 256 },
            hash: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    mod : { type : "boolean" },
                    type : { type : "string", min : 1, max : 256 },
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
            nonce: { type : "string", min : 1, max : 256 },
            hash: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    id : { type : "number", integer: true, min : 0, max : Number.MAX_SAFE_INTEGER },
                    type : { type : "string", min : 1, max : 256 },
                    address : { type : "is_hex" }
                }
            }
        };
        return this.validator.compile(schema);
    }

    deleteMessage(op){
        const res = this._delete_message(op);
        return res === true;
    }

    compilePinMessage (){
        const schema = {
            nonce: { type : "string", min : 1, max : 256 },
            hash: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    id : { type : "number", integer: true, min : 0, max : Number.MAX_SAFE_INTEGER },
                    pinned : { type : "boolean" },
                    type : { type : "string", min : 1, max : 256 },
                    address : { type : "is_hex" }
                }
            }
        };
        return this.validator.compile(schema);
    }

    compileUnpinMessage (){
        const schema = {
            nonce: { type : "string", min : 1, max : 256 },
            hash: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    id : { type : "number", integer: true, min : 0, max : Number.MAX_SAFE_INTEGER },
                    type : { type : "string", min : 1, max : 256 },
                    address : { type : "is_hex" }
                }
            }
        };
        return this.validator.compile(schema);
    }

    pinMessage(op){
        const res = this._pin_message(op);
        return res === true;
    }

    unpinMessage(op){
        const res = this._unpin_message(op);
        return res === true;
    }

    compileMute (){
        const schema = {
            nonce: { type : "string", min : 1, max : 256 },
            hash: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    muted : { type : "boolean" },
                    type : { type : "string", min : 1, max : 256 },
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
            nonce: { type : "string", min : 1, max : 256 },
            hash: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    nick : { type : "string", min : 1, max : 256 },
                    type : { type : "string", min : 1, max : 256 },
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
            nonce: { type : "string", min : 1, max : 256 },
            hash: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    admin : { type : "is_hex", nullable : true },
                    type : { type : "string", min : 1, max : 256 },
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
            key: { type : "string", min : 1, max : 256 },
            hash : { type : "is_hex" },
            nonce : { type : "string", min : 1, max : 256 },
            value : {
                $$type: "object",
                msg : {
                    $$type : "object",
                    type : { type : "string", min : 1, max : 256 },
                    key: { type : "string", min : 1, max : 256 }
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
            key: { type : "string", min : 1, max : 256 },
            hash : { type : "is_hex" },
            nonce : { type : "string", min : 1, max : 256 },
            value : {
                $$type: "object",
                msg : {
                    $$type : "object",
                    type : { type : "string", min : 1, max : 256 },
                    key: { type : "string", min : 1, max : 256 }
                }
            }
        };
        return this.validator.compile(schema);
    }

    setChatStatus(op){
        const res = this._chat_status(op);
        return res === true;
    }

    compileRemoveWriter (){
        const schema = {
            key: { type : "is_hex" },
            hash : { type : "is_hex" },
            nonce : { type : "string", min : 1, max : 256 },
            value : {
                $$type: "object",
                msg : {
                    $$type : "object",
                    type : { type : "string", min : 1, max : 256 },
                    key: { type : "is_hex" }
                }
            }
        };
        return this.validator.compile(schema);
    }

    compileAddWriter (){
        const schema = {
            key: { type : "is_hex" },
            hash : { type : "is_hex" },
            nonce : { type : "string", min : 1, max : 256 },
            value : {
                $$type: "object",
                msg : {
                    $$type : "object",
                    type : { type : "string", min : 1, max : 256 },
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

    removeWriter(op){
        const res = this._remove_writer(op);
        return res === true;
    }

    compileFeature (){
        const schema = {
            key: { type : "string", min : 1, max : 256 },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    value : { type : "any", nullable : true },
                    nonce: { type : "string", min : 1, max : 256 },
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
            $$strict: true,
            type : { type : "string", min : 1, max : 256 },
            nonce: { type : "string", min : 1, max : 256 },
            hash: { type : "is_hex" },
            value : {
                $$strict: true,
                $$type: "object",
                dispatch : {
                    $$strict: true,
                    $$type : "object",
                    attachments : { type : "array", items : "string" },
                    msg : { type : "string", min : 1 },
                    type : { type : "string", min : 1, max : 256 },
                    address : { type : "is_hex" },
                    deleted_by : { type : "is_hex", nullable : true },
                    reply_to : { type : "number", integer : true, min : 0, max : Number.MAX_SAFE_INTEGER, nullable : true },
                    pinned : { type : "boolean" },
                    pin_id : { type : "number", integer : true, min : 0, max : Number.MAX_SAFE_INTEGER, nullable : true },
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
                ch : { type : "is_hex" },
                ws : { type : "is_hex" },
                wn : { type : "string", min : 1, max : 256 },
                wp : { type : "is_hex" },
                is : { type : "is_hex" },
                in : { type : "string", min : 1, max : 256 },
                ipk : { type : "is_hex" },
                w : { type : "is_hex" },
                i : { type : "is_hex" }
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
                type: { type : "string", min : 1, max : 256 }
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
            key: { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$strict : true,
                    $$type : "object",
                    type : { type : "string", min : 1, max : 256 },
                    value : { type : "any", nullable : true }
                },
                msbsl : { type : "number", integer : true, min : 0, max : Number.MAX_SAFE_INTEGER },
                msbbs : { type : "is_hex" },
                ipk : { type : "is_hex" },
                wp : { type : "is_hex" }
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