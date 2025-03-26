/** @typedef {import('pear-interface')} */ /* global Pear */
import Autobase from 'autobase';
import Hyperswarm from 'hyperswarm';
import ReadyResource from 'ready-resource';
import b4a from 'b4a';
import Hyperbee from 'hyperbee';
import readline from 'readline';
import Corestore from 'corestore';
import {createHash} from "node:crypto";
import w from 'protomux-wakeup';
const wakeup = new w();
import {addWriter, addAdmin, setAutoAddWriters, setChatStatus, setMod, deleteMessage,
    postMessage, jsonStringify, visibleLength, setNick, muteStatus} from "./functions.js";
export {default as Protocol} from "./protocol.js";
export {default as Contract} from "./contract.js";
export {default as Feature} from "./feature.js";
export {default as Wallet} from "./wallet.js";

export class Peer extends ReadyResource {

    constructor(options = {}) {
        super();
        this.STORES_DIRECTORY = options.stores_directory;
        this.KEY_PAIR_PATH = `${this.STORES_DIRECTORY}${options.store_name}/db/keypair.json`;
        this.keyPair = null;
        this.store = new Corestore(this.STORES_DIRECTORY + options.store_name);
        this.msb = options.msb || null;
        this.swarm = null;
        this.base = null;
        this.key = null;
        this.tx_pool = {};
        this.writerLocalKey = null;
        this.tx_pool_max_size = options.tx_pool_max_size || 1_000;
        this.max_tx_delay = options.max_tx_delay || 60;
        this.bootstrap = options.bootstrap || null;
        this.protocol = options.protocol || null;
        this.contract = options.contract || null;
        this.wallet = options.wallet || null;
        this.features = options.features || [];
        this.protocol_instance = null;
        this.contract_instance = null;
        this.channel = Buffer.alloc(32).fill(options.channel) || null;
        this.tx_channel = Buffer.alloc(32).fill(options.tx_channel) || null;
        this.bee = null;
        this.replicate = options.replicate !== false;
        this.connectedNodes = 1;
        this.isStreaming = false;
        this.connectedPeers = new Set();
        this.options = options;

        this.tx_observer();
        this.nodeListener();
        this._boot();
        this.ready().catch(noop);
    }

