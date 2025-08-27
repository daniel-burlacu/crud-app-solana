import { TOKEN_2022_PROGRAM_ADDRESS, TOKEN_PROGRAM_ADDRESS } from 'gill/programs/token'
import { getTransferSolInstruction } from 'gill/programs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useWalletUi } from '@wallet-ui/react'
import {
  type Address,
  airdropFactory,
  createTransaction,
  getBase58Decoder,
  lamports,
  signAndSendTransactionMessageWithSigners,
  type SolanaClient,
} from 'gill'
import { toast } from 'sonner'
import { toastTx } from '@/components/toast-tx'
import { useWalletUiSigner } from '@/components/solana/use-wallet-ui-signer'

function useGetBalanceQueryKey({ address }: { address: Address }) {
  const { cluster } = useWalletUi()

  return ['get-balance', { cluster, address }]
}

function useInvalidateGetBalanceQuery({ address }: { address: Address }) {
  const queryClient = useQueryClient()
  const queryKey = useGetBalanceQueryKey({ address })
  return async () => {
    await queryClient.invalidateQueries({ queryKey })
  }
}

export function useGetBalanceQuery({ address }: { address: Address }) {
  const { client } = useWalletUi()

  return useQuery({
    retry: false,
    queryKey: useGetBalanceQueryKey({ address }),
    queryFn: () => client.rpc.getBalance(address).send(),
  })
}

function useGetSignaturesQueryKey({ address }: { address: Address }) {
  const { cluster } = useWalletUi()

  return ['get-signatures', { cluster, address }]
}

function useInvalidateGetSignaturesQuery({ address }: { address: Address }) {
  const queryClient = useQueryClient()
  const queryKey = useGetSignaturesQueryKey({ address })
  return async () => {
    await queryClient.invalidateQueries({ queryKey })
  }
}

export function useGetSignaturesQuery({ address }: { address: Address }) {
  const { client } = useWalletUi()

  return useQuery({
    queryKey: useGetSignaturesQueryKey({ address }),
    queryFn: () => client.rpc.getSignaturesForAddress(address).send(),
  })
}

async function getTokenAccountsByOwner(
  rpc: SolanaClient['rpc'],
  { address, programId }: { address: Address; programId: Address },
) {
  return await rpc
    .getTokenAccountsByOwner(address, { programId }, { commitment: 'confirmed', encoding: 'jsonParsed' })
    .send()
    .then((res) => res.value ?? [])
}

export function useGetTokenAccountsQuery({ address }: { address: Address }) {
  const { client, cluster } = useWalletUi()

  return useQuery({
    queryKey: ['get-token-accounts', { cluster, address }],
    queryFn: async () =>
      Promise.all([
        getTokenAccountsByOwner(client.rpc, { address, programId: TOKEN_PROGRAM_ADDRESS }),
        getTokenAccountsByOwner(client.rpc, { address, programId: TOKEN_2022_PROGRAM_ADDRESS }),
      ]).then(([tokenAccounts, token2022Accounts]) => [...tokenAccounts, ...token2022Accounts]),
  })
}

export function useTransferSolMutation({ address }: { address: Address }) {
  const { client } = useWalletUi()
  const signer = useWalletUiSigner()
  const invalidateBalanceQuery = useInvalidateGetBalanceQuery({ address })
  const invalidateSignaturesQuery = useInvalidateGetSignaturesQuery({ address })

  return useMutation({
    mutationFn: async (input: { destination: Address; amount: number }) => {
      try {
        const { value: latestBlockhash } = await client.rpc.getLatestBlockhash({ commitment: 'confirmed' }).send()

        const transaction = createTransaction({
          feePayer: signer,
          version: 0,
          latestBlockhash,
          instructions: [
            getTransferSolInstruction({
              amount: input.amount,
              destination: input.destination,
              source: signer,
            }),
          ],
        })

        const signatureBytes = await signAndSendTransactionMessageWithSigners(transaction)
        const signature = getBase58Decoder().decode(signatureBytes)

        console.log(signature)
        return signature
      } catch (error: unknown) {
        console.log('error', `Transaction failed! ${error}`)

        return
      }
    },
    onSuccess: async (tx) => {
      toastTx(tx)
      await Promise.all([invalidateBalanceQuery(), invalidateSignaturesQuery()])
    },
    onError: (error) => {
      toast.error(`Transaction failed! ${error}`)
    },
  })
}

