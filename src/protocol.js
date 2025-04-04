import { formatNumberString, resolveNumberString, jsonStringify } from "./functions.js";
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
        this.nonce = 0;
        this.prepared_transactions_content = {};
        this.features = {};
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

    async broadcastTransaction(validator_writer_key, obj){
        if(this.peer.wallet.publicKey !== null &&
            this.peer.wallet.secretKey !== null &&
            this.base.localWriter !== null)
        {
            this.nonce = Math.random() + '-' + Date.now();
            const content_hash = await this.peer.createHash('sha256', JSON.stringify(obj));
            let tx = await this.generateTx(this.peer.bootstrap, this.peer.msb.bootstrap, validator_writer_key,
                this.peer.writerLocalKey, this.peer.wallet.publicKey, content_hash, this.nonce);
            const signature = this.peer.wallet.sign(tx + this.nonce);
            this.peer.emit('tx', {
                op: 'pre-tx',
                tx: tx,
                is: signature,
                w: validator_writer_key,
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
    }

    async tokenizeInput(input){
        this.input = input;
        if(typeof input === "string"){
            this.tokenized_input = input.split(' ').map(function(item) {
                return item.trim();
            });
        }
    }

    async tx(subject){
        throw new Error('Not implemented: Protocol.tx(subject)');
    }

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

export default Protocol;