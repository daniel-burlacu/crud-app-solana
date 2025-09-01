// src/components/crudapp/crudapp-ui.tsx
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ExplorerLink, ClusterChecker } from '@/components/cluster/cluster-ui'

import {
  useCrudappAccountsQuery,
  useCreateJournalMutation,
  useUpdateJournalMessageMutation,
  useDeleteJournalMutation,
} from '@/components/crudapp/crudapp-data-access'

export default function JournalPage() {
  return (
    <ClusterChecker>
      <JournalInner />
    </ClusterChecker>
  )
}

function JournalInner() {
  const { data, isLoading, isError, refetch } = useCrudappAccountsQuery()
  const createMut = useCreateJournalMutation()
  const updateMut = useUpdateJournalMessageMutation()
  const deleteMut = useDeleteJournalMutation()

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')

  if (isLoading) return <div className="p-4">Loading journals…</div>
  if (isError)
    return (
      <div className="p-4">
        Failed to load journals.{' '}
        <Button variant="outline" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    )

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6 bg-gradient-to-br from-pink-200 via-pink-100 to-blue-100 rounded-lg shadow-md">
      <h1 className="text-2xl font-bold">Journal</h1>

      {/* Create */}
      <Card className="p-4 space-y-3 bg-pink-200 shadow-inner">
        <h2 className="font-semibold">New entry</h2>
        <input
          className="w-full border rounded px-3 py-2 text-sm bg-white"  // 👈 stays white
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={createMut.isPending}
        />
        <textarea
          className="w-full border rounded px-3 py-2 text-sm bg-white" // 👈 stays white
          placeholder="Write your thoughts…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          disabled={createMut.isPending}
        />
        <div className="flex items-center gap-2">
          <Button
            disabled={!title || !message || createMut.isPending}
            onClick={async () => {
              await createMut.mutateAsync({ title, message })
              setTitle('')
              setMessage('')
            }}
          >
            {createMut.isPending ? 'Creating…' : 'Create'}
          </Button>
          {createMut.data ? (
            <ExplorerLink label="View tx" address={createMut.data!} />
          ) : null}
        </div>
      </Card>

      {/* List */}
      <div className="space-y-3">
        {(data ?? []).length === 0 ? (
          <div className="text-muted-foreground">No entries yet.</div>
        ) : (
          data!.map((acc: any) => (
            <JournalRow
              key={acc.pubkey ?? acc.address}
              pubkey={(acc.pubkey ?? acc.address) as string}
              title={(acc.account?.title ?? acc.data?.title ?? '(untitled)') as string}
              message={(acc.account?.message ?? acc.data?.message ?? '') as string}
              onUpdate={async (newMsg) => {
                await updateMut.mutateAsync({
                  crudappPubkey: (acc.pubkey ?? acc.address) as string,
                  title: (acc.account?.title ?? acc.data?.title ?? '') as string,
                  message: newMsg,
                })
              }}
              onDelete={async () => {
                await deleteMut.mutateAsync({
                  crudappPubkey: (acc.pubkey ?? acc.address) as string,
                  title: (acc.account?.title ?? acc.data?.title ?? '') as string,
                })
              }}
              lastTxSig={updateMut.data ?? deleteMut.data}
            />
          ))
        )}
      </div>
    </div>
  )
}

function JournalRow({
  pubkey,
  title,
  message,
  onUpdate,
  onDelete,
  lastTxSig,
  deletePending,
}: {
  pubkey: string
  title: string
  message: string
  onUpdate: (newMessage: string) => Promise<void>
  onDelete: () => Promise<void>
  lastTxSig?: string | null
  deletePending?: boolean
}) {
  const [edit, setEdit] = useState(false)
  const [draft, setDraft] = useState(message)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!edit) setDraft(message)
  }, [message, edit])

  const canSave = edit && !saving && draft.trim() !== '' && draft !== message

  return (
    <Card className="p-4 space-y-2 bg-gradient-to-r from-blue-100 via-pink-100 to-blue-200 shadow">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{title}</div>
          <div className="text-xs text-muted-foreground truncate">{pubkey}</div>
        </div>
        {lastTxSig ? <ExplorerLink label="Last tx" address={lastTxSig} /> : null}
      </div>

      {edit ? (
        <div className="space-y-2">
          <textarea
            className="w-full border rounded px-3 py-2 text-sm bg-white disabled:opacity-60 disabled:cursor-not-allowed" // 👈 stays white
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            disabled={saving}
            aria-busy={saving}
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={!canSave}
              onClick={async () => {
                try {
                  setSaving(true)
                  await onUpdate(draft)
                  setEdit(false)
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                if (saving) return
                setDraft(message)
                setEdit(false)
              }}
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="whitespace-pre-wrap text-sm">{message}</div>
      )}

      {!edit && (
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={() => setEdit(true)}>
            Edit message
          </Button>
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={deletePending}
          >
            {deletePending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      )}
    </Card>
  )
}
