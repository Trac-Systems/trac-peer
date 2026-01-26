import BaseContract from "../contract.js";

class HyperMallContract extends BaseContract {

    constructor(protocol, options = {}) {
        super(protocol, options);

        this.addSchema('stake', {
            value : {
                $$type: "object",
                tick : { type : "string", min : 1, max: 128 },
                amt : { type : "string", numeric : true, min: 1, max: 38 }
            }
        });

        this.addSchema('unstake', {
            value : {
                $$type: "object",
                tick : { type : "string", min : 1, max: 128 }
            }
        });

        this.addSchema('setStaking', {
            value : {
                $$type: "object",
                tick : { type : "string", min : 1, max: 128 },
                min_blocks : { type : "number", integer : true, min : 0, max : Number.MAX_SAFE_INTEGER },
                max_block : { type : "number", integer : true, min : 0, max : Number.MAX_SAFE_INTEGER },
                enabled : { type : "boolean" },
                min_amt : { type : "string", numeric : true, min: 1, max: 38 },
                max_amt : { type : "string", numeric : true, min: 1, max: 38 }
            }
        });

        this.addSchema('setPair', {
            value : {
                $$type: "object",
                tick : { type : "string", min : 1, max: 128 },
                ftick : { type : "string", min : 1, max: 128 },
                tick_min : { type : "string", numeric : true, min: 1, max: 38 },
                ftick_min : { type : "string", numeric : true, min: 1, max: 38 },
                enabled : { type : "boolean" }
            }
        });

        this.addSchema('allowTransfer', {
            value : {
                $$type: "object",
                addr : { type : "is_hex" },
                enabled : { type : "boolean" }
            }
        });

        this.addSchema('transfer', {
            value : {
                $$type: "object",
                tick : { type : "string", min : 1, max: 128 },
                amt : { type : "string", numeric : true, min: 1, max: 38 },
                addr : { type : "is_hex" }
            }
        });

        this.addSchema('setFees', {
            value : {
                $$type: "object",
                maker_fee : { type : "string", numeric : true, min: 1, max: 38 },
                taker_fee : { type : "string", numeric : true, min: 1, max: 38 },
                receiver: { type : "is_hex" }
            }
        });

        this.addSchema('setSpecialFees', {
            value : {
                $$type: "object",
                tick : { type : "string", min : 1, max: 128 },
                ftick : { type : "string", min : 1, max: 128 },
                max_block : { type : "number", integer : true, min : 0, max : Number.MAX_SAFE_INTEGER },
                maker_fee : { type : "string", numeric : true, min: 1, max: 38 },
                taker_fee : { type : "string", numeric : true, min: 1, max: 38 },
                receiver: { type : "is_hex" }
            }
        });

        this.addSchema('setRemoveSpecialFees', {
            value : {
                $$type: "object",
                tick : { type : "string", min : 1, max: 128 },
                ftick : { type : "string", min : 1, max: 128 }
            }
        });

        this.addSchema('fill', {
            value : {
                $$type: "object",
                id : { type : "number", integer : true, min : 0 },
                amt : { type : "string", numeric : true, min: 1, max: 38 }
            }
        });

        this.addSchema('delist', {
            value : {
                $$type: "object",
                id : { type : "number", integer : true, min : 0, max : Number.MAX_SAFE_INTEGER }
            }
        });

        this.addSchema('list', {
            value : {
                $$type: "object",
                tick : { type : "string", min : 1, max: 128 },
                ftick : { type : "string", min : 1, max: 128 },
                fprice : { type : "string", numeric : true, min: 1, max: 38 },
                amt : { type : "string", numeric : true, min: 1, max: 38 }
            }
        });

        this.addSchema('withdrawRequest', {
            value : {
                $$type: "object",
                tick : { type : "string", min : 1, max: 128 },
                amt : { type : "string", numeric : true, min: 1, max: 38 },
                addr : { type : "bitcoin_address" }
            }
        });

        this.addSchema('deployTest', {
            value : {
                $$strict: true,
                $$type: "object",
                op : { type : "string", min : 1, max: 128 },
                tick : { type : "string", min : 1, max: 128 },
                max : { type : "string", numeric : true, min: 1, max: 38 },
                lim : { type : "string", numeric : true, min: 1, max: 38 },
                dec : { type : "number", integer : true, min : 0, max : 18 }
            }
        });

        this.addSchema('feature_entry', {
            key : { type : "string", min : 1, max: 256 },
            value : { type : "any" }
        });

        this.addSchema('tap_hypermall_feature_deposit', {
            value : {
                $$type: "object",
                tick : { type : "string", min : 1, max: 128 },
                amt : { type : "string", numeric : true, min: 1, max: 38 },
                addr : { type : "is_hex" }
            }
        });

        this.addSchema('tap_hypermall_feature_withdraw', {
            value : {
                $$type: "object",
                tx : { type : "is_hex" },
                ins : { type : "string", min : 1, max: 4096 }
            }
        });

        this.addSchema('tap_hypermall_feature_deploy', {
            value : {
                $$type: "object",
                tick : { type : "string", min : 1, max: 128 },
                max : { type : "string", numeric : true, min: 1, max: 38 },
                lim : { type : "string", numeric : true, min: 1, max: 38 },
                dec : { type : "number", integer : true, min : 0, max : 18 }
            }
        });

        const _this = this;

        this.addFeature('extapprove_feature', async function(){
            if(false === _this.validateSchema('feature_entry', _this.op)) return;
            if(_this.op.key === 'aprvall' || _this.op.key.startsWith('aprvd/')) {
                await _this.put(_this.op.key, _this.op.value);
            }
        });

        this.addFeature('slowdown_feature', async function(){
            if(false === _this.validateSchema('feature_entry', _this.op)) return;
            if(_this.op.key === 'slwdn') {
                await _this.put(_this.op.key, _this.op.value);
            }
        });

        this.addFeature('timer_feature', async function(){
            if(false === _this.validateSchema('feature_entry', _this.op)) return;
            if(_this.op.key === 'currentTime') {
                await _this.put(_this.op.key, _this.op.value);
            }
        });

        this.addFeature('tap_hypermall_feature', async function(){
            if(false === _this.validateSchema('feature_entry', _this.op)) return;
            if(_this.op.key === 'currentBlock' ||
                _this.op.key === 'cwl' ||
                _this.op.key.startsWith('processed_block_') ||
                _this.op.key.startsWith('vo_') ||
                _this.op.key.startsWith('wdp/') ) {
                console.log(_this.op.key, _this.op.value);
                await _this.put(_this.op.key, _this.op.value);
            } else if(_this.op.key === 'deposit') {
                if(false === _this.validateSchema('tap_hypermall_feature_deposit', _this.op)) return;
                await _this.deposit();
            } else if(_this.op.key === 'withdraw') {
                if(false === _this.validateSchema('tap_hypermall_feature_withdraw', _this.op)) return;
                await _this.withdraw();
            }  else if(_this.op.key === 'deploy') {
                if(false === _this.validateSchema('tap_hypermall_feature_deploy', _this.op)) return;
                await _this.deploy();
            }
        });

        this.messageHandler(async function(){
            if(1 === await _this.get('slwdn')){
                console.log('chat slowdown');
                return false;
            }
            if(0 === await _this.get('aprvall') &&
                1 !== await _this.get('aprvd/'+_this.address)){
                console.log('not approved');
                return false;
            }
        });
    }