    async _boot() {
        const _this = this;
        this.base = new Autobase(this.store, this.bootstrap, {
            valueEncoding: 'json',
            ackInterval: 1000,
            open(store) {
                _this.bee = new Hyperbee(store.get('view'), {
                    extension: false,
                    keyEncoding: 'utf-8',
                    valueEncoding: 'json'
                })
                return _this.bee;
            },
            apply: async (nodes, view, base) => {
                if(this.contract_instance === null) await this.initContract();

                const batch = view.batch();

                for (const node of nodes) {
                    if(node.value === undefined || node.value.type === undefined) continue;
                    const op = node.value;
                    if (op.type === 'tx') {
                        if(op.key === undefined || op.value === undefined || op.value.dispatch === undefined) continue;

                        const str_dispatch = jsonStringify(op.value.dispatch);
                        const msb_view_session = _this.msb.base.view.checkout(op.value.msbsl);
                        const post_tx = await msb_view_session.get(op.key);
                        await msb_view_session.close();
                        if (null !== str_dispatch &&
                            null !== post_tx &&
                            null === await batch.get('tx/'+op.key) &&
                            post_tx.value &&
                            post_tx.value.tx &&
                            op.key === post_tx.value.tx &&
                            post_tx.value.ch === createHash('sha256').update(str_dispatch).digest('hex')) {
                            await batch.put('tx/'+op.key, op.value);
                            await _this.contract_instance.dispatch(op, node, batch);
                            console.log(`${op.key} appended`);
                        }
                    } else if(op.type === 'msg') {
                        if(op.value === undefined || op.value.dispatch === undefined || op.value.dispatch.attachments === undefined ||
                            !Array.isArray(op.value.dispatch.attachments) || op.value.dispatch.msg === undefined ||
                            typeof op.value.dispatch.msg !== "string" || op.value.dispatch.type === undefined ||
                            op.value.dispatch.address === undefined || typeof op.value.dispatch.address !== "string" ||
                            op.nonce === undefined || op.hash === undefined) continue;

                        let muted = false;
                        const mute_status = await batch.get('mtd/'+op.value.dispatch.address);
                        if(null !== mute_status){
                            muted = mute_status.value;
                        }
                        const str_value = jsonStringify(op.value);
                        const chat_status = await batch.get('chat_status');
                        const verified = _this.wallet.verify(op.hash, str_value + op.nonce, op.value.dispatch.address);
                        if(false === muted && null !== str_value && verified &&
                            null !== chat_status && chat_status.value === 'on' &&
                            null === await batch.get('sh/'+op.hash) &&
                            Buffer.byteLength(str_value) <= 10_2400){
                            let len = await batch.get('msgl');
                            if(null === len) {
                                len = 0;
                            } else {
                                len = len.value;
                            }
                            await batch.put('msg/'+len, op.value.dispatch);
                            await batch.put('msgl', len + 1);
                            await _this.contract_instance.dispatch(op, node, batch);
                            const nick = await batch.get('nick/'+op.value.dispatch.address);
                            console.log(`#${len + 1} | ${nick !== null ? nick.value : op.value.dispatch.address}: ${op.value.dispatch.msg}`);
                        }
                        await batch.put('sh/'+op.hash, '');
                    } else if (op.type === 'feature') {
                        if(op.key === undefined || op.value === undefined || op.value.dispatch === undefined ||
                            op.value.dispatch.hash === undefined || op.value.dispatch.value === undefined ||
                            op.value.dispatch.nonce === undefined) continue;

                        const str_dispatch_value = jsonStringify(op.value.dispatch.value);
                        const admin = await batch.get('admin');
                        if(null !== admin &&
                            typeof op.value.dispatch === "object" &&
                            typeof op.value.dispatch.hash === "string" &&
                            typeof op.value.dispatch.value !== "undefined" &&
                            null === await batch.get('sh/'+op.value.dispatch.hash)){
                            const verified = _this.wallet.verify(op.value.dispatch.hash, str_dispatch_value + op.value.dispatch.nonce, admin.value);
                            if(verified) {
                                await _this.contract_instance.dispatch(op, node, batch);
                                console.log(`Feature ${op.key} appended`);
                            }
                        }
                        await batch.put('sh/'+op.value.dispatch.hash, '');
                    } else if (op.type === 'addIndexer') {
                        if(op.key === undefined || op.value === undefined || op.hash === undefined ||
                            op.value.msg === undefined || op.value.msg.key === undefined ||
                            op.value.msg.type === undefined || op.nonce === undefined) continue;

                        const str_msg = jsonStringify(op.value.msg);
                        const admin = await batch.get('admin');
                        if(null !== admin &&
                            op.value.msg.key === op.key &&
                            op.value.msg.type === 'addIndexer' &&
                            null === await batch.get('sh/'+op.hash)) {
                            const verified = _this.wallet.verify(op.hash, str_msg + op.nonce, admin.value);
                            if(verified){
                                const writerKey = b4a.from(op.key, 'hex');
                                await base.addWriter(writerKey);
                                console.log(`Indexer added: ${op.key}`);
                            }
                        }
                        await batch.put('sh/'+op.hash, '');
                    } else if (op.type === 'addWriter') {
                        if(op.key === undefined || op.hash === undefined || op.value === undefined ||
                            op.value.msg === undefined || op.value.msg.key === undefined ||
                            op.value.msg.type === undefined || op.nonce === undefined) continue;

                        const str_msg = jsonStringify(op.value.msg);
                        const admin = await batch.get('admin');
                        if(null !== admin &&
                            op.value.msg.key === op.key &&
                            op.value.msg.type === 'addWriter' &&
                            null === await batch.get('sh/'+op.hash)) {
                            const verified = _this.wallet.verify(op.hash, str_msg + op.nonce, admin.value);
                            if(verified){
                                const writerKey = b4a.from(op.key, 'hex');
                                await base.addWriter(writerKey, { isIndexer : false });
                                console.log(`Writer added: ${op.key}`);
                            }
                        }
                        await batch.put('sh/'+op.hash, '');
                    } else if (op.type === 'setChatStatus') {
                        if(op.key === undefined || op.value === undefined || op.hash === undefined ||
                            op.value.msg === undefined || op.value.msg.key === undefined ||
                            op.nonce === undefined || op.value.msg.type === undefined) continue;

                        const str_msg = jsonStringify(op.value.msg);
                        const admin = await batch.get('admin');
                        if(null !== admin && op.value.msg.key === op.key &&
                            op.value.msg.type === 'setChatStatus' &&
                            (op.key === 'on' || op.key === 'off') &&
                            null === await batch.get('sh/'+op.hash)) {
                            const verified = _this.wallet.verify(op.hash, str_msg + op.nonce, admin.value);
                            if(verified){
                                await batch.put('chat_status', op.key);
                                console.log(`Set chat_status: ${op.key}`);
                            }
                        }
                        await batch.put('sh/'+op.hash, '');
                    } else if (op.type === 'setAutoAddWriters') {
                        if(op.key === undefined || op.value === undefined || op.hash === undefined ||
                            op.value.msg === undefined || op.value.msg.key === undefined ||
                            op.nonce === undefined || op.value.msg.type === undefined) continue;

                        const str_msg = jsonStringify(op.value.msg);
                        const admin = await batch.get('admin');
                        if(null !== admin && op.value.msg.key === op.key &&
                            op.value.msg.type === 'setAutoAddWriters' &&
                            (op.key === 'on' || op.key === 'off') &&
                            null === await batch.get('sh/'+op.hash)) {
                            const verified = _this.wallet.verify(op.hash, str_msg + op.nonce, admin.value);
                            if(verified){
                                await batch.put('auto_add_writers', op.key);
                                console.log(`Set auto_add_writers: ${op.key}`);
                            }
                        }
                        await batch.put('sh/'+op.hash, '');
                    } else if (op.type === 'autoAddWriter') {
                        if(op.key === undefined) continue;
                        const auto_add_writers = await batch.get('auto_add_writers');
                        if(null !== auto_add_writers && auto_add_writers.value === 'on'){
                            const writerKey = b4a.from(op.key, 'hex');
                            await base.addWriter(writerKey, { isIndexer : false });
                        }
                        console.log(`Writer auto added: ${op.key}`);
                    } else if (op.type === 'addAdmin') {
                        if(op.key === undefined) continue;
                        const bootstrap = Buffer(node.from.key).toString('hex')
                        if(null === await batch.get('admin') && bootstrap === _this.bootstrap){
                            await batch.put('admin', op.key);
                            console.log(`Admin added: ${op.key}`);
                        }
                    } else if(op.type === 'setNick') {
                        if(op.value === undefined || op.value.dispatch === undefined || op.value.dispatch.nick === undefined ||
                            typeof op.value.dispatch.nick !== "string" || op.value.dispatch.type === undefined ||
                            op.value.dispatch.address === undefined || typeof op.value.dispatch.address !== "string" ||
                            op.value.dispatch.initiator === undefined || typeof op.value.dispatch.initiator !== "string" ||
                            op.nonce === undefined || op.hash === undefined) continue;

                        const taken = await batch.get('kcin/'+op.value.dispatch.nick);
                        const chat_status = await batch.get('chat_status');
                        const str_value = jsonStringify(op.value);
                        const admin = await batch.get('admin');
                        const mod = await batch.get('mod/'+op.value.dispatch.initiator);
                        let admin_verified = false;
                        if(null !== admin) {
                            admin_verified = _this.wallet.verify(op.hash, str_value + op.nonce, admin.value);
                        }
                        let mod_verified = false;
                        if(null !== mod && true === mod.value && op.value.dispatch.address !== op.value.dispatch.initiator) {
                            const target_mod = await batch.get('mod/'+op.value.dispatch.address);
                            if((null === target_mod || false === target_mod.value) && (null === admin || admin.value !== op.value.dispatch.address)){
                                mod_verified = _this.wallet.verify(op.hash, str_value + op.nonce, op.value.dispatch.initiator);
                            }
                        }
                        const verified = _this.wallet.verify(op.hash, str_value + op.nonce, op.value.dispatch.address);
                        if(null === taken && null !== str_value && ( verified || mod_verified || admin_verified ) &&
                            null !== chat_status && chat_status.value === 'on' &&
                            null === await batch.get('sh/'+op.hash) &&
                            Buffer.byteLength(str_value) <= 256 &&
                            visibleLength(op.value.dispatch.nick) <= 32){
                            const old = await batch.get('nick/'+op.value.dispatch.address);
                            if(old !== null){
                                await batch.del('nick/'+op.value.dispatch.address);
                                await batch.del('kcin/'+old.value);
                            }
                            await batch.put('nick/'+op.value.dispatch.address, op.value.dispatch.nick);
                            await batch.put('kcin/'+op.value.dispatch.nick, op.value.dispatch.address);
                            console.log(`Changed nick to ${op.value.dispatch.nick} (${op.value.dispatch.address})`);
                        }
                        await batch.put('sh/'+op.hash, '');
                    } else if(op.type === 'muteStatus') {
                        if(op.value === undefined || op.value.dispatch === undefined || op.value.dispatch.user === undefined ||
                            typeof op.value.dispatch.user !== "string" || op.value.dispatch.type === undefined ||
                            op.value.dispatch.address === undefined || typeof op.value.dispatch.address !== "string" ||
                            op.nonce === undefined || op.value.dispatch.muted === undefined || typeof op.value.dispatch.muted !== 'boolean' ||
                            op.hash === undefined) continue;

                        const admin = await batch.get('admin');
                        const str_value = jsonStringify(op.value);
                        if(null !== admin && null !== str_value &&
                            null === await batch.get('sh/'+op.hash)){
                            const mod = await batch.get('mod/'+op.value.dispatch.address);
                            let mod_verified = false;
                            if(null !== mod && true === mod.value && admin !== op.value.dispatch.user) {
                                const target_mod = await batch.get('mod/'+op.value.dispatch.user);
                                if(null === target_mod || false === target_mod.value) {
                                    mod_verified = _this.wallet.verify(op.hash, str_value + op.nonce, op.value.dispatch.address);
                                }
                            }
                            const verified = _this.wallet.verify(op.hash, str_value + op.nonce, admin.value);
                            if(verified || mod_verified) {
                                await batch.put('mtd/'+op.value.dispatch.user, op.value.dispatch.muted);
                                console.log(`Changed mute status ${op.value.dispatch.user} to ${op.value.dispatch.muted}`);
                            }
                        }
                        await batch.put('sh/'+op.hash, '');
                    } else if(op.type === 'deleteMessage') {
                        if(op.value === undefined || op.value.dispatch === undefined || op.value.dispatch.id === undefined ||
                            typeof op.value.dispatch.id !== "number" || op.value.dispatch.type === undefined ||
                            op.value.dispatch.address === undefined || typeof op.value.dispatch.address !== "string" ||
                            op.nonce === undefined || op.hash === undefined || op.value.dispatch.deleted_by === undefined) continue;

                        const admin = await batch.get('admin');
                        const str_value = jsonStringify(op.value);
                        if(null !== admin && null !== str_value &&
                            null === await batch.get('sh/'+op.hash)){
                            const mod = await batch.get('mod/'+op.value.dispatch.address);
                            const message = await batch.get('msg/'+op.value.dispatch.id);
                            if(null !== message && null !== message.value && message.value.deleted_by !== undefined && null === message.value.deleted_by) {
                                let mod_verified = false;
                                if(null !== mod && true === mod.value && message.value.address !== admin.value) {
                                    mod_verified = _this.wallet.verify(op.hash, str_value + op.nonce, op.value.dispatch.address);
                                }
                                let user_verified = false;
                                if((null === mod || false === mod.value) && message.value.address === op.value.dispatch.address &&
                                    op.value.dispatch.address !== admin.value) {
                                    user_verified = _this.wallet.verify(op.hash, str_value + op.nonce, op.value.dispatch.address);
                                }
                                const verified = _this.wallet.verify(op.hash, str_value + op.nonce, admin.value);
                                if(verified || mod_verified || user_verified) {
                                    message.value.msg = null;
                                    message.value.attachments = [];
                                    message.value.deleted_by = verified ? admin.value : op.value.dispatch.address;
                                    let len = await batch.get('delml');
                                    if(null === len) {
                                        len = 0;
                                    } else {
                                        len = len.value;
                                    }
                                    await batch.put('msg/'+op.value.dispatch.id, message);
                                    await batch.put('delm/'+len, op.value.dispatch.id);
                                    await batch.put('delml', len + 1);
                                    console.log(`Deleted message ${op.value.dispatch.id} by user ${message.value.address}`);
                                }
                            }
                        }
                        await batch.put('sh/'+op.hash, '');
                    } else if(op.type === 'setMod') {
                        if(op.value === undefined || op.value.dispatch === undefined || op.value.dispatch.user === undefined ||
                            typeof op.value.dispatch.user !== "string" || op.value.dispatch.type === undefined ||
                            op.value.dispatch.address === undefined || typeof op.value.dispatch.address !== "string" ||
                            op.nonce === undefined || op.value.dispatch.mod === undefined || typeof op.value.dispatch.mod !== 'boolean' ||
                            op.hash === undefined) continue;

                        const admin = await batch.get('admin');
                        const str_value = jsonStringify(op.value);
                        if(null !== admin && null !== str_value &&
                            null === await batch.get('sh/'+op.hash)){
                            const verified = _this.wallet.verify(op.hash, str_value + op.nonce, admin.value);
                            if(verified) {
                                await batch.put('mod/'+op.value.dispatch.user, op.value.dispatch.mod);
                                console.log(`Changed mod status ${op.value.dispatch.user} to ${op.value.dispatch.mod}`);
                            }
                        }
                        await batch.put('sh/'+op.hash, '');
                    }
                }

                await batch.flush();
                await batch.close();
            }
        })
        this.base.on('warning', (e) => console.log(e))
    }

