import fetch from 'cross-fetch'
jest.mock('cross-fetch', () => jest.fn()) // this gets hoisted to the top of the file
const mockFetch = fetch as jest.Mock
const { Response } = jest.requireActual('cross-fetch')

import { createCeramic } from '../../create-ceramic'
import { createIPFS } from '../../create-ipfs'
import { CeramicApi, IpfsApi } from '@ceramicnetwork/common'
import { happyPath, wrongProof } from './caip-flows'
import { TezosAuthProvider, TezosProvider } from '@ceramicnetwork/blockchain-utils-linking'
import { InMemorySigner } from '@taquito/signer'

const privateKey = 'p2sk2obfVMEuPUnadAConLWk7Tf4Dt3n4svSgJwrgpamRqJXvaYcg1'

let provider: TezosProvider
let publicKey: string

let ceramic: CeramicApi
let ipfs: IpfsApi

beforeEach(async () => {
  ceramic = await createCeramic(ipfs)
}, 10000)

afterEach(async () => {
  await ceramic.close()
}, 10000)

beforeAll(async () => {
  ipfs = await createIPFS()
  const signer = await InMemorySigner.fromSecretKey(privateKey)
  provider = {
    signer,
  }
  publicKey = await provider.signer.publicKey()
  mockFetch.mockReset()
  mockFetch.mockImplementation(async () => {
    return new Response(
      JSON.stringify({
        pubkey: publicKey,
      })
    )
  })
}, 10000)

afterAll(async () => {
  await ipfs?.stop()
  jest.clearAllMocks()
}, 10000)

test('happy path', async () => {
  const authProvider = new TezosAuthProvider(provider)
  await happyPath(ceramic, authProvider)
}, 20000)

test('wrong proof', async () => {
  const authProvider = new TezosAuthProvider(provider)
  await wrongProof(ceramic, authProvider)
})