    async fill(){
        let address = this.address;
        let listing = await this.get(this.protocol.getListingsKey(this.value.id));

        if(null === listing || address === listing.address) return new Error('Invalid listing');

        const pair1_enabled = await this.get(this.protocol.getPairKey(listing.tick, listing.ftick));
        const pair2_enabled = await this.get(this.protocol.getPairKey(listing.ftick, listing.tick));
        if(true !== pair1_enabled && true !== pair2_enabled) return new Error('Invalid pair');

        let deployment = await this.get(this.protocol.getDeploymentKey(listing.tick));
        let fill_deployment = await this.get(this.protocol.getDeploymentKey(listing.ftick));

        if(false === listing.active || null === deployment || null === fill_deployment) return new Error('Invalid ticker');

        const amt = this.protocol.safeBigInt(this.protocol.toBigIntString(this.value.amt, deployment.dec));
        let listing_filled = this.protocol.safeBigInt(this.protocol.toBigIntString(listing.filled, deployment.dec));
        let listing_amt = this.protocol.safeBigInt(this.protocol.toBigIntString(listing.amt, deployment.dec));

        if(null === amt || amt <= 0n || listing_amt < amt || null === listing_filled || null === listing_amt) return new Error('Invalid listing');

        let balance = await this.get(this.protocol.getBalanceKey(address, fill_deployment.tick));

        if(null === balance) {
            balance = 0n;
        } else {
            balance = this.protocol.safeBigInt(balance);
            if(null === balance) return new Error('Invalid balance');
        }

        let price = this.protocol.safeBigInt(this.protocol.toBigIntString(listing.fprice, fill_deployment.dec + 26));
        const dec = this.protocol.safeBigInt(deployment.dec);
        const fdec = this.protocol.safeBigInt(fill_deployment.dec);

        if(null === price || null === dec || null === fdec) return new Error('Invalid price');

        let total = ((amt * price) / 10n ** dec)/10n**26n;
        let _total = ((listing_amt * price) / 10n ** dec)/10n**26n;

        if(_total <= 0n) return this._delist(listing.address, this.value.id);
        if(total <= 0n && listing_amt <= amt ) return this._delist(listing.address, this.value.id);

        if(total <= 0n || balance < total) return new Error('Invalid total');

        listing_amt -= amt;
        listing_filled += amt;
        balance -= total;

        if(balance < 0n) return new Error('Invalid calculation');

        if(listing_amt <= 0n) {
            listing.active = false;
            listing_amt = 0n;
        }

        listing.amt = this.protocol.fromBigIntString(listing_amt.toString(), deployment.dec);
        listing.filled = this.protocol.fromBigIntString(listing_filled.toString(), deployment.dec);

        let lister_balance = await this.get(this.protocol.getBalanceKey(listing.address, fill_deployment.tick));

        if(lister_balance === null) {
            lister_balance = 0n;
        } else {
            lister_balance = this.protocol.safeBigInt(lister_balance);
            if(null === lister_balance) return new Error('Invalid lister balance');
        }

        let fees;

        let something_special = await this.get(this.protocol.getSpecialFeesKey(deployment.tick, fill_deployment.tick));
        if(null === something_special){
            something_special = await this.get(this.protocol.getSpecialFeesKey(fill_deployment.tick, deployment.tick));
        }

        if(null !== something_special){
            const current_block = await this.get('currentBlock');
            if(null === current_block) something_special = null;
            if(null !== current_block && something_special.max_block > 0 &&
                current_block > something_special.max_block) {
                something_special = null;
            }
        }

        if(null === something_special){
            fees = await this.get(this.protocol.getFeesKey());
        } else {
            fees = something_special;
        }

        let platform_fee_receiver = null;

        if(null !== fees){
            platform_fee_receiver = fees.receiver;
        }

        // maker fees
        let platform_maker_fee = 0n
        let validator_maker_fee = 0n;
        let net_maker_total = total;

        if(null !== fees){
            const platform_maker_fee_percent = this.protocol.safeBigInt(fees.maker_fee);
            if(null !== platform_maker_fee_percent && platform_maker_fee_percent > 0n){
                const total_maker_fee = (total * platform_maker_fee_percent) / 10n**4n;
                net_maker_total = net_maker_total - total_maker_fee;
                const total_maker_fee_div = total_maker_fee / 2n;
                platform_maker_fee = total_maker_fee_div;
                validator_maker_fee = total_maker_fee_div;
            }
        }

        lister_balance += net_maker_total;

        if(lister_balance < 0n) return new Error('Lister balance too low');

        let buyer_balance = await this.get(this.protocol.getBalanceKey(address, deployment.tick));

        if(buyer_balance === null) {
            buyer_balance = 0n;
        } else {
            buyer_balance = this.protocol.safeBigInt(buyer_balance);
            if(null === buyer_balance) return new Error('Invalid buyer balance');
        }

        // taker fees
        let platform_taker_fee = 0n
        let validator_taker_fee = 0n;
        let net_taker_total = amt;

        if(null !== fees){
            const platform_taker_fee_percent = this.protocol.safeBigInt(fees.taker_fee);
            if(null !== platform_taker_fee_percent && platform_taker_fee_percent > 0n){
                const total_taker_fee = (amt * platform_taker_fee_percent) / 10n**4n;
                net_taker_total = net_taker_total - total_taker_fee;
                const total_taker_fee_div = total_taker_fee / 2n;
                platform_taker_fee = total_taker_fee_div;
                validator_taker_fee = total_taker_fee_div;
            }
        }

        buyer_balance += net_taker_total;

        if(buyer_balance < 0n) return new Error('Buyer balance too low');

        let orders_key = this.protocol.getOrdersKey(listing.tick, listing.ftick);
        let orders = await this.get(orders_key);
        const bigIntPrice = this.protocol.toBigIntString(listing.fprice, 18);
        const bigIntPrice2 = this.protocol.toBigIntString(listing.fprice, fill_deployment.dec);

        await this.put(this.protocol.getLastPriceKey(listing.tick, listing.ftick), bigIntPrice);
        const series_length_key = this.protocol.getFillSeriesLengthKey(listing.tick, listing.ftick);
        let series_length = await this.get(series_length_key);
        if(null === series_length){
            series_length = 0;
        }
        const series_key = this.protocol.getFillSeriesKey(listing.tick, listing.ftick, series_length);
        await this.put(series_key, { price : bigIntPrice, amt : amt.toString(), time : await this.get('currentTime') });
        await this.put(series_length_key, series_length + 1);

        if(null !== orders) {
            if(false === listing.active && null !== orders[bigIntPrice2]){
                const index = orders[bigIntPrice2].findIndex((element) => element === this.value.id);
                if(index !== -1){
                    orders[bigIntPrice2].splice(index, 1);
                    if(orders[bigIntPrice2].length === 0){
                        delete orders[bigIntPrice2];
                    }
                    await this.put(orders_key, orders);
                }
            }
        }

        if(platform_maker_fee > 0n && null !== platform_fee_receiver){
            let pmf_balance = await this.get(this.protocol.getBalanceKey(platform_fee_receiver, fill_deployment.tick));
            if(null === pmf_balance) {
                pmf_balance = 0n;
            } else {
                pmf_balance = this.protocol.safeBigInt(pmf_balance);
                if(null === pmf_balance) return new Error('Invalid maker balance');
            }
            pmf_balance += platform_maker_fee;
            await this.put(this.protocol.getBalanceKey(platform_fee_receiver, fill_deployment.tick), pmf_balance.toString());
        }

        if(platform_taker_fee > 0n && null !== platform_fee_receiver){
            let ptf_balance = await this.get(this.protocol.getBalanceKey(platform_fee_receiver, deployment.tick));
            if(null === ptf_balance) {
                ptf_balance = 0n;
            } else {
                ptf_balance = this.protocol.safeBigInt(ptf_balance);
                if(null === ptf_balance) return new Error('Invalid taker balance');
            }
            ptf_balance += platform_taker_fee;
            await this.put(this.protocol.getBalanceKey(platform_fee_receiver, deployment.tick), ptf_balance.toString());
        }

        if(validator_maker_fee > 0n && null !== this.validator_address){
            let vmf_balance = await this.get(this.protocol.getBalanceKey(this.validator_address, fill_deployment.tick));
            if(null === vmf_balance) {
                vmf_balance = 0n;
            } else {
                vmf_balance = this.protocol.safeBigInt(vmf_balance);
                if(null === vmf_balance) return new Error('Invalid validator maker balance');
            }
            vmf_balance += validator_maker_fee;
            await this.put(this.protocol.getBalanceKey(this.validator_address, fill_deployment.tick), vmf_balance.toString());
        }

        if(validator_taker_fee > 0n && null !== this.validator_address){
            let vtf_balance = await this.get(this.protocol.getBalanceKey(this.validator_address, deployment.tick));
            if(null === vtf_balance) {
                vtf_balance = 0n;
            } else {
                vtf_balance = this.protocol.safeBigInt(vtf_balance);
                if(null === vtf_balance) return new Error('Invalid validator taker balance');
            }
            vtf_balance += validator_taker_fee;
            await this.put(this.protocol.getBalanceKey(this.validator_address, deployment.tick), vtf_balance.toString());
        }

        await this.put(this.protocol.getBalanceKey(listing.address, fill_deployment.tick), lister_balance.toString());
        await this.put(this.protocol.getBalanceKey(address, fill_deployment.tick), balance.toString());
        await this.put(this.protocol.getBalanceKey(address, deployment.tick), buyer_balance.toString());
        await this.put(this.protocol.getListingsKey(this.value.id), listing);
        console.log(address + ': Order filled', listing);
    }

