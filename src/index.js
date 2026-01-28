/** @typedef {import('pear-interface')} */ /* global Pear */
import Autobase from 'autobase';
import Hyperswarm from 'hyperswarm';
import ReadyResource from 'ready-resource';
import b4a from 'b4a';
import Hyperbee from 'hyperbee';
import Corestore from 'corestore';
import w from 'protomux-wakeup';
const wakeup = new w();
import Protomux from 'protomux'
import c from 'compact-encoding'
import { MsbClient } from './msbClient.js';
import { safeDecodeApplyOperation } from 'trac-msb/src/utils/protobuf/operationHelpers.js';
import { safeClone } from "./functions.js";
import Check from "./check.js";
import { handlerFor } from './operations/index.js';
export {default as Protocol} from "./protocol.js";
export {default as Contract} from "./contract.js";
export {default as Feature} from "./feature.js";
export {default as Wallet} from "./wallet.js";

export class Peer extends ReadyResource {

    constructor(options = {}) {
        super();

        // begin config
        this.storesDirectory = options.storesDirectory;
        this.storeName = options.storeName
        this.fullStoresDirectory = `${this.storesDirectory}${this.storeName}`
        this.keyPairPath = `${this.fullStoresDirectory}/db/keypair.json`;
        this.txPoolMaxSize = options.txPoolMaxSize || 1_000;
        this.maxTxDelay = options.maxTxDelay || 60;
        this.maxMsbSignedLength = Number.isSafeInteger(options.maxMsbSignedLength) ? options.maxMsbSignedLength : 1_000_000_000;
        this.maxMsbApplyOperationBytes = Number.isSafeInteger(options.maxMsbApplyOperationBytes) ? options.maxMsbApplyOperationBytes : 1024 * 1024;
        this.bootstrap = options.bootstrap || null;
        this.enableBackgroundTasks = options.enableBackgroundTasks !== false;
        this.enableUpdater = options.enableUpdater !== false;
        this.replicate = options.replicate !== false;
        this.channel = b4a.alloc(32).fill(options.channel ?? 0);
        this.dhtBootstrap = ['116.202.214.149:10001', '157.180.12.214:10001', 'node1.hyperdht.org:49737', 'node2.hyperdht.org:49737', 'node3.hyperdht.org:49737'];
        this.enableTxlogs = options.enableTxlogs
        // end config

        this.keyPair = null;
        this.store = new Corestore(this.fullStoresDirectory);
        this.msb = options.msb || null;
        this.msbClient = new MsbClient(this.msb);
        this.swarm = null;
        this.base = null;
        this.key = null;
        this.tx_pool = {};
        this.writerLocalKey = null;
        this.wallet = options.wallet || null;
        
        this.protocol = options.protocol || null;
        this.contract = options.contract || null;
        this.protocol_instance = null;
        this.contract_instance = null;
        this.features = options.features || [];
        
        // In bare runtime, Buffer#fill(undefined) throws; default to 0 when channel not provided.
        this.bee = null;
        this.connectedNodes = 1;
        this.isStreaming = false;
        this.connectedPeers = new Set();
        this.options = options;
        this.check = new Check();
        this.readline_instance = options.readline_instance || null;
    }

    async _open() {
        await this.msbClient.ready()
        if (this.enableBackgroundTasks) {
            this.tx_observer();
            this.nodeListener();
        }
        this._boot();
        await this.base.ready();
        if (this.bootstrap === null) {
            this.bootstrap = this.base.key;
        }
        await this.wallet.initKeyPair(this.keyPairPath, this.readline_instance);
        this.writerLocalKey = b4a.toString(this.base.local.key, 'hex');

        await this.initContract();

        if (this.replicate) await this._replicate();
        this.on('tx', async (msg) => {
            if(Object.keys(this.tx_pool).length <= this.txPoolMaxSize && !this.tx_pool[msg.tx]){
                msg['ts'] = Math.floor(Date.now() / 1000);
                this.tx_pool[msg.tx] = msg;
            }
        });
        if (this.enableUpdater) this.updater();
    }

