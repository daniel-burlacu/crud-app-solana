import { useCrudappProgram } from './crudapp-data-access'
import { useCrudappProgramId } from './crudapp-data-access'
import { ExplorerLink } from '../cluster/cluster-ui'
import { ellipsify } from '@wallet-ui/react'
import { ReactNode } from 'react'
import JournalPage from './crudapp-ui'
import { WalletButton } from '../solana/solana-provider'
import { AppHero } from '../app-hero'
import { useWalletUi } from '@wallet-ui/react'
import { motion } from 'framer-motion'

// Explorer link to the program
export function CrudappProgramExplorerLink() {
  const programId = useCrudappProgramId()
  return (
    <ExplorerLink address={programId.toString()} label={ellipsify(programId.toString())} />
  )
}

// Guard that ensures program account exists
export function CrudappProgramGuard({ children }: { children: ReactNode }) {
  const programAccountQuery = useCrudappProgram()
  if (programAccountQuery.isLoading) {
    return <span className="loading loading-spinner loading-lg" />
  }
  if (!programAccountQuery.data?.value) {
    return (
      <div className="alert alert-info flex justify-center">
        <span>
          Program account not found. Make sure you have deployed the program and are on
          the correct cluster.
        </span>
      </div>
    )
  }
  return children
}

export default function CrudappFeature() {
  const { account } = useWalletUi()

  return (
    <CrudappProgramGuard>
      <AppHero
       title={
          <motion.h1
            className="text-3xl md:text-4xl font-extrabold tracking-tight"
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 12 }}
          >
            ✏️ My Sparkly Journal
          </motion.h1>
        }
        subtitle={account ? 'Create, update, and delete on-chain journal entries.' : 'Select a wallet to use the journal.'}
      >
        <p className="mb-6">
          <CrudappProgramExplorerLink />
        </p>
        {account ? null : (
          <div style={{ display: 'inline-block' }}>
            <WalletButton />
          </div>
        )}
      </AppHero>

      {account ? <JournalPage /> : null}
    </CrudappProgramGuard>
  )
}
