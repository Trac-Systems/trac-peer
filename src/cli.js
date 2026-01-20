/** @typedef {import('pear-interface')} */ /* global Pear */
import readline from 'readline';
import tty from 'tty';

import {
    addWriter,
    addIndexer,
    addAdmin,
    setAutoAddWriters,
    setChatStatus,
    setMod,
    deleteMessage,
    enableWhitelist,
    postMessage,
    setNick,
    muteStatus,
    setWhitelistStatus,
    updateAdmin,
    tx,
    pinMessage,
    joinValidator,
    removeWriter,
    removeIndexer,
    unpinMessage,
    deploySubnet,
    enableTransactions
} from "./functions.js";



// printHelp(){
//     console.log('Node started. Available commands:');
//     console.log(' ');
//     console.log('- Setup Commands:');
//     console.log('- /add_admin | Works only once and only on bootstrap node! Enter a wallet address to assign admin rights: \'/add_admin --address "<address>"\'.');
//     console.log('- /update_admin | Existing admins may transfer admin ownership. Enter "null" as address to waive admin rights for this peer entirely: \'/update_admin --address "<address>"\'.');
//     console.log('- /add_indexer | Only admin. Enter a peer writer key to get included as indexer for this network: \'/add_indexer --key "<key>"\'.');
//     console.log('- /add_writer | Only admin. Enter a peer writer key to get included as writer for this network: \'/add_writer --key "<key>"\'.');
//     console.log('- /remove_writer | Only admin. Enter a peer writer key to get removed as writer or indexer for this network: \'/remove_writer --key "<key>"\'.');
//     console.log('- /set_auto_add_writers | Only admin. Allow any peer to join as writer automatically: \'/set_auto_add_writers --enabled 1\'');
//     console.log('- /enable_transactions | Only admin. Disable/enable transactions. Enabled by default: \'/enable_transactions --enabled 0\'');
//     console.log(' ');
//     console.log('- Chat Commands:');
//     console.log('- /set_chat_status | Only admin. Enable/disable the built-in chat system: \'/set_chat_status --enabled 1\'. The chat system is disabled by default.');
//     console.log('- /post | Post a message: \'/post --message "Hello"\'. Chat must be enabled. Optionally use \'--reply_to <message id>\' to respond to a desired message.');
//     console.log('- /set_nick | Change your nickname like this \'/set_nick --nick "Peter"\'. Chat must be enabled. Can be edited by admin and mods using the optional --user <address> flag.');
//     console.log('- /mute_status | Only admin and mods. Mute or unmute a user by their address: \'/mute_status --user "<address>" --muted 1\'.');
//     console.log('- /set_mod | Only admin. Set a user as mod: \'/set_mod --user "<address>" --mod 1\'.');
//     console.log('- /delete_message | Delete a message: \'/delete_message --id 1\'. Chat must be enabled.');
//     console.log('- /pin_message | Set the pin status of a message: \'/pin_message --id 1 --pin 1\'. Chat must be enabled.');
//     console.log('- /unpin_message | Unpin a message by its pin id: \'/unpin_message --pin_id 1\'. Chat must be enabled.');
//     console.log('- /enable_whitelist | Only admin. Enable/disable chat whitelists: \'/enable_whitelist --enabled 1\'.');
//     console.log('- /set_whitelist_status | Only admin. Add/remove users to/from the chat whitelist: \'/set_whitelist_status --user "<address>" --status 1\'.');
//     console.log(' ');
//     console.log('- System Commands:');
//     console.log('- /tx | Perform a contract transaction. The command flag contains contract commands (format is protocol dependent): \'/tx --command "<string>"\'. To simulate a tx, additionally use \'--sim 1\'.');
//     console.log('- /join_validator | Try to connect to a specific validator with its MSB address: \'/join_validator --address "<address>"\'.');
//     console.log('- /stats | check system properties such as writer key, DAG, etc.');
//     console.log('- /get_keys | prints your public and private keys. Be careful and never share your private key!');
//     console.log('- /exit | Exit the program');
//     console.log('- /help | This help text');

//     this.protocol_instance.printOptions();
// }

// async interactiveMode() {
//     if(this.readline_instance === null || (global.Pear !== undefined && global.Pear.config.options.type === 'desktop')) return;

//     const rl = this.readline_instance;

//     this.printHelp();

