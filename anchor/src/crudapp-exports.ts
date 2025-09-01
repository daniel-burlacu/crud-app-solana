// Here we export some useful types and functions for interacting with the Anchor program.
import { Account, address, getBase58Decoder, SolanaClient, type Address } from 'gill'
import { SolanaClusterId } from '@wallet-ui/react'
import { getProgramAccountsDecoded } from './helpers/get-program-accounts-decoded'
import { Crudapp, CRUDAPP_DISCRIMINATOR, CRUDAPP_PROGRAM_ADDRESS, getCrudappDecoder } from './client/js'
import CrudappIDL from '../target/idl/crudapp.json'

export type CrudappAccount = Account<Crudapp, string>

// Re-export the generated IDL and type
export { CrudappIDL }

// This is a helper function to get the program ID for the Crudapp program depending on the cluster.
export function getCrudappProgramId(cluster: SolanaClusterId) {
  switch (cluster) {
    case 'solana:devnet':
    case 'solana:testnet':
    case 'solana:localnet':
      // This is the program ID for the Crudapp program on devnet and testnet.
      return address('8bgEPmmRk3N7Wtz1srGiz7BQ6ojG4cVhGHndnASiUQGQ')
    case 'solana:mainnet':
    default:
      return CRUDAPP_PROGRAM_ADDRESS
  }
}

export * from './client/js'

export function getCrudappProgramAccounts(
  programId: Address,                         // <— use Address
  rpc: SolanaClient['rpc']
) {
  return getProgramAccountsDecoded(rpc, {
    decoder: getCrudappDecoder(),
    filter: getBase58Decoder().decode(CRUDAPP_DISCRIMINATOR),
    programAddress: programId,                // <— use the argument, not the constant
  })
}
