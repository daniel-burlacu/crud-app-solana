// src/components/crudapp/crudapp-data-access.tsx
import {
  getCrudappProgramId,
} from '@project/anchor'
import { useMemo } from 'react'
import { useWalletUi } from '@wallet-ui/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useClusterVersion } from '@/components/cluster/use-cluster-version'
import { useWalletUiSigner } from '@/components/solana/use-wallet-ui-signer'
import { useWalletTransactionSignAndSend } from '@/components/solana/use-wallet-transaction-sign-and-send'
import { toast } from 'sonner'
import { toastTx } from '@/components/toast-tx'
import { install as installEd25519 } from '@solana/webcrypto-ed25519-polyfill'
import { buildCreateJournalEntryIx, buildUpdateJournalEntryIx, buildDeleteJournalEntryIx } from './journal-instructions'
import { address } from '@solana/kit'

const crudappAccountsKey = (clusterId: string) =>
  ['crudapp', 'accounts', clusterId] as const

/** Program account existence/health check */
export function useCrudappProgram() {
  const { client, cluster } = useWalletUi()
  const programId = useCrudappProgramId()
  const query = useClusterVersion()

  return useQuery({
    retry: false,
    queryKey: [
      'get-program-account',
      { clusterId: cluster.id, programId: programId.toString(), clusterVersion: query.data },
    ],
    queryFn: () => client.rpc.getAccountInfo(programId).send(),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
    refetchOnWindowFocus: false,
  })
}

// Some versions of browsers need this for ed25519 keygen
installEd25519()

export function useCrudappProgramId() {
  const { cluster } = useWalletUi()
  return useMemo(() => getCrudappProgramId(cluster.id), [cluster])
}

export function useCrudappAccountsQuery() {
  const { client, cluster } = useWalletUi()
  const programId = useCrudappProgramId()

  return useQuery({
    queryKey: crudappAccountsKey(cluster.id),
    queryFn: async () => {
      const accounts = await client.rpc
        .getProgramAccounts(programId, { encoding: 'base64', commitment: 'finalized' }) // 👈
        .send()
      return accounts.map((a: any) => ({
        address: a.pubkey?.toString?.() ?? a.pubkey ?? a.address ?? '',
        data: decodeJournalAccount(a.account?.data, a.pubkey?.toString?.()),
      }))
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
    refetchOnWindowFocus: false,
  })
}

function useInvalidateCrudappAccounts() {
  const { cluster } = useWalletUi()
  const qc = useQueryClient()
  return async () => {
    await qc.invalidateQueries({ queryKey: crudappAccountsKey(cluster.id), exact: false })
  }
}

async function waitForFinalized(client: any, signature: string, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await client.rpc.getSignatureStatuses([signature]).send()
    const st = res?.value?.[0]
    if (st?.confirmationStatus === 'finalized') return
    await new Promise(r => setTimeout(r, 350))
  }
}

async function waitUntilAccountClosed(client: any, pubkey: string, programId: string, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const info = await client.rpc.getAccountInfo(pubkey, { commitment: 'finalized' }).send()
    // closed or reassigned
    const owner = info?.owner?.toString?.() ?? info?.owner
    const lamports = info?.lamports ?? 0
    if (!info || owner !== programId || lamports === 0) return
    await new Promise(r => setTimeout(r, 350))
  }
}
export function useCreateJournalMutation() {
  const { client } = useWalletUi()
  const owner = useWalletUiSigner()
  const programId = useCrudappProgramId()
  const signAndSend = useWalletTransactionSignAndSend()
  const invalidate = useInvalidateCrudappAccounts()

  return useMutation({
    mutationFn: async ({ title, message }: { title: string; message: string }) => {
      const ix = buildCreateJournalEntryIx({
        programId: programId.toString(), ownerSigner: owner, title, message
      })
      const sanitizedIx = { ...ix, accounts: ix.accounts.filter(Boolean) }
      const sig = await signAndSend(sanitizedIx as any, owner)
      return typeof sig === 'string' ? sig : String(sig)
    },
    // ❌ no onMutate
    onSuccess: async (sig) => {
      toastTx(sig)
      await waitForFinalized(client, sig)     // wait so refetch includes new PDA
      await invalidate()
    },
    onError: (err) => {
      toast.error('Failed to create: ' + (err?.message ?? err)
  )}
  })
}
/** Update: modify message */
export function useUpdateJournalMessageMutation() {
  const { client, cluster } = useWalletUi()
  const owner = useWalletUiSigner()
  const signAndSend = useWalletTransactionSignAndSend()
  const invalidate = useInvalidateCrudappAccounts()
  const programId = useCrudappProgramId()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ crudappPubkey, title, message }: {
      crudappPubkey: string; title: string; message: string
    }) => {
      const ix = buildUpdateJournalEntryIx({
        programId: programId.toString(),
        ownerSigner: owner,
        title,
        message,
        journalPubkey: address(crudappPubkey), // ensure accounts[0] == row PDA
      } as any)

      const sanitizedIx = { ...ix, accounts: ix.accounts.filter(Boolean) }
      const sig = await signAndSend(sanitizedIx as any, owner)
      return typeof sig === 'string' ? sig : String(sig)
    },
    onMutate: async ({ crudappPubkey, message }) => {
      await qc.cancelQueries({ queryKey: crudappAccountsKey(cluster.id) })
      const prev = qc.getQueryData<any[]>(crudappAccountsKey(cluster.id))
      qc.setQueryData<any[]>(crudappAccountsKey(cluster.id), (old = []) =>
        old.map(r => r.address === crudappPubkey ? { ...r, data: { ...r.data, message } } : r)
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(crudappAccountsKey(cluster.id), ctx.prev) // rollback
    },

    // Wait until finalized, then refetch from chain
    onSuccess: async (sig) => {
      toastTx(sig)
      await waitForFinalized(client, sig)
      await invalidate()
    },
  })
}

