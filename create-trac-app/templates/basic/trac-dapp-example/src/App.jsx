import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  Container,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Stack,
  Chip,
  Tooltip,
  IconButton,
  Snackbar,
} from '@mui/material';
import PetsIcon from '@mui/icons-material/Pets';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';

const POLL_MS = 3000;
const DEFAULT_API_BASE = 'http://127.0.0.1:5001/v1';
const API_BASE = (import.meta.env.VITE_API_BASE || DEFAULT_API_BASE).replace(/\/$/, '');

function apiUrl(path, qs) {
  const p = path.startsWith('/') ? path : `/${path}`;
  const base = API_BASE ? `${API_BASE}${p}` : p;
  return qs ? `${base}?${qs}` : base;
}

function shortHex(value, keep = 10) {
  const s = String(value || '');
  if (s.length <= keep * 2 + 1) return s;
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
}

function monoFont() {
  return 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
}

function normalizeRows(payload) {
  try {
    const getFirstField = (obj) => {
      if (!obj || typeof obj !== 'object') return undefined;
      return obj?.tuxemons;
    };

    let raw = getFirstField(payload);
    if (!raw && payload?.value) {
      const v = payload.value;
      raw = typeof v === 'object' ? getFirstField(v) : undefined;
      if (!raw && typeof v === 'string') {
        try { raw = getFirstField(JSON.parse(v)); } catch {}
      }
    }
    if (raw) {
      const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(arr)) {
        return arr.map((item, idx) => ({
          id: typeof item?.id === 'number' ? item.id : idx,
          name: String(item?.name ?? ''),
          tx: String(item?.tx ?? ''),
        }));
      }
    }
  } catch {}
  return [];
}