    async _open() {
        await this.base.ready();
        await this.wallet.initKeyPair(this.KEY_PAIR_PATH);
        this.writerLocalKey = b4a.toString(this.base.local.key, 'hex');
        if(!this.init_contract_starting){
            await this.initContract();
        }
        if (this.replicate) await this._replicate();
        await this.txChannel();
        this.updater();
        const auto_add_writers = await this.base.view.get('auto_add_writers');
        if(!this.base.writable && null !== auto_add_writers && auto_add_writers.value === 'on'){
            this.emit('announce', {
                op : 'auto-add-writer',
                type : 'autoAddWriter',
                key : this.writerLocalKey
            });
        }
    }

    async initContract(){
        this.init_contract_starting = true;
        this.protocol_instance = new this.protocol({
            peer : this,
            base : this.base
        });
        this.contract_instance = new this.contract(this.protocol_instance);
    }

    async close() {
        if (this.swarm) {
            await this.swarm.destroy();
        }
        await this.base.close();
    }

    async txChannel() {
        const _this = this;
        this.tx_swarm = new Hyperswarm({ maxPeers: 1024, maxParallel: 512, maxServerConnections: 256 });

        this.tx_swarm.on('connection', async (connection, peerInfo) => {
            const peerName = b4a.toString(connection.remotePublicKey, 'hex');
            this.connectedPeers.add(peerName);
            this.connectedNodes++;

            connection.on('close', () => {
                this.connectedNodes--;
                this.connectedPeers.delete(peerName);
            });

            connection.on('error', (error) => { });

            _this.on('tx', async (msg) => {
                if(Object.keys(_this.tx_pool).length < _this.tx_pool_max_size && !_this.tx_pool[msg.tx]){
                    await connection.write(JSON.stringify(msg))
                    msg['ts'] = Math.floor(Date.now() / 1000);
                    _this.tx_pool[msg.tx] = msg;
                }
            });
        });

        const channelBuffer = this.tx_channel;
        this.tx_swarm.join(channelBuffer, { server: true, client: true });
        await this.tx_swarm.flush();
        console.log('Joined MSB TX channel');
    }

