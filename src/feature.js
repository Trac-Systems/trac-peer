class Feature {

    constructor(peer, options = {}) {
        this.peer = peer;
        this.key = '';
        this.options = options;
    }

    async append(key, value){
        const hash = this.peer.wallet.sign(JSON.stringify(value));
        await this.peer.base.append({ type: 'feature', key: this.key + '_' + key, value : {
            dispatch : {
                type : this.key + '_feature',
                key : key,
                hash : hash,
                value : value
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