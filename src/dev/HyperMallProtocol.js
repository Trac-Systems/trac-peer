import BaseProtocol from "../protocol.js";
import b4a from 'b4a';

class HyperMallProtocol extends BaseProtocol {

    constructor(peer, base, options = {}) {
        super(peer, base, options);
        this.BALANCE = 'b/';
        this.DEPLOYMENT = 'd/';
        this.LISTINGS_ID = 'lid';
        this.LISTINGS_KEY = 'lik/';
        this.USR_LISTINGS_ID = 'ulid/';
        this.USR_LISTINGS_KEY = 'ulik/';
        this.WITHDRAW_REQUEST_LENGTH = 'wdrl';
        this.WITHDRAW_REQUEST = 'wdr/';
        this.REDEEM = 'rdm/';
        this.ORDERS = 'o/';
        this.PAIR_KEY = 'p/';
        this.PAIRS_LENGTH_KEY = 'pairsl';
        this.PAIRS_KEY = 'pairs/';
        this.USER_WITHDRAW_REQUEST_LENGTH_KEY = 'uwdrl/';
        this.USER_WITHDRAW_REQUEST = 'uwdr/';
        this.FEES_KEY = 'fees';
        this.SPECIAL_FEES_KEY = 'sfees/';
        this.LAST_PRICE_KEY = 'ldp/';
        this.FILL_SERIES_LENGTH_KEY = 'fserl/';
        this.FILL_SERIES_KEY = 'fser/';
        this.STAKING_KEY = 'stkn/';
        this.STAKE = 'stk/';
        this.STAKE_LOG_KEY = 'stklog/';
        this.STAKE_LOG_LENGTH_KEY = 'stklogl';
        this.ALLOW_TRANSFER_KEY = 'altr/';
    }

    msgMaxBytes(){
        return 2_048;
    }

