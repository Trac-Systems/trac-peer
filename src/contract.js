import assert from 'assert';

class Contract {

    constructor(protocol, options = {}) {
        this.protocol = protocol;
        this.storage = null;
        this.options = options;
        this.is_feature = false;
        this.is_message = false;
        this.features = {};
        this.schemata = {};
        this.funcs = {};
        this.message_handler = null;
        this.address = null;
        this.validator_address = null;
        this.tx = null;
        this.op = null;
        this.value = null;
        this.assert = assert;

        this.enter_execute_schema = this.protocol.peer.check.validator.compile({
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    type : { type : "string", min : 1, max : 256 }
                }
            }
        });

        this.tx_schema = this.protocol.peer.check.validator.compile({
            key : { type : "is_hex" },
            value : {
                $$type: "object",
                dispatch : {
                    $$type : "object",
                    type : { type : "string", min : 1, max : 256 },
                    value : { type : "any", nullable : true }
                },
                ipk : { type : "is_hex" },
                wp : { type : "is_hex" }
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
            key : { type : "string", min : 1, max : 256 }
        });
    }

    async execute(op, storage){

        this.address = null;
        this.validator_address = null;
        this.is_message = false;
        this.is_feature = false;
        this.tx = null;
        this.op = null;
        this.value = null;
        this.storage = null;

        if(true !== this.enter_execute_schema(op)) return false;

        if(op.type !== 'feature' && op.type !== 'msg'){
            if(false === this.tx_schema(op)) return false;
            this.address = op.value.ipk;
            this.validator_address = op.value.wp;
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
        this.storage = storage;

        let _return = null;

        if(this.isFeature()) {
            if(this.features[this.op.type] !== undefined){
                // feature returns aren't handled by peer, so not necessary to track
                await this.features[this.op.type]();
            }
        } else if(this.isMessage()) {
            if(typeof this.message_handler === 'function'){
                try {
                    _return = await this.message_handler();
                } catch(e) {
                    if(e.constructor.name !== 'AssertionError'){
                        throw new RethrownError('Error in contract.', e);
                    }
                    _return = e;
                }
            }
        } else if(this[this.op.type] !== undefined) {
            try {
                if(this.schemata[this.op.type] !== undefined){
                    if(true === this.validateSchema(this.op.type, this.op)) {
                        _return = await this[this.op.type]();
                    } else {
                        _return = new UnknownContractOperationType('Invalid schema.');
                    }
                } else if(this.funcs[this.op.type] !== undefined) {
                    _return = await this[this.op.type]();
                } else {
                    _return = new UnknownContractOperationType('Function not registered.');
                }
            } catch(e) {
                if(e.constructor.name !== 'AssertionError'){
                    throw new RethrownError('Error in contract.', e);
                }
                _return = e;
            }
        } else {
            _return = new UnknownContractOperationType('Unknown contract operation type.');
        }

        this.address = null;
        this.validator_address = null;
        this.is_message = false;
        this.is_feature = false;
        this.tx = null;
        this.op = null;
        this.value = null;
        this.storage = null;

        return _return;
    }

    validateSchema(type, op) {
        const result = this.schemata[type](op);
        return result === true;
    }

    addFunction(type){
        if(this.features[type] !== undefined || this.schemata[type] !== undefined) throw new Error('addFunction(type): The type has been registered already.');
        this.funcs[type] = true;
    }

    addSchema(type, schema){
        if(this.funcs[type] !== undefined || this.features[type] !== undefined) throw new Error('addSchema(type, schema): The type has been registered already.');
        this.schemata[type] = this.protocol.peer.check.validator.compile(schema);
    }

    addFeature(type, func) {
        if(this.funcs[type] !== undefined || this.schemata[type] !== undefined) throw new Error('addFeature(type, func): The type has been registered already.');
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

    isReservedKey(key){
        return key.startsWith('sh/') || key.startsWith('tx/') || key === 'msgl' || key.startsWith('kcin/') || key.startsWith('delm/') ||
            key.startsWith('umsg/') || key.startsWith('umsg/') || key.startsWith('msgl/') || key === 'admin' || key === 'auto_add_writers'
            || key.startsWith('nick/') || key.startsWith('mod/') || key === 'chat_status' || key.startsWith('mtd/') || key === 'delml' ||
            key === 'wlst' || key === 'txl' || key.startsWith('txi/') || key.startsWith('wl/') || key === 'pnl' || key.startsWith('pni/') ||
            key.startsWith('utxl/') || key.startsWith('utxi/') || key.startsWith('bnd/') || key === 'txen';
    }

    async del(key){
        if(typeof this.storage === "undefined" || this.storage === null) throw new Error('del(key): storage undefined');
        if(this.isReservedKey(key)) throw Error('del(key): ' + key + 'is reserved');
        await this.storage.del(key);
    }

    async get(key){
        if(typeof this.storage === "undefined" || this.storage === null) throw new Error('get(key): storage undefined');
        const result = await this.storage.get(key);
        if(null === result) return null;
        return result.value;
    }

    async put(key, value){
        if(typeof this.storage === "undefined" || this.storage === null) throw new Error('put(key,value): storage undefined');
        if(this.isReservedKey(key)) throw Error('put(key,value): ' + key + 'is reserved');
        return await this.storage.put(key, value);
    }

    async emptyPromise(){
        return new Promise((resolve) => {
            resolve();
        });
    }
}

class UnknownContractOperationType extends Error {
    constructor(message) {
        super(message);
    }
}

class RethrownError extends Error {
    constructor(message, error){
        super(message)
        this.name = this.constructor.name
        if (!error) throw new Error('RethrownError requires a message and error')
        this.original_error = error
        this.stack_before_rethrow = this.stack
        const message_lines =  (this.message.match(/\n/g)||[]).length + 1
        this.stack = this.stack.split('\n').slice(0, message_lines+1).join('\n') + '\n' +
            error.stack
    }
}

export default Contract;