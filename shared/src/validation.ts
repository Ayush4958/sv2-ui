import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import bs58check from 'bs58check';
import type { BitcoinNetwork } from './types.js';

// Required by bitcoinjs-lib for validating taproot addresses.
bitcoin.initEccLib(ecc);

// These characters can escape or terminate a generated TOML basic string.
// eslint-disable-next-line no-control-regex
const TOML_UNSAFE_CHARS = /["\\\u0000-\u001F\u007F]/;

export function isValidBitcoinNetwork(value: unknown): value is BitcoinNetwork {
  return value === 'mainnet' || value === 'testnet4';
}

export function isValidBitcoinAddress(value: unknown, network: BitcoinNetwork): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;

  const bitcoinNetwork = network === 'mainnet'
    ? bitcoin.networks.bitcoin
    : bitcoin.networks.testnet;

  try {
    bitcoin.address.toOutputScript(value, bitcoinNetwork);
    return true;
  } catch {
    return false;
  }
}

export function getBitcoinAddressError(value: string, network: BitcoinNetwork): string | null {
  if (!value || isValidBitcoinAddress(value, network)) return null;
  const otherNetwork = network === 'mainnet' ? 'testnet4' : 'mainnet';
  return isValidBitcoinAddress(value, otherNetwork) ? 'Wrong network' : 'Invalid Bitcoin address';
}

export function getBitcoinAddressPlaceholder(network: BitcoinNetwork): string {
  return network === 'mainnet' ? 'bc1q...' : 'tb1q...';
}

export function isTomlSafeOptionalString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return value === '' || (value === value.trim() && !TOML_UNSAFE_CHARS.test(value));
}

export function isTomlSafeIdentifier(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    !TOML_UNSAFE_CHARS.test(value);
}

export function getIdentifierError(value: string): string | null {
  if (!value) return null;
  if (value !== value.trim()) return 'Leading or trailing whitespace is not allowed';
  if (TOML_UNSAFE_CHARS.test(value)) {
    return 'Contains characters that are not allowed (quotes, backslashes, control characters)';
  }
  return null;
}

// Pubkeys in pool docs / Discord are almost always shown wrapped in quotes,
// and users copy them with the quotes. Strip one matched pair, then trim.
export function stripWrappingQuotes(v: string): string {
  const trimmed = v.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

// The SRI Noise-protocol authority key is base58check-encoded, so a corrupted
// character or missing byte fails the checksum — which is exactly what
// copy-paste mistakes produce.
//
// The value must already be canonical: no wrapping quotes (single or double)
// and no surrounding whitespace. Stripping here would let a quoted key sail
// through validation and land in the generated TOML as `authority_pubkey =
// "'...'"`, which Translator/JDC then receive as an invalid key. Callers are
// expected to normalize (e.g. via stripWrappingQuotes) before persisting.
export function isValidPoolAuthorityPubkey(v: string): boolean {
  if (typeof v !== 'string' || !v) return false;
  if (stripWrappingQuotes(v) !== v) return false;
  try {
    const decoded = bs58check.decode(v);
    return decoded.length === 34;
  } catch {
    return false;
  }
}