    async extendApi(){
        const _this = this;
        /**
         *
         * @param signed
         * @returns {Promise<number>}
         */
        this.api.getListingsLength = async function(signed = true){
            try {
                let length = null;
                if(true === signed) length = await _this.getSigned(_this.getListingsIdKey());
                if(false === signed) length = await _this.get(_this.getListingsIdKey());
                if (length !== null) {
                    return length;
                }
            } catch (e) { }
            return 0;
        };
        /**
         * Get actual order ID from a user listing
         * @param address - User's wallet address
         * @param userIndex - Index of the listing in user's orders
         * @param signed - Whether to use signed data
         * @returns {Promise<string|null>} - The actual order ID or null
         */
        this.api.getOrderIdFromListing = async function(address, userIndex, signed = true) {
            try {

                // Get the raw listing reference which contains the actual order ID
                let listingRef = null;
                if(true === signed) listingRef = await _this.getSigned(_this.getUserListingsKey(address, userIndex));
                if(false === signed) listingRef = await _this.get(_this.getUserListingsKey(address, userIndex));

                if (listingRef) {
                    // Extract the actual order ID from the reference
                    const parts = listingRef.split('/');
                    if (parts.length > 1) {
                        return parts[1]; // The actual order ID
                    }
                }
            } catch (e) {
                console.error("Error getting order ID from listing:", e);
            }
            return null;
        };
        /**
         *
         * @param index
         * @param signed
         * @returns {Promise<object|null>}
         */
        this.api.getListing = async function(index, signed = true){
            try {
                let listing = null;
                if(true === signed) listing = await _this.getSigned(_this.getListingsKey(index));
                if(false === signed) listing = await _this.get(_this.getListingsKey(index));
                if (null !== listing) {
                    return listing;
                }
            } catch (e) { }
            return null;
        };
        /**
         *
         * @param ticker
         * @param amount
         * @param address
         * @returns {Promise<{link: string, text: string}|null>}
         */
        this.api.getDepositInfo = async function(ticker, amount, address){
            if(ticker.startsWith('r/')){
                const address_key = 'vo_r/addr_' + this.peer.wallet.publicKey;
                const address = await _this.get(address_key);
                if(null === address) return null;
                const res = {
                    address : address,
                    text : 'Please send your Runes to the given Bitcoin deposit address.'
                }
                return res;
            } else if(ticker.startsWith('h/')) {
                const res = {
                    address : await _this.get('admin'),
                    text : 'Please send your Hypertokens to the given Trac address.'
                }
                return res;
            } else {
                const to_address = 'bc1p5s46uu63wllwe0vr7um3k23kgak2lgc0np42fh4pn9j8vtwqseqs7ddg5e';
                try {
                    const transfer_inscription = `{ 
"p": "tap",
"op": "token-transfer",
"tick": "${ticker}",
"amt": "${amount}",
"dta" : "{\\"op\\":\\"deposit\\",\\"addr\\":\\"${address}\\"}",
"addr" : "${to_address}"
}`;
                    const text = b4a.toString(b4a.from(transfer_inscription), 'base64');
                    const link = "https://inscribe.taparooswap.com/tap/transfer?text="+text;
                    const howto = 'Use the button below to deposit (_ALWAYS_ use the button, never send directly!).'+"\n\n"+
                        'Two more steps IF you did not enable 1-TX Transfers in your TAP Wallet:'+"\n\n"+
                        '1) Send the transfer inscription using the button below to the Hypermall address: '+to_address+"\n\n"+
                        '2) Once confirmed, you will have access to your funds in Hypermall.'+"\n";
                    const res = {
                        link : link,
                        text : howto
                    }
                    return res;
                } catch (e) { }
            }

            return null;
        };
        /**
         *
         * @param tx
         * @param signed
         * @returns {Promise<{link: string, text: string}|null>}
         */
        this.api.getWithdrawInfo = async function(tx, signed = true){
            try {
                let voucher = null;
                if(true === signed) voucher = await _this.getSigned(_this.getRedeemKey(tx));
                if(false === signed) voucher = await _this.get(_this.getRedeemKey(tx));
                if (voucher !== null) {
                    try{
                        const vouch = JSON.parse(voucher);
                        if(vouch.from !== undefined){
                            const text = b4a.toString(b4a.from(voucher), 'base64');
                            const res = {
                                voucher : text,
                                text : 'Copy and redeem the voucher in the Hypertokens contract.'
                            }
                            return res;
                        }
                    }catch(e){ }
                    const text = b4a.toString(b4a.from(voucher), 'base64');
                    const link = "https://inscribe.taparooswap.com/text?data="+text;
                    const howto = '1) To receive your funds, use the button below and follow the instructions.'+"\n\n"+
                        '2) Once confirmed, you will have access to your funds on Bitcoin.';
                    const res = {
                        link : link,
                        text : howto
                    }
                    return res;
                }
            } catch (e) { }
            return null;
        };
        /**
         *
         * @param address
         * @param ticker
         * @param signed
         * @returns {Promise<string>}
         */
        this.api.getBalance = async function(address, ticker, signed = true){
            try {
                let balance = null;
                if(true === signed) balance = await _this.getSigned(_this.getBalanceKey(address, ticker));
                if(false === signed) balance = await _this.get(_this.getBalanceKey(address, ticker));
                if (balance !== null) {
                    let deployment = null;
                    if(true === signed) deployment = await _this.getSigned(_this.getDeploymentKey(ticker));
                    if(false === signed) deployment = await _this.get(_this.getDeploymentKey(ticker));
                    if (deployment !== null) {
                        return _this.fromBigIntString(balance, deployment.dec);
                    }
                }
            } catch (e) { }
            return '0';
        };
        /**
         *
         * @param address
         * @param signed
         * @returns {Promise<number>}
         */
        this.api.getUserListingsLength = async function(address, signed = true){
            try {
                let my_length = null;
                if(true === signed) my_length = await _this.getSigned(_this.getUserListingsIdKey(address));
                if(false === signed) my_length = await _this.get(_this.getUserListingsIdKey(address));
                if (my_length !== null) {
                    return my_length;
                }
            } catch (e) { }
            return 0;
        };
        /**
         *
         * @param address
         * @param index
         * @param signed
         * @returns {Promise<object|null>}
         */
        this.api.getUserListing = async function(address, index, signed = true){
            try {
                let listing = null;
                if(true === signed) listing = await _this.getSigned(_this.getUserListingsKey(address, index));
                if(false === signed) listing = await _this.get(_this.getUserListingsKey(address, index));
                if (null !== listing) {
                    if(true === signed) listing = await _this.getSigned(_this.getListingsKey(listing.split('/')[1]));
                    if(false === signed) listing = await _this.get(_this.getListingsKey(listing.split('/')[1]));
                    if (null !== listing) {
                        return listing;
                    }
                }
            } catch (e) { }
            return null;
        };
        /**
         *
         * @param ticker
         * @param fticker
         * @param signed
         * @returns {Promise<{}|null>}
         */
        this.api.getOrders = async function(ticker, fticker, signed = true){
            try {
                let orders = null;
                if(true === signed) orders = await _this.getSigned(_this.getOrdersKey(ticker, fticker));
                if(false === signed) orders = await _this.get(_this.getOrdersKey(ticker, fticker));
                if (orders !== null) {
                    const keys = Object.keys(orders);
                    keys.sort((a, b) => BigInt(a) > BigInt(b));
                    const sortedObject = {};
                    for (const key of keys) {
                        sortedObject[key] = orders[key];
                    }
                    return sortedObject;
                }
            } catch (e) { }
            return null;
        };
        /**
         *
         * @param signed
         * @returns {Promise<number>}
         */
        this.api.getPairsLength = async function(signed = true){
            try {
                let length = null;
                if(true === signed) length = await _this.getSigned(_this.getPairsLengthKey());
                if(false === signed) length = await _this.get(_this.getPairsLengthKey());
                if (length !== null) {
                    return length;
                }
            } catch (e) { }
            return 0;
        };
        /**
         *
         * @param index
         * @param signed
         * @returns {Promise<object|null>}
         */
        this.api.getPair = async function(index, signed = true){
            try {
                let pair = null;
                if(true === signed) pair = await _this.getSigned(_this.getPairsKey(index));
                if(false === signed) pair = await _this.get(_this.getPairsKey(index));
                if (null !== pair) {
                    return pair;
                }
            } catch (e) { }
            return null;
        };
        /**
         *
         * @param tick
         * @param signed
         * @returns {Promise<number|null>}
         */
        this.api.getDeployment = async function(tick, signed = true) {
            try {
                let deployment = null;
                if (true === signed) deployment = await _this.getSigned(_this.getDeploymentKey(tick));
                if (false === signed) deployment = await _this.get(_this.getDeploymentKey(tick));
                if (deployment !== null && deployment.dec !== undefined) {
                    return deployment.dec;
                }
            } catch (e) { }
            return null;
        };
        /**
         *
         * @param address
         * @param signed
         * @returns {Promise<number>}
         */
        this.api.getUserWithdrawRequestsLength = async function(address, signed = true){
            try {
                let my_length = null;
                if(true === signed) my_length = await _this.getSigned(_this.getUserWithdrawRequestLengthKey(address));
                if(false === signed) my_length = await _this.get(_this.getUserWithdrawRequestLengthKey(address));
                if (my_length !== null) {
                    return my_length;
                }
            } catch (e) { }
            return 0;
        };
        /**
         *
         * @param address
         * @param index
         * @param signed
         * @returns {Promise<object|null>}
         */
        this.api.getUserWithdrawRequest = async function(address, index, signed = true){
            try {
                let withdraw = null;
                if(true === signed) withdraw = await _this.getSigned(_this.getUserWithdrawRequestKey(address, index));
                if(false === signed) withdraw = await _this.get(_this.getUserWithdrawRequestKey(address, index));
                if (null !== withdraw) {
                    if(true === signed) withdraw = await _this.getSigned(_this.getWithdrawRequestKey(withdraw.split('/')[1]));
                    if(false === signed) withdraw = await _this.get(_this.getWithdrawRequestKey(withdraw.split('/')[1]));
                    if (null !== withdraw) {
                        return withdraw;
                    }
                }
            } catch (e) { }
            return null;
        };
        /**
         *
         * @param ticker
         * @param fticker
         * @param signed
         * @returns {Promise<string>}
         */
        this.api.getLastPrice = async function(ticker, fticker, signed = true){
            try {
                let last_price = null;
                if(true === signed) last_price = await _this.getSigned(_this.getLastPriceKey(ticker, fticker));
                if(false === signed) last_price = await _this.get(_this.getLastPriceKey(ticker, fticker));
                if (last_price !== null) {
                    return last_price;
                }
            } catch (e) { }
            return null;
        };
        /**
         *
         * @param signed
         * @returns {Promise<number>}
         */
        this.api.getStakeLogLength = async function(signed = true){
            try {
                let length = null;
                if(true === signed) length = await _this.getSigned(_this.getStakeLogLengthKey());
                if(false === signed) length = await _this.get(_this.getStakeLogLengthKey());
                if (length !== null) {
                    return length;
                }
            } catch (e) { }
            return 0;
        };
        /**
         *
         * @param index
         * @param signed
         * @returns {Promise<object|null>}
         */
        this.api.getStakeLog = async function(index, signed = true){
            try {
                let log = null;
                if(true === signed) log = await _this.getSigned(_this.getStakeLogKey(index));
                if(false === signed) log = await _this.get(_this.getStakeLogKey(index));
                if (null !== log) {
                    return log;
                }
            } catch (e) { }
            return null;
        };
        /**
         *
         * @param address
         * @param tick
         * @param signed
         * @returns {Promise<object|null>}
         */
        this.api.getUserStake = async function(address, tick, signed = true){
            try {
                let stake = null;
                if(true === signed) stake = await _this.getSigned(_this.getStakingKey(address, tick));
                if(false === signed) stake = await _this.get(_this.getStakingKey(address, tick));
                if (stake !== null) {
                    return stake;
                }
            } catch (e) { }
            return null;
        };
        /**
         *
         * @param tick
         * @param ftick
         * @param signed
         * @returns {Promise<number>}
         */
        this.api.getFillSeriesLength = async function(tick, ftick, signed = true){
            try {
                let length = null;
                if(true === signed) length = await _this.getSigned(_this.getFillSeriesLengthKey(tick, ftick));
                if(false === signed) length = await _this.get(_this.getFillSeriesLengthKey(tick, ftick));
                if (length !== null) {
                    return length;
                }
            } catch (e) { }
            return 0;
        };
        /**
         *
         * @param tick
         * @param ftick
         * @param index
         * @param signed
         * @returns {Promise<object|null>}
         */
        this.api.getFillSeries = async function(tick, ftick, index, signed = true){
            try {
                let series = null;
                if(true === signed) series = await _this.getSigned(_this.getFillSeriesKey(tick, ftick, index));
                if(false === signed) series = await _this.get(_this.getFillSeriesKey(tick, ftick, index));
                if (null !== series) {
                    return series;
                }
            } catch (e) { }
            return null;
        };
    }

