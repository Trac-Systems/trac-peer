class Feature {

    constructor(peer, options = {}) {
        this.peer = peer;
        this.key = '';
        this.options = options;
    }

    async getSigned(key){
        const view_session = this.peer.base.view.checkout(this.peer.base.view.core.signedLength);
        const result = await view_session.get(key);
        if(result === null) return null;
        return result.value;
    }

    async get(key){
        const result = await this.peer.base.view.get(key);
        if(result === null) return null;
        return result.value;
    }

    async append(key, value){
        const nonce = Math.random() + '-' + Date.now();
        const hash = this.peer.wallet.sign(JSON.stringify(value) + nonce);
        await this.peer.base.append({ type: 'feature', key: this.key + '_' + key, value : {
                dispatch : {
                    type : this.key + '_feature',
                    key : key,
                    hash : hash,
                    value : value,
                    nonce : nonce,
                    address : this.peer.wallet.publicKey
                }
            }});
    }

    async start(options = {}) {
        throw Error('Not implemented: start(options = {})');
    }

    async stop(options = {}) {
        throw Error('Not implemented: stop(options = {})');
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

export default Feature;