    async _boot() {
        const _this = this;
        this.base = new Autobase(this.store, this.bootstrap, {
            ackInterval : 1000,
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
                const batch = view.batch();
                const context = {
                    wallet: this.wallet,
                    protocolInstance: this.protocol_instance,
                    contractInstance: this.contract_instance,
                    msbClient: this.msbClient,
                    config: {
                        bootstrap: this.bootstrap,
                        maxMsbApplyOperationBytes: this.maxMsbApplyOperationBytes,
                        maxMsbSignedLength: this.maxMsbSignedLength,
                        enableTxlogs: this.enableTxlogs
                    }
                }
                for (const node of nodes) {
                    const op = node.value;
                    const handler = handlerFor(node, context)
                    if (handler) {
                        await handler.handle(op, batch, base, node)
                    }
                }

                await batch.flush();
                await batch.close();
            }
        })
        this.base.on('warning', (e) => console.log(e))
    }

    async sendTx(msg){
        if(msg?.type === 'number') {
            try { await this.msbClient.broadcastTransaction(msg); } catch(_e) { }
        }
    }

    async updater() {
        while (true) {
            if (this.base.isIndexer &&
                this.base.view.core.length >
                this.base.view.core.signedLength) {
                await this.base.append(null);
            }
            await this.sleep(10_000);
        }
    }

    async initContract(){
        this.protocol_instance = new this.protocol(this, this.base, this.options);
        await this.protocol_instance.extendApi();
        this.contract_instance = new this.contract(this.protocol_instance);
    }

    async close() {
        if (this.swarm) {
            await this.swarm.destroy();
        }
        await this.base.close();
    }

    async tx_observer(){
        while(true){
            const ts = Math.floor(Date.now() / 1000);
            for(let tx in this.tx_pool){
                if(ts - this.tx_pool[tx].ts > this.maxTxDelay){
                    console.log('Dropping TX', tx);
                    delete this.tx_pool[tx];
                    delete this.protocol_instance.prepared_transactions_content[tx];
                    continue;
                }

                const msbsl = this.msbClient.getSignedLength();
                const msb_tx = this.msbClient.getSignedAtLength(tx)

                if (b4a.isBuffer(msb_tx?.value)) {
                    const decoded = safeDecodeApplyOperation(msb_tx.value);
                    if (decoded?.type !== 12 || decoded?.txo === undefined) continue;
                    if (decoded.txo.tx === undefined || decoded.txo.tx.toString('hex') !== tx) continue;
                    const invokerAddress = decoded?.address ? decoded.address.toString('ascii') : null;
                    const validatorAddress = decoded?.txo?.va ? decoded.txo.va.toString('ascii') : null;
                    const ipk = invokerAddress ? this.msbClient.addressToPubKeyHex(invokerAddress) : null;
                    const wp = validatorAddress ? this.msbClient.addressToPubKeyHex(validatorAddress) : null;
                    if (null === ipk || null === wp) continue;
                    const prepared = this.protocol_instance.prepared_transactions_content[tx];
                    if (prepared === undefined) continue;
                    const subnet_tx = {
                        msbsl: msbsl,
                        dispatch: prepared.dispatch,
                        ipk: ipk,
                        wp: wp,
                    };
                    delete this.tx_pool[tx];
                    delete this.protocol_instance.prepared_transactions_content[tx];
                    await this.base.append({ type: 'tx', key: tx, value: subnet_tx });
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

            const _this = this;

            const keyPair = {
                publicKey: b4a.from(this.wallet.publicKey, 'hex'),
                secretKey: b4a.from(this.wallet.secretKey, 'hex')
            };

            this.swarm = new Hyperswarm({ keyPair, bootstrap: this.dhtBootstrap });
            console.log('');
            console.log('######################################################################################');
            console.log('# Peer Address:    ', this.wallet.publicKey, '#');
            this.writerLocalKey = b4a.toString(this.base.local.key, 'hex');
            console.log('# Peer Writer:     ', this.writerLocalKey, '#');
            console.log('######################################################################################');
            console.log('');
            console.log(`isIndexer: ${this.base.isIndexer}`);
            console.log(`isWriter: ${this.base.writable}`);
            console.log('');

            this.swarm.on('connection', async (connection, peerInfo) => {
                const mux = Protomux.from(connection)
                connection.userData = mux
                const message_channel = mux.createChannel({
                    protocol: b4a.toString(this.channel, 'utf8'),
                    onopen() {},
                    onclose() {}
                })
                message_channel.open()
                const message = message_channel.addMessage({
                    encoding: c.json,
                    async onmessage(msg) {
                        try{
                            if(true === _this.base.writable && msg.inviteMyKey !== undefined &&
                                msg.bootstrap === _this.bootstrap && b4a.toString(connection.publicKey, 'hex') === msg.to){
                                const auto_add_writers = await _this.base.view.get('auto_add_writers');
                                if(auto_add_writers !== null && auto_add_writers.value === 'on') {
                                    await _this.base.append({
                                        type : 'autoAddWriter',
                                        key : msg.inviteMyKey
                                    });
                                }
                            }
                        }catch(e){}
                    }});

                if(false === _this.base.writable){
                    const auto_add_writers = await _this.base.view.get('auto_add_writers');
                    if(auto_add_writers !== null && auto_add_writers.value === 'on') {
                        message.send({
                            inviteMyKey : _this.writerLocalKey,
                            bootstrap : _this.bootstrap,
                            to : b4a.toString(connection.remotePublicKey, 'hex')
                        });
                    }
                }

                const remotePublicKey = b4a.toString(connection.remotePublicKey, 'hex');

                this.connectedPeers.add(remotePublicKey);
                const stream = this.store.replicate(connection);
                stream.on('error', (error) => { });
                wakeup.addStream(stream);
                this.connectedNodes++;

                connection.on('close', () => {
                    try{ message_channel.close() }catch(e){}
                    this.connectedNodes--;
                    this.connectedPeers.delete(remotePublicKey);
                });

                connection.on('error', (error) => { });

                if (!this.isStreaming) {
                    this.emit('readyNode');
                }
            });

            this.swarm.join(this.channel, { server: true, client: true });
            await this.swarm.flush();
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
            console.log('--- Stats ---');
            const dagView = await this.base.view.core.treeHash();
            const lengthdagView = this.base.view.core.length;
            const dagSystem = await this.base.system.core.treeHash();
            const lengthdagSystem = this.base.system.core.length;
            console.log('wallet.address:', this.wallet !== null ? this.wallet.publicKey : 'unset');
            console.log('hypermall.writerKey:', this.writerLocalKey);
            const admin = await this.base.view.get('admin')
            console.log(`admin: ${admin !== null ? admin.value : 'unset'}`);
            console.log(`isIndexer: ${this.base.isIndexer}`);
            console.log(`isWriter: ${this.base.writable}`);
            console.log('swarm.connections.size:', this.swarm.connections.size);
            console.log('base.view.core.signedLength:', this.base.view.core.signedLength);
            console.log("base.signedLength", this.base.signedLength);
            console.log("base.indexedLength", this.base.indexedLength);
            console.log("base.linearizer.indexers.length", this.base.linearizer.indexers.length);
            console.log(`base.key: ${this.base.key.toString('hex')}`);
            console.log('discoveryKey:', b4a.toString(this.base.discoveryKey, 'hex'));
            console.log(`VIEW Dag: ${dagView.toString('hex')} (length: ${lengthdagView})`);
            console.log(`SYSTEM Dag: ${dagSystem.toString('hex')} (length: ${lengthdagSystem})`);
            const wl = await this.base.view.get('wrl');
            console.log('Total Registered Writers:', wl !== null ? wl.value : 0);
        } catch (error) {
            console.error('Error during DAG monitoring:', error.message);
        }
    }
}

export default Peer;