//     rl.on('line', async (input) => {
//         switch (input) {
//             case '/stats':
//                 await this.verifyDag();
//                 break;
//             case '/help':
//                 await this.printHelp();
//                 break;
//             case '/exit':
//                 console.log('Exiting...');
//                 rl.close();
//                 await this.close();
//                 typeof process !== "undefined" ? process.exit(0) : Pear.exit(0);
//             case '/get_keys':
//                 console.log("Public Key: ", this.wallet.publicKey);
//                 console.log("Secret Key: ", this.wallet.secretKey);
//                 break;
//             default:
//                 try {
//                     if (input.startsWith('/tx')) {
//                         await tx(input, this);
//                     } else if (input.startsWith('/add_indexer') || input.startsWith('/add_writer')) {
//                         await addWriter(input, this);
//                     } else if (input.startsWith('/remove_writer')) {
//                         await removeWriter(input, this);
//                     } else if (input.startsWith('/add_admin')) {
//                         await addAdmin(input, this);
//                     } else if (input.startsWith('/update_admin')) {
//                         await updateAdmin(input, this);
//                     } else if (input.startsWith('/set_auto_add_writers')) {
//                         await setAutoAddWriters(input, this);
//                     } else if (input.startsWith('/enable_transactions')) {
//                         await enableTransactions(input, this);
//                     } else if (input.startsWith('/set_chat_status')) {
//                         await setChatStatus(input, this);
//                     } else if (input.startsWith('/post')) {
//                         await postMessage(input, this);
//                     } else if (input.startsWith('/set_nick')) {
//                         await setNick(input, this);
//                     } else if (input.startsWith('/mute_status')) {
//                         await muteStatus(input, this);
//                     } else if (input.startsWith('/pin_message')) {
//                         await pinMessage(input, this);
//                     } else if (input.startsWith('/unpin_message')) {
//                         await unpinMessage(input, this);
//                     } else if (input.startsWith('/set_mod')) {
//                         await setMod(input, this);
//                     } else if (input.startsWith('/delete_message')) {
//                         await deleteMessage(input, this);
//                     } else if (input.startsWith('/enable_whitelist')) {
//                         await enableWhitelist(input, this);
//                     } else if (input.startsWith('/set_whitelist_status')) {
//                         await setWhitelistStatus(input, this);
//                     } else if (input.startsWith('/join_validator')) {
//                         await joinValidator(input, this);
//                     } else {
//                         await this.protocol_instance.customCommand(input);
//                     }
//                 } catch(e) {
//                     console.log('Command failed:', e.message);
//                 }
//         }
//         rl.prompt();
//     });

//     rl.prompt();
// }


export function printHelp(peer) {
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

    peer.protocol_instance.printOptions();
}

export async function startInteractiveCli(peer, { readlineInstance = null } = {}) {
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

    printHelp(peer);

    rl.on('line', async (input) => {
        switch (input) {
            case '/stats':
                await peer.verifyDag();
                break;
            case '/help':
                await printHelp(peer);
                break;
            case '/exit':
                console.log('Exiting...');
                rl.close();
                await peer.close();
                typeof process !== "undefined" ? process.exit(0) : Pear.exit(0);
            case '/get_keys':
                console.log("Address: ", peer.wallet.address);
                console.log("Public Key: ", peer.wallet.publicKey);
                console.log("Secret Key: ", peer.wallet.secretKey);
                break;
            default:
                try {
                    if (input.startsWith('/tx')) {
                        await tx(input, peer);
                    } else if (input.startsWith('/add_indexer')) {
                        await addIndexer(input, peer);
                    } else if (input.startsWith('/add_writer')) {
                        await addWriter(input, peer);
                    } else if (input.startsWith('/remove_writer')) {
                        await removeWriter(input, peer);
                    } else if (input.startsWith('/remove_indexer')) {
                        await removeIndexer(input, peer);
                    } else if (input.startsWith('/add_admin')) {
                        await addAdmin(input, peer);
                    } else if (input.startsWith('/update_admin')) {
                        await updateAdmin(input, peer);
                    } else if (input.startsWith('/enable_transactions')) {
                        await enableTransactions(input, peer);
                    } else if (input.startsWith('/set_auto_add_writers')) {
                        await setAutoAddWriters(input, peer);
                    } else if (input.startsWith('/set_chat_status')) {
                        await setChatStatus(input, peer);
                    } else if (input.startsWith('/post')) {
                        await postMessage(input, peer);
                    } else if (input.startsWith('/set_nick')) {
                        await setNick(input, peer);
                    } else if (input.startsWith('/mute_status')) {
                        await muteStatus(input, peer);
                    } else if (input.startsWith('/pin_message')) {
                        await pinMessage(input, peer);
                    } else if (input.startsWith('/unpin_message')) {
                        await unpinMessage(input, peer);
                    } else if (input.startsWith('/set_mod')) {
                        await setMod(input, peer);
                    } else if (input.startsWith('/delete_message')) {
                        await deleteMessage(input, peer);
                    } else if (input.startsWith('/enable_whitelist')) {
                        await enableWhitelist(input, peer);
                    } else if (input.startsWith('/set_whitelist_status')) {
                        await setWhitelistStatus(input, peer);
                    } else if (input.startsWith('/join_validator')) {
                        await joinValidator(input, peer);
                    } else if (input.startsWith('/deploy_subnet')) {
                        await deploySubnet(input, peer);
                    } else {
                        await peer.protocol_instance.customCommand(input);
                    }
                } catch (e) {
                    console.log('Command failed:', e.message);
                }
        }
        rl.prompt();
    });

    rl.prompt();
    return rl;
}
