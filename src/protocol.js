import { formatNumberString, resolveNumberString } from "./functions.js";
import {createHash} from "node:crypto";

class Protocol{
    constructor(options = {}) {
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

    async addFeature(key, feature){
        const pk1 = this.peer.wallet.publicKey;
        const pk2 = await this.base.view.get('admin');
        if(null === pk2 || pk1 !== pk2.value) throw new Error('addFeature(key, feature): Features only allowed for admin.');
        if(typeof this.features[key] !== "undefined") throw new Error('addFeature(key, feature): Feature key exists already.');
        feature.key = key;
        this.features[key] = feature;
    }

    async broadcastTransaction(writer, obj){
        if((this.peer.wallet.publicKey !== null &&
            this.peer.wallet.secretKey !== null) &&
            this.base.localWriter !== null &&
            this.tokenized_input !== null)
        {
            this.nonce = Math.random() + '-' + Date.now();
            const MSBwriter = writer;
            const content_hash = createHash('sha256').update(JSON.stringify(obj)).digest('hex');
            let tx = createHash('sha256').update(
                MSBwriter + '-' +
                this.peer.writerLocalKey + '-' +                
                this.peer.wallet.publicKey + '-' +
                content_hash + '-' +
                this.nonce).digest('hex');
            tx = createHash('sha256').update(tx).digest('hex');
            const signature = this.peer.wallet.sign(tx);
            this.peer.emit('tx', {
                op: 'pre-tx',
                tx: tx,
                is: signature,
                w: MSBwriter,
                i: this.peer.writerLocalKey,
                ipk: this.peer.wallet.publicKey,
                ch : content_hash,
                in : this.nonce
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

    async execute(input){
        throw new Error('Not implemented: Protocol.execute(input)');
    }

    async printOptions(){
        throw new Error('Not implemented: Protocol.printOptions()');
    }

    async get(key){
        const result = await this.peer.base.view.get(key);
        if(null === result) return null;
        return result.value;
    }
}

export default Protocol;