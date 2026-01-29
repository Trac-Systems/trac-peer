/** @typedef {import('pear-interface')} */ /* global Pear */
import readline from 'readline';
import tty from 'tty';
import b4a from "b4a";
import { createMessage } from 'trac-msb/src/utils/buffer.js';
import { blake3 } from '@tracsystems/blake3';
import { MSB_OPERATION_TYPE } from './msbClient.js';
import { requireAdmin, requireAdminOrMod, requireBootstrapNodeForAdminSet } from "./permissions.js";

class TerminalHandlers {
    #peer

    constructor(peer) {
        this.#peer = peer
    }

    async setWhitelistStatus(input){
        const peer = this.#peer;
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

    async enableTransactions(input){
        const peer = this.#peer;
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

    async enableWhitelist(input){
        const peer = this.#peer;
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

    async unpinMessage(input){
        const peer = this.#peer;
        await requireAdminOrMod(peer);
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

    async pinMessage(input){
        const peer = this.#peer;
        await requireAdminOrMod(peer);
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

    async deleteMessage(input){
        const peer = this.#peer;
        await requireAdminOrMod(peer);
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

    async updateAdmin(input){
        const peer = this.#peer;
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

    async setMod(input){
        const peer = this.#peer;
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

    async muteStatus(input){
        const peer = this.#peer;
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

    async setNick(input){
        const peer = this.#peer;
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

    async postMessage(input){
        const peer = this.#peer;
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

    async setChatStatus(input){
        const peer = this.#peer;
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

    async setAutoAddWriters(input){
        const peer = this.#peer;
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

    async addAdmin(input){
        const peer = this.#peer;
        await requireBootstrapNodeForAdminSet(peer);
        const splitted = peer.protocol_instance.parseArgs(input)
        const publicKey = (splitted.address != null ? String(splitted.address) : '').trim().toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(publicKey)) {
            throw new Error(
                'Invalid --address. Expected a 32-byte hex public key (64 hex chars). Example: /add_admin --address "<peer-publicKey-hex>"'
            );
        }
        await this.#addAdminKey(publicKey);
    }

    async #addAdminKey(publicKeyHex){
        const peer = this.#peer;
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

    async #appendAddWriter(keyHex, isIndexer){
        const peer = this.#peer;
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

    async #addWriterKey(keyHex){
        return this.#appendAddWriter(keyHex, false);
    }

    async #addIndexerKey(keyHex){
        return this.#appendAddWriter(keyHex, true);
    }

    async addWriter(input){
        const peer = this.#peer;
        await requireAdmin(peer);
        const parsed = peer.protocol_instance.parseArgs(input);
        return this.#addWriterKey(parsed.key);
    }

    async addIndexer(input){
        const peer = this.#peer;
        await requireAdmin(peer);
        const parsed = peer.protocol_instance.parseArgs(input);
        return this.#addIndexerKey(parsed.key);
    }

    async #appendRemoveWriter(keyHex){
        const peer = this.#peer;
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

    async #removeWriterKey(keyHex){
        return this.#appendRemoveWriter(keyHex);
    }

    async #removeIndexerKey(keyHex){
        // Current apply operation is `removeWriter` and it removes either writer or indexer.
        // This keeps the exact on-chain / on-log operation type unchanged.
        return this.#appendRemoveWriter(keyHex);
    }

    async removeWriter(input){
        const peer = this.#peer;
        await requireAdmin(peer);
        const parsed = peer.protocol_instance.parseArgs(input);
        return this.#removeWriterKey(parsed.key);
    }

    async removeIndexer(input){
        const peer = this.#peer;
        await requireAdmin(peer);
        const parsed = peer.protocol_instance.parseArgs(input);
        return this.#removeIndexerKey(parsed.key);
    }

    async joinValidator(input){
        const peer = this.#peer;
        console.log('Please wait...')
        const splitted = peer.protocol_instance.parseArgs(input)
        const address = ''+splitted.address;
        const pubKeyHex = peer.msbClient.addressToPubKeyHex(address);
        if(pubKeyHex === null) throw new Error('Invalid validator address.');
        await peer.msbClient.msb.network.tryConnect(pubKeyHex, 'validator');
    }

    async verifyDag(_input){
        const peer = this.#peer;
        if (peer.verifyDag) {
            return peer.verifyDag();
        }
        try {
            console.log('--- Stats ---');
            const dagView = await peer.base.view.core.treeHash();
            const lengthdagView = peer.base.view.core.length;
            const dagSystem = await peer.base.system.core.treeHash();
            const lengthdagSystem = peer.base.system.core.length;
            console.log('wallet.address:', peer.wallet !== null ? peer.wallet.publicKey : 'unset');
            console.log('hypermall.writerKey:', peer.writerLocalKey);
            const admin = await peer.base.view.get('admin')
            console.log(`admin: ${admin !== null ? admin.value : 'unset'}`);
            console.log(`isIndexer: ${peer.base.isIndexer}`);
            console.log(`isWriter: ${peer.base.writable}`);
            console.log('swarm.connections.size:', peer.swarm.connections.size);
            console.log('base.view.core.signedLength:', peer.base.view.core.signedLength);
            console.log("base.signedLength", peer.base.signedLength);
            console.log("base.indexedLength", peer.base.indexedLength);
            console.log("base.linearizer.indexers.length", peer.base.linearizer.indexers.length);
            console.log(`base.key: ${peer.base.key.toString('hex')}`);
            console.log('discoveryKey:', b4a.toString(peer.base.discoveryKey, 'hex'));
            console.log(`VIEW Dag: ${dagView.toString('hex')} (length: ${lengthdagView})`);
            console.log(`SYSTEM Dag: ${dagSystem.toString('hex')} (length: ${lengthdagSystem})`);
            const wl = await peer.base.view.get('wrl');
            console.log('Total Registered Writers:', wl !== null ? wl.value : 0);
        } catch (error) {
            console.error('Error during DAG monitoring:', error.message);
        }
    }

    async tx(input){
        const peer = this.#peer;
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

    async deploySubnet(input){
        const peer = this.#peer;
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

    getKeys(){
        const peer = this.#peer;
        console.log("Address: ", peer.wallet.address);
        console.log("Public Key: ", peer.wallet.publicKey);
        console.log("Secret Key: ", peer.wallet.secretKey);
    }

    async exit({ rl } = {}){
        console.log('Exiting...');
        if(rl) rl.close();
        await this.#peer.close();
        typeof process !== "undefined" ? process.exit(0) : Pear.exit(0);
        return { exit: true };
    }
}

class Terminal {
    #peer
    #handlers

    constructor(peer) {
        this.#peer = peer
        this.#handlers = new TerminalHandlers(peer)
    }

    printHelp() {
        console.log('Node started. Available commands:');
        console.log(' ');
        console.log('- Setup Commands:');
        console.log('- /add_admin | Works only once and only on the bootstrap node. Enter a peer public key (hex) to assign admin rights: \'/add_admin --address "<hex>"\'.');
        console.log('- /update_admin | Existing admins may transfer admin ownership. Enter "null" as address to waive admin rights for this peer entirely: \'/update_admin --address "<address>"\'.');
        console.log('- /add_indexer | Only admin. Enter a peer writer key to get included as indexer for this network: \'/add_indexer --key "<key>"\'.');
        console.log('- /add_writer | Only admin. Enter a peer writer key to get included as writer for this network: \'/add_writer --key "<key>"\'.');
        console.log('- /remove_writer | Only admin. Enter a peer writer key to get removed as writer or indexer for this network: \'/remove_writer --key "<key>"\'.');
        console.log('- /remove_indexer | Only admin. Alias of /remove_writer (removes indexer as well): \'/remove_indexer --key "<key>"\'.');
        console.log('- /set_auto_add_writers | Only admin. Allow any peer to join as writer automatically: \'/set_auto_add_writers --enabled 1\'');
        console.log('- /enable_transactions | Enable transactions.');
        console.log(' ');
        console.log('- Chat Commands:');
        console.log('- /set_chat_status | Only admin. Enable/disable the built-in chat system: \'/set_chat_status --enabled 1\'. The chat system is disabled by default.');
        console.log('- /post | Post a message: \'/post --message "Hello"\'. Chat must be enabled. Optionally use \'--reply_to <message id>\' to respond to a desired message.');
        console.log('- /set_nick | Change your nickname like this \'/set_nick --nick "Peter"\'. Chat must be enabled. Can be edited by admin and mods using the optional --user <address> flag.');
        console.log('- /mute_status | Only admin and mods. Mute or unmute a user by their address: \'/mute_status --user "<address>" --muted 1\'.');
        console.log('- /set_mod | Only admin. Set a user as mod: \'/set_mod --user "<address>" --mod 1\'.');
        console.log('- /delete_message | Delete a message: \'/delete_message --id 1\'. Chat must be enabled.');
        console.log('- /pin_message | Set the pin status of a message: \'/pin_message --id 1 --pin 1\'. Chat must be enabled.');
        console.log('- /unpin_message | Unpin a message by its pin id: \'/unpin_message --pin_id 1\'. Chat must be enabled.');
        console.log('- /enable_whitelist | Only admin. Enable/disable chat whitelists: \'/enable_whitelist --enabled 1\'.');
        console.log('- /set_whitelist_status | Only admin. Add/remove users to/from the chat whitelist: \'/set_whitelist_status --user "<address>" --status 1\'.');
        console.log(' ');
        console.log('- System Commands:');
        console.log('- /tx | Perform a contract transaction. The command flag contains contract commands (format is protocol dependent): \'/tx --command "<string>"\'. To simulate a tx, additionally use \'--sim 1\'.');
        console.log('- /join_validator | Try to connect to a specific validator with its MSB address: \'/join_validator --address "<address>"\'.');
        console.log('- /deploy_subnet | Register this subnet in the MSB (required before TX settlement): \'/deploy_subnet\'.');
        console.log('- /stats | check system properties such as writer key, DAG, etc.');
        console.log('- /get_keys | prints your public and private keys. Be careful and never share your private key!');
        console.log('- /exit | Exit the program');
        console.log('- /help | This help text');
    
        this.#peer.protocol_instance.printOptions();
    }

    async start({ readlineInstance = null } = {}) {
        const peer = this.#peer;
        if (!peer) return;
        if (global.Pear !== undefined && global.Pear.config?.options?.type === 'desktop') return;
    
        let rl = readlineInstance;
        if (!rl) {
            try {
                rl = readline.createInterface({
                    input: new tty.ReadStream(0),
                    output: new tty.WriteStream(1),
                });
            } catch (_e) {
                try {
                    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
                } catch (_e2) {
                    return;
                }
            }
        }
    
        this.printHelp();

        const commandHandlers = [
            { rule: (line) => line === '/stats', handler: (line) => this.#handlers.verifyDag(line) },
            { rule: (line) => line === '/help', handler: () => this.printHelp() },
            { rule: (line) => line === '/exit', handler: () => this.#handlers.exit({ rl }) },
            { rule: (line) => line === '/get_keys', handler: () => this.#handlers.getKeys() },
            { rule: (line) => line.startsWith('/tx'), handler: (line) => this.#handlers.tx(line) },
            { rule: (line) => line.startsWith('/add_indexer'), handler: (line) => this.#handlers.addIndexer(line) },
            { rule: (line) => line.startsWith('/add_writer'), handler: (line) => this.#handlers.addWriter(line) },
            { rule: (line) => line.startsWith('/remove_writer'), handler: (line) => this.#handlers.removeWriter(line) },
            { rule: (line) => line.startsWith('/remove_indexer'), handler: (line) => this.#handlers.removeIndexer(line) },
            { rule: (line) => line.startsWith('/add_admin'), handler: (line) => this.#handlers.addAdmin(line) },
            { rule: (line) => line.startsWith('/update_admin'), handler: (line) => this.#handlers.updateAdmin(line) },
            { rule: (line) => line.startsWith('/enable_transactions'), handler: (line) => this.#handlers.enableTransactions(line) },
            { rule: (line) => line.startsWith('/set_auto_add_writers'), handler: (line) => this.#handlers.setAutoAddWriters(line) },
            { rule: (line) => line.startsWith('/set_chat_status'), handler: (line) => this.#handlers.setChatStatus(line) },
            { rule: (line) => line.startsWith('/post'), handler: (line) => this.#handlers.postMessage(line) },
            { rule: (line) => line.startsWith('/set_nick'), handler: (line) => this.#handlers.setNick(line) },
            { rule: (line) => line.startsWith('/mute_status'), handler: (line) => this.#handlers.muteStatus(line) },
            { rule: (line) => line.startsWith('/pin_message'), handler: (line) => this.#handlers.pinMessage(line) },
            { rule: (line) => line.startsWith('/unpin_message'), handler: (line) => this.#handlers.unpinMessage(line) },
            { rule: (line) => line.startsWith('/set_mod'), handler: (line) => this.#handlers.setMod(line) },
            { rule: (line) => line.startsWith('/delete_message'), handler: (line) => this.#handlers.deleteMessage(line) },
            { rule: (line) => line.startsWith('/enable_whitelist'), handler: (line) => this.#handlers.enableWhitelist(line) },
            { rule: (line) => line.startsWith('/set_whitelist_status'), handler: (line) => this.#handlers.setWhitelistStatus(line) },
            { rule: (line) => line.startsWith('/join_validator'), handler: (line) => this.#handlers.joinValidator(line) },
            { rule: (line) => line.startsWith('/deploy_subnet'), handler: (line) => this.#handlers.deploySubnet(line) },
            { rule: () => true, handler: (line) => peer.protocol_instance.customCommand(line) }
        ];

        rl.on('line', async (input) => {
            for (const { rule, handler } of commandHandlers) {
                if (!rule(input)) continue;
                try {
                    const result = await handler(input);
                    if (result?.exit) return;
                } catch (e) {
                    console.log('Command failed:', e.message);
                }
                break;
            }
            rl.prompt();
        });
    
        rl.prompt();
        return rl;
    }
}

export { Terminal };
