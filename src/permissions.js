export async function getAdminKey(peer) {
    if (!peer?.base?.view) return null;
    const admin = await peer.base.view.get('admin');
    return admin?.value ?? null;
}

export async function isAdmin(peer, address = null) {
    const target = address ?? peer?.wallet?.publicKey ?? null;
    if (!target) return false;
    const admin = await getAdminKey(peer);
    return admin !== null && admin === target;
}

export async function isMod(peer, address = null) {
    if (!peer?.base?.view) return false;
    const target = address ?? peer?.wallet?.publicKey ?? null;
    if (!target) return false;
    const mod = await peer.base.view.get('mod/' + target);
    return mod !== null && mod.value === true;
}

export async function requireAdmin(peer) {
    if (await isAdmin(peer)) return;
    throw new Error('Only admin may perform this operation.');
}

export async function requireAdminOrMod(peer) {
    if (await isAdmin(peer)) return;
    if (await isMod(peer)) return;
    throw new Error('Only admin or mod may perform this operation.');
}

export function isHex32(value) {
    return /^[0-9a-f]{64}$/.test(String(value ?? '').trim().toLowerCase());
}

export function getSubnetBootstrapHex(peer) {
    const b = peer?.bootstrap;
    if (!b) return null;
    if (typeof b === 'string') return b.toLowerCase();
    if (b?.toString) return b.toString('hex').toLowerCase();
    return null;
}

export function getLocalWriterKeyHex(peer) {
    try {
        return peer?.base?.local?.key?.toString('hex') ?? peer?.writerLocalKey ?? null;
    } catch (_e) {
        return peer?.writerLocalKey ?? null;
    }
}

export async function requireBootstrapNodeForAdminSet(peer) {
    const bootstrapHex = getSubnetBootstrapHex(peer);
    const writerKeyHex = getLocalWriterKeyHex(peer);
    if (!bootstrapHex || !writerKeyHex) throw new Error('Peer is not initialized.');
    if (bootstrapHex !== writerKeyHex.toLowerCase()) {
        throw new Error('Only the subnet bootstrap node may set the initial admin.');
    }
    const admin = await getAdminKey(peer);
    if (admin !== null) throw new Error('Admin is already set.');
}

