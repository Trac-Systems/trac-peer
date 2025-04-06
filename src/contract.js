class Contract {

    constructor(protocol, options = {}) {
        this.protocol = protocol;
        this.storage = null;
        this.options = options;
        this.is_feature = false;
        this.is_message = false;
        this.features = {};
        this.schemata = {};
        this.message_handler = null;
        this.root = null;
        this.address = null;
        this.validator_address = null;
        this.tx = null;
        this.op = null;
        this.value = null;
        this.node = null;

        this.enter_execute_schema = this.protocol.peer.check.validator.compile({
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    type : { type : "string", min : 1 }
                }
            }
        });

        this.tx_schema = this.protocol.peer.check.validator.compile({
            key : { type : "string", hex : null },
            value : {
                $$type: "object",
                value : {
                    $$type : "object",
                    ipk : { type : "is_hex" },
                    wp : { type : "is_hex" }
                }
            }
        });

        this.address_schema = this.protocol.peer.check.validator.compile({
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    address : { type : "is_hex" }
                }
            }
        });

        this.textkey_schema = this.protocol.peer.check.validator.compile({
            key : { type : "string", min : 1 }
        });
    }

    async execute(op, node, storage){

        this.address = null;
        this.validator_address = null;
        this.is_message = false;
        this.is_feature = false;
        this.tx = null;
        this.op = null;
        this.value = null;
        this.node = null;
        this.storage = null;
        this.root = null;

        if(true !== this.enter_execute_schema(op)) return false;

        if(op.type !== 'feature' && op.type !== 'msg'){
            if(false === this.tx_schema(op)) return false;
            this.address = op.value.value.ipk;
            this.validator_address = op.value.value.wp;
        } else {
            if(true !== this.address_schema(op)) return false;
            if(op.type === 'feature' && true !== this.textkey_schema(op)) return false;
            if(op.type === 'feature') this.is_feature = true;
            if(op.type === 'msg') this.is_message = true;
            this.address = op.value.dispatch.address;
        }

        this.tx = op.type === 'tx' ? op.key : null;
        this.op = op.value.dispatch;
        this.value = this.op.value !== undefined ? this.op.value : null;
        this.node = node;
        this.storage = storage;
        this.root = op;

        let _return = null;

        if(this.isFeature()) {
            if(this.features[this.op.type] !== undefined){
                _return = await this.features[this.op.type]();
            }
        } else if(this.isMessage()) {
            if(this.message_handler !== undefined){
                _return = await this.message_handler();
            }
        } else {
            if(this[this.op.type] !== undefined) {
                if(this.schemata[this.op.type] !== undefined){
                    if(true === this.validateSchema(this.op.type, this.op)) {
                        _return = await this[this.op.type]();
                    } else {
                        _return = false;
                    }
                } else {
                    _return = await this[this.op.type]();
                }
            }
        }

        this.address = null;
        this.validator_address = null;
        this.is_message = false;
        this.is_feature = false;
        this.tx = null;
        this.op = null;
        this.value = null;
        this.node = null;
        this.storage = null;
        this.root = null;

        return _return;
    }

    validateSchema(type, op) {
        const result = this.schemata[type](op);
        return result === true;
    }

    addSchema(type, schema){
        this.schemata[type] = this.protocol.peer.check.validator.compile(schema);
    }

    addFeature(type, func) {
        this.features[type] = func;
    }

    messageHandler(func){
        this.message_handler = func;
    }

    getRoot() {
        return this.root;
    }

    isFeature(){
        return this.is_feature;
    }

    isMessage(){
        return this.is_message;
    }

    async get(key){
        if(typeof this.storage === "undefined" || this.storage === null) throw new Error('get(key): storage undefined');
        const result = await this.storage.get(key);
        if(null === result) return null;
        return result.value;
    }

    async put(key, value){
        if(typeof this.storage === "undefined" || this.storage === null) throw new Error('put(key,value): storage undefined');
        if(key.startsWith('sh/') || key.startsWith('tx/') || key === 'msgl' || key.startsWith('kcin/') || key.startsWith('delm/') ||
            key.startsWith('umsg/') || key.startsWith('umsg/') || key.startsWith('msgl/') || key === 'admin' || key === 'auto_add_writers'
            || key.startsWith('nick/') || key.startsWith('mod/') || key === 'chat_status' || key.startsWith('mtd/') || key === 'delml' ||
            key === 'wlst' || key === 'txl' || key.startsWith('txi/') || key.startsWith('wl/'))
            throw Error('put(key,value): ' + key + 'is reserved');
        return await this.storage.put(key, value);
    }

    async emptyPromise(){
        return new Promise((resolve) => {
            resolve();
        });
    }
}

export default Contract;