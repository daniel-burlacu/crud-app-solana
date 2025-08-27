'use client';

import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { useWalletUi } from '@wallet-ui/react';
import { useWalletUiSigner } from '@/components/solana/use-wallet-ui-signer';
import { useWalletTransactionSignAndSend } from '@/components/solana/use-wallet-transaction-sign-and-send';
import { toastTx } from '@/components/toast-tx';

import {
  address,
  type Address,
  getProgramDerivedAddress,
} from '@solana/addresses';
import { type IInstruction, AccountRole } from '@solana/kit';

// If your lib returns the program id based on cluster, keep it:
import { getCrudappProgramId } from '@project/anchor';// should return base58 string or Address

import { getAddressEncoder } from '@solana/kit'
// ---------------------------------------------
// Constants & helpers
// ---------------------------------------------

const SYSTEM_PROGRAM_ADDRESS = address('11111111111111111111111111111111');

const text = new TextEncoder();
const addressEncoder = getAddressEncoder();

const enc = new TextEncoder();

// Anchor-style sighash: first 8 bytes of sha256("global:<name>")
async function anchorSighash(name: string): Promise<Uint8Array> {
  const preimage = enc.encode(`global:${name}`);
  const hash = await crypto.subtle.digest('SHA-256', preimage);
  return new Uint8Array(hash).slice(0, 8);
}

// borsh string: u32 LE length + UTF8 bytes
function encodeBorshString(s: string): Uint8Array {
  const bytes = enc.encode(s);
  const out = new Uint8Array(4 + bytes.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, bytes.length, true);
  out.set(bytes, 4);
  return out;
}

function concatBytes(...parts: Uint8Array[]) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

// PDA using seeds = [title.as_bytes(), owner]

async function deriveJournalPda(programAddress: Address, title: string, owner: Address) {
  const titleSeed = text.encode(title);
  if (titleSeed.length > 32) {
    throw new Error('Title too long for PDA seed (max 32 bytes).');
  }
  const ownerSeed = addressEncoder.encode(owner); // <-- fix here

  const [pda] = await getProgramDerivedAddress({
    programAddress,
    seeds: [titleSeed, ownerSeed], // seeds are ReadonlyUint8Array[]
  });
  return pda;
}

// ---------------------------------------------
// Instruction builders (Kit)
// ---------------------------------------------

async function ixCreateJournalEntry(params: {
  programAddress: Address;
  owner: Address;
  title: string;
  message: string;
}): Promise<IInstruction> {
  const { programAddress, owner, title, message } = params;
  const sighash = await anchorSighash('create_journal_entry');
  const data = concatBytes(sighash, encodeBorshString(title), encodeBorshString(message));
  const journalPda = await deriveJournalPda(programAddress, title, owner);

  return {
    programAddress,
    accounts: [
      { address: journalPda, role: AccountRole.WRITABLE },
      { address: owner,      role: AccountRole.WRITABLE_SIGNER },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
    data,
  };
}

async function ixUpdateJournalEntry(params: {
  programAddress: Address;
  owner: Address;
  title: string;
  message: string;
}): Promise<IInstruction> {
  const { programAddress, owner, title, message } = params;
  const sighash = await anchorSighash('update_journal_entry');
  const data = concatBytes(sighash, encodeBorshString(title), encodeBorshString(message));
  const journalPda = await deriveJournalPda(programAddress, title, owner);

  return {
    programAddress,
    accounts: [
      { address: journalPda, role: AccountRole.WRITABLE },
      { address: owner,      role: AccountRole.WRITABLE_SIGNER },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
    data,
  };
}

async function ixDeleteJournalEntry(params: {
  programAddress: Address;
  owner: Address;
  title: string;
}): Promise<IInstruction> {
  const { programAddress, owner, title } = params;
  const sighash = await anchorSighash('delete_journal_entry');
  const data = concatBytes(sighash, encodeBorshString(title));
  const journalPda = await deriveJournalPda(programAddress, title, owner);

  return {
    programAddress,
    accounts: [
      { address: journalPda, role: AccountRole.WRITABLE },
      { address: owner,      role: AccountRole.WRITABLE_SIGNER },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
    data,
  };
}

// ---------------------------------------------
// Hooks (Kit-native)
// ---------------------------------------------

export interface CreateEntryArgs {
  title: string;
  message: string;
  owner: Address; // Address (not PublicKey)
}

export function useJournalProgramAddress() {
  const { cluster } = useWalletUi();
  return useMemo<Address>(() => {
    const pid = getCrudappProgramId(cluster.id); // string or Address
    return typeof pid === 'string' ? address(pid) : pid;
  }, [cluster.id]);
}

// (Optional) Program account info (not the list of JournalEntry accounts)
export function useGetProgramAccount() {
  const { client, cluster } = useWalletUi();
  const programAddress = useJournalProgramAddress();

  return useQuery({
    queryKey: ['get-program-account', { cluster: cluster.id }],
    queryFn: () => client.rpc.getAccountInfo(programAddress).send(),
  });
}

export function useCreateEntry() {
  const { cluster, wallet } = useWalletUi();
  const programAddress = useJournalProgramAddress();
  const txSigner = useWalletUiSigner();
  const signAndSend = useWalletTransactionSignAndSend();

  return useMutation<string, Error, CreateEntryArgs>({
    mutationKey: ['journalEntry', 'create', { cluster: cluster.id }],
    mutationFn: async ({ title, message, owner }) => {
      if (!wallet?.accounts) throw new Error('Connect wallet first');
      const ix = await ixCreateJournalEntry({ programAddress, owner, title, message });
      const sig = await signAndSend(ix, txSigner); // or [ix] if your helper expects an array
      return sig;
    },
    onSuccess: (signature) => toastTx(signature),
    onError: (error) => toast.error(`Failed to create journal entry: ${error.message}`),
  });
}

export function useUpdateEntry() {
  const { cluster, wallet } = useWalletUi();
  const programAddress = useJournalProgramAddress();
  const txSigner = useWalletUiSigner();
  const signAndSend = useWalletTransactionSignAndSend();

  return useMutation<string, Error, CreateEntryArgs>({
    mutationKey: ['journalEntry', 'update', { cluster: cluster.id }],
    mutationFn: async ({ title, message, owner }) => {
      if (!wallet?.accounts) throw new Error('Connect wallet first');
      const ix = await ixUpdateJournalEntry({ programAddress, owner, title, message });
      const sig = await signAndSend(ix, txSigner);
      return sig;
    },
    onSuccess: (signature) => toastTx(signature),
    onError: (error) => toast.error(`Failed to update journal entry: ${error.message}`),
  });
}

export function useDeleteEntry() {
  const { cluster, wallet } = useWalletUi();
  const programAddress = useJournalProgramAddress();
  const txSigner = useWalletUiSigner();
  const signAndSend = useWalletTransactionSignAndSend();

  return useMutation<string, Error, string>({
    mutationKey: ['journalEntry', 'delete', { cluster: cluster.id }],
    mutationFn: async (title: string) => {
      if (!wallet?.accounts) throw new Error('Connect wallet first');
      const owner = address(wallet.accounts[0].address);
      const ix = await ixDeleteJournalEntry({ programAddress, owner, title });
      const sig = await signAndSend(ix, txSigner);
      return sig;
    },
    onSuccess: (signature) => toastTx(signature),
    onError: (error) => toast.error(`Failed to delete journal entry: ${error.message}`),
  });
}