    async _delist(address, id){
        let listing = await this.get(this.protocol.getListingsKey(id));

        if(null === listing) return new Error('Invalid listing');

        let deployment = await this.get(this.protocol.getDeploymentKey(listing.tick));
        let fill_deployment = await this.get(this.protocol.getDeploymentKey(listing.ftick));

        if(deployment === null || fill_deployment === null || false === listing.active || listing.address !== address) return new Error('Invalid data');

        let amt = this.protocol.safeBigInt(this.protocol.toBigIntString(listing.amt, deployment.dec));

        if(null === amt || amt <= 0n) return new Error('Invalid amount');

        listing.active = false;
        let balance = await this.get(this.protocol.getBalanceKey(address, listing.tick))

        if(null === balance) {
            balance = 0n;
        } else {
            balance = this.protocol.safeBigInt(balance);
            if(null === balance) return new Error('Invalid balance');
        }

        balance += amt;
        listing.amt = '0';

        let orders_key= this.protocol.getOrdersKey(listing.tick, listing.ftick);
        let orders = await this.get(orders_key);
        if(null !== orders) {
            const bigIntPrice = this.protocol.toBigIntString(listing.fprice, fill_deployment.dec);
            if(null !== orders[bigIntPrice]){
                const index = orders[bigIntPrice].findIndex((element) => element === id);
                if(index !== -1){
                    orders[bigIntPrice].splice(index, 1);
                    if(orders[bigIntPrice].length === 0){
                        delete orders[bigIntPrice];
                    }
                    await this.put(orders_key, orders);
                }
            }
        }

        await this.put(this.protocol.getBalanceKey(address, listing.tick), balance.toString());
        await this.put(this.protocol.getListingsKey(id), listing);
        console.log(address + ': Delisted', listing);
    }

