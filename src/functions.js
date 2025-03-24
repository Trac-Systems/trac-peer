export function resolveNumberString(number, decimals){
    number = number + '';
    decimals = isNaN(decimals) ? 18 : parseInt(decimals);
    let splitted = number.split(".");
    if(splitted.length == 1 && decimals > 0){
        splitted[1] = '';
    }
    if(splitted.length > 1) {
        let size = decimals - splitted[1].length;
        for (let i = 0; i < size; i++) {
            splitted[1] += "0";
        }
        let new_splitted = '';
        for(let i = 0; i < splitted[1].length; i++)
        {
            if(i >= decimals)
            {
                break;
            }
            new_splitted += splitted[1][i];
        }
        number = "" + (splitted[0] == '0' ? '' : splitted[0]) + new_splitted;
        if(BigInt(number) == 0n || number === ''){
            number = "0";
        }
    }

    try {

        while (number.charAt(0) === '0') {
            number = number.substring(1);
        }

    }catch(e){

        number = '0';
    }

    return number === '' ? '0' : number;
}

export function formatNumberString(string, decimals) {
    string = string + '';
    decimals = isNaN(decimals) ? 18 : parseInt(decimals);
    let pos = string.length - decimals;

    if(decimals == 0) {
        // nothing
    }else
    if(pos > 0){
        string = string.substring(0, pos) + "." + string.substring(pos, string.length);
    }else{
        string = '0.' + ( "0".repeat( decimals - string.length ) ) + string;
    }

    return removeTrailingZeros(string);
}

export function removeTrailingZeros(value) {
    value = value.toString();
    if (value.indexOf('.') === -1) {
        return value;
    }

    while((value.slice(-1) === '0' || value.slice(-1) === '.') && value.indexOf('.') !== -1) {
        value = value.substr(0, value.length - 1);
    }
    return value;
}


export function restoreManifest(parsedManifest) {

    if (Array.isArray(parsedManifest.signers)) {
        parsedManifest.signers = parsedManifest.signers.map(signer => {
            if(signer.namespace && signer.namespace.data &&signer.publicKey && signer.publicKey.data){ 
                return {
                    ...signer,
                    namespace: Buffer.from(signer.namespace.data),
                    publicKey: Buffer.from(signer.publicKey.data),
                }
            } else {
                return signer;
            }
        });
    }

    return parsedManifest;
}

export async function setAutoAddWriters(input, peer){
    const splitted = input.split(' ');
    const value = splitted[1];
    if(value !== 'on' && value !== 'off') throw new Error('setAutoAddWriters: use on and off values.');
    const msg = { type: 'setAutoAddWriters', key: value, nonce : Math.random() + '-' + Date.now() }
    const signature = {
        msg: msg
    };
    const hash = peer.wallet.sign(JSON.stringify(msg));
    signature['hash'] = hash;
    await peer.base.append({type: 'setAutoAddWriters', key: value, value: signature });
}

export async function addAdmin(input, peer){
    const splitted = input.split(' ');
    const publicKey = splitted[1];
    await peer.base.append({ type: 'addAdmin', key: publicKey });
}

export async function addWriter(input, peer){
    const splitted = input.split(' ');
    if(splitted[0] === '/add_indexer'){
        const msg = { type: 'addIndexer', key: splitted[splitted.length - 1], nonce : Math.random() + '-' + Date.now() }
        const signature = {
            msg: msg
        };
        const hash = peer.wallet.sign(JSON.stringify(msg));
        signature['hash'] = hash;
        peer.emit('announce', { op : 'append_writer', type: 'addIndexer', key: splitted[splitted.length - 1], value: signature });
    } else if(splitted[0] === '/add_writer') {
        const msg = { type: 'addWriter', key: splitted[splitted.length - 1], nonce : Math.random() + '-' + Date.now() }
        const signature = {
            msg: msg
        };
        const hash = peer.wallet.sign(JSON.stringify(msg));
        signature['hash'] = hash;
        peer.emit('announce', { op : 'append_writer', type: 'addWriter', key: splitted[splitted.length - 1], value: signature });
    }
}