    async updater(){
        while(true){
            if(this.base.writable){
                await this.base.append(null);
            }
            await this.sleep(10_000);
        }
    }

    async tx_observer(){
        while(true){
            const ts = Math.floor(Date.now() / 1000);
            for(let tx in this.tx_pool){
                if(ts - this.tx_pool[tx].ts > this.max_tx_delay){
                    console.log('Dropping TX', tx);
                    delete this.tx_pool[tx];
                    delete this.protocol_instance.prepared_transactions_content[tx];
                    continue;
                }
                const msbsl = this.msb.base.view.core.signedLength;
                const view_session = this.msb.base.view.checkout(msbsl);
                const msb_tx = await view_session.get(tx);
                await view_session.close();
                if(null !== msb_tx){
                    msb_tx['dispatch'] = this.protocol_instance.prepared_transactions_content[tx];
                    msb_tx['msbsl'] = msbsl;
                    delete this.tx_pool[tx];
                    delete this.protocol_instance.prepared_transactions_content[tx];
                    await this.base.append({ type: 'tx', key: tx, value: msb_tx });
                }
                await this.sleep(5);
            }
            await this.sleep(10);
        }
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async _replicate() {
        if (!this.swarm) {
            const keyPair = await this.store.createKeyPair('hyperswarm');
            this.swarm = new Hyperswarm({ keyPair });

            console.log(`Writer key: ${this.writerLocalKey}`)

            this.swarm.on('connection', async (connection, peerInfo) => {
                const peerName = b4a.toString(connection.remotePublicKey, 'hex');
                this.connectedPeers.add(peerName);
                wakeup.addStream(connection);
                this.store.replicate(connection);
                this.connectedNodes++;

                connection.on('close', () => {
                    this.connectedNodes--;
                    this.connectedPeers.delete(peerName);
                });

                connection.on('error', (error) => { });

                connection.on('data', async (msg) => {
                    try{
                        msg = JSON.parse(msg);
                        if(msg.op && msg.op === 'append_writer' && this.base.localWriter.isActive &&
                            this.writerLocalKey !== msg.key) {
                            await this.base.append(msg);
                        } else if(msg.op && msg.op === 'auto-add-writer' && this.base.localWriter.isActive &&
                            this.writerLocalKey !== msg.key) {
                            await this.base.append(msg);
                        }
                    } catch(e){ }
                });

                this.on('announce', async function(msg){
                    await connection.write(JSON.stringify(msg))
                });

                if (!this.isStreaming) {
                    this.emit('readyNode');
                }
            });

            const channelBuffer = this.channel;
            this.swarm.join(channelBuffer, { server: true, client: true });
            await this.swarm.flush();
            console.log('Joined channel');
        }
    }

    nodeListener() {
        this.on('readyNode', async () => {
            if (!this.isStreaming) {
                this.isStreaming = true;
            }
        });
    }

    async verifyDag() {
        try {
            console.log('--- DAG Monitoring ---');
            const dagView = await this.base.view.core.treeHash();
            const lengthdagView = this.base.view.core.length;
            const dagSystem = await this.base.system.core.treeHash();
            const lengthdagSystem = this.base.system.core.length;
            console.log('this.base.view.core.signedLength:', this.base.view.core.signedLength);
            console.log("this.base.signedLength", this.base.signedLength);
            console.log("this.base.linearizer.indexers.length", this.base.linearizer.indexers.length);
            console.log("this.base.indexedLength", this.base.indexedLength);
            //console.log("this.base.system.core", this.base.system.core);
            console.log(`writerLocalKey: ${this.writerLocalKey}`);
            console.log(`base.key: ${this.base.key.toString('hex')}`);
            console.log('discoveryKey:', b4a.toString(this.base.discoveryKey, 'hex'));

            console.log(`VIEW Dag: ${dagView.toString('hex')} (length: ${lengthdagView})`);
            console.log(`SYSTEM Dag: ${dagSystem.toString('hex')} (length: ${lengthdagSystem})`);

        } catch (error) {
            console.error('Error during DAG monitoring:', error.message);
        }
    }

    async interactiveMode() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        console.log('Node started. Available commands:');
        console.log('- /add_admin: Only once on bootstrap node! Enter a wallet public key to assign admin rights to it.');
        console.log('- /add_indexer: Only admin. Enter a peer writer key as argument to get included as indexer for this network.');
        console.log('- /add_writer: Only admin. Enter a peer writer key as argument to get included as writer.');
        console.log('- /set_auto_add_writers: Only admin. Use "on" or "off" as 2nd parameter to allow/disallow peers automatically being added as writers.');
        console.log('- /set_chat_status: Only admin. Use "on" or "off" as 2nd parameter to enable/disable the built-in chat system.');
        console.log('- /post: Post a message like \'/post --message "Hello"\'. Chat must be enabled.');
        console.log('- /set_nick: Change your nickname like this \'/set_nick --nick "Peter"\'. Chat must be enabled. Can be edited by admin and mods using the optional --user <address> flag..');
        console.log('- /mute_status: Only admin and mods. Mute or unmute a user by their address like this \'/mute_status --user "<address>" --muted 1\'.');
        console.log('- /set_mod: Only admin. Set a user as mod like this \'/set_mod --user "<address>" --mod 1\'.');
        console.log('- /delete_message: Delete a messages like \'/delete_message --id 1\'. Chat must be enabled.');
        console.log('- /dag: check system properties such as writer key, DAG, etc.');
        console.log('- /get_keys: prints your public and private keys. Be careful and never share your private key!');
        console.log('- /exit: Exit the program');
        this.protocol_instance.printOptions();

        rl.on('line', async (input) => {
            switch (input) {
                case '/dag':
                    await this.verifyDag();
                    break;
                case '/exit':
                    console.log('Exiting...');
                    rl.close();
                    await this.close();
                    process.exit(0);
                case '/get_keys':
                    console.log("Public Key: ", this.wallet.publicKey);
                    console.log("Secret Key: ", this.wallet.secretKey);
                    break;
                default:
                    if (input.startsWith('/add_indexer') || input.startsWith('/add_writer')) {
                        await addWriter(input, this);
                    } else if (input.startsWith('/add_admin')) {
                        await addAdmin(input, this);
                    } else if (input.startsWith('/set_auto_add_writers')) {
                        await setAutoAddWriters(input, this);
                    } else if (input.startsWith('/set_chat_status')) {
                        await setChatStatus(input, this);
                    } else if (input.startsWith('/post')) {
                        await postMessage(input, this);
                    } else if (input.startsWith('/set_nick')) {
                        await setNick(input, this);
                    } else if (input.startsWith('/mute_status')) {
                        await muteStatus(input, this);
                    } else if (input.startsWith('/set_mod')) {
                        await setMod(input, this);
                    } else if (input.startsWith('/delete_message')) {
                        await deleteMessage(input, this);
                    } else {
                        this.protocol_instance.execute(input);
                    }
            }
            rl.prompt();
        });

        rl.prompt();
    }
}

function noop() { }

export default Peer;