    async delist(){
        return this._delist(this.address, this.value.id);
    }

    async list(){
        if(this.value.tick === this.value.ftick) return new Error('Equal ticks');

        const pair1_enabled = await this.get(this.protocol.getPairKey(this.value.tick, this.value.ftick));
        const pair2_enabled = await this.get(this.protocol.getPairKey(this.value.ftick, this.value.tick));
        if(true !== pair1_enabled && true !== pair2_enabled) return new Error('Pair not enabled');

        let tick_min = 0n;

        if(true === pair1_enabled){
            tick_min = this.protocol.safeBigInt(await this.get(this.protocol.getPairKey(this.value.tick, this.value.ftick)+'/tm'));
            if(null === tick_min) return new Error('Pair 1 min not found');
        } else {
            tick_min = this.protocol.safeBigInt(await this.get(this.protocol.getPairKey(this.value.ftick, this.value.tick)+'/ftm'));
            if(null === tick_min) return new Error('Pair 2 min not found');
        }

        let address = this.address;
        let deployment = await this.get(this.protocol.getDeploymentKey(this.value.tick));
        let fill_deployment = await this.get(this.protocol.getDeploymentKey(this.value.ftick));

        if(null === deployment || null === fill_deployment) return new Error('Missing deployment');

        let balance = await this.get(this.protocol.getBalanceKey(address, this.value.tick))

        if(null === balance) {
            balance = 0n;
        } else {
            balance = this.protocol.safeBigInt(balance);
            if(null === balance) return new Error('Insufficient balance');
        }

        const amt = this.protocol.safeBigInt(this.protocol.toBigIntString(this.value.amt, deployment.dec));

        if(amt < tick_min) return new Error('Minimum amount not met');
        if(null === amt || balance < amt || amt <= 0n) return new Error('Invalid amount');

        // creating a new global listing and id
        let listings_id = await this.get(this.protocol.getListingsIdKey());

        if(null === listings_id) {
            listings_id = 0;
        }

        const cloned = this.protocol.safeClone(this.op.value);
        if(cloned === null) return new Error('Cloning failed');

        cloned['filled'] = '0';
        cloned['active'] = true;
        cloned['address'] = address;
        balance -= amt;

        if(balance < 0n) return new Error('Invalid trade amount');

        let usr_listings_id = await this.get(this.protocol.getUserListingsIdKey(address));

        if(null === usr_listings_id) {
            usr_listings_id = 0;
        }

        let orders_key = this.protocol.getOrdersKey(this.value.tick, this.value.ftick);
        let orders = await this.get(orders_key);
        if(null === orders) {
            orders = {};
        }
        const big_int_price = this.protocol.toBigIntString(this.value.fprice, fill_deployment.dec);
        const big = this.protocol.safeBigInt(big_int_price);

        if(null === big || big < 0n) return new Error('Invalid fprice');

        if(orders[big_int_price] === undefined){
            orders[big_int_price] = [];
        }
        if(false === orders[big_int_price].includes(listings_id)){
            orders[big_int_price].push(listings_id);
        }
        await this.put(orders_key, orders);

        // removing from the user's available balance as it is now reserved for the listing
        await this.put(this.protocol.getBalanceKey(address, this.value.tick), balance.toString());
        // storing the next listing id
        await this.put(this.protocol.getListingsIdKey(), listings_id + 1);
        // saving the listing itself
        await this.put(this.protocol.getListingsKey(listings_id), cloned);
        // storing the next user listing id
        await this.put(this.protocol.getUserListingsIdKey(address), usr_listings_id + 1);
        // using a reference to the global list for the user. saving storage space:
        await this.put(this.protocol.getUserListingsKey(address, usr_listings_id), this.protocol.getListingsKey(listings_id));
        console.log(address + `: Listing added`, cloned);
    }