export function useRequestAirdropMutation({ address }: { address: Address }) {
  const { client } = useWalletUi()
  const invalidateBalanceQuery = useInvalidateGetBalanceQuery({ address })
  const invalidateSignaturesQuery = useInvalidateGetSignaturesQuery({ address })
  const airdrop = airdropFactory(client)

  return useMutation({
    mutationFn: async (amount: number = 1) =>
      airdrop({
        commitment: 'confirmed',
        recipientAddress: address,
        lamports: lamports(BigInt(Math.round(amount * 1_000_000_000))),
      }),
    onSuccess: async (tx) => {
      toastTx(tx)
      await Promise.all([invalidateBalanceQuery(), invalidateSignaturesQuery()])
    },
  })
}

// 'use client';

// import { useMemo } from 'react';
// import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// import { toast } from 'sonner';
// import { useWalletUi } from '@wallet-ui/react';
// import { useWalletUiSigner } from '@/components/solana/use-wallet-ui-signer';
// import { useWalletTransactionSignAndSend } from '@/components/solana/use-wallet-transaction-sign-and-send';
// import { toastTx } from '@/components/toast-tx';

// import {
//   address,
//   isAddress,
//   assertIsAddress,
//   IInstruction,
//   AccountRole,
//   type Address,
//   Signature,
//   lamports as toLamports,
// } from '@solana/kit';
// // ---------------------------------------------
// // Constants
// // ---------------------------------------------

// // 1 SOL = 1_000_000_000 lamports
// const LAMPORTS_PER_SOL = 1_000_000_000n;

// // Token program addresses as base58 strings (no web3.js import needed)
// const TOKEN_PROGRAM_ID_ADDR = address(
//   'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
// );
// const TOKEN_2022_PROGRAM_ID_ADDR = address(
//   'TokenzQdBNbLqP5VEhKNDy7kGKuX3sZ6tq86nrafTeSL',
// );

// // System program address (for SOL transfers)
// const SYSTEM_PROGRAM_ADDR = address('11111111111111111111111111111111');

// // ---------------------------------------------
// // Small helpers
// // ---------------------------------------------

// /** Safely brand an unknown/base58 string as Address (throws if invalid). */
// export function asAddress(x: string): Address {
//   assertIsAddress(x);
//   return x as Address;
// }

// /** Convert SOL (number) → lamports (bigint) */
// function solToLamports(sol: number): bigint {
//   // Avoid floating errors: round to nano-SOL then to bigint
//   return BigInt(Math.round(sol * 1e9));
// }

// function makeSystemTransferInstruction(params: {
//   from: Address;
//   to: Address;
//   lamports: bigint;
// }): IInstruction {
//   const { from, to, lamports } = params;

//   // data = u32 (2 = transfer) + u64(lamports), both little-endian
//   const data = new Uint8Array(12);
//   const view = new DataView(data.buffer);
//   view.setUint32(0, 2, true);
//   view.setBigUint64(4, lamports, true);

//   return {
//     programAddress: SYSTEM_PROGRAM_ADDR,
//     accounts: [
//       { address: from, role: AccountRole.WRITABLE_SIGNER },
//       { address: to,   role: AccountRole.WRITABLE },
//     ],
//     data,
//   };
// }

// /** Polls for signature confirmation (simple util, avoids web3.js confirmTransaction). */
// async function waitForConfirmation(
//   clientRpc: ReturnType<typeof useWalletUi>['client']['rpc'],
//   signature: Signature | string,
//   commitment: 'processed' | 'confirmed' | 'finalized' = 'confirmed',
//   timeoutMs = 20_000,
// ): Promise<void> {
//   const sig = signature as Signature;
//   const start = Date.now();
//   while (true) {
//     const { value } = await clientRpc
//       .getSignatureStatuses([sig])
//       .send();
//     const status = value?.[0];
//     if (status?.confirmationStatus) {
//       // Map RPC status to our requested commitment
//       const ok =
//         (commitment === 'processed' && !!status.confirmationStatus) ||
//         (commitment === 'confirmed' &&
//           (status.confirmationStatus === 'confirmed' ||
//             status.confirmationStatus === 'finalized')) ||
//         (commitment === 'finalized' &&
//           status.confirmationStatus === 'finalized');
//       if (ok) return;
//     }
//     if (Date.now() - start > timeoutMs) {
//       throw new Error('Confirmation timeout');
//     }
//     await new Promise((r) => setTimeout(r, 500));
//   }
// }

// /**
//  * Build a **System Program: Transfer** instruction in Kit form.
//  * This avoids importing web3.js's SystemProgram.
//  *
//  * Layout (legacy): u32 instruction index (2) + u64 lamports (LE)
//  */

// // ---------------------------------------------
// // Hooks
// // ---------------------------------------------

