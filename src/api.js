export class ProtocolApi{
    constructor(options = {}) {
        this.peer = options.peer || null;
    }

    async getAdmin(signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('admin');
        if(false === signed) res = await this.peer.protocol_instance.get('admin');
        if(null !== res) return res;
        return null;
    }

    async getWhitelistEnabled(signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('wlst');
        if(false === signed) res = await this.peer.protocol_instance.get('wlst');
        if(null !== res) return res;
        return false;
    }

    async getWhitelistStatus(address, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('wl/'+address);
        if(false === signed) res = await this.peer.protocol_instance.get('wl/'+address);
        if(null !== res) return res;
        return false;
    }

    async getModStatus(address, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('mod/'+address);
        if(false === signed) res = await this.peer.protocol_instance.get('mod/'+address);
        if(null !== res) return res;
        return false;
    }

    async getMuteStatus(address, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('mtd/'+address);
        if(false === signed) res = await this.peer.protocol_instance.get('mtd/'+address);
        if(null !== res) return res;
        return false;
    }

    async getAutoAddWritersStatus(signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('auto_add_writers');
        if(false === signed) res = await this.peer.protocol_instance.get('auto_add_writers');
        if(null !== res) {
            return res === 'on';
        }
        return false;
    }

    async getChatStatus(signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('chat_status');
        if(false === signed) res = await this.peer.protocol_instance.get('chat_status');
        if(null !== res) {
            return res === 'on';
        }
        return false;
    }

    async getAddressFromNick(nick, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('kcin/'+nick);
        if(false === signed) res = await this.peer.protocol_instance.get('kcin/'+nick);
        console.log(JSON.stringify(res));
        return res;
    }

    async getNick(address, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('nick/'+address);
        if(false === signed) res = await this.peer.protocol_instance.get('nick/'+address);
        console.log(JSON.stringify(res));
        return res;
    }

    async getDeletedMessageLength(signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('delml');
        if(false === signed) res = await this.peer.protocol_instance.get('delml');
        res = res !== null ? res : 0;
        console.log(JSON.stringify(res));
        return res;
    }

    async getDeletedMessage(index, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('delm/'+parseInt(index));
        if(false === signed) res = await this.peer.protocol_instance.get('delm/'+parseInt(index));
        if(null === res) {
            console.log(JSON.stringify(null));
            return null
        }
        return await this.getMessage(res, signed);
    }

    async getMessageLength(signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('msgl');
        if(false === signed) res = await this.peer.protocol_instance.get('msgl');
        res = res !== null ? res : 0;
        console.log(JSON.stringify(res));
        return res;
    }

    async getMessage(index, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('msg/'+parseInt(index));
        if(false === signed) res = await this.peer.protocol_instance.get('msg/'+parseInt(index));
        console.log(JSON.stringify(res));
        return res;
    }

    async getUserMessageLength(address, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('umsgl/'+address);
        if(false === signed) res = await this.peer.protocol_instance.get('umsgl/'+address);
        res = res !== null ? res : 0;
        console.log(JSON.stringify(res));
        return res;
    }

    async getUserMessage(address, index, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('umsg/'+address+'/'+parseInt(index));
        if(false === signed) res = await this.peer.protocol_instance.get('umsg/'+address+'/'+parseInt(index));
        if(null === res) {
            console.log(JSON.stringify(null));
            return null
        }
        return await this.getMessage(res, signed);
    }

    async getTxLength(signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('txl');
        if(false === signed) res = await this.peer.protocol_instance.get('txl');
        res = res !== null ? res : 0;
        console.log(JSON.stringify(res));
        return res;
    }

    async getTx(index, signed = true){
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('txi/'+parseInt(index));
        if(false === signed) res = await this.peer.protocol_instance.get('txi/'+parseInt(index));
        console.log(JSON.stringify(res));
        return res;
    }

    async getTxData(index, signed = true){
        const tx = await this.getTx(index, signed);
        if(null === tx) return null;
        let res = null;
        if(true === signed) res = await this.peer.protocol_instance.getSigned('tx/'+tx);
        if(false === signed) res = await this.peer.protocol_instance.get('tx/'+tx);
        console.log(JSON.stringify(res));
        return res;
    }
}

export default ProtocolApi;