    async withdrawRequest() {
        let address = this.address;

        let deployment = await this.get(this.protocol.getDeploymentKey(this.value.tick));

        if(null === deployment) return new Error('Invalid ticker');

        let balance = await this.get(this.protocol.getBalanceKey(address, this.value.tick))

        if(null === balance) {
            balance = 0n;
        } else {
            balance = this.protocol.safeBigInt(balance);
            if(null === balance) return new Error('Invalid balance');
        }

        let amt = this.protocol.safeBigInt(this.protocol.toBigIntString(this.value.amt, deployment.dec));

        if(null === amt || amt <= 0n || balance - amt < 0n) return new Error('Invalid amount');

        balance -= amt;

        let length = await this.get(this.protocol.getWithdrawRequestLengthKey());
        if(null === length){
            length = 0;
        }
        let user_request_length = await this.get(this.protocol.getUserWithdrawRequestLengthKey(address));
        if(null === user_request_length){
            user_request_length = 0;
        }
        await this.put(this.protocol.getWithdrawRequestKey(length), {
            addr : this.value.addr,
            tick : this.value.tick,
            amt: amt.toString(),
            dec : deployment.dec,
            tx : this.tx
        });
        await this.put(this.protocol.getWithdrawRequestLengthKey(), length + 1);
        await this.put(this.protocol.getUserWithdrawRequestKey(address, user_request_length), this.protocol.getWithdrawRequestKey(length));
        await this.put(this.protocol.getUserWithdrawRequestLengthKey(address), user_request_length + 1);
        await this.put(this.protocol.getBalanceKey(address, this.value.tick), balance.toString());
        console.log('Withdraw request placed', address, this.op.value);
    }

    async withdraw() {
        if(this.address !== await this.get('admin')) return false;
        if(null !== await this.get(this.protocol.getRedeemKey(this.value.tx))) return new Error('Invalid redeem');
        await this.put(this.protocol.getRedeemKey(this.value.tx), this.value.ins);
        console.log('Withdraw granted', this.value.tx, this.value.ins);
    }

