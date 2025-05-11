import b4a from "b4a";

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
                    namespace: b4a.from(signer.namespace.data),
                    publicKey: b4a.from(signer.publicKey.data),
                }
            } else {
                return signer;
            }
        });
    }

    return parsedManifest;
}

export function visibleLength(str) {
    return b4a.byteLength(str);
}

export function jsonStringify(value){
    try {
        return JSON.stringify(value);
    } catch(e){
        console.log(e);
    }
    return null;
}

export function jsonParse(str){
    try {
        return JSON.parse(str);
    } catch(e){
        console.log(e);
    }
    return undefined;
}

export function safeClone(obj){
    if(typeof obj !== 'object') return null;
    const str = jsonStringify(obj);
    if(str === null) return null;
    const obj2 = jsonParse(str);
    if(obj2 === undefined) return null;
    return obj2;
}

export async function setWhitelistStatus(input, peer){
    const splitted = peer.protocol_instance.parseArgs(input)
    const value = ''+splitted.user;
    const status = parseInt(splitted.status) === 1;
    const nonce = peer.protocol_instance.generateNonce();
    const signature = { dispatch : {
            type : 'setWhitelistStatus',
            user: value,
            status : status,
            address : peer.wallet.publicKey
        }};
    const hash = peer.wallet.sign(JSON.stringify(signature) + nonce);
    await peer.base.append({type: 'setWhitelistStatus', value: signature, hash : hash, nonce: nonce });
}

export async function enableTransactions(input, peer){
    const splitted = peer.protocol_instance.parseArgs(input)
    const value = parseInt(splitted.enabled) === 1;
    const nonce = peer.protocol_instance.generateNonce();
    const signature = { dispatch : {
            type : 'enableTransactions',
            enabled: value,
            address : peer.wallet.publicKey
        }};
    const hash = peer.wallet.sign(JSON.stringify(signature) + nonce);
    await peer.base.append({type: 'enableTransactions', value: signature, hash : hash, nonce: nonce });
}

export async function enableWhitelist(input, peer){
    const splitted = peer.protocol_instance.parseArgs(input)
    const value = parseInt(splitted.enabled) === 1;
    const nonce = peer.protocol_instance.generateNonce();
    const signature = { dispatch : {
            type : 'enableWhitelist',
            enabled: value,
            address : peer.wallet.publicKey
        }};
    const hash = peer.wallet.sign(JSON.stringify(signature) + nonce);
    await peer.base.append({type: 'enableWhitelist', value: signature, hash : hash, nonce: nonce });
}

export async function unpinMessage(input, peer){
    let address = null;
    const splitted = peer.protocol_instance.parseArgs(input)
    const value = parseInt(splitted.pin_id);
    const nonce = peer.protocol_instance.generateNonce();
    const signature = { dispatch : {
            type : 'unpinMessage',
            id: value,
            address : peer.wallet.publicKey
        }};
    const hash = peer.wallet.sign(JSON.stringify(signature) + nonce);
    await peer.base.append({type: 'unpinMessage', value: signature, hash : hash, nonce: nonce });
}

export async function pinMessage(input, peer){
    let address = null;
    const splitted = peer.protocol_instance.parseArgs(input)
    const value = parseInt(splitted.id);
    const pinned = parseInt(splitted.pin) === 1;
    const nonce = peer.protocol_instance.generateNonce();
    const signature = { dispatch : {
            type : 'pinMessage',
            id: value,
            pinned : pinned,
            address : peer.wallet.publicKey
        }};
    const hash = peer.wallet.sign(JSON.stringify(signature) + nonce);
    await peer.base.append({type: 'pinMessage', value: signature, hash : hash, nonce: nonce });
}

export async function deleteMessage(input, peer){
    let address = null;
    const splitted = peer.protocol_instance.parseArgs(input)
    const value = parseInt(splitted.id);
    const nonce = peer.protocol_instance.generateNonce();
    const signature = { dispatch : {
            type : 'deleteMessage',
            id: value,
            address : peer.wallet.publicKey
        }};
    const hash = peer.wallet.sign(JSON.stringify(signature) + nonce);
    await peer.base.append({type: 'deleteMessage', value: signature, hash : hash, nonce: nonce });
}

export async function updateAdmin(input, peer){
    const splitted = peer.protocol_instance.parseArgs(input)
    const value = ''+splitted.address === 'null' ? null : ''+splitted.address;
    const nonce = peer.protocol_instance.generateNonce();
    const signature = { dispatch : {
            type : 'updateAdmin',
            admin: value,
            address : peer.wallet.publicKey
        }};
    const hash = peer.wallet.sign(JSON.stringify(signature) + nonce);
    await peer.base.append({type: 'updateAdmin', value: signature, hash : hash, nonce: nonce });
}

