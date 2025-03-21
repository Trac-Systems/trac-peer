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
import {addWriter, addAdmin, setAutoAddWriters} from "./functions.js";
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

                for (const node of nodes) {
                    const op = node.value;
                    if (op.type === 'tx') {
                        const msb_view_session = _this.msb.base.view.checkout(op.value.msbsl);
                        const post_tx = await msb_view_session.get(op.key);
                        await msb_view_session.close();
                        if (null !== post_tx &&
                            null === await view.get(op.key) &&
                            op.key === post_tx.value.tx &&
                            post_tx.value.ch === createHash('sha256').update(JSON.stringify(op.value.dispatch)).digest('hex')) {
                            await view.put(op.key, op.value);
                            await _this.contract_instance.dispatch(op, node, view);
                            console.log(`${op.key} appended`);
                        }
                    } else if (op.type === 'feature') {
                        const admin = await view.get('admin');
                        if(null !== admin &&
                            typeof op.value.dispatch === "object" &&
                            typeof op.value.dispatch.hash === "string" &&
                            typeof op.value.dispatch.value !== "undefined"){
                            const verified = _this.wallet.verify(op.value.dispatch.hash, JSON.stringify(op.value.dispatch.value), admin.value);
                            if(verified){
                                await _this.contract_instance.dispatch(op, node, view);
                            }
                        }
                        console.log(`Feature ${op.key} appended`);
                    } else if (op.type === 'addIndexer') {
                        const admin = await view.get('admin');
                        if(null !== admin && op.value.msg.key === op.key && op.value.msg.type === 'addIndexer') {
                            const verified = _this.wallet.verify(op.value.hash, JSON.stringify(op.value.msg), admin.value);
                            if(verified){
                                const writerKey = b4a.from(op.key, 'hex');
                                await base.addWriter(writerKey);
                                console.log(`Indexer added: ${op.key}`);
                            }
                        }
                    } else if (op.type === 'addWriter') {
                        const admin = await view.get('admin');
                        if(null !== admin && op.value.msg.key === op.key && op.value.msg.type === 'addWriter') {
                            const verified = _this.wallet.verify(op.value.hash, JSON.stringify(op.value.msg), admin.value);
                            if(verified){
                                const writerKey = b4a.from(op.key, 'hex');
                                await base.addWriter(writerKey, { isIndexer : false });
                                console.log(`Writer added: ${op.key}`);
                            }
                        }
                    } else if (op.type === 'setAutoAddWriters') {
                        const admin = await view.get('admin');
                        if(null !== admin && op.value.msg.key === op.key &&
                            op.value.msg.type === 'setAutoAddWriters' &&
                            (op.key === 'on' || op.key === 'off')) {
                            const verified = _this.wallet.verify(op.value.hash, JSON.stringify(op.value.msg), admin.value);
                            if(verified){
                                await view.put('auto_add_writers', op.key);
                                console.log(`Set auto_add_writers: ${op.key}`);
                            }
                        }
                    } else if (op.type === 'autoAddWriter') {
                        const auto_add_writers = await view.get('auto_add_writers');
                        if(null !== auto_add_writers && auto_add_writers.value === 'on'){
                            const writerKey = b4a.from(op.key, 'hex');
                            await base.addWriter(writerKey, { isIndexer : false });
                        }
                        console.log(`Writer auto added: ${op.key}`);
                    } else if (op.type === 'addAdmin') {
                        const bootstrap = Buffer(node.from.key).toString('hex')
                        if(null === await view.get('admin') && bootstrap === _this.bootstrap){
                            await view.put('admin', op.key);
                            console.log(`Admin added: ${op.key}`);
                        }
                    }
                }
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
        console.log('- /add_admin: only once on bootstrap node: enter a wallet public key to assign admin rights to it. Admin rights are required to set indexers and writers.');
        console.log('- /add_indexer: enter a peer writer key as argument to get included as indexer for this network.');
        console.log('- /add_writer: enter a peer writer key as argument to get included as writer.');
        console.log('- /set_auto_add_writers: use "on" or "off" as 2nd parameter to allow/disallow peers automatically being added as writers.');
        console.log('- /dag: check system properties such as writer key, DAG, etc.');
        console.log('- /get_keys: prints the signing key pair');
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
                    }  else {
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