    async deposit() {
        if(this.address !== await this.get('admin')) return false;
        let address = this.value.addr;
        let deployment = await this.get(this.protocol.getDeploymentKey(this.value.tick));

        if(null === deployment) return new Error('Invalid deployment');

        let balance = await this.get(this.protocol.getBalanceKey(address, this.value.tick))

        if(null === balance) {
            balance = 0n;
        } else {
            balance = this.protocol.safeBigInt(balance);
            if(null === balance) return new Error('Invalid balance');
        }

        let amt = this.protocol.safeBigInt(this.protocol.toBigIntString(this.value.amt, deployment.dec));

        if(null === amt || amt <= 0n) return new Error('Invalid amount');

        balance += amt;

        if(balance < 0n) return new Error('Balance too low');

        await this.put(this.protocol.getBalanceKey(address, this.value.tick), balance.toString());
        console.log(`Deposit added:`, this.op.value);
    }

    async unstake() {
        let address = this.address;
        let current_block = await this.get('currentBlock');
        let deployment = await this.get(this.protocol.getDeploymentKey(this.value.tick));
        let staking = await this.get(this.protocol.getStakingKey(address, this.value.tick));

        if(null === current_block || isNaN(parseInt(current_block)) || current_block < 0 || null === deployment ||
            null === staking || staking.min_blocks < 0 || staking.max_block < 0 || staking.block < 0) return new Error('Invalid data');

        let balance = await this.get(this.protocol.getBalanceKey(address, this.value.tick))

        if(null === balance) {
            balance = 0n;
        } else {
            balance = this.protocol.safeBigInt(balance);
            if(null === balance) return new Error('Invalid balance');
        }

        let staking_balance = this.protocol.safeBigInt(staking.balance);

        if(null === staking_balance || current_block - staking.block < staking.min_blocks) return new Error('Invalid stake');

        balance += staking_balance;

        if(balance < 0n) return new Error('Balance too low');

        let stake_log_length = await this.get(this.protocol.getStakeLogLengthKey());
        if(null === stake_log_length){
            stake_log_length = 0;
        }
        await this.put(this.protocol.getStakeLogKey(stake_log_length), {
            type : 'unstake',
            tick: this.value.tick,
            unstake_amt : staking_balance.toString(),
            unstake_block : parseInt(current_block),
            stake_block : staking.block,
            min_blocks : staking.min_blocks,
            max_block : staking.max_block,
            address : address
        });
        await this.put(this.protocol.getStakeLogLengthKey(), stake_log_length + 1);
        await this.del(this.protocol.getStakingKey(address, this.value.tick));
        await this.put(this.protocol.getBalanceKey(address, this.value.tick), balance.toString());
        console.log(`Stake removed:`, this.op.value);
    }

    async stake() {
        let address = this.address;
        let current_block = await this.get('currentBlock');
        let staking = await this.get(this.protocol.getStakingKey(address, this.value.tick))
        let deployment = await this.get(this.protocol.getDeploymentKey(this.value.tick));
        let staking_setup = await this.get(this.protocol.getStakingSetupKey(this.value.tick));

        if(null !== staking || null === deployment || null === staking_setup ||
            null === current_block || isNaN(parseInt(current_block)) || current_block < 0 ||
            false === staking_setup.enabled || staking_setup.min_blocks < 0 || staking_setup.max_block < 0 ||
            (staking_setup.max_block > 0 && current_block > staking_setup.max_block)) return new Error('Invalid stake');

        let balance = await this.get(this.protocol.getBalanceKey(address, this.value.tick))

        if(null === balance) {
            balance = 0n;
        } else {
            balance = this.protocol.safeBigInt(balance);
            if(null === balance) return new Error('Invalid balance');
        }

        let staking_balance = 0n;
        let block = parseInt(current_block);

        let amt = this.protocol.safeBigInt(this.protocol.toBigIntString(this.value.amt, deployment.dec));

        const min_amt = this.protocol.safeBigInt(staking_setup.min_amt);
        const max_amt = this.protocol.safeBigInt(staking_setup.max_amt);

        if(null === amt || null === max_amt || null === min_amt ||
            amt <= 0n || max_amt < 0n ||  min_amt < 0n || amt < min_amt ||
            (max_amt > 0n && amt > max_amt)) return new Error('Invalid amount');

        balance -= amt;
        staking_balance += amt;

        if(balance < 0n || staking_balance < 0n) return new Error('Balance too low');

        let stake_log_length = await this.get(this.protocol.getStakeLogLengthKey());
        if(null === stake_log_length){
            stake_log_length = 0;
        }
        await this.put(this.protocol.getStakeLogKey(stake_log_length), {
            type : 'stake',
            tick: this.value.tick,
            stake_amt : amt.toString(),
            min_amt : min_amt.toString(),
            max_amt : max_amt.toString(),
            stake_block : block,
            min_blocks : staking_setup.min_blocks,
            max_block : staking_setup.max_block,
            address: address
        });
        await this.put(this.protocol.getStakingKey(address, this.value.tick), {
            balance : staking_balance.toString(),
            block : block,
            min_blocks : staking_setup.min_blocks,
            max_block : staking_setup.max_block
        });
        await this.put(this.protocol.getStakeLogLengthKey(), stake_log_length + 1);
        await this.put(this.protocol.getBalanceKey(address, this.value.tick), balance.toString());
        console.log(`Stake added:`, this.op.value);
    }