/** Delete: close PDA */
export function useDeleteJournalMutation() {
  const { client, cluster } = useWalletUi()
  const owner = useWalletUiSigner()
  const signAndSend = useWalletTransactionSignAndSend()
  const invalidate = useInvalidateCrudappAccounts()
  const programId = useCrudappProgramId()
  const qc = useQueryClient()

  return useMutation({
    // run after user clicks Delete; wallet prompt will open here
    mutationFn: async ({ crudappPubkey, title }: { crudappPubkey: string; title: string }) => {
      const ix = buildDeleteJournalEntryIx({
        programId: programId.toString(),
        ownerSigner: owner,
        title,
        journalPubkey: address(crudappPubkey),
      } as any)
      const sanitizedIx = { ...ix, accounts: ix.accounts.filter(Boolean) }
      const sig = await signAndSend(sanitizedIx as any, owner) // awaits user signature
      return typeof sig === 'string' ? sig : String(sig)
    },

    // ❌ no onMutate removal — keep row until user signs

    onError: () => {
      // user rejected or tx failed; nothing to roll back since we didn’t remove yet
      toast.error('Failed to delete')
    },

    onSuccess: async (sig, { crudappPubkey }) => {
      toastTx(sig)

      // ✅ remove from UI now that we have a signature (user signed)
      qc.setQueryData<any[]>(['crudapp','accounts', cluster.id], (old = []) =>
        (old ?? []).filter((row) => row.address !== crudappPubkey)
      )

      // (optional) wait for finalization, then refresh from chain
      await waitForFinalized(client, sig)
      await waitUntilAccountClosed(client, crudappPubkey, programId.toString())
      await invalidate()
    },
  })
}


function readU32LE(view: DataView, offset: number) {
  return view.getUint32(offset, true)
}

function b64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64) // browser built-in
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function decodeJournalAccountRaw(bytes: Uint8Array): { title?: string; message?: string } {
  // Expect: [8-byte anchor discriminator][u32 title_len][title][u32 msg_len][msg]
  // Your hexdump matches this layout.
  if (!bytes || bytes.length < 12) return {}
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  let o = 0
  o += 8 // skip discriminator

  if (o + 4 > bytes.length) return {}
  const titleLen = readU32LE(view, o); o += 4
  if (titleLen > 10_000 || o + titleLen > bytes.length) {
    // guard against wrong offset/encoding
    return {}
  }
  const title = new TextDecoder().decode(bytes.subarray(o, o + titleLen)); o += titleLen

  if (o + 4 > bytes.length) return { title }
  const msgLen = readU32LE(view, o); o += 4
  if (msgLen > 1_000_000 || o + msgLen > bytes.length) {
    return { title }
  }
  const message = new TextDecoder().decode(bytes.subarray(o, o + msgLen))

  return { title, message }
}

function normalizeAccountDataShape(data: any): Uint8Array {
  // Most common shape from getProgramAccounts({ encoding: 'base64' }):
  // { account: { data: [base64String, 'base64'], ... } }
  if (data?.data && Array.isArray(data.data) && typeof data.data[0] === 'string') {
    return b64ToUint8Array(data.data[0])
  }
  // Some wrappers stick it at a.data or account.data directly:
  if (Array.isArray(data) && typeof data[0] === 'string') {
    return b64ToUint8Array(data[0])
  }
  if (typeof data === 'string') return b64ToUint8Array(data)
  if (data instanceof Uint8Array) return data
  if (Array.isArray(data)) return new Uint8Array(data)
  return new Uint8Array()
}

function decodeJournalAccount(dataField: any, addr?: string) {
  const bytes = normalizeAccountDataShape(dataField)
  const dec = decodeJournalAccountRaw(bytes)
  if (!dec.title && !dec.message) {
    console.warn('[crudapp][decode] failed to decode account', addr, 'len=', bytes.length)
  }
  return dec
}

