// src/components/crudapp/journal-instructions.ts
import { PublicKey, SystemProgram } from '@solana/web3.js'
import {
  type Address,
  type TransactionSigner,
} from 'gill'

// Reuse the same helper used by the generated files
import { getAccountMetaFactory, type ResolvedAccount } from '../../../anchor/src/client/js/generated/shared';


// ---- BORSH helpers ----
function leU32(n: number) {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n, true)
  return b
}
function borshString(str: string) {
  const bytes = new TextEncoder().encode(str)
  const out = new Uint8Array(4 + bytes.length)
  out.set(leU32(bytes.length), 0)
  out.set(bytes, 4)
  return out
}
function concatBytes(...parts: Uint8Array[]) {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

// ---- Discriminators from your IDL ----
const DISC_CREATE = new Uint8Array([48, 65, 201, 186, 25, 41, 127, 0])
const DISC_UPDATE = new Uint8Array([113, 164, 49, 62, 43, 83, 194, 172])
const DISC_DELETE = new Uint8Array([156, 50, 93, 5, 157, 97, 188, 114])

function deriveJournalPda(programId: string, owner: string, title: string) {
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(title), new PublicKey(owner).toBuffer()],
    new PublicKey(programId)
  )
  return pda.toBase58()
}

function buildCommon(
  programId: string,
  ownerSigner: TransactionSigner<string>,
  title: string,
  overrideJournalPubkey?: Address<string>
) {
  const journalPda = overrideJournalPubkey
    ?? deriveJournalPda(programId, ownerSigner.address, title)

  const originalAccounts = {
    journalEntryState: { value: journalPda as Address<string>, isWritable: true },
    owner: { value: ownerSigner, isWritable: true }, // signer object
    systemProgram: {
      value: SystemProgram.programId.toBase58() as Address<'11111111111111111111111111111111'>,
      isWritable: false,
    },
  }

  const accounts = originalAccounts as Record<keyof typeof originalAccounts, ResolvedAccount>
  const getAccountMeta = getAccountMetaFactory(programId as Address<string>, 'programId')
  const metas = [
    getAccountMeta(accounts.journalEntryState),
    getAccountMeta(accounts.owner),
    getAccountMeta(accounts.systemProgram),
  ]

  return { programAddress: programId as Address<string>, accounts: metas }
}

export function buildCreateJournalEntryIx(args: {
  programId: string
  ownerSigner: TransactionSigner<string>
  title: string
  message: string
}) {
  const { programId, ownerSigner, title, message } = args
  const common = buildCommon(programId, ownerSigner, title)
  const data = concatBytes(DISC_CREATE, borshString(title), borshString(message))
  return { ...common, data }
}

export function buildUpdateJournalEntryIx(args: {
  programId: string
  ownerSigner: TransactionSigner<string>
  title: string
  message: string
  journalPubkey?: Address<string>      // <-- allow override
}) {
  const { programId, ownerSigner, title, message, journalPubkey } = args
  const common = buildCommon(programId, ownerSigner, title, journalPubkey)
  const data = concatBytes(DISC_UPDATE, borshString(title), borshString(message))
  return { ...common, data }
}

export function buildDeleteJournalEntryIx(args: {
  programId: string
  ownerSigner: TransactionSigner<string>
  title: string
  journalPubkey?: Address<string>   // <-- allow overriding the PDA
}) {
  const { programId, ownerSigner, title, journalPubkey } = args
  const common = buildCommon(programId, ownerSigner, title, journalPubkey)
  const data = concatBytes(DISC_DELETE, borshString(title))  // your program expects title in data
  return { ...common, data }
}