    async deploy() {
        if(this.address !== await this.get('admin')) return false;
        if(null === await this.get(this.protocol.getDeploymentKey(this.value.tick))) {
            const cloned = this.protocol.safeClone(this.op.value);
            if(cloned === null) return new Error('Invalid clone');
            cloned.max = this.protocol.toBigIntString(this.value.max, this.value.dec);
            cloned.lim = this.protocol.toBigIntString(this.value.lim, this.value.dec);
            const big_max = this.protocol.safeBigInt(cloned.max);
            const big_lim = this.protocol.safeBigInt(cloned.lim);
            if(null === big_max || null == big_lim || big_max < 0n || big_lim < 0n) return new Error('Invalid max');
            await this.put(this.protocol.getDeploymentKey(this.value.tick), cloned);
            console.log(`Deployment added: ${cloned.tick}`);
            return true;
        }
        return false;
    }

    async setStaking(){
        const admin = await this.get('admin');
        if(null !== admin && this.address === admin){
            let deployment = await this.get(this.protocol.getDeploymentKey(this.value.tick));
            let blocks = this.value.min_blocks;
            if(null === blocks || null === deployment || true === isNaN(parseInt(blocks)) || blocks < 0 || this.value.max_block < 0) return new Error('Invalid block');
            const min_amt = this.protocol.safeBigInt(this.protocol.toBigIntString(this.value.min_amt, deployment.dec));
            const max_amt = this.protocol.safeBigInt(this.protocol.toBigIntString(this.value.max_amt, deployment.dec));
            if(null === min_amt || null == max_amt || min_amt < 0n || max_amt < 0n) return new Error('Invalid amount');
            blocks = parseInt(blocks);
            await this.put(this.protocol.getStakingSetupKey(this.value.tick), {
                tick : this.value.tick,
                min_blocks : blocks,
                max_block : this.value.max_block,
                enabled : this.value.enabled,
                min_amt : min_amt.toString(),
                max_amt : max_amt.toString()
            });
            console.log('Staking set:', {
                tick : this.value.tick,
                min_blocks : blocks,
                max_block : this.value.max_block,
                enabled : this.value.enabled,
                min_amt : min_amt.toString(),
                max_amt : max_amt.toString()
            });
            return true;
        }
        return new Error('No admin');
    }

    async setFees(){
        const admin = await this.get('admin');
        if(null !== admin && this.address === admin){
            const maker_fee = this.protocol.safeBigInt(this.protocol.toBigIntString(this.value.maker_fee, 2));
            const taker_fee = this.protocol.safeBigInt(this.protocol.toBigIntString(this.value.taker_fee, 2));
            if(null === maker_fee || null === taker_fee || maker_fee < 0 || taker_fee < 0) return new Error('Invalid fee');
            await this.put(this.protocol.getFeesKey(), {
                tick : null,
                ftick : null,
                maker_fee : maker_fee.toString(),
                taker_fee : taker_fee.toString(),
                receiver: this.value.receiver
            });
            console.log('Fees set', {
                tick : null,
                ftick : null,
                maker_fee : maker_fee.toString(),
                taker_fee : taker_fee.toString(),
                receiver: this.value.receiver
            });
            return true;
        }
        return new Error('No admin');
    }

    async setSpecialFees(){
        const admin = await this.get('admin');
        if(null !== admin && this.address === admin){
            let deployment = await this.get(this.protocol.getDeploymentKey(this.value.tick));
            let fill_deployment = await this.get(this.protocol.getDeploymentKey(this.value.ftick));
            const maker_fee = this.protocol.safeBigInt(this.protocol.toBigIntString(this.value.maker_fee, 2));
            const taker_fee = this.protocol.safeBigInt(this.protocol.toBigIntString(this.value.taker_fee, 2));
            const pair_key = this.protocol.getPairKey(this.value.tick, this.value.ftick);
            const pair = await this.get(pair_key);
            if(null === pair || null === maker_fee || null === taker_fee || maker_fee < 0 ||
                taker_fee < 0 || null === deployment || null === fill_deployment) return new Error('Invalid data');
            await this.put(this.protocol.getSpecialFeesKey(this.value.tick, this.value.ftick), {
                tick : this.value.tick,
                ftick : this.value.ftick,
                maker_fee : maker_fee.toString(),
                taker_fee : taker_fee.toString(),
                receiver: this.value.receiver,
                max_block : this.value.max_block
            });
            console.log('Fees set', {
                tick : this.value.tick,
                ftick : this.value.ftick,
                maker_fee : maker_fee.toString(),
                taker_fee : taker_fee.toString(),
                receiver: this.value.receiver,
                max_block : this.value.max_block
            });
            return true;
        }
        return new Error('No admin');
    }