async function httpJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) {
    const msg =
      typeof json === 'object' && json && typeof json.error === 'string'
        ? json.error
        : typeof json === 'string'
          ? json
          : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

function normalizeHexLower(hex) {
  if (!hex) return null;
  const s = String(hex);
  const normalized = s.startsWith('0x') ? s.slice(2) : s;
  return normalized.toLowerCase();
}

function randomHex(bytes) {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    const arr = Array.from({ length: bytes }, () => Math.floor(Math.random() * 256));
    return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function parseTracTxPayload(payload) {
  if (!payload || typeof payload !== 'string') return null;
  try {
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch {
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }
}

export default function App() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletPubKey, setWalletPubKey] = useState(null);
  const [provider, setProvider] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const sync = () => setProvider(window.tracnetwork ?? null);
    sync();
    window.addEventListener('tracnetwork#initialized', sync);
    return () => window.removeEventListener('tracnetwork#initialized', sync);
  }, []);

  const dexKey = useMemo(() => {
    if (!walletPubKey) return null;
    return `app/tuxedex/${walletPubKey}`;
  }, [walletPubKey]);

  const query = useMemo(() => {
    if (!dexKey) return null;
    return new URLSearchParams({ key: dexKey, confirmed: 'false' }).toString();
  }, [dexKey]);

  const fetchState = useCallback(async () => {
    try {
      setError(null);
      if (!query) {
        setRows([]);
        return;
      }
      const res = await fetch(apiUrl('/state', query), { cache: 'no-store' });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = text; }
      const next = normalizeRows(json);
      setRows(next);
    } catch (e) {
      setError(e?.message ?? 'Failed to fetch state');
    }
  }, [query]);

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    fetchState().finally(() => setLoading(false));
    const id = setInterval(fetchState, POLL_MS);
    return () => clearInterval(id);
  }, [fetchState, query]);

  const syncWallet = useCallback(async () => {
    if (!provider) {
      setError('TAP Wallet extension not detected (window.tracnetwork missing).');
      return;
    }
    try {
      setError(null);
      const [address, pubKey] = await Promise.all([
        provider.getAddress(),
        provider.getPublicKey(),
      ]);
      setWalletAddress(address || null);
      setWalletPubKey(normalizeHexLower(pubKey));
    } catch (e) {
      setWalletAddress(null);
      setWalletPubKey(null);
      const msg = String(e?.message || '');
      if (/not connected|requestaccount/i.test(msg)) {
        setError(null);
        return;
      }
      setError(msg || 'Failed to read wallet state');
    }
  }, [provider]);

  useEffect(() => {
    if (!provider) return;
    syncWallet();
  }, [provider, syncWallet]);

  const handleConnectWallet = useCallback(async () => {
    if (!provider) {
      setError('TAP Wallet extension not detected (window.tracnetwork missing).');
      return;
    }
    try {
      setError(null);
      const address = await provider.requestAccount();
      setWalletAddress(address || null);
      await syncWallet();
    } catch (e) {
      setError(e?.message || 'Wallet connection failed');
    }
  }, [provider, syncWallet]);

  const handleCatch = useCallback(async () => {
    if (!provider) {
      setError('TAP Wallet extension not detected (window.tracnetwork missing).');
      return;
    }
    if (!walletPubKey) {
      setError('Connect wallet first.');
      return;
    }
    if (!walletAddress) {
      setError('Connect wallet first.');
      return;
    }
    try {
      setError(null);
      setSending(true);

      const prepared_command = { type: 'catch', value: {} };

      const nonceRes = await httpJson(apiUrl('/contract/nonce'), { cache: 'no-store' });
      const nonce = normalizeHexLower(nonceRes?.nonce);
      if (!nonce) throw new Error('Failed to get nonce from peer');

      const prep = await httpJson(apiUrl('/contract/tx/prepare'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prepared_command, address: walletPubKey, nonce }),
      });

      const tx = normalizeHexLower(prep?.tx);
      if (!tx) throw new Error('Failed to prepare tx');

      const txData = {
        from: walletAddress,
        to: walletAddress,
        amount: '0',
        validity: '0'.repeat(64),
        nonce: randomHex(32),
        hash: tx,
        _bufferFields: ['hash', 'nonce'],
      };

      const txPayload = await provider.signTracTx(txData);
      const parsed = parseTracTxPayload(txPayload);
      const signedTx = normalizeHexLower(parsed?.tro?.tx);
      const signature = normalizeHexLower(parsed?.tro?.is);
      if (!signature) throw new Error('Wallet did not return a signature');
      if (signedTx && signedTx !== tx) {
        throw new Error('Wallet signed an unexpected tx hash');
      }

      await httpJson(apiUrl('/contract/tx'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tx,
          prepared_command,
          address: walletPubKey,
          signature,
          nonce,
          sim: true,
        }),
      });

      await httpJson(apiUrl('/contract/tx'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tx,
          prepared_command,
          address: walletPubKey,
          signature,
          nonce,
          sim: false,
        }),
      });

      setToast('Tuxemon caught!');
      fetchState();
    } catch (e) {
      console.error('Catch failed:', e);
      setError(e?.message || 'Catch transaction failed');
    } finally {
      setSending(false);
    }
  }, [provider, walletPubKey, walletAddress, fetchState]);

  const copy = useCallback(async (label, value) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast(`${label} copied`);
    } catch (e) {
      console.warn('Copy failed:', e);
      setToast('Copy failed');
    }
  }, []);

  useEffect(() => {
    if (!provider?.on) return;
    const onAccountsChanged = () => {
      syncWallet();
    };
    provider.on('accountsChanged', onAccountsChanged);
    provider.on('networkChanged', onAccountsChanged);
    return () => {
      provider.removeListener?.('accountsChanged', onAccountsChanged);
      provider.removeListener?.('networkChanged', onAccountsChanged);
    };
  }, [provider, syncWallet]);

  return (
    <>
      <AppBar
        position="static"
        elevation={0}
        sx={{
          bgcolor: 'transparent',
          background: 'linear-gradient(90deg, #0F172A 0%, #0B3A54 55%, #0F766E 100%)',
          borderBottom: '4px solid rgba(15, 23, 42, 0.9)',
        }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.35)',
              flexShrink: 0,
              bgcolor: 'rgba(15, 23, 42, 0.55)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 10px 22px rgba(0,0,0,0.28)',
            }}
          >
            <Typography
              component="span"
              sx={{
                fontWeight: 1000,
                fontSize: 14,
                lineHeight: 1,
                letterSpacing: 0.6,
                color: '#FDE68A',
                fontFamily: monoFont(),
              }}
            >
              TX
            </Typography>
          </Box>

          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 800, letterSpacing: 0.3 }}>
              Tuxedex
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              Catch Tuxemon • Switch accounts • Watch your collection grow
            </Typography>
          </Box>

          <Button
            color="secondary"
            variant={walletAddress ? 'outlined' : 'contained'}
            startIcon={<AccountBalanceWalletIcon />}
            onClick={handleConnectWallet}
            sx={{
              borderColor: 'rgba(17,24,39,0.55)',
              color: walletAddress ? '#111827' : '#111827',
              bgcolor: walletAddress ? 'rgba(255,255,255,0.85)' : undefined,
              fontWeight: 800,
              textTransform: 'none',
              boxShadow: walletAddress ? 'none' : '0 10px 24px rgba(0,0,0,0.25)',
            }}
          >
            {walletAddress ? 'Connected' : 'Connect Wallet'}
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 3 },
            borderRadius: 4,
            border: '4px solid #111827',
            bgcolor: 'rgba(255,255,255,0.92)',
            boxShadow: '0 20px 50px rgba(17, 24, 39, 0.25)',
          }}
        >
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                Tamer Card
              </Typography>
              <Tooltip title="Refresh wallet state">
                <span>
                  <IconButton
                    size="small"
                    onClick={syncWallet}
                    disabled={!provider}
                    sx={{
                      bgcolor: 'rgba(17,24,39,0.06)',
                      border: '1px solid rgba(17,24,39,0.18)',
                      '&:hover': { bgcolor: 'rgba(17,24,39,0.10)' },
                    }}
                  >
                    <RefreshRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1,
              }}
            >
              <Paper
                variant="outlined"
                sx={{
                  p: 1.25,
                  borderRadius: 999,
                  borderColor: 'rgba(17,24,39,0.22)',
                  bgcolor: 'rgba(255,255,255,0.75)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: provider ? '#16A34A' : '#6B7280',
                    boxShadow: provider
                      ? '0 0 0 4px rgba(34,197,94,0.15)'
                      : '0 0 0 4px rgba(107,114,128,0.12)',
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 900,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      color: 'rgba(17,24,39,0.70)',
                    }}
                  >
                    Wallet
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                    {provider ? (walletAddress ? 'Connected' : 'Detected (not connected)') : 'Not detected'}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={provider ? 'OK' : '—'}
                  color={provider ? 'success' : 'default'}
                  variant="outlined"
                />
              </Paper>

              <Paper
                variant="outlined"
                sx={{
                  p: 1.25,
                  borderRadius: 999,
                  borderColor: 'rgba(17,24,39,0.22)',
                  bgcolor: 'rgba(255,255,255,0.75)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 900,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      color: 'rgba(17,24,39,0.70)',
                    }}
                  >
                    Address
                  </Typography>
                  <Tooltip title={walletAddress || ''} disableHoverListener={!walletAddress}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: monoFont(),
                        fontWeight: 800,
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {walletAddress ? shortHex(walletAddress, 12) : '—'}
                    </Typography>
                  </Tooltip>
                </Box>
                <Tooltip title={walletAddress ? 'Copy' : 'Connect wallet'}>
                  <span>
                    <IconButton
                      size="small"
                      disabled={!walletAddress}
                      onClick={() => walletAddress && copy('Address', walletAddress)}
                      sx={{ border: '1px solid rgba(17,24,39,0.18)', bgcolor: 'rgba(17,24,39,0.04)' }}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Paper>

              <Paper
                variant="outlined"
                sx={{
                  p: 1.25,
                  borderRadius: 999,
                  borderColor: 'rgba(17,24,39,0.22)',
                  bgcolor: 'rgba(255,255,255,0.75)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 900,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      color: 'rgba(17,24,39,0.70)',
                    }}
                  >
                    PubKey
                  </Typography>
                  <Tooltip title={walletPubKey || ''} disableHoverListener={!walletPubKey}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: monoFont(),
                        fontWeight: 800,
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {walletPubKey ? shortHex(walletPubKey, 12) : '—'}
                    </Typography>
                  </Tooltip>
                </Box>
                <Tooltip title={walletPubKey ? 'Copy' : 'Connect wallet'}>
                  <span>
                    <IconButton
                      size="small"
                      disabled={!walletPubKey}
                      onClick={() => walletPubKey && copy('PubKey', walletPubKey)}
                      sx={{ border: '1px solid rgba(17,24,39,0.18)', bgcolor: 'rgba(17,24,39,0.04)' }}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Paper>

              <Paper
                variant="outlined"
                sx={{
                  p: 1.25,
                  borderRadius: 999,
                  borderColor: 'rgba(17,24,39,0.22)',
                  bgcolor: 'rgba(255,255,255,0.75)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 900,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      color: 'rgba(17,24,39,0.70)',
                    }}
                  >
                    State Key
                  </Typography>
                  <Tooltip title={dexKey || ''} disableHoverListener={!dexKey}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: monoFont(),
                        fontWeight: 800,
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {dexKey ? shortHex(dexKey, 18) : '—'}
                    </Typography>
                  </Tooltip>
                </Box>
                <Tooltip title={dexKey ? 'Copy' : 'Connect wallet'}>
                  <span>
                    <IconButton
                      size="small"
                      disabled={!dexKey}
                      onClick={() => dexKey && copy('State Key', dexKey)}
                      sx={{ border: '1px solid rgba(17,24,39,0.18)', bgcolor: 'rgba(17,24,39,0.04)' }}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Paper>

            </Box>
          </Box>

          <Paper
            variant="outlined"
            sx={{
              p: { xs: 2, sm: 2.5 },
              borderRadius: 3,
              bgcolor: '#ECFEFF',
              borderColor: 'rgba(17,24,39,0.25)',
              mb: 2,
            }}
          >
            <Stack direction="row" spacing={2} alignItems="center" sx={{ flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<PetsIcon />}
                onClick={handleCatch}
                disabled={!walletPubKey || sending}
                sx={{
                  color: '#111827',
                  fontWeight: 900,
                  textTransform: 'none',
                  boxShadow: '0 12px 26px rgba(0,0,0,0.25)',
                }}
              >
                {sending ? 'Catching…' : 'Catch Tuxemon'}
              </Button>
              <Typography variant="body2" sx={{ fontWeight: 700, opacity: 0.9 }}>
                {walletPubKey ? `Caught: ${rows.length}` : 'Connect your wallet to start catching.'}
              </Typography>
              {loading && <Typography variant="body2">Loading…</Typography>}
            </Stack>
          </Paper>

          {error && <Alert severity="error" sx={{ mb: 2 }}>Error: {error}</Alert>}

          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{
              borderRadius: 3,
              borderColor: 'rgba(17,24,39,0.25)',
              overflow: 'auto',
              maxHeight: { xs: 420, sm: 520 },
            }}
          >
            <Table
              stickyHeader
              aria-label="Tuxedex table"
              sx={{ '& tbody tr:nth-of-type(odd)': { bgcolor: 'rgba(17,24,39,0.03)' } }}
            >
              <caption style={{ textAlign: 'left', fontWeight: 800, padding: '12px 16px' }}>
                Your Tuxedex
              </caption>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 90, fontWeight: 900, bgcolor: 'rgba(17,24,39,0.06)' }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 900, bgcolor: 'rgba(17,24,39,0.06)' }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 900, bgcolor: 'rgba(17,24,39,0.06)' }}>Tx</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontWeight: 900 }}>{r.id}</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>{r.name}</TableCell>
                    <TableCell
                      sx={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
                        opacity: 0.9,
                        maxWidth: 340,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={r.tx}
                    >
                      {r.tx}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3}><em>No entries yet. Catch your first Tuxemon!</em></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>

      <Snackbar
        open={!!toast}
        autoHideDuration={1200}
        onClose={() => setToast(null)}
        message={toast || ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}
