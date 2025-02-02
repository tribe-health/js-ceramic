import { createCeramic } from '../../create-ceramic'
import { createIPFS } from '../../create-ipfs'
import { CeramicApi, IpfsApi } from '@ceramicnetwork/common'
import * as linking from '@ceramicnetwork/blockchain-utils-linking'
import { happyPath, wrongProof } from './caip-flows'
import { LocalManagedProvider } from '@glif/local-managed-provider'
import { Network } from '@glif/filecoin-address'

const testnetPrivateKey =
  '7b2254797065223a22736563703235366b31222c22507269766174654b6579223a2257587362654d5176487a366f5668344b637262633045642b31362b3150766a6a504f3753514931355031343d227d'
const mainnetPrivateKey =
  '7b2254797065223a22736563703235366b31222c22507269766174654b6579223a2257587362654d5176487a366f5668344b637262633045642b31362b3150766a6a554f3753514931355031343d227d'
const blsPrivateKey =
  '7b2254797065223a22626c73222c22507269766174654b6579223a226e586841424f4163796856504b48326155596261796f4475752f4c6f32515a2b6662622f6f736a2f34456f3d227d'
const testnetProvider = new LocalManagedProvider(testnetPrivateKey, Network.TEST)
const mainnetProvider = new LocalManagedProvider(mainnetPrivateKey, Network.MAIN)
const blsMainnetProvider = new LocalManagedProvider(blsPrivateKey, Network.MAIN)

let ceramic: CeramicApi
let ipfs: IpfsApi

beforeEach(async () => {
  ceramic = await createCeramic(ipfs)
}, 20000)

afterEach(async () => {
  await ceramic.close()
}, 20000)

beforeAll(async () => {
  ipfs = await createIPFS()
}, 30000)

afterAll(async () => {
  await ipfs?.stop()
}, 20000)

test('happy path', async () => {
  const providers = [testnetProvider, mainnetProvider, blsMainnetProvider]
  await Promise.all(
    providers.map(async (provider) => {
      const addresses = await provider.getAccounts()
      const authProvider = new linking.filecoin.FilecoinAuthProvider(provider, addresses[0])
      await happyPath(ceramic, authProvider)
    })
  )
})

test('wrong proof', async () => {
  const providers = [testnetProvider, mainnetProvider, blsMainnetProvider]
  await Promise.all(
    providers.map(async (provider) => {
      const addresses = await provider.getAccounts()
      const authProvider = new linking.filecoin.FilecoinAuthProvider(provider, addresses[0])
      await wrongProof(ceramic, authProvider)
    })
  )
})
