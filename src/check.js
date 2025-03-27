import Validator from 'fastest-validator';

class Check {

    constructor() {
        this._node = null;
        this._tx = null;
        this._post_tx = null;
        this._msg = null;
        this._feature = null;
        this._add_writer = null;
        this._key = null;
        this._nick = null;
        this._mute = null;
        this._delete_message = null;
        this._mod = null;
        this._whitelist_status = null;
        this._enable_whitelist = null;
        this.validator = new Validator();
    }

    async compileEnableWhitelist (){
        /*
        if(op.value === undefined || op.value.dispatch === undefined || op.value.dispatch.type === undefined ||
                            op.value.dispatch.address === undefined || typeof op.value.dispatch.address !== "string" ||
                            op.nonce === undefined || op.value.dispatch.enabled === undefined || typeof op.value.dispatch.enabled !== 'boolean' ||
                            op.hash === undefined) continue;
         */
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

    async enableWhitelist(op){
        if(this._enable_whitelist === null) {
            this._enable_whitelist = await this.compileEnableWhitelist();
        }
        return this._enable_whitelist(op);
    }

    async compileWhitelistStatus (){
        /*
        if(op.value === undefined || op.value.dispatch === undefined || op.value.dispatch.user === undefined ||
                            typeof op.value.dispatch.user !== "string" || op.value.dispatch.type === undefined ||
                            op.value.dispatch.address === undefined || typeof op.value.dispatch.address !== "string" ||
                            op.nonce === undefined || op.value.dispatch.status === undefined || typeof op.value.dispatch.status !== 'boolean' ||
                            op.hash === undefined) continue;
         */
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

    async whitelistStatus(op){
        if(this._whitelist_status === null) {
            this._whitelist_status = await this.compileWhitelistStatus();
        }
        return this._whitelist_status(op);
    }

    async compileMod (){
        /*
        if(op.value === undefined || op.value.dispatch === undefined || op.value.dispatch.user === undefined ||
                            typeof op.value.dispatch.user !== "string" || op.value.dispatch.type === undefined ||
                            op.value.dispatch.address === undefined || typeof op.value.dispatch.address !== "string" ||
                            op.nonce === undefined || op.value.dispatch.mod === undefined || typeof op.value.dispatch.mod !== 'boolean' ||
                            op.hash === undefined) continue;
         */
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

    async mod(op){
        if(this._mod === null) {
            this._mod = await this.compileMod();
        }
        return this._mod(op);
    }

    async compileDeleteMessage (){
        /*
        if(op.value === undefined || op.value.dispatch === undefined || op.value.dispatch.id === undefined ||
                            typeof op.value.dispatch.id !== "number" || op.value.dispatch.type === undefined ||
                            op.value.dispatch.address === undefined || typeof op.value.dispatch.address !== "string" ||
                            op.nonce === undefined || op.hash === undefined || op.value.dispatch.deleted_by === undefined) continue;
         */
        const schema = {
            nonce: { type : "string", min : 1 },
            hash: { type : "string", hex : null },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    id : { type : "number", integer: true, positive: true },
                    type : { type : "string", min : 1 },
                    address : { type : "string", hex : null },
                    deleted_by : { type : "string", hex : null, nullable : true }
                }
            }
        };
        return this.validator.compile(schema);
    }

    async deleteMessage(op){
        if(this._delete_message === null) {
            this._delete_message = await this.compileDeleteMessage();
        }
        return this._delete_message(op);
    }

    async compileMute (){
        /*
        if(op.value === undefined || op.value.dispatch === undefined || op.value.dispatch.user === undefined ||
                            typeof op.value.dispatch.user !== "string" || op.value.dispatch.type === undefined ||
                            op.value.dispatch.address === undefined || typeof op.value.dispatch.address !== "string" ||
                            op.nonce === undefined || op.value.dispatch.muted === undefined || typeof op.value.dispatch.muted !== 'boolean' ||
                            op.hash === undefined) continue;
         */
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

    async mute(op){
        if(this._mute === null) {
            this._mute = await this.compileMute();
        }
        return this._mute(op);
    }

    async compileNick (){
        /*
        if(op.value === undefined || op.value.dispatch === undefined || op.value.dispatch.nick === undefined ||
                            typeof op.value.dispatch.nick !== "string" || op.value.dispatch.type === undefined ||
                            op.value.dispatch.address === undefined || typeof op.value.dispatch.address !== "string" ||
                            op.value.dispatch.initiator === undefined || typeof op.value.dispatch.initiator !== "string" ||
                            op.nonce === undefined || op.hash === undefined) continue;
         */
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

    async nick(op){
        if(this._nick === null) {
            this._nick = await this.compileNick();
        }
        return this._nick(op);
    }

    async compileKey() {
        const schema = {
            key: { type : 'string', hex: null }
        };
        return this.validator.compile(schema);
    }

    async key(op){
        if(this._key === null) {
            this._key = await this.compileKey();
        }
        return this._key(op);
    }

    async setStatus(op){
        // currently same as addWriter
        return await this.addWriter(op);
    }

    async compileAddWriter (){
        /*
        if(op.key === undefined || op.value === undefined || op.hash === undefined ||
                            op.value.msg === undefined || op.value.msg.key === undefined ||
                            op.value.msg.type === undefined || op.nonce === undefined) continue;
         */
        const schema = {
            key: { type : "string", hex : null },
            hash : { type : "string", hex : null },
            nonce : { type : "string", min : 1 },
            value : {
                $$type: "object",
                msg : {
                    $$type : "object",
                    type : { type : "string", min : 1 },
                    key: { type : "string", hex : null },
                }
            }
        };
        return this.validator.compile(schema);
    }

    async addIndexer(op){
        // currently same as addWriter
        return await this.addWriter(op);
    }

    async addWriter(op){
        if(this._add_writer === null) {
            this._add_writer = await this.compileAddWriter();
        }
        return this._add_writer(op);
    }

    async compileFeature (){
        /*
        if(op.key === undefined || op.value === undefined || op.value.dispatch === undefined ||
                            op.value.dispatch.hash === undefined || op.value.dispatch.value === undefined ||
                            op.value.dispatch.nonce === undefined) continue;
         */
        const schema = {
            key: { type : "string", min : 1 },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    value : { type : "object" },
                    nonce: { type : "string", min : 1 },
                    hash: { type : "string", hex : null }
                }
            }
        };
        return this.validator.compile(schema);
    }

    async feature(op){
        if(this._feature === null) {
            this._feature = await this.compileFeature();
        }
        return this._feature(op);
    }

    async compileMsg (){
        /*
        if(op.value === undefined || op.value.dispatch === undefined || op.value.dispatch.attachments === undefined ||
                            !Array.isArray(op.value.dispatch.attachments) || op.value.dispatch.msg === undefined ||
                            typeof op.value.dispatch.msg !== "string" || op.value.dispatch.type === undefined ||
                            op.value.dispatch.address === undefined || typeof op.value.dispatch.address !== "string" ||
                            op.nonce === undefined || op.hash === undefined) continue;
         */
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
                    address : { type : "string", hex : null }
                }
            }
        };
        return this.validator.compile(schema);
    }

    async msg(op){
        if(this._msg === null) {
            this._msg = await this.compileMsg();
        }
        return this._msg(op);
    }

    async compilePostTx() {
        // if(op.key === undefined || op.value === undefined || op.value.dispatch === undefined) continue;
        const schema = {
            value : {
                $$type: "object",
                tx : { type : "string", hex : null },
                ch : { type : "string", hex : null }
            }
        };
        return this.validator.compile(schema);
    }

    async postTx(post_tx){
        if(this._post_tx === null) {
            this._post_tx = await this.compilePostTx();
        }
        return this._post_tx(post_tx);
    }

    async compileNode() {
        const schema = {
            from : {
                $$type: "object",
                key : { type : 'string', hex : null, instanceof: Buffer }
            },
            value: {
                $$type: "object",
                type: { type : "string", min : 1 }
            }
        };
        return this.validator.compile(schema);
    }

    async node(node){
        if(this._node === null) {
            this._node = await this.compileNode();
        }
        return this._node(node);
    }

    async compileTx() {
        // if(op.key === undefined || op.value === undefined || op.value.dispatch === undefined) continue;
        const schema = {
            key: { type : "string", hex : null },
            value : {
                $$type: "object",
                dispatch : { type : "object" },
                msbsl : { type : "number", integer : true, positive: true }
            }
        };
        return this.validator.compile(schema);
    }

    async tx(op){
        if(this._tx === null) {
            this._tx = await this.compileTx();
        }
        return this._tx(op);
    }
}

export default Check;