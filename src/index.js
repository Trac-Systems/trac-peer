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
import { jsonStringify, visibleLength, safeClone, jsonParse } from "./functions.js";
import Check from "./check.js";
import { MsgOperation } from './operations/msg/index.js';
import { FeatureOperation } from './operations/feature/index.js';
import { AddIndexerOperation } from './operations/addIndexer/index.js';
import { AddWriterOperation } from './operations/addWriter/index.js';
import { RemoveWriterOperation } from './operations/removeWriter/index.js';
import { SetChatStatusOperation } from './operations/setChatStatus/index.js';
import { SetAutoAddWritersOperation } from './operations/setAutoAddWriters/index.js';
import { AutoAddWritersOperation } from './operations/autoAddWriter/index.js';
import { AddAdminOperation } from './operations/addAdmin/index.js';
import { UpdateAdminOperation } from './operations/updateAdmin/index.js';
import { SetNickOperation } from './operations/setNick/index.js';
import { MuteStatusOperation } from './operations/muteStatus/index.js';
import { DeleteMessageOperation } from './operations/deleteMessage/index.js';
import { UnpinMessageOperation } from './operations/unpinMessage/index.js';
import { PinMessageOperation } from './operations/pinMessage/index.js';
import { SetModOperation } from './operations/setMod/index.js';
import { SetWhitelistStatusOperation } from './operations/setWhitelistStatus/index.js';
import { EnableWhitelistOperation } from './operations/enableWhitelist/index.js';
import { EnableTransactionsOperation } from './operations/enableTransactions/index.js';
import { TxOperation } from './operations/tx/index.js';
import { handlerFor } from './operations/index.js';
export {default as Protocol} from "./protocol.js";
export {default as Contract} from "./contract.js";
export {default as Feature} from "./feature.js";
export {default as Wallet} from "./wallet.js";

export class Peer extends ReadyResource {

    constructor(options = {}) {
        super();
        this.enable_background_tasks = options.enable_background_tasks !== false;
        this.enable_updater = options.enable_updater !== false;
        this.STORES_DIRECTORY = options.stores_directory;
        this.KEY_PAIR_PATH = `${this.STORES_DIRECTORY}${options.store_name}/db/keypair.json`;
        this.keyPair = null;
        this.store = new Corestore(this.STORES_DIRECTORY + options.store_name);
        this.msb = options.msb || null;
        this.msbClient = new MsbClient(this.msb);
        this.swarm = null;
        this.base = null;
        this.key = null;
        this.tx_pool = {};
        this.writerLocalKey = null;
        this.tx_pool_max_size = options.tx_pool_max_size || 1_000;
        this.max_tx_delay = options.max_tx_delay || 60;
        this.max_msb_signed_length = Number.isSafeInteger(options.max_msb_signed_length) ? options.max_msb_signed_length : 1_000_000_000;
        this.max_msb_apply_operation_bytes = Number.isSafeInteger(options.max_msb_apply_operation_bytes)
            ? options.max_msb_apply_operation_bytes
            : 1024 * 1024;
        this.bootstrap = options.bootstrap || null;

        this.protocol = options.protocol || null;
        this.contract = options.contract || null;
        this.protocol_instance = null;
        this.contract_instance = null;
        this.features = options.features || [];

        this.wallet = options.wallet || null;
        this.custom_validators = options.custom_validators || [];
        this.channel = b4a.alloc(32).fill(options.channel) || null;
        this.bee = null;
        this.replicate = options.replicate !== false;
        this.connectedNodes = 1;
        this.isStreaming = false;
        this.connectedPeers = new Set();
        this.options = options;
        this.check = new Check();
        this.dhtBootstrap = ['116.202.214.149:10001', '157.180.12.214:10001', 'node1.hyperdht.org:49737', 'node2.hyperdht.org:49737', 'node3.hyperdht.org:49737'];
        this.readline_instance = options.readline_instance || null;
    }