// /** Get the current wallet address as Address (or null if disconnected). */
// export function useWalletAddress(): Address | null {
//   const { wallet } = useWalletUi();
//   return useMemo(() => {
//     const pk = wallet?.accounts?.[0]?.address ?? null; // take the first account's base58 address
//     if (!pk) return null;
//     return isAddress(pk) ? (pk as Address) : address(pk);
//   }, [wallet?.accounts]);
// }

// export function useGetBalance({ address: owner }: { address: Address }) {
//   const { client, cluster } = useWalletUi();

//   return useQuery({
//     queryKey: ['get-balance', { cluster: cluster.id, owner }],
//     queryFn: async () => {
//       // Kit RPC: returns lamports (bigint)
//       const lamports = await client.rpc.getBalance(owner).send();
//       return lamports; // keep as bigint for precision
//     },
//   });
// }

// export function useGetSignatures({ address: owner }: { address: Address }) {
//   const { client, cluster } = useWalletUi();

//   return useQuery({
//     queryKey: ['get-signatures', { cluster: cluster.id, owner }],
//     queryFn: async () =>
//       client.rpc.getSignaturesForAddress(owner).send(),
//   });
// }

// export function useGetTokenAccounts({ address: owner }: { address: Address }) {
//   const { client, cluster } = useWalletUi();

//   return useQuery({
//     queryKey: ['get-token-accounts', { cluster: cluster.id, owner }],
//     queryFn: async () => {
//       // Two queries: legacy SPL Token + Token-2022, with parsed JSON encoding
//       const [legacy, token2022] = await Promise.all([
//         client.rpc
//           .getTokenAccountsByOwner(owner, {
//             programId: TOKEN_PROGRAM_ID_ADDR,
//           }, { encoding: 'jsonParsed' })
//           .send(),
//         client.rpc
//           .getTokenAccountsByOwner(owner, {
//             programId: TOKEN_2022_PROGRAM_ID_ADDR,
//           }, { encoding: 'jsonParsed' })
//           .send(),
//       ]);
//       // Each response usually has .value array of { pubkey, account }
//       return [...(legacy?.value ?? []), ...(token2022?.value ?? [])];
//     },
//   });
// }

// export function useRequestAirdrop({ address: owner }: { address: Address }) {
//   const { client, cluster } = useWalletUi();
//   const qc = useQueryClient();

//   return useMutation({
//     mutationFn: async (amountSol: number = 1) => {
//       const lamportsBn = solToLamports(amountSol);
//       const signature = await client.rpc
//         .requestAirdrop(owner, toLamports(lamportsBn))
//         .send();

//       // Wait for confirmation (confirmed)
//       await waitForConfirmation(client.rpc, signature, 'confirmed');
//       return signature;
//     },
//     onSuccess: async (sig) => {
//       toastTx(sig);
//       await Promise.all([
//         qc.invalidateQueries({
//           queryKey: ['get-balance', { cluster: cluster.id, owner }],
//         }),
//         qc.invalidateQueries({
//           queryKey: ['get-signatures', { cluster: cluster.id, owner }],
//         }),
//       ]);
//     },
//     onError: (err) => toast.error(`Airdrop failed: ${String(err)}`),
//   });
// }

// /**
//  * Transfer SOL using **Kit**: build a System Transfer instruction and use
//  * your existing helpers to sign & send (wallet-ui signer + signAndSend).
//  */
// export function useTransferSol({ address: from }: { address: Address }) {
//   const { client, cluster } = useWalletUi();
//   const txSigner = useWalletUiSigner();
//   const signAndSend = useWalletTransactionSignAndSend();
//   const qc = useQueryClient();

//   return useMutation({
//     mutationKey: ['transfer-sol', { cluster: cluster.id, from }],
//     mutationFn: async (input: { destination: Address; amount: number }) => {
//       const lamports = solToLamports(input.amount);

//       // Build the instruction in Kit form (no web3.js)
//       const ix = makeSystemTransferInstruction({
//         from,
//         to: input.destination,
//         lamports,
//       });

//       // Your helper should build a v0 message, attach blockhash, sign, send.
//       // It returns a signature (string).
//       const signature = await signAndSend(ix, txSigner);

//       // Confirm like we do for airdrop:
//       await waitForConfirmation(client.rpc, signature, 'confirmed');
//       return signature;
//     },
//     onSuccess: async (sig) => {
//       toastTx(sig);
//       await Promise.all([
//         qc.invalidateQueries({
//           queryKey: ['get-balance', { cluster: cluster.id, address: from }],
//         }),
//         qc.invalidateQueries({
//           queryKey: ['get-signatures', { cluster: cluster.id, address: from }],
//         }),
//       ]);
//     },
//     onError: (err) => toast.error(`Transaction failed: ${String(err)}`),
//   });
// }