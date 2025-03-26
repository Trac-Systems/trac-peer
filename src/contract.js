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
        const result = await this.storage.get(key);
        if(null === result) return null;
        return result.value;
    }

    async put(key, value){
        if(typeof this.storage === "undefined" || this.storage === null) throw new Error('put(key,value): storage undefined');
        if(key.startsWith('sh/') || key.startsWith('tx/') || key === 'msgl' || key.startsWith('kcin/') || key.startsWith('delm/') ||
            key.startsWith('msg/') || key === 'admin' || key === 'auto_add_writers' || key.startsWith('nick/') || key.startsWith('mod/') ||
            key === 'chat_status' || key.startsWith('mtd/') || key === 'delml') throw Error('put(key,value): ' + key + 'is reserved');
        return await this.storage.put(key, value);
    }

    async emptyPromise(){
        return new Promise((resolve) => {
            resolve();
        });
    }
}

export default Contract;