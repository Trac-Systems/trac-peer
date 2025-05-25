/** @typedef {import('pear-interface')} */ /* global Pear */
import Autobase from 'autobase';
import Hyperswarm from 'hyperswarm';
import ReadyResource from 'ready-resource';
import b4a from 'b4a';
import sodium from 'sodium-native'
import Hyperbee from 'hyperbee';
import readline from 'readline';
import tty from 'tty'
import Corestore from 'corestore';
import w from 'protomux-wakeup';
const wakeup = new w();
import Protomux from 'protomux'
import c from 'compact-encoding'
import {
    addWriter, addAdmin, setAutoAddWriters, setChatStatus, setMod, deleteMessage,
    enableWhitelist, postMessage, jsonStringify, visibleLength, setNick,
    muteStatus, setWhitelistStatus, updateAdmin, tx, safeClone, jsonParse,
    pinMessage, joinValidator, removeWriter, unpinMessage, enableTransactions
} from "./functions.js";
import Check from "./check.js";
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
        this.readline_instance = null;
        this.enable_interactive_mode = options.enable_interactive_mode !== false;
        this.enable_txlogs = true === options.enable_txlogs;
        if(this.enable_interactive_mode !== false){
            try{
                this.readline_instance = readline.createInterface({
                    input: new tty.ReadStream(0),
                    output: new tty.WriteStream(1)
                });
            }catch(e){ }
        }

        this.tx_observer();
        this.validator_observer();
        this.nodeListener();
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
                    if(false === this.check.node(node)) continue;
                    const op = node.value;
                    if (op.type === 'tx') {
                        if(b4a.byteLength(jsonStringify(op)) > _this.protocol_instance.txMaxBytes()) continue;
                        if(false === this.check.tx(op)) continue;
                        if(op.value.msbbs !== _this.msb.bootstrap) continue;
                        while (_this.msb.base.view.core.signedLength < op.value.msbsl) {
                            console.log(_this.msb.base.view.core.signedLength, '<', op.value.msbsl)
                            await new Promise( (resolve, reject) => {
                                _this.msb.base.view.core.once('append', resolve);
                            });
                        }
                        const msb_view_session = _this.msb.base.view.checkout(op.value.msbsl);
                        const post_tx = await msb_view_session.get(op.key);
                        await msb_view_session.close();
                        if(false === this.check.postTx(post_tx)) continue;
                        const content_hash = await _this.createHash('sha256', jsonStringify(op.value.dispatch));
                        const enabled = await batch.get('txen');
                        if ((null === enabled || true === enabled.value) &&
                            op.key === post_tx.value.tx &&
                            null === await batch.get('tx/'+post_tx.value.tx) &&
                            post_tx.value.ch === content_hash &&
                            post_tx.value.ipk === op.value.ipk &&
                            post_tx.value.wp === op.value.wp &&
                            _this.wallet.verify(post_tx.value.ws, post_tx.value.tx + post_tx.value.wn, post_tx.value.wp) &&
                            _this.wallet.verify(post_tx.value.is, post_tx.value.tx + post_tx.value.in, post_tx.value.ipk) &&
                            post_tx.value.tx === await _this.protocol_instance.generateTx(
                                _this.bootstrap, _this.msb.bootstrap,
                                post_tx.value.wp, post_tx.value.i, post_tx.value.ipk,
                                post_tx.value.ch, post_tx.value.in
                            )) {
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
                            dta['tx'] = post_tx.value.tx;
                            dta['ipk'] = post_tx.value.ipk;
                            dta['wp'] = post_tx.value.wp;
                            await batch.put('txi/'+len, dta);
                            await batch.put('txl', len + 1);
                            await batch.put('tx/'+post_tx.value.tx, len);
                            let ulen = await batch.get('utxl/'+post_tx.value.ipk);
                            if(null === ulen) {
                                ulen = 0;
                            } else {
                                ulen = ulen.value;
                            }
                            await batch.put('utxi/'+post_tx.value.ipk+'/'+ulen, len);
                            await batch.put('utxl/'+post_tx.value.ipk, ulen + 1);
                            if(true === _this.enable_txlogs){
                                console.log(`${post_tx.value.tx} appended. Signed length:`, _this.base.view.core.signedLength, 'tx length', len + 1);
                            }
                        }
                    } else if(op.type === 'msg') {
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
                        if(false === this.check.key(op)) continue;
                        const auto_add_writers = await batch.get('auto_add_writers');
                        const banned = await batch.get('bnd/'+op.key);
                        if(null === banned && null !== auto_add_writers && auto_add_writers.value === 'on'){
                            const writerKey = b4a.from(op.key, 'hex');
                            await base.addWriter(writerKey, { isIndexer : false });
                        }
                        console.log(`Writer auto added: ${op.key}`);
                    } else if (op.type === 'addAdmin') {
                        if(false === this.check.key(op)) continue;
                        const bootstrap = b4a.toString(node.from.key, 'hex')
                        if(null === await batch.get('admin') && bootstrap === _this.bootstrap){
                            await batch.put('admin', op.key);
                            console.log(`Admin added: ${op.key}`);
                        }
                    } else if (op.type === 'updateAdmin') {
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
        if(this.msb.getNetwork().validator_stream === null) return;
        let _msg = safeClone(msg);
        if(_msg['ts'] !== undefined) delete _msg['ts'];
        try{ this.msb.getNetwork().validator_stream.messenger.send(_msg); } catch(e){ }
    }

    async _open() {
        await this.base.ready();
        await this.wallet.initKeyPair(this.KEY_PAIR_PATH, this.readline_instance);
        this.writerLocalKey = b4a.toString(this.base.local.key, 'hex');
        if(!this.init_contract_starting){
            await this.initContract();
        }
        if (this.replicate) await this._replicate();
        this.on('tx', async (msg) => {
            if(Object.keys(this.tx_pool).length <= this.tx_pool_max_size && !this.tx_pool[msg.tx]){
                await this.sendTx(msg);
                msg['ts'] = Math.floor(Date.now() / 1000);
                this.tx_pool[msg.tx] = msg;
            }
        });
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
                const msbsl = this.msb.base.view.core.signedLength;
                const view_session = this.msb.base.view.checkout(msbsl);
                const msb_tx = await view_session.get(tx);
                await view_session.close();
                if(null !== msb_tx){
                    if(this.protocol_instance.prepared_transactions_content[tx].dispatch.type !== undefined &&
                        this.protocol_instance.prepared_transactions_content[tx].dispatch.type !== 'p'){
                        const _this = this;
                        async function push(){
                            await _this.sleep(10_000 + (backoff * 250));
                            try{
                                await _this.protocol_instance.broadcastTransaction(_this.msb.getNetwork().validator,{
                                    type : 'p',
                                    value : ''
                                });
                            } catch(e) { }
                        }
                        push();
                    }
                    const _tx = {};
                    _tx['msbsl'] = msbsl;
                    _tx['dispatch'] = this.protocol_instance.prepared_transactions_content[tx].dispatch;
                    _tx['ipk'] = this.protocol_instance.prepared_transactions_content[tx].ipk;
                    _tx['wp'] = this.protocol_instance.prepared_transactions_content[tx].validator;
                    _tx['msbbs'] = this.msb.bootstrap;
                    delete this.tx_pool[tx];
                    delete this.protocol_instance.prepared_transactions_content[tx];
                    await this.base.append({ type: 'tx', key: tx, value: _tx });
                    backoff += 1;
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

    printHelp(){
        console.log('Node started. Available commands:');
        console.log(' ');
        console.log('- Setup Commands:');
        console.log('- /add_admin | Works only once and only on bootstrap node! Enter a wallet address to assign admin rights: \'/add_admin --address "<address>"\'.');
        console.log('- /update_admin | Existing admins may transfer admin ownership. Enter "null" as address to waive admin rights for this peer entirely: \'/update_admin --address "<address>"\'.');
        console.log('- /add_indexer | Only admin. Enter a peer writer key to get included as indexer for this network: \'/add_indexer --key "<key>"\'.');
        console.log('- /add_writer | Only admin. Enter a peer writer key to get included as writer for this network: \'/add_writer --key "<key>"\'.');
        console.log('- /remove_writer | Only admin. Enter a peer writer key to get removed as writer or indexer for this network: \'/remove_writer --key "<key>"\'.');
        console.log('- /set_auto_add_writers | Only admin. Allow any peer to join as writer automatically: \'/set_auto_add_writers --enabled 1\'');
        console.log('- /enable_transactions | Only admin. Disable/enable transactions. Enabled by default: \'/enable_transactions --enabled 0\'');
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
        console.log('- /stats | check system properties such as writer key, DAG, etc.');
        console.log('- /get_keys | prints your public and private keys. Be careful and never share your private key!');
        console.log('- /exit | Exit the program');
        console.log('- /help | This help text');

        this.protocol_instance.printOptions();
    }

    async interactiveMode() {
        if(this.readline_instance === null || (global.Pear !== undefined && global.Pear.config.options.type === 'desktop')) return;

        const rl = this.readline_instance;

        this.printHelp();

        rl.on('line', async (input) => {
            switch (input) {
                case '/stats':
                    await this.verifyDag();
                    break;
                case '/help':
                    await this.printHelp();
                    break;
                case '/exit':
                    console.log('Exiting...');
                    rl.close();
                    await this.close();
                    typeof process !== "undefined" ? process.exit(0) : Pear.exit(0);
                case '/get_keys':
                    console.log("Public Key: ", this.wallet.publicKey);
                    console.log("Secret Key: ", this.wallet.secretKey);
                    break;
                default:
                    try {
                        if (input.startsWith('/tx')) {
                            await tx(input, this);
                        } else if (input.startsWith('/add_indexer') || input.startsWith('/add_writer')) {
                            await addWriter(input, this);
                        } else if (input.startsWith('/remove_writer')) {
                            await removeWriter(input, this);
                        } else if (input.startsWith('/add_admin')) {
                            await addAdmin(input, this);
                        } else if (input.startsWith('/update_admin')) {
                            await updateAdmin(input, this);
                        } else if (input.startsWith('/set_auto_add_writers')) {
                            await setAutoAddWriters(input, this);
                        } else if (input.startsWith('/enable_transactions')) {
                            await enableTransactions(input, this);
                        } else if (input.startsWith('/set_chat_status')) {
                            await setChatStatus(input, this);
                        } else if (input.startsWith('/post')) {
                            await postMessage(input, this);
                        } else if (input.startsWith('/set_nick')) {
                            await setNick(input, this);
                        } else if (input.startsWith('/mute_status')) {
                            await muteStatus(input, this);
                        } else if (input.startsWith('/pin_message')) {
                            await pinMessage(input, this);
                        } else if (input.startsWith('/unpin_message')) {
                            await unpinMessage(input, this);
                        } else if (input.startsWith('/set_mod')) {
                            await setMod(input, this);
                        } else if (input.startsWith('/delete_message')) {
                            await deleteMessage(input, this);
                        } else if (input.startsWith('/enable_whitelist')) {
                            await enableWhitelist(input, this);
                        } else if (input.startsWith('/set_whitelist_status')) {
                            await setWhitelistStatus(input, this);
                        } else if (input.startsWith('/join_validator')) {
                            await joinValidator(input, this);
                        } else {
                            await this.protocol_instance.customCommand(input);
                        }
                    } catch(e) {
                        console.log('Command failed:', e.message);
                    }
            }
            rl.prompt();
        });

        rl.prompt();
    }
}

function noop() { }

export default Peer;