import b4a from "b4a";
import { createMessage } from 'trac-msb/src/utils/buffer.js';
import { blake3 } from '@tracsystems/blake3';
import { MSB_OPERATION_TYPE } from './msbClient.js';
import { requireAdmin, requireAdminOrMod, requireBootstrapNodeForAdminSet } from "./permissions.js";

export async function setWhitelistStatus(input, peer){
    await requireAdmin(peer);
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
    await requireAdmin(peer);
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
    await requireAdminOrMod(peer);
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
    await requireAdminOrMod(peer);
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
    await requireAdminOrMod(peer);
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
    await requireAdmin(peer);
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
    await requireAdmin(peer);
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
    await requireAdminOrMod(peer);
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
    if (user !== null && user !== peer.wallet.publicKey) {
        await requireAdminOrMod(peer);
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
    const chat_status = await peer.base.view.get('chat_status');
    if (chat_status === null || chat_status.value !== 'on') throw new Error('Chat is disabled.');
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
    await requireAdmin(peer);
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
    await requireAdmin(peer);
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
    await requireBootstrapNodeForAdminSet(peer);
    const splitted = peer.protocol_instance.parseArgs(input)
    const publicKey = (splitted.address != null ? String(splitted.address) : '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(publicKey)) {
        throw new Error(
            'Invalid --address. Expected a 32-byte hex public key (64 hex chars). Example: /add_admin --address "<peer-publicKey-hex>"'
        );
    }
    await addAdminKey(publicKey, peer);
}

export async function addAdminKey(publicKeyHex, peer){
    await requireBootstrapNodeForAdminSet(peer);
    const publicKey = (publicKeyHex != null ? String(publicKeyHex) : '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(publicKey)) {
        throw new Error('Invalid public key. Expected 32-byte hex (64 chars).');
    }
    if(peer.base.writable === false){
        throw new Error('Peer is not writable.');
    }
    await peer.base.append({ type: 'addAdmin', key: publicKey });
}

async function appendAddWriter(peer, keyHex, isIndexer){
    await requireAdmin(peer);
    const wk = (keyHex != null ? String(keyHex) : '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(wk)) throw new Error('Invalid --key. Expected 32-byte hex (64 chars).');
    const nonce = peer.protocol_instance.generateNonce();
    const msg = { type: isIndexer ? 'addIndexer' : 'addWriter', key: wk };
    const signature = { msg: msg };
    const hash = peer.wallet.sign(JSON.stringify(msg) + nonce);
    if(peer.base.writable === false){
        throw new Error('Peer is not writable.');
    }
    await peer.base.append({
        op : 'append_writer',
        type: isIndexer ? 'addIndexer' : 'addWriter',
        key: wk,
        value: signature,
        hash: hash,
        nonce: nonce
    });
}

export async function addWriterKey(keyHex, peer){
    return appendAddWriter(peer, keyHex, false);
}

export async function addIndexerKey(keyHex, peer){
    return appendAddWriter(peer, keyHex, true);
}

export async function addWriter(input, peer){
    await requireAdmin(peer);
    const parsed = peer.protocol_instance.parseArgs(input);
    return addWriterKey(parsed.key, peer);
}

export async function addIndexer(input, peer){
    await requireAdmin(peer);
    const parsed = peer.protocol_instance.parseArgs(input);
    return addIndexerKey(parsed.key, peer);
}

async function appendRemoveWriter(peer, keyHex){
    await requireAdmin(peer);
    const wk = (keyHex != null ? String(keyHex) : '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(wk)) throw new Error('Invalid --key. Expected 32-byte hex (64 chars).');
    const nonce = peer.protocol_instance.generateNonce();
    const msg = { type: 'removeWriter', key: wk };
    const signature = { msg: msg };
    const hash = peer.wallet.sign(JSON.stringify(msg) + nonce);
    if(peer.base.writable === false){
        throw new Error('Peer is not writable.');
    }
    await peer.base.append({ op : 'remove_writer', type: 'removeWriter', key: wk, value: signature, hash: hash, nonce : nonce });
}

export async function removeWriterKey(keyHex, peer){
    return appendRemoveWriter(peer, keyHex);
}

export async function removeIndexerKey(keyHex, peer){
    // Current apply operation is `removeWriter` and it removes either writer or indexer.
    // This keeps the exact on-chain / on-log operation type unchanged.
    return appendRemoveWriter(peer, keyHex);
}

export async function removeWriter(input, peer){
    await requireAdmin(peer);
    const parsed = peer.protocol_instance.parseArgs(input);
    return removeWriterKey(parsed.key, peer);
}

export async function removeIndexer(input, peer){
    await requireAdmin(peer);
    const parsed = peer.protocol_instance.parseArgs(input);
    return removeIndexerKey(parsed.key, peer);
}

export async function joinValidator(input, peer){
    console.log('Please wait...')
    const splitted = peer.protocol_instance.parseArgs(input)
    const address = ''+splitted.address;
    const pubKeyHex = peer.msbClient.addressToPubKeyHex(address);
    if(pubKeyHex === null) throw new Error('Invalid validator address.');
    await peer.msbClient.msb.network.tryConnect(pubKeyHex, 'validator');
}

export async function tx(input, peer){
    if(peer.base?.writable === false) throw new Error('Peer is not writable.');
    const splitted = peer.protocol_instance.parseArgs(input);
    let res = false;
    if(splitted.command === undefined){
        res = new Error('Missing option. Please use the --command flag.');
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
        } else if(res && typeof res === 'object') {
            if(res.txo && res.txo.tx) {
                console.log('MSB TX broadcasted:', res.txo.tx);
            } else if(res.bdo && res.bdo.tx) {
                console.log('MSB BOOTSTRAP_DEPLOYMENT broadcasted:', res.bdo.tx);
            }
        }
    }
    return res;
}

export async function deploySubnet(input, peer){
    if(peer.wallet.publicKey === null || peer.wallet.secretKey === null) throw new Error('Wallet is not initialized.');

    const txvHex = await peer.msbClient.getTxvHex();
    const nonceHex = peer.protocol_instance.generateNonce();
    const subnetBootstrapHex = (b4a.isBuffer(peer.config.bootstrap) ? peer.config.bootstrap.toString('hex') : (''+peer.config.bootstrap)).toLowerCase();
    const channelHex = b4a.isBuffer(peer.config.channel) ? peer.config.channel.toString('hex') : null;
    if(channelHex === null) throw new Error('Peer channel is not initialized.');

    const address = peer.msbClient.pubKeyHexToAddress(peer.wallet.publicKey);
    if(address === null) throw new Error('Failed to create MSB address from public key.');

    const msg = createMessage(
        peer.msbClient.networkId,
        b4a.from(txvHex, 'hex'),
        b4a.from(subnetBootstrapHex, 'hex'),
        b4a.from(channelHex, 'hex'),
        b4a.from(nonceHex, 'hex'),
        MSB_OPERATION_TYPE.BOOTSTRAP_DEPLOYMENT
    );
    const txBuf = await blake3(msg);
    const txHex = b4a.toString(txBuf, 'hex');
    const signatureHex = peer.wallet.sign(txBuf);

    const payload = {
        type: MSB_OPERATION_TYPE.BOOTSTRAP_DEPLOYMENT,
        address,
        bdo: {
            tx: txHex,
            txv: txvHex,
            bs: subnetBootstrapHex,
            ic: channelHex,
            in: nonceHex,
            is: signatureHex
        }
    };

    const ok = await peer.msbClient.broadcastBootstrapDeployment(payload);
    if(ok !== true) throw new Error('Subnet deployment broadcast failed.');
    console.log('Subnet bootstrap:', subnetBootstrapHex);
    console.log('Subnet channel (hex):', channelHex);
    console.log('Subnet deployment tx:', payload.bdo.tx);
    return payload;
}

export async function createHash(message) {
    const out = await blake3(message);
    return b4a.toString(out, 'hex');
}