    mapTxCommand(command){
        if(typeof command === 'string' && command === '') return null;
        const proto = typeof command === 'string' ? this.safeJsonParse(command) : command;
        if(typeof proto !== 'object' || typeof proto.op !== 'string') return null;
        const obj = { type : null, value : proto };
        switch (proto.op) {
            case 'allow-transfer': obj.type = 'allowTransfer'; break;
            case 'transfer': obj.type = 'transfer'; break;
            case 'staking': obj.type = 'setStaking'; break;
            case 'unstake': obj.type = 'unstake'; break;
            case 'stake': obj.type = 'stake'; break;
            case 'fees': obj.type = 'setFees'; break;
            case 'special-fees': obj.type = 'setSpecialFees'; break;
            case 'remove-special-fees': obj.type = 'setRemoveSpecialFees'; break;
            case 'pair': obj.type = 'setPair'; break;
            case 'withdraw': obj.type = 'withdrawRequest'; break;
            case 'list': obj.type = 'list'; break;
            case 'delist': obj.type = 'delist'; break;
            case 'fill': obj.type = 'fill'; break;
        }
        if(null !== obj.type) return obj;
        return null;
    }

    async printOptions(){
        console.log(' ');
        console.log('- Hypermall Commands:');
        console.log('- /get_deposit_link | enter a token ticker and amount to generate a deposit link: \'/get_deposit_link --ticker "<ticker>" --amount "<amount>"\'');
        console.log('- /get_withdraw_link | enter the transaction hash of your withdraw request to generate a redeem link: \'/get_withdraw_link --tx "<transaction hash>"\'.');
        console.log('- /balance | enter a token ticker to see your token balance: \'/balance --ticker "<ticker>"\'');
        console.log('- /listings_length | see the amount of all listings ever.');
        console.log('- /my_listings_length | see the amount of all of your listings ever.');
        console.log('- /get_listing | enter the listing index to get listing information. The index starts at zero until length - 1: \'/get_listing --index <index>\'');
        console.log('- /get_my_listing | enter the listing index to get listing information. The index starts at zero until length - 1: \'/get_my_listing --index <index>\'');
        console.log('- /my_withdraw_requests_length | see the amount of all of your withdraw requests ever.');
        console.log('- /my_withdraw_request | enter the withdraw request index to get the request information. The index starts at zero until length - 1: \'/my_withdraw_request --index <index>\'');
    }

