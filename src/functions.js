import yargs from 'yargs/yargs';

export function resolveNumberString(number, decimals){
    number = number + '';
    decimals = isNaN(decimals) ? 18 : parseInt(decimals);
    let splitted = number.split(".");
    if(splitted.length == 1 && decimals > 0){
        splitted[1] = '';
    }
    if(splitted.length > 1) {
        let size = decimals - splitted[1].length;
        for (let i = 0; i < size; i++) {
            splitted[1] += "0";
        }
        let new_splitted = '';
        for(let i = 0; i < splitted[1].length; i++)
        {
            if(i >= decimals)
            {
                break;
            }
            new_splitted += splitted[1][i];
        }
        number = "" + (splitted[0] == '0' ? '' : splitted[0]) + new_splitted;
        if(BigInt(number) == 0n || number === ''){
            number = "0";
        }
    }

    try {

        while (number.charAt(0) === '0') {
            number = number.substring(1);
        }

    }catch(e){

        number = '0';
    }

    return number === '' ? '0' : number;
}

export function formatNumberString(string, decimals) {
    string = string + '';
    decimals = isNaN(decimals) ? 18 : parseInt(decimals);
    let pos = string.length - decimals;

    if(decimals == 0) {
        // nothing
    }else
    if(pos > 0){
        string = string.substring(0, pos) + "." + string.substring(pos, string.length);
    }else{
        string = '0.' + ( "0".repeat( decimals - string.length ) ) + string;
    }

    return removeTrailingZeros(string);
}

export function removeTrailingZeros(value) {
    value = value.toString();
    if (value.indexOf('.') === -1) {
        return value;
    }

    while((value.slice(-1) === '0' || value.slice(-1) === '.') && value.indexOf('.') !== -1) {
        value = value.substr(0, value.length - 1);
    }
    return value;
}


export function restoreManifest(parsedManifest) {

    if (Array.isArray(parsedManifest.signers)) {
        parsedManifest.signers = parsedManifest.signers.map(signer => {
            if(signer.namespace && signer.namespace.data &&signer.publicKey && signer.publicKey.data){
                return {
                    ...signer,
                    namespace: Buffer.from(signer.namespace.data),
                    publicKey: Buffer.from(signer.publicKey.data),
                }
            } else {
                return signer;
            }
        });
    }

    return parsedManifest;
}

export function visibleLength(str) {
    return [...new Intl.Segmenter().segment(str)].length
}

export function jsonStringify(value){
    try {
        return JSON.stringify(value);
    } catch(e){
        console.log(e);
    }
    return null;
}

export async function setWhitelistStatus(input, peer){
    const splitted = yargs(input).parse();
    const value = splitted.user;
    const status = parseInt(splitted.status) === 1;
    const nonce = Math.random() + '-' + Date.now();
    const signature = { dispatch : {
            type : 'setWhitelistStatus',
            user: value,
            status : status,
            address : peer.wallet.publicKey
        }};
    const hash = peer.wallet.sign(JSON.stringify(signature) + nonce);
    await peer.base.append({type: 'setWhitelistStatus', value: signature, hash : hash, nonce: nonce });
}

export async function enableWhitelist(input, peer){
    const splitted = yargs(input).parse();
    const value = splitted.enabled === 1;
    const nonce = Math.random() + '-' + Date.now();
    const signature = { dispatch : {
            type : 'enableWhitelist',
            enabled: value,
            address : peer.wallet.publicKey
        }};
    const hash = peer.wallet.sign(JSON.stringify(signature) + nonce);
    await peer.base.append({type: 'enableWhitelist', value: signature, hash : hash, nonce: nonce });
}

export async function deleteMessage(input, peer){
    const splitted = yargs(input).parse();
    const value = splitted.id;
    const nonce = Math.random() + '-' + Date.now();
    const signature = { dispatch : {
            type : 'deleteMessage',
            id: value,
            address : peer.wallet.publicKey
        }};
    const hash = peer.wallet.sign(JSON.stringify(signature) + nonce);
    await peer.base.append({type: 'deleteMessage', value: signature, hash : hash, nonce: nonce });
}

export async function setMod(input, peer){
    const splitted = yargs(input).parse();
    const value = splitted.user;
    const mod = parseInt(splitted.mod) === 1;
    const nonce = Math.random() + '-' + Date.now();
    const signature = { dispatch : {
            type : 'setMod',
            user: value,
            mod : mod,
            address : peer.wallet.publicKey
        }};
    const hash = peer.wallet.sign(JSON.stringify(signature) + nonce);
    await peer.base.append({type: 'setMod', value: signature, hash : hash, nonce: nonce });
}