export async function setMod(input, peer){
    const splitted = peer.protocol_instance.parseArgs(input)
    const value = ''+splitted.user;
    const mod = parseInt(splitted.mod) === 1;
    const nonce = peer.protocol_instance.generateNonce();
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
    const splitted = peer.protocol_instance.parseArgs(input)
    const value = ''+splitted.user;
    const muted = parseInt(splitted.muted) === 1;
    const nonce = peer.protocol_instance.generateNonce();
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
    const splitted = peer.protocol_instance.parseArgs(input)
    const value = ''+splitted.nick;
    let user = null;
    if(splitted.user !== undefined){
        user = ''+splitted.user;
    }
    const nonce = peer.protocol_instance.generateNonce();
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
    const splitted = peer.protocol_instance.parseArgs(input)
    if(typeof splitted.message === "boolean" || splitted.message === undefined) throw new Error('Empty message not allowed');
    const reply_to = splitted.reply_to !== undefined ? parseInt(splitted.reply_to) : null;
    const value = '' + splitted.message;
    const nonce = peer.protocol_instance.generateNonce();
    const signature = { dispatch : {
            type : 'msg',
            msg: value,
            address : peer.wallet.publicKey,
            attachments : [],
            deleted_by : null,
            reply_to : reply_to,
            pinned : false,
            pin_id : null
        }};
    const hash = peer.wallet.sign(JSON.stringify(signature) + nonce);
    await peer.base.append({type: 'msg', value: signature, hash : hash, nonce: nonce });
}

export async function setChatStatus(input, peer){
    const splitted = peer.protocol_instance.parseArgs(input)
    const value = parseInt(splitted.enabled) === 1 ? 'on' : 'off';
    const nonce = peer.protocol_instance.generateNonce();
    if(value !== 'on' && value !== 'off') throw new Error('setChatStatus: use on and off values.');
    const msg = { type: 'setChatStatus', key: value }
    const signature = {
        msg: msg
    };
    const hash = peer.wallet.sign(JSON.stringify(msg) + nonce);
    await peer.base.append({type: 'setChatStatus', key: value, value: signature, hash : hash, nonce: nonce });
}

export async function setAutoAddWriters(input, peer){
    const splitted = peer.protocol_instance.parseArgs(input)
    const value = parseInt(splitted.enabled) === 1 ? 'on' : 'off';
    const nonce = peer.protocol_instance.generateNonce();
    if(value !== 'on' && value !== 'off') throw new Error('setAutoAddWriters: use on and off values.');
    const msg = { type: 'setAutoAddWriters', key: value }
    const signature = {
        msg: msg
    };
    const hash = peer.wallet.sign(JSON.stringify(msg) + nonce);
    await peer.base.append({type: 'setAutoAddWriters', key: value, value: signature, hash : hash, nonce: nonce });
}

export async function addAdmin(input, peer){
    const splitted = peer.protocol_instance.parseArgs(input)
    const publicKey = ''+splitted.address;
    await peer.base.append({ type: 'addAdmin', key: publicKey });
}

export async function addWriter(input, peer){
    const splitted = input.split(' ');
    const parsed = peer.protocol_instance.parseArgs(input)
    const nonce = peer.protocol_instance.generateNonce();
    if(splitted[0] === '/add_indexer'){
        const msg = { type: 'addIndexer', key: ''+parsed.key }
        const signature = {
            msg: msg
        };
        const hash = peer.wallet.sign(JSON.stringify(msg) + nonce);
        if(peer.base.writable){
            await peer.base.append({ op : 'append_writer', type: 'addIndexer', key: parsed.key, value: signature, hash: hash, nonce: nonce });
        }
    } else if(splitted[0] === '/add_writer') {
        const msg = { type: 'addWriter', key: ''+parsed.key }
        const signature = {
            msg: msg
        };
        const hash = peer.wallet.sign(JSON.stringify(msg) + nonce);
        if(peer.base.writable){
            await peer.base.append({ op : 'append_writer', type: 'addWriter', key: ''+parsed.key, value: signature, hash: hash, nonce : nonce });
        }
    }
}


export async function removeWriter(input, peer){
    const splitted = input.split(' ');
    const parsed = peer.protocol_instance.parseArgs(input)
    const nonce = peer.protocol_instance.generateNonce();
    if(splitted[0] === '/remove_writer') {
        const msg = { type: 'removeWriter', key: ''+parsed.key }
        const signature = {
            msg: msg
        };
        const hash = peer.wallet.sign(JSON.stringify(msg) + nonce);
        if(peer.base.writable){
            await peer.base.append({ op : 'remove_writer', type: 'removeWriter', key: ''+parsed.key, value: signature, hash: hash, nonce : nonce });
        }
    }
}

export async function joinValidator(input, peer){
    console.log('Please wait...')
    const splitted = peer.protocol_instance.parseArgs(input)
    const address = ''+splitted.address;
    const validator = await peer.msb.base.view.get(address);
    if(validator === null || false === validator.value.isWriter || true === validator.value.isIndexer){
        throw new Error('Invalid validator address. The target does not seem to be a validator or does not exist.');
    }
    let cnt = 0;
    while(peer.msb.getNetwork().validator !== address){
        if(cnt >= 3) break;
        await peer.msb.tryConnection(address);
        await peer.sleep(10);
        cnt += 1;
    }
    if(peer.msb.getNetwork().validator !== address){
        console.log('Could not connect. You will be connected with the next available one instead.');
    }
}

export async function tx(input, peer){
    const splitted = peer.protocol_instance.parseArgs(input);
    let res = false;
    if(splitted.command === undefined){
        res = new Error('Missing option. Please use the --command flag.');
    } else if(splitted.sim === undefined && peer.msb.getNetwork().validator === null){
        res = new Error('No validator available: Please wait for your peer to find an available one or use joinValidator to connect to a specific one.');
    }
    let sim = false;
    try{
        if(splitted.sim !== undefined && parseInt(splitted.sim) === 1){
            sim = true;
        }
        res = await peer.protocol_instance.tx(splitted, sim);
    } catch(e){ console.log(e) }
    if(res !== false){
        const err = peer.protocol_instance.getError(res);
        if(null !== err){
            console.log(err.message);
        }
    }
    return res;
}