    async customCommand(input) {
        await super.tokenizeInput(input);

        if (this.input.startsWith('/test')) {
            const _this = this;
            async function runTest(){
                if(Object.keys(_this.peer.tx_pool).length < _this.peer.tx_pool_max_size)
                {
                    const deployment = JSON.parse('{"op":"deploy","tick":"'+Math.random()+'","max":"21000000","lim":"1000","dec":18}');
                    try{
                        await _this.broadcastTransaction(_this.peer.msb.getNetwork().validator,{
                            type : 'deployTest',
                            value : deployment
                        });
                    }catch(e)
                    {
                        console.log('Disconnected')
                    }
                } else {
                    console.log('TX Pool full');
                }
                if(_this.peer.msb.getNetwork().validator_stream === null){
                    console.log('No validator stream provided.');
                } else {
                    setTimeout(runTest, 10);
                }
            }
            runTest();
        } else if (this.input.startsWith('/get_deposit_link')) {
            const splitted = this.parseArgs(input);
            console.log(this.safeJsonStringify(await this.api.getDepositInfo(splitted.ticker, splitted.amount, this.peer.wallet.publicKey)));
        } else if (this.input.startsWith('/get_withdraw_link')) {
            const splitted = this.parseArgs(input);
            console.log(this.safeJsonStringify(await this.api.getWithdrawInfo(splitted.tx, false)));
        } else if (this.input.startsWith('/get_my_listing')) {
            const splitted = this.parseArgs(input);
            console.log(this.safeJsonStringify(await this.api.getUserListing(this.peer.wallet.publicKey, splitted.index)));
        } else if (this.input.startsWith('/get_listing')) {
            const splitted = this.parseArgs(input);
            console.log(this.safeJsonStringify(await this.api.getListing(splitted.index)));
        } else if (this.input.startsWith('/listings_length')) {
            console.log(this.safeJsonStringify(await this.api.getListingsLength()));
        } else if (this.input.startsWith('/my_listings_length')) {
            console.log(this.safeJsonStringify(await this.api.getUserListingsLength(this.peer.wallet.publicKey)));
        } else if (this.input.startsWith('/balance')) {
            const splitted = this.parseArgs(input);
            console.log(this.safeJsonStringify(await this.api.getBalance(this.peer.wallet.publicKey, splitted.ticker)));
        } else if (this.input.startsWith('/my_withdraw_requests_length')) {
            console.log(this.safeJsonStringify(await this.api.getUserWithdrawRequestsLength(this.peer.wallet.publicKey)));
        } else if (this.input.startsWith('/my_withdraw_request')) {
            const splitted = this.parseArgs(input);
            console.log(this.safeJsonStringify(await this.api.getUserWithdrawRequest(this.peer.wallet.publicKey, splitted.index)));
        }
    }

