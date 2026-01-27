import { TxOperation } from './tx/index.js';
import { MsgOperation } from './msg/index.js';
import { FeatureOperation } from './feature/index.js';
import { AddIndexerOperation } from './addIndexer/index.js';
import { AddWriterOperation } from './addWriter/index.js';
import { RemoveWriterOperation } from './removeWriter/index.js';
import { SetChatStatusOperation } from './setChatStatus/index.js';
import { SetAutoAddWritersOperation } from './setAutoAddWriters/index.js';
import { AutoAddWritersOperation } from './autoAddWriter/index.js';
import { AddAdminOperation } from './addAdmin/index.js';
import { UpdateAdminOperation } from './updateAdmin/index.js';
import { SetNickOperation } from './setNick/index.js';
import { MuteStatusOperation } from './muteStatus/index.js';
import { DeleteMessageOperation } from './deleteMessage/index.js';
import { UnpinMessageOperation } from './unpinMessage/index.js';
import { PinMessageOperation } from './pinMessage/index.js';
import { SetModOperation } from './setMod/index.js';
import { SetWhitelistStatusOperation } from './setWhitelistStatus/index.js';
import { EnableWhitelistOperation } from './enableWhitelist/index.js';
import { EnableTransactionsOperation } from './enableTransactions/index.js';

const handlers = [
    { operation: 'tx', Class: TxOperation },
    { operation: 'msg', Class: MsgOperation },
    { operation: 'feature', Class: FeatureOperation },
    { operation: 'addIndexer', Class: AddIndexerOperation },
    { operation: 'addWriter', Class: AddWriterOperation },
    { operation: 'removeWriter', Class: RemoveWriterOperation },
    { operation: 'setChatStatus', Class: SetChatStatusOperation },
    { operation: 'setAutoAddWriters', Class: SetAutoAddWritersOperation },
    { operation: 'autoAddWriter', Class: AutoAddWritersOperation },
    { operation: 'addAdmin', Class: AddAdminOperation },
    { operation: 'updateAdmin', Class: UpdateAdminOperation },
    { operation: 'setNick', Class: SetNickOperation },
    { operation: 'muteStatus', Class: MuteStatusOperation },
    { operation: 'deleteMessage', Class: DeleteMessageOperation },
    { operation: 'unpinMessage', Class: UnpinMessageOperation },
    { operation: 'pinMessage', Class: PinMessageOperation },
    { operation: 'setMod', Class: SetModOperation },
    { operation: 'setWhitelistStatus', Class: SetWhitelistStatusOperation },
    { operation: 'enableWhitelist', Class: EnableWhitelistOperation },
    { operation: 'enableTransactions', Class: EnableTransactionsOperation }
]

export const handlerFor = (node, context) => {
    const handler = handlers.find(({ operation }) => operation === node.value.type)
    if (handler) {
        return new handler.Class(context)
    }
}