export async function muteStatus(input, peer){
    const splitted = yargs(input).parse();
    const value = splitted.user;
    const muted = parseInt(splitted.muted) === 1;
    const nonce = Math.random() + '-' + Date.now();
    const signature = { dispatch : {
            type : 'muteStatus',
            user: value,
            muted : muted,
            address : peer.wallet.publicKey
        }};
    const hash = peer.wallet.sign(JSON.stringify(signature) + nonce);
    await peer.base.append({type: 'muteStatus', value: signature, hash : hash, nonce: nonce });
}

export async function setNick(input, peer){
    const splitted = yargs(input).parse();
    const value = splitted.nick;
    let user = null;
    if(splitted.user !== undefined){
        user = splitted.user;
    }
    const nonce = Math.random() + '-' + Date.now();
    const signature = { dispatch : {
            type : 'setNick',
            nick: value,
            address : null === user ? peer.wallet.publicKey : user,
            initiator: peer.wallet.publicKey
        }};
    const hash = peer.wallet.sign(JSON.stringify(signature) + nonce);
    await peer.base.append({type: 'setNick', value: signature, hash : hash, nonce: nonce });
}

export async function postMessage(input, peer){
    const splitted = yargs(input).parse();
    if(typeof splitted.message === "boolean" || splitted.message === undefined) throw new Error('Empty message not allowed');
    const value = splitted.message;
    const nonce = Math.random() + '-' + Date.now();
    const signature = { dispatch : {
            type : 'msg',
            msg: value,
            address : peer.wallet.publicKey,
            attachments : [],
            deleted_by : null
        }};
    const hash = peer.wallet.sign(JSON.stringify(signature) + nonce);
    await peer.base.append({type: 'msg', value: signature, hash : hash, nonce: nonce });
}

export async function setChatStatus(input, peer){
    const splitted = yargs(input).parse();
    const value = splitted.enabled === 1 ? 'on' : 'off';
    const nonce = Math.random() + '-' + Date.now();
    if(value !== 'on' && value !== 'off') throw new Error('setChatStatus: use on and off values.');
    const msg = { type: 'setChatStatus', key: value }
    const signature = {
        msg: msg
    };
    const hash = peer.wallet.sign(JSON.stringify(msg) + nonce);
    await peer.base.append({type: 'setChatStatus', key: value, value: signature, hash : hash, nonce: nonce });
}

export async function setAutoAddWriters(input, peer){
    const splitted = yargs(input).parse();
    const value = splitted.enabled === 1 ? 'on' : 'off';
    const nonce = Math.random() + '-' + Date.now();
    if(value !== 'on' && value !== 'off') throw new Error('setAutoAddWriters: use on and off values.');
    const msg = { type: 'setAutoAddWriters', key: value }
    const signature = {
        msg: msg
    };
    const hash = peer.wallet.sign(JSON.stringify(msg) + nonce);
    await peer.base.append({type: 'setAutoAddWriters', key: value, value: signature, hash : hash, nonce: nonce });
}

export async function addAdmin(input, peer){
    const splitted = yargs(input).parse();
    const publicKey = splitted.address;
    await peer.base.append({ type: 'addAdmin', key: publicKey });
}

export async function addWriter(input, peer){
    const splitted = input.split(' ');
    const parsed = yargs(input).parse();
    const nonce = Math.random() + '-' + Date.now();
    if(splitted[0] === '/add_indexer'){
        const msg = { type: 'addIndexer', key: parsed.key }
        const signature = {
            msg: msg
        };
        const hash = peer.wallet.sign(JSON.stringify(msg) + nonce);
        peer.emit('announce', { op : 'append_writer', type: 'addIndexer', key: parsed.key, value: signature, hash: hash, nonce: nonce });
    } else if(splitted[0] === '/add_writer') {
        const msg = { type: 'addWriter', key: parsed.key }
        const signature = {
            msg: msg
        };
        const hash = peer.wallet.sign(JSON.stringify(msg) + nonce);
        peer.emit('announce', { op : 'append_writer', type: 'addWriter', key: parsed.key, value: signature, hash: hash, nonce : nonce });
    }
}