    getBalanceKey(from_key, tick)
    {
        return this.BALANCE + from_key + '/' + this.safeJsonStringify(tick);
    }

    getStakingKey(from_key, tick)
    {
        return this.STAKE + from_key + '/' + this.safeJsonStringify(tick);
    }

    getDeploymentKey(tick)
    {
        return this.DEPLOYMENT + this.safeJsonStringify(tick);
    }

    getPairKey(tick, ftick)
    {
        return this.PAIR_KEY + this.safeJsonStringify(tick) + '/' + this.safeJsonStringify(ftick);
    }

    getListingsKey(listing_id)
    {
        return this.LISTINGS_KEY + listing_id;
    }

    getListingsIdKey()
    {
        return this.LISTINGS_ID;
    }

    getUserListingsKey(from_key, listing_id)
    {
        return this.USR_LISTINGS_KEY + from_key + '/' + listing_id;
    }

    getOrdersKey(tick, ftick)
    {
        return this.ORDERS + this.safeJsonStringify(tick) + '/' + this.safeJsonStringify(ftick);
    }

    getUserListingsIdKey(from_key)
    {
        return this.USR_LISTINGS_ID + from_key;
    }

    getWithdrawRequestLengthKey()
    {
        return this.WITHDRAW_REQUEST_LENGTH;
    }

