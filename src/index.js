/** @typedef {import('pear-interface')} */ /* global Pear */
import Autobase from 'autobase';
import Hyperswarm from 'hyperswarm';
import ReadyResource from 'ready-resource';
import b4a from 'b4a';
import sodium from 'sodium-native'
import Hyperbee from 'hyperbee';
import Corestore from 'corestore';
import w from 'protomux-wakeup';
const wakeup = new w();
import Protomux from 'protomux'
import c from 'compact-encoding'
import { MsbClient } from './msbClient.js';
import { safeDecodeApplyOperation } from 'trac-msb/src/utils/protobuf/operationHelpers.js';
import { blake3Hash } from 'trac-msb/src/utils/crypto.js';
import { jsonStringify, visibleLength, safeClone, jsonParse } from "./functions.js";
import Check from "./check.js";
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
        this.wallet = options.wallet || null;
        this.features = options.features || [];
        this.custom_validators = options.custom_validators || [];
        this.protocol_instance = null;
        this.contract_instance = null;
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

        if (this.enable_background_tasks) {
            this.tx_observer();
            this.validator_observer();
            this.nodeListener();
        }
        this._boot();
        this.ready().catch(noop);
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
                for (const node of nodes) {
                    // Basic node shape validation (prevents apply crashes on malformed entries)
                    if(false === this.check.node(node)) continue;
                    const op = node.value;
                    if (op.type === 'tx') {
                        // TX apply: only accept subnet TXs that are confirmed on MSB, then execute contract logic
                        // deterministically (same ordered log => same state everywhere).

                        // Payload size guard (protect apply from huge JSON ops)
                        if(b4a.byteLength(jsonStringify(op)) > _this.protocol_instance.txMaxBytes()) continue;
                        // Schema validation (required fields / types)
                        if(false === this.check.tx(op)) continue;
                        // Stall guard: don't allow a writer to pin apply waiting on an absurd MSB height
                        if (op.value.msbsl > _this.max_msb_signed_length) continue;
                        if (!_this.msbClient.isReady()) continue;
                        const msbCore = _this.msb.state.base.view.core;
                        // Wait for local MSB view to reach the referenced signed length
                        while (msbCore.signedLength < op.value.msbsl) {
                            await new Promise((resolve) => msbCore.once('append', resolve));
                        }
                        // Fetch MSB apply-op at msbsl by tx key (op.key = tx hash)
                        const msb_view_session = _this.msb.state.base.view.checkout(op.value.msbsl);
                        const msb_tx_entry = await msb_view_session.get(op.key);
                        await msb_view_session.close();
                        // MSB entry shape/size guards (protect protobuf decode + keep apply bounded)
                        if (null === msb_tx_entry || false === b4a.isBuffer(msb_tx_entry.value)) continue;
                        if (msb_tx_entry.value.byteLength > _this.max_msb_apply_operation_bytes) continue;
                        // Decode MSB operation and ensure it's a TX (type 12) with required fields
                        const decoded = safeDecodeApplyOperation(msb_tx_entry.value);
                        if (null === decoded || decoded.txo === undefined) continue;
                        if (decoded.type !== 12) continue;
                        // Cross-check: tx hash matches op.key
                        if (null === decoded.txo.tx || decoded.txo.tx.toString('hex') !== op.key) continue;
                        // Cross-check: MSB tx targets this subnet + this MSB network
                        const subnetBootstrapHex = (b4a.isBuffer(_this.bootstrap) ? _this.bootstrap.toString('hex') : ('' + _this.bootstrap)).toLowerCase();
                        if (null === decoded.txo.bs || decoded.txo.bs.toString('hex') !== subnetBootstrapHex) continue;
                        if (null === decoded.txo.mbs || decoded.txo.mbs.toString('hex') !== _this.msbClient.bootstrapHex) continue;
                        // Cross-check: content hash matches the subnet dispatch payload (blake3)
                        const content_hash = await _this.createHash('blake3', jsonStringify(op.value.dispatch));
                        if (null === decoded.txo.ch || decoded.txo.ch.toString('hex') !== content_hash) continue;
                        // Cross-check: requester identity matches ipk
                        const invokerAddress = decoded.address ? decoded.address.toString('ascii') : null;
                        const invokerPubKeyHex = invokerAddress ? _this.msbClient.addressToPubKeyHex(invokerAddress) : null;
                        if (null === invokerPubKeyHex || invokerPubKeyHex !== ('' + op.value.ipk).toLowerCase()) continue;
                        // Cross-check: validator identity matches wp
                        const validatorAddress = decoded.txo.va ? decoded.txo.va.toString('ascii') : null;
                        const validatorPubKeyHex = validatorAddress ? _this.msbClient.addressToPubKeyHex(validatorAddress) : null;
                        if (null === validatorPubKeyHex || validatorPubKeyHex !== ('' + op.value.wp).toLowerCase()) continue;
                        // Transactions enabled gate (default: enabled if missing)
                        const enabled = await batch.get('txen');
                        if (!(enabled === null || enabled.value === true)) continue;
                        // Replay protection: ignore already-indexed TXs
                        if (null !== await batch.get('tx/' + op.key)) continue;
                        // Execute contract and index deterministic result into subnet state
                        const err = _this.protocol_instance.getError(
                            await _this.contract_instance.execute(op, batch)
                        );
                        let _err = null;
                        if(null !== err) {
                            if(err.constructor.name === 'UnknownContractOperationType') continue;
                            const _err_msg = parseInt(err.message);
                            _err = isNaN(_err_msg) ? ''+err.message : _err_msg;
                        }
                        let len = await batch.get('txl');
                        if(null === len) {
                            len = 0;
                        } else {
                            len = len.value;
                        }
                        const dta = {};
                        dta['val'] = safeClone(op.value.dispatch);
                        dta['err'] = _err;
                        dta['tx'] = op.key;
                        dta['ipk'] = op.value.ipk;
                        dta['wp'] = op.value.wp;
                        await batch.put('txi/'+len, dta);
                        await batch.put('txl', len + 1);
                        await batch.put('tx/'+op.key, len);
                        let ulen = await batch.get('utxl/'+op.value.ipk);
                        if(null === ulen) {
                            ulen = 0;
                        } else {
                            ulen = ulen.value;
                        }
                        await batch.put('utxi/'+op.value.ipk+'/'+ulen, len);
                        await batch.put('utxl/'+op.value.ipk, ulen + 1);
                        if(true === _this.enable_txlogs){
                            console.log(`${op.key} appended. Signed length: ${_this.base.view.core.signedLength}, tx length: ${len + 1}`);
                        }
                    } else if(op.type === 'msg') {
                        // Chat apply: user-signed message + whitelist/mute checks + replay protection.
                        if(b4a.byteLength(jsonStringify(op)) > _this.protocol_instance.msgMaxBytes()) continue;
                        if(false === this.check.msg(op)) continue;
                        const admin = await batch.get('admin');
                        let muted = false;
                        let whitelisted = true;
                        const whitelist_status = await batch.get('wlst');
                        if(null !== whitelist_status && true === whitelist_status.value) {
                            const _whitelisted = await batch.get('wl/'+op.value.dispatch.address);
                            if(null === _whitelisted || false === _whitelisted.value) {
                                whitelisted = false;
                            }
                        }
                        const mute_status = await batch.get('mtd/'+op.value.dispatch.address);
                        if(null !== mute_status){
                            muted = mute_status.value;
                        }
                        if(null !== admin && admin.value === op.value.dispatch.address) {
                            muted = false;
                            whitelisted = true;
                        }
                        const str_value = jsonStringify(op.value);
                        const chat_status = await batch.get('chat_status');
                        const verified = _this.wallet.verify(op.hash, str_value + op.nonce, op.value.dispatch.address);
                        if(true === verified &&
                            false === muted &&
                            true === whitelisted &&
                            null !== str_value &&
                            null !== chat_status &&
                            null === await batch.get('sh/'+op.hash) &&
                            chat_status.value === 'on' &&
                            null === _this.protocol_instance.getError(
                                await _this.contract_instance.execute(op, batch)
                            )){
                            let len = await batch.get('msgl');
                            if(null === len) {
                                len = 0;
                            } else {
                                len = len.value;
                            }
                            let user_len = await batch.get('umsgl/'+op.value.dispatch.address);
                            if(null === user_len) {
                                user_len = 0;
                            } else {
                                user_len = user_len.value;
                            }
                            await batch.put('msg/'+len, op.value.dispatch);
                            await batch.put('umsg/'+op.value.dispatch.address+'/'+user_len, 'msg/'+len);
                            await batch.put('msgl', len + 1);
                            await batch.put('umsgl/'+op.value.dispatch.address, user_len + 1);
                            await batch.put('sh/'+op.hash, '');
                            const nick = await batch.get('nick/'+op.value.dispatch.address);
                            console.log(`#${len + 1} | ${nick !== null ? nick.value : op.value.dispatch.address}: ${op.value.dispatch.msg}`);
                        }
                    } else if (op.type === 'feature') {
                        // Feature apply: admin-signed feature/contract op (replay-protected by sh/<hash>).
                        if(b4a.byteLength(jsonStringify(op)) > _this.protocol_instance.featMaxBytes()) continue;
                        if(false === this.check.feature(op)) continue;
                        const str_dispatch_value = jsonStringify(op.value.dispatch.value);
                        const admin = await batch.get('admin');
                        if(null !== admin &&
                            null === await batch.get('sh/'+op.value.dispatch.hash)){
                            const verified = _this.wallet.verify(op.value.dispatch.hash, str_dispatch_value + op.value.dispatch.nonce, admin.value);
                            if(true === verified) {
                                await _this.contract_instance.execute(op, batch);
                                await batch.put('sh/'+op.value.dispatch.hash, '');
                                //console.log(`Feature ${op.key} appended`);
                            }
                        }
                    } else if (op.type === 'addIndexer') {
                        // Membership apply: admin-signed add indexer (Autobase writer with isIndexer: true).
                        if(false === this.check.addIndexer(op)) continue;
                        const str_msg = jsonStringify(op.value.msg);
                        const admin = await batch.get('admin');
                        if(null !== admin &&
                            op.value.msg.key === op.key &&
                            op.value.msg.type === 'addIndexer' &&
                            null === await batch.get('sh/'+op.hash)) {
                            const verified = _this.wallet.verify(op.hash, str_msg + op.nonce, admin.value);
                            if(true === verified){
                                const writerKey = b4a.from(op.key, 'hex');
                                await base.addWriter(writerKey, { isIndexer : true });
                                await batch.put('sh/'+op.hash, '');
                                console.log(`Indexer added: ${op.key}`);
                            }
                        }
                    } else if (op.type === 'addWriter') {
                        // Membership apply: admin-signed add writer (Autobase writer with isIndexer: false).
                        if(false === this.check.addWriter(op)) continue;
                        const str_msg = jsonStringify(op.value.msg);
                        const admin = await batch.get('admin');
                        if(null !== admin &&
                            op.value.msg.key === op.key &&
                            op.value.msg.type === 'addWriter' &&
                            null === await batch.get('sh/'+op.hash)) {
                            const verified = _this.wallet.verify(op.hash, str_msg + op.nonce, admin.value);
                            if(true === verified){
                                const writerKey = b4a.from(op.key, 'hex');
                                await base.addWriter(writerKey, { isIndexer : false });
                                await batch.put('sh/'+op.hash, '');
                                console.log(`Writer added: ${op.key}`);
                            }
                        }
                    } else if (op.type === 'removeWriter') {
                        // Membership apply: admin-signed remove writer/indexer.
                        if(false === this.check.removeWriter(op)) continue;
                        const str_msg = jsonStringify(op.value.msg);
                        const admin = await batch.get('admin');
                        if(null !== admin &&
                            op.value.msg.key === op.key &&
                            op.value.msg.type === 'removeWriter' &&
                            null === await batch.get('sh/'+op.hash)) {
                            const verified = _this.wallet.verify(op.hash, str_msg + op.nonce, admin.value);
                            if(true === verified){
                                const writerKey = b4a.from(op.key, 'hex');
                                await base.removeWriter(writerKey);
                                await batch.put('sh/'+op.hash, '');
                                console.log(`Writer removed: ${op.key}`);
                            }
                        }
                    } else if (op.type === 'setChatStatus') {
                        // Chat config apply: admin-signed chat on/off toggle.
                        if(false === this.check.setChatStatus(op)) continue;
                        const str_msg = jsonStringify(op.value.msg);
                        const admin = await batch.get('admin');
                        if(null !== admin && op.value.msg.key === op.key &&
                            op.value.msg.type === 'setChatStatus' &&
                            (op.key === 'on' || op.key === 'off') &&
                            null === await batch.get('sh/'+op.hash)) {
                            const verified = _this.wallet.verify(op.hash, str_msg + op.nonce, admin.value);
                            if(true === verified){
                                await batch.put('chat_status', op.key);
                                await batch.put('sh/'+op.hash, '');
                                console.log(`Set chat_status: ${op.key}`);
                            }
                        }
                    } else if (op.type === 'setAutoAddWriters') {
                        // Membership config apply: admin-signed toggle for auto-adding writers.
                        if(false === this.check.setAutoAddWriters(op)) continue;
                        const str_msg = jsonStringify(op.value.msg);
                        const admin = await batch.get('admin');
                        if(null !== admin && op.value.msg.key === op.key &&
                            op.value.msg.type === 'setAutoAddWriters' &&
                            (op.key === 'on' || op.key === 'off') &&
                            null === await batch.get('sh/'+op.hash)) {
                            const verified = _this.wallet.verify(op.hash, str_msg + op.nonce, admin.value);
                            if(true === verified){
                                await batch.put('auto_add_writers', op.key);
                                await batch.put('sh/'+op.hash, '');
                                console.log(`Set auto_add_writers: ${op.key}`);
                            }
                        }
                    } else if (op.type === 'autoAddWriter') {
                        // Membership apply: when auto_add_writers is on, allow a new writer to join by key.
                        if(false === this.check.key(op)) continue;
                        const auto_add_writers = await batch.get('auto_add_writers');
                        const banned = await batch.get('bnd/'+op.key);
                        if(null === banned && null !== auto_add_writers && auto_add_writers.value === 'on'){
                            const writerKey = b4a.from(op.key, 'hex');
                            await base.addWriter(writerKey, { isIndexer : false });
                        }
                        console.log(`Writer auto added: ${op.key}`);
                    } else if (op.type === 'addAdmin') {
                        // Admin apply: bootstrap node can set the initial admin once.
                        if(false === this.check.key(op)) continue;
                        const bootstrapWriterKeyHex = b4a.toString(node.from.key, 'hex');
                        const subnetBootstrapHex = (b4a.isBuffer(_this.bootstrap) ? _this.bootstrap.toString('hex') : (''+_this.bootstrap)).toLowerCase();
                        if(null === await batch.get('admin') && bootstrapWriterKeyHex === subnetBootstrapHex){
                            await batch.put('admin', op.key);
                            console.log(`Admin added: ${op.key}`);
                        }
                    } else if (op.type === 'updateAdmin') {
                        // Admin apply: current admin transfers admin rights (replay-protected by sh/<hash>).
                        if(false === this.check.updateAdmin(op)) continue;
                        const admin = await batch.get('admin');
                        const str_value = jsonStringify(op.value);
                        if(null !== admin && null !== str_value &&
                            null === await batch.get('sh/'+op.hash)){
                            const verified = _this.wallet.verify(op.hash, str_value + op.nonce, admin.value);
                            if(true === verified) {
                                await batch.put('admin', op.value.dispatch.admin);
                                await batch.put('sh/'+op.hash, '');
                                console.log(`Changed admin ${admin.value} to ${op.value.dispatch.admin}`);
                            }
                        }
                    } else if(op.type === 'setNick') {
                        // Chat apply: nickname changes (user/mod/admin-signed, uniqueness-enforced).
                        if(false === this.check.nick(op)) continue;
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
                        if(null === taken &&
                            null !== str_value &&
                            ( true === verified || true === mod_verified || true === admin_verified ) &&
                            null !== chat_status &&
                            chat_status.value === 'on' &&
                            null === await batch.get('sh/'+op.hash) &&
                            b4a.byteLength(str_value) <= 256 &&
                            visibleLength(op.value.dispatch.nick) <= 32){
                            const old = await batch.get('nick/'+op.value.dispatch.address);
                            if(old !== null){
                                await batch.del('nick/'+op.value.dispatch.address);
                                await batch.del('kcin/'+old.value);
                            }
                            await batch.put('nick/'+op.value.dispatch.address, op.value.dispatch.nick);
                            await batch.put('kcin/'+op.value.dispatch.nick, op.value.dispatch.address);
                            await batch.put('sh/'+op.hash, '');
                            console.log(`Changed nick to ${op.value.dispatch.nick} (${op.value.dispatch.address})`);
                        }
                    } else if(op.type === 'muteStatus') {
                        // Chat moderation apply: admin/mod-signed mute/unmute (stored under mtd/<user>).
                        if(false === this.check.mute(op)) continue;
                        const admin = await batch.get('admin');
                        const str_value = jsonStringify(op.value);
                        if(null !== str_value &&
                            null === await batch.get('sh/'+op.hash)){
                            const mod = await batch.get('mod/'+op.value.dispatch.address);
                            let mod_verified = false;
                            if(null !== mod && true === mod.value && admin.value !== op.value.dispatch.user) {
                                const target_mod = await batch.get('mod/'+op.value.dispatch.user);
                                if(null === target_mod || false === target_mod.value) {
                                    mod_verified = _this.wallet.verify(op.hash, str_value + op.nonce, op.value.dispatch.address);
                                }
                            }
                            const verified = _this.wallet.verify(op.hash, str_value + op.nonce, admin.value);
                            if(true === verified || true === mod_verified) {
                                await batch.put('mtd/'+op.value.dispatch.user, op.value.dispatch.muted);
                                await batch.put('sh/'+op.hash, '');
                                console.log(`Changed mute status ${op.value.dispatch.user} to ${op.value.dispatch.muted}`);
                            }
                        }
                    } else if(op.type === 'deleteMessage') {
                        // Chat moderation apply: admin/mod/user-signed message deletion (replay-protected by sh/<hash>).
                        if(false === this.check.deleteMessage(op)) continue;
                        const str_value = jsonStringify(op.value);
                        if(null !== str_value &&
                            null === await batch.get('sh/'+op.hash)){
                            const mod = await batch.get('mod/'+op.value.dispatch.address);
                            const message = await batch.get('msg/'+op.value.dispatch.id);
                            if(null !== message && null !== message.value && message.value.deleted_by !== undefined && null === message.value.deleted_by) {
                                const admin = await batch.get('admin');
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
                                if(true === verified || true === mod_verified || true === user_verified) {
                                    message.value.msg = null;
                                    message.value.attachments = [];
                                    message.value.deleted_by = verified ? admin.value : op.value.dispatch.address;
                                    let len = await batch.get('delml');
                                    if(null === len) {
                                        len = 0;
                                    } else {
                                        len = len.value;
                                    }
                                    await batch.put('msg/'+op.value.dispatch.id, message.value);
                                    await batch.put('delm/'+len, op.value.dispatch.id);
                                    await batch.put('delml', len + 1);
                                    await batch.put('sh/'+op.hash, '');
                                    console.log(`Deleted message ${op.value.dispatch.id} of user ${message.value.address} by ${op.value.dispatch.address}`);
                                }
                            }
                        }
                    } else if(op.type === 'unpinMessage') {
                        // Chat moderation apply: admin/mod-signed unpin.
                        if(false === this.check.unpinMessage(op)) continue;
                        const str_value = jsonStringify(op.value);
                        if(null !== str_value &&
                            null === await batch.get('sh/'+op.hash)){
                            const mod = await batch.get('mod/'+op.value.dispatch.address);
                            const pin = await batch.get('pni/'+op.value.dispatch.id);
                            if(null !== pin) {
                                const admin = await batch.get('admin');
                                let mod_verified = false;
                                if(null !== mod && true === mod.value) {
                                    mod_verified = _this.wallet.verify(op.hash, str_value + op.nonce, op.value.dispatch.address);
                                }
                                const verified = _this.wallet.verify(op.hash, str_value + op.nonce, admin.value);
                                if(true === verified || true === mod_verified) {
                                    const message = await batch.get('msg/'+pin.value.msg)
                                    if(null !== message){
                                        message.value.pinned = false;
                                        message.value.pin_id = null;
                                        await batch.put('msg/'+pin.value.msg, message.value);
                                        await batch.put('pni/'+op.value.dispatch.id, { msg : pin.value.msg, pinned : false });
                                    }
                                    await batch.put('sh/'+op.hash, '');
                                    console.log(`Unpinned message ${pin.value.msg} by ${op.value.dispatch.address}`);
                                }
                            }
                        }
                    } else if(op.type === 'pinMessage') {
                        // Chat moderation apply: admin/mod-signed pin/unpin (by pinned flag).
                        if(false === this.check.pinMessage(op)) continue;
                        const str_value = jsonStringify(op.value);
                        if(null !== str_value &&
                            null === await batch.get('sh/'+op.hash)){
                            const mod = await batch.get('mod/'+op.value.dispatch.address);
                            const message = await batch.get('msg/'+op.value.dispatch.id);
                            if(null !== message && null !== message.value) {
                                const admin = await batch.get('admin');
                                let mod_verified = false;
                                if(null !== mod && true === mod.value) {
                                    mod_verified = _this.wallet.verify(op.hash, str_value + op.nonce, op.value.dispatch.address);
                                }
                                const verified = _this.wallet.verify(op.hash, str_value + op.nonce, admin.value);
                                if(true === verified || true === mod_verified) {
                                    if(null === message.value.pin_id){
                                        let pin_len = await batch.get('pnl');
                                        if(null === pin_len) {
                                            pin_len = 0;
                                        } else {
                                            pin_len = pin_len.value;
                                        }
                                        message.value.pin_id = pin_len;
                                        await batch.put('pni/'+pin_len, { msg : op.value.dispatch.id, pinned : op.value.dispatch.pinned });
                                        await batch.put('pnl', pin_len + 1);
                                    } else {
                                        await batch.put('pni/'+message.value.pin_id, { msg : op.value.dispatch.id, pinned : op.value.dispatch.pinned });
                                    }
                                    message.value.pinned = op.value.dispatch.pinned;
                                    await batch.put('msg/'+op.value.dispatch.id, message.value);
                                    await batch.put('sh/'+op.hash, '');
                                    console.log(`Pinned message ${op.value.dispatch.id} by ${op.value.dispatch.address}`);
                                }
                            }
                        }
                    } else if(op.type === 'setMod') {
                        // Chat moderation apply: admin-signed set/unset mod role.
                        if(false === this.check.mod(op)) continue;
                        const admin = await batch.get('admin');
                        const str_value = jsonStringify(op.value);
                        if(null !== admin && null !== str_value &&
                            null === await batch.get('sh/'+op.hash)){
                            const verified = _this.wallet.verify(op.hash, str_value + op.nonce, admin.value);
                            if(true === verified) {
                                await batch.put('mod/'+op.value.dispatch.user, op.value.dispatch.mod);
                                await batch.put('sh/'+op.hash, '');
                                console.log(`Changed mod status ${op.value.dispatch.user} to ${op.value.dispatch.mod}`);
                            }
                        }
                    } else if(op.type === 'setWhitelistStatus') {
                        // Chat whitelist apply: admin-signed add/remove address from whitelist.
                        if(false === this.check.whitelistStatus(op)) continue;
                        const admin = await batch.get('admin');
                        const str_value = jsonStringify(op.value);
                        if(null !== admin && null !== str_value &&
                            null === await batch.get('sh/'+op.hash)){
                            const verified = _this.wallet.verify(op.hash, str_value + op.nonce, admin.value);
                            if(true === verified) {
                                await batch.put('wl/'+op.value.dispatch.user, op.value.dispatch.status);
                                await batch.put('sh/'+op.hash, '');
                                console.log(`Changed whitelist status ${op.value.dispatch.user} to ${op.value.dispatch.status}`);
                            }
                        }
                    } else if(op.type === 'enableWhitelist') {
                        // Chat whitelist config apply: admin-signed enable/disable whitelist enforcement.
                        if(false === this.check.enableWhitelist(op)) continue;
                        const admin = await batch.get('admin');
                        const str_value = jsonStringify(op.value);
                        if(null !== admin && null !== str_value &&
                            null === await batch.get('sh/'+op.hash)){
                            const verified = _this.wallet.verify(op.hash, str_value + op.nonce, admin.value);
                            if(true === verified) {
                                await batch.put('wlst', op.value.dispatch.enabled);
                                await batch.put('sh/'+op.hash, '');
                                console.log(`Changed whitelist enabled ${op.value.dispatch.enabled}`);
                            }
                        }
                    } else if(op.type === 'enableTransactions') {
                        if(false === this.check.enableTransactions(op)) continue;
                        const admin = await batch.get('admin');
                        const str_value = jsonStringify(op.value);
                        if(null !== admin && null !== str_value &&
                            null === await batch.get('sh/'+op.hash)){
                            const verified = _this.wallet.verify(op.hash, str_value + op.nonce, admin.value);
                            if(true === verified) {
                                await batch.put('txen', op.value.dispatch.enabled);
                                await batch.put('sh/'+op.hash, '');
                                console.log(`Changed transactions enabled ${op.value.dispatch.enabled}`);
                            }
                        }
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

    async _open() {
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

    async createHash(type, message){
        if(type === 'blake3'){
            const out = await blake3Hash(message);
            return out.toString('hex');
        }
        if(type === 'sha256'){
            const out = b4a.alloc(sodium.crypto_hash_sha256_BYTES);
            sodium.crypto_hash_sha256(out, b4a.from(message));
            return b4a.toString(out, 'hex');
        }
        let createHash = null;
        if(global.Pear !== undefined){
            let _type = '';
            switch(type.toLowerCase()){
                case 'sha1': _type = 'SHA-1'; break;
                case 'sha384': _type = 'SHA-384'; break;
                case 'sha512': _type = 'SHA-512'; break;
                default: throw new Error('Unsupported algorithm.');
            }
            const encoder = new TextEncoder();
            const data = encoder.encode(message);
            const hash = await crypto.subtle.digest(_type, data);
            const hashArray = Array.from(new Uint8Array(hash));
            return hashArray
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
        } else {
            return crypto.createHash(type).update(message).digest('hex')
        }
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
