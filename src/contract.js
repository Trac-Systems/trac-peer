class Contract {

    constructor(protocol, options = {}) {
        this.protocol = protocol;
        this.storage = null;
        this.options = options;
    }

    async dispatch(op, node, storage) {
        throw Error('Not implemented: Contract.dispatch(op, node, signed_storage, storage)');
    }

    async get(key){
        if(typeof this.storage === "undefined" || this.storage === null) throw new Error('get(key): storage undefined');
        return await this.storage.get(key);
    }

    async put(key, value){
        if(typeof this.storage === "undefined" || this.storage === null) throw new Error('put(key,value): storage undefined');
        return await this.storage.put(key, value);
    }
}

export default Contract;