    async _open() {
        if (this.enable_background_tasks) {
            this.tx_observer();
            this.validator_observer();
            this.nodeListener();
        }
        this._boot();
        await this.base.ready();
        if (this.bootstrap === null) {
            this.bootstrap = this.base.key;
        }
        await this.wallet.initKeyPair(this.KEY_PAIR_PATH, this.readline_instance);
        this.writerLocalKey = b4a.toString(this.base.local.key, 'hex');
        if(!this.init_contract_starting){
            await this.initContract();
        }
        if (this.replicate) await this._replicate();
        this.on('tx', async (msg) => {
            if(Object.keys(this.tx_pool).length <= this.tx_pool_max_size && !this.tx_pool[msg.tx]){
                msg['ts'] = Math.floor(Date.now() / 1000);
                this.tx_pool[msg.tx] = msg;
            }
        });
        if (this.enable_updater) this.updater();
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
                if(this.contract_instance === null) await this.initContract();
                const batch = view.batch();
                const context = {
                    check: this.check,
                    wallet: this.wallet,
                    protocolInstance: this.protocol_instance,
                    contractInstance: this.contract_instance,
                    msbClient: this.msbClient,
                    config: {
                        bootstrap: this.bootstrap,
                        maxMsbApplyOperationBytes: this.max_msb_apply_operation_bytes,
                        maxMsbSignedLength: this.max_msb_signed_length,
                        enableTxlogs: this.options.enable_txlogs
                    }
                }
                for (const node of nodes) {
                    // Basic node shape validation (prevents apply crashes on malformed entries)
                    if(false === this.check.node(node)) continue;
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
        if(this.msbClient.isReady()){
            if(msg && typeof msg === 'object' && typeof msg.type === 'number') {
                try { await this.msbClient.broadcastTransaction(msg); } catch(_e) { }
            }
            return;
        }
        if(this.msb.getNetwork().validator_stream === null) return;
        let _msg = safeClone(msg);
        if(_msg['ts'] !== undefined) delete _msg['ts'];
        try{ this.msb.getNetwork().validator_stream.messenger.send(_msg); } catch(e){ }
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
        this.init_contract_starting = true;
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

    async validator_observer(){
        if(this.msbClient.isReady()){
            return;
        }
        while(true){
            if(this.msb.getSwarm() !== null && this.msb.getNetwork().validator_stream === null) {
                console.log('Looking for available validators, please wait...');
                const _this = this;
                let length = await this.msb.base.view.get('wrl');
                if (null === length) {
                    length = 0;
                } else {
                    length = length.value;
                }
                if(this.custom_validators.length !== 0){
                    length = this.custom_validators.length;
                }
                async function findSome(){
                    if(_this.msb.getNetwork().validator_stream !== null) return;
                    const rnd_index = Math.floor(Math.random() * length);
                    let validator = await _this.msb.base.view.get('wri/' + rnd_index);
                    if(_this.custom_validators.length !== 0){
                        validator = { value : _this.custom_validators[rnd_index] };
                        console.log('Trying custom validator', validator.value);
                    }
                    if(_this.msb.getNetwork().validator_stream !== null) return;
                    if (null !== validator) {
                        validator = await _this.msb.base.view.get(validator.value);
                        if(_this.msb.getNetwork().validator_stream !== null) return;
                        if(null !== validator && false !== validator.value.isWriter && false === validator.value.isIndexer) {
                            await _this.msb.tryConnection(validator.value.pub, 'validator');
                        }
                    }
                }
                const promises = [];
                for(let i = 0; i < 2; i++){
                    promises.push(findSome());
                    await this.sleep(500);
                }
                await Promise.all(promises);
            }
            await this.sleep(1_000);
        }
    }

    async tx_observer(){
        while(true){
            let backoff = 1;
            const ts = Math.floor(Date.now() / 1000);
            for(let tx in this.tx_pool){
                if(ts - this.tx_pool[tx].ts > this.max_tx_delay){
                    console.log('Dropping TX', tx);
                    delete this.tx_pool[tx];
                    delete this.protocol_instance.prepared_transactions_content[tx];
                    continue;
                }
                if(!this.msbClient.isReady()) continue;
                const msbsl = this.msbClient.getSignedLength();
                const view_session = this.msb.state.base.view.checkout(msbsl);
                const msb_tx = await view_session.get(tx);
                await view_session.close();
                if (null !== msb_tx && b4a.isBuffer(msb_tx.value)) {
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

function noop() { }

export default Peer;
