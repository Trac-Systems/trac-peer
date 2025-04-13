import { formatNumberString, resolveNumberString, jsonStringify, jsonParse, safeClone } from "./functions.js";
import {ProtocolApi} from './api.js';

class Protocol{
    constructor(options = {}) {
        this.api = new ProtocolApi({ peer : options.peer });
        this.base = options.base || null;
        this.peer = options.peer || null;
        this.options = options;
        this.input = null;
        this.tokenized_input = null;
        this.fromBigIntString = formatNumberString;
        this.toBigIntString = resolveNumberString;
        this.safeJsonStringify = jsonStringify;
        this.safeJsonParse = jsonParse;
        this.safeClone = safeClone;
        this.nonce = 0;
        this.prepared_transactions_content = {};
        this.features = {};
        this.sim = false;
    }

    featMaxBytes(){
        return 4_096;
    }

    txMaxBytes(){
        return 4_096;
    }

    msgMaxBytes(){
        return 8_192;
    }

    safeBigInt(value) {
        try{
            return BigInt(value);
        } catch(e) { }
        return null;
    }

    parseArgs(cmdline) {
        let re_next_arg = /^\s*((?:(?:"(?:\\.|[^"])*")|(?:'[^']*')|\\.|\S)+)\s*(.*)$/;
        let next_arg = ['', '', cmdline];
        let args = [];
        const obj = {};
        while (next_arg = re_next_arg.exec(next_arg[2])) {
            let quoted_arg = next_arg[1];
            let unquoted_arg = "";
            while (quoted_arg.length > 0) {
                if (/^"/.test(quoted_arg)) {
                    let quoted_part = /^"((?:\\.|[^"])*)"(.*)$/.exec(quoted_arg);
                    unquoted_arg += quoted_part[1].replace(/\\(.)/g, "$1");
                    quoted_arg = quoted_part[2];
                } else if (/^'/.test(quoted_arg)) {
                    let quoted_part = /^'([^']*)'(.*)$/.exec(quoted_arg);
                    unquoted_arg += quoted_part[1];
                    quoted_arg = quoted_part[2];
                } else if (/^\\/.test(quoted_arg)) {
                    unquoted_arg += quoted_arg[1];
                    quoted_arg = quoted_arg.substring(2);
                } else {
                    unquoted_arg += quoted_arg[0];
                    quoted_arg = quoted_arg.substring(1);
                }
            }

            args[args.length] = unquoted_arg;
        }
        args = args.splice(1);
        for(let i = 0; i < args.length; i++){
            if(i % 2 === 0) {
                if(args[i].startsWith('--')) args[i] = args[i].substring(2);
                obj[args[i]] = args[i+1] !== undefined ? args[i+1] : null;
            }
        }
        return obj;
    }

    async addFeature(key, feature){
        const pk1 = this.peer.wallet.publicKey;
        const pk2 = await this.base.view.get('admin');
        if(null === pk2 || pk1 !== pk2.value) throw new Error('addFeature(key, feature): Features only allowed for admin.');
        if(typeof this.features[key] !== "undefined") throw new Error('addFeature(key, feature): Feature key exists already.');
        feature.key = key;
        this.features[key] = feature;
    }

    async generateTx(bootstrap, msb_bootstrap, validator_writer_key, local_writer_key, local_public_key, content_hash, nonce){
        let tx = bootstrap + '-' +
            msb_bootstrap + '-' +
            validator_writer_key + '-' +
            local_writer_key + '-' +
            local_public_key + '-' +
            content_hash + '-' +
            nonce;
        return await this.peer.createHash('sha256', await this.peer.createHash('sha256', tx));
    }

    async simulateTransaction(obj){
        const storage = new SimStorage(this.peer);
        const null_hex = '0000000000000000000000000000000000000000000000000000000000000000';
        let nonce = Math.random() + '-' + Date.now();
        const content_hash = await this.peer.createHash('sha256', JSON.stringify(obj));
        let tx = await this.generateTx(this.peer.bootstrap, this.peer.msb.bootstrap, null_hex,
            this.peer.writerLocalKey, this.peer.wallet.publicKey, content_hash, nonce);
        const op = {
            type : 'tx',
            key : tx,
            value : {
                dispatch : obj,
                value : {
                    ipk : this.peer.wallet.publicKey,
                    wp : null_hex
                }
            }
        }
        return await this.peer.contract_instance.execute(op, storage);
    }

    async broadcastTransaction(writer_pub_key, obj){
        if(true === this.sim) {
            return await this.simulateTransaction(obj);
        }
        if(this.peer.wallet.publicKey !== null &&
            this.peer.wallet.secretKey !== null &&
            this.base.localWriter !== null &&
            obj.type !== undefined &&
            obj.value !== undefined)
        {
            this.nonce = Math.random() + '-' + Date.now();
            const content_hash = await this.peer.createHash('sha256', JSON.stringify(obj));
            let tx = await this.generateTx(this.peer.bootstrap, this.peer.msb.bootstrap, writer_pub_key,
                this.peer.writerLocalKey, this.peer.wallet.publicKey, content_hash, this.nonce);
            const signature = this.peer.wallet.sign(tx + this.nonce);
            this.peer.emit('tx', {
                op: 'pre-tx',
                tx: tx,
                is: signature,
                wp : writer_pub_key,
                i: this.peer.writerLocalKey,
                ipk: this.peer.wallet.publicKey,
                ch : content_hash,
                in : this.nonce,
                bs : this.peer.bootstrap,
                mbs : this.peer.msb.bootstrap
            });
            this.prepared_transactions_content[tx] = obj;
        } else {
            throw Error('broadcastTransaction(writer, obj): Cannot prepare transaction. Please make sure inputs and local writer are set.');
        }
        return true;
    }

    async tokenizeInput(input){
        this.input = input;
        if(typeof input === "string"){
            this.tokenized_input = input.split(' ').map(function(item) {
                return item.trim();
            });
        }
    }

    getError(value){
        if (value === false || (value !== undefined && value.stack !== undefined && value.message !== undefined)) {
            return value === false ? new Error('Generic Error') : value;
        }
        return null;
    }

    async tx(subject){ }

    async customCommand(input){ }

    async printOptions(){ }

    async extendApi(){ }

    async getSigned(key){
        const view_session = this.peer.base.view.checkout(this.peer.base.view.core.signedLength);
        const result = await view_session.get(key);
        if(result === null) return null;
        return result.value;
    }

    async get(key){
        const result = await this.peer.base.view.get(key);
        if(null === result) return null;
        return result.value;
    }
}

class SimStorage{
    constructor(peer) {
        this.peer = peer;
        this.values = {};
    }

    async del(key){
        if(this.peer.contract_instance.isReservedKey(key)) throw Error('del(key): ' + key + 'is reserved');
        delete this.values[key];
        return this.peer.contract_instance.emptyPromise();
    }

    async get(key){
        if(this.values[key] !== undefined) {
            return { value : this.values[key] };
        }
        return await this.peer.base.view.get(key);
    }

    async put(key, value){
        if(this.peer.contract_instance.isReservedKey(key)) throw Error('put(key,value): ' + key + 'is reserved');
        this.values[key] = value;
        return this.peer.contract_instance.emptyPromise();
    }
}

export default Protocol;