    async setRemoveSpecialFees(){
        const admin = await this.get('admin');
        if(null !== admin && this.address === admin){
            await this.del(this.protocol.getSpecialFeesKey(this.value.tick, this.value.ftick));
            console.log('removed special fees', this.value.tick, this.value.ftick);
            return true;
        }
        return new Error('No admin');
    }

    async transfer(){
        if((this.address+'').trim().toLowerCase() === (this.value.addr+'').trim().toLowerCase()) return new Error('Cannot send to yourself');
        const allowed = await this.get(this.protocol.getAllowTransferKey(this.address));
        if(null !== allowed && true === allowed){
            let balance = await this.get(this.protocol.getBalanceKey(this.address, this.value.tick));
            if(null === balance) return new Error('No transferable balance');
            balance = this.protocol.safeBigInt(balance);
            if(null === balance) return new Error('Invalid balance');

            let deployment = await this.get(this.protocol.getDeploymentKey(this.value.tick));
            if(null === deployment) return new Error('Not deployed');

            const amt = this.protocol.safeBigInt(this.protocol.toBigIntString(this.value.amt, deployment.dec));
            if(null === amt) return new Error('Invalid amount');

            if(balance - amt < 0n) return new Error('Insufficient balance');

            let rec_balance = await this.get(this.protocol.getBalanceKey(this.value.addr, this.value.tick));

            if(null === rec_balance){
                rec_balance = 0n;
            } else {
                rec_balance = this.protocol.safeBigInt(rec_balance);
                if(null === rec_balance) return new Error('Invalid rec balance');
            }

            rec_balance += amt;
            balance -= amt;

            await this.put(this.protocol.getBalanceKey(this.address, this.value.tick), balance.toString());
            await this.put(this.protocol.getBalanceKey(this.value.addr, this.value.tick), rec_balance.toString());
            return true;
        }
        return new Error('No admin');
    }

    async allowTransfer(){
        const admin = await this.get('admin');
        if(null !== admin && this.address === admin){
            await this.put(this.protocol.getAllowTransferKey(this.value.addr), this.value.enabled);
            console.log('allowed transfer', this.value.addr, this.value.enabled);
            return true;
        }
        return new Error('No admin');
    }

    async setPair(){
        const admin = await this.get('admin');
        if(null !== admin && this.address === admin){
            let deployment = await this.get(this.protocol.getDeploymentKey(this.value.tick));
            let fill_deployment = await this.get(this.protocol.getDeploymentKey(this.value.ftick));
            if(null === deployment || null === fill_deployment) return new Error('Invalid deployment');
            const reverse_pair_key = this.protocol.getPairKey(this.value.ftick, this.value.tick);
            const reverse_pair = await this.get(reverse_pair_key);
            if(null !== reverse_pair) return new Error('Reverse pair exists already');
            const pair_key = this.protocol.getPairKey(this.value.tick, this.value.ftick);
            const pair = await this.get(pair_key);
            const pair_length_key = this.protocol.getPairsLengthKey();
            if(null === pair){
                let pairs_length = await this.get(pair_length_key);
                if(null === pairs_length){
                    pairs_length = 0;
                }
                await this.put(this.protocol.getPairsKey(pairs_length), { tick : this.value.tick, ftick : this.value.ftick });
                await this.put(pair_length_key, pairs_length + 1);
            }
            const tick_min = this.protocol.safeBigInt(this.protocol.toBigIntString(this.value.tick_min, deployment.dec));
            const ftick_min = this.protocol.safeBigInt(this.protocol.toBigIntString(this.value.ftick_min, fill_deployment.dec));
            if(null === tick_min || null === ftick_min || tick_min < 0n || ftick_min < 0n) return new Error('Invalid min');
            await this.put(pair_key, this.value.enabled);
            await this.put(pair_key + '/tm', tick_min.toString());
            await this.put(pair_key + '/ftm', ftick_min.toString());
            console.log(`Pair enabled: ${this.value.tick}/${this.value.ftick} = ${this.value.enabled}, tmin = ${this.value.tick_min}, ftmin = ${this.value.ftick_min}`);
            return true;
        }
        return new Error('No admin');
    }

    async deployTest() {
        if(this.address !== await this.get('admin')) return false;
        this.assert( null === await this.get(this.protocol.getDeploymentKey(this.value.tick)), 'Tick exists already.');
        const cloned = this.protocol.safeClone(this.op.value);
        this.assert(cloned !== null, 'Cloning failed.');
        cloned.max = this.protocol.toBigIntString(this.value.max, this.value.dec);
        cloned.lim = this.protocol.toBigIntString(this.value.lim, this.value.dec);
        await this.put(this.protocol.getDeploymentKey(this.value.tick), cloned);
    }
}

export default HyperMallContract;