    getWithdrawRequestKey(num)
    {
        return this.WITHDRAW_REQUEST + num;
    }

    getRedeemKey(tx)
    {
        return this.REDEEM + tx;
    }

    getPairsLengthKey()
    {
        return this.PAIRS_LENGTH_KEY;
    }

    getFeesKey()
    {
        return this.FEES_KEY;
    }

    getSpecialFeesKey(tick, ftick)
    {
        return this.SPECIAL_FEES_KEY + this.safeJsonStringify(tick) + '/' + this.safeJsonStringify(ftick);
    }

    getPairsKey(index)
    {
        return this.PAIRS_KEY + index;
    }

    getUserWithdrawRequestLengthKey(address)
    {
        return this.USER_WITHDRAW_REQUEST_LENGTH_KEY + address;
    }

    getUserWithdrawRequestKey(address, index)
    {
        return this.USER_WITHDRAW_REQUEST +  address + '/' + index;
    }

    getLastPriceKey(tick, ftick)
    {
        return this.LAST_PRICE_KEY + this.safeJsonStringify(tick) + '/' + this.safeJsonStringify(ftick);
    }

    getFillSeriesLengthKey(tick, ftick)
    {
        return this.FILL_SERIES_LENGTH_KEY + this.safeJsonStringify(tick) + '/' + this.safeJsonStringify(ftick);
    }

    getFillSeriesKey(tick, ftick, index)
    {
        return this.FILL_SERIES_KEY + this.safeJsonStringify(tick) + '/' + this.safeJsonStringify(ftick) + '/' + index;
    }

    getStakingSetupKey(tick)
    {
        return this.STAKING_KEY + this.safeJsonStringify(tick);
    }

    getStakeLogLengthKey()
    {
        return this.STAKE_LOG_LENGTH_KEY;
    }

    getStakeLogKey(index)
    {
        return this.STAKE_LOG_KEY + index;
    }

    getAllowTransferKey(addr)
    {
        return this.ALLOW_TRANSFER_KEY + addr;
    }
}

export default HyperMallProtocol;