import Validator from 'fastest-validator';

class Check {

    constructor() {
        this.validator = new Validator();
        this._node = this.compileNode();
        this._tx = this.compileTx();
        this._post_tx = this.compilePostTx();
        this._msg = this.compileMsg();
        this._feature = this.compileFeature();
        this._add_writer = this.compileAddWriter();
        this._key = this.compileKey();
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
            hash: { type : "string", hex : null },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    enabled : { type : "boolean" },
                    type : { type : "string", min : 1 },
                    address : { type : "string", hex : null }
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
            hash: { type : "string", hex : null },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    status : { type : "boolean" },
                    type : { type : "string", min : 1 },
                    address : { type : "string", hex : null },
                    user : { type : "string", hex : null }
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
            hash: { type : "string", hex : null },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    mod : { type : "boolean" },
                    type : { type : "string", min : 1 },
                    address : { type : "string", hex : null },
                    user : { type : "string", hex : null }
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
            hash: { type : "string", hex : null },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    id : { type : "number", integer: true, min : 0 },
                    type : { type : "string", min : 1 },
                    address : { type : "string", hex : null },
                    deleted_by : { type : "string", hex : null, nullable : true }
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
            hash: { type : "string", hex : null },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    muted : { type : "boolean" },
                    type : { type : "string", min : 1 },
                    address : { type : "string", hex : null },
                    user : { type : "string", hex : null }
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
            hash: { type : "string", hex : null },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    nick : { type : "string", min : 1 },
                    type : { type : "string", min : 1 },
                    address : { type : "string", hex : null },
                    initiator : { type : "string", hex : null }
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
            key: { type : 'string', hex: null }
        };
        return this.validator.compile(schema);
    }

    key(op){
        const res = this._key(op);
        return res === true;
    }

    setStatus(op){
        // currently same as addWriter
        return this.addWriter(op);
    }

    compileAddWriter (){
        const schema = {
            key: { type : "string", hex : null },
            hash : { type : "string", hex : null },
            nonce : { type : "string", min : 1 },
            value : {
                $$type: "object",
                msg : {
                    $$type : "object",
                    type : { type : "string", min : 1 },
                    key: { type : "string", hex : null }
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
                    hash: { type : "string", hex : null }
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
            hash: { type : "string", hex : null },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    attachments : { type : "array", items : "string" },
                    msg : { type : "string", min : 1 },
                    type : { type : "string", min : 1 },
                    address : { type : "string", hex : null },
                    deleted_by : { type : "string", hex : null, nullable : true }
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
                tx : { type : "string", hex : null },
                ch : { type : "string", hex : null }
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