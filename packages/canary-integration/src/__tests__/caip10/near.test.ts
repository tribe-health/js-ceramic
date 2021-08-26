import { createCeramic } from '../../create-ceramic'
import { createIPFS } from '../../create-ipfs'
import { CeramicApi, IpfsApi } from '@ceramicnetwork/common'
import { KeyPair } from 'near-api-js'
import * as uint8arrays from 'uint8arrays'
import * as linking from '@ceramicnetwork/blockchain-utils-linking'
import { Caip10Link } from '@ceramicnetwork/stream-caip10-link'

const privateKey =
  'ed25519:9hB3onqC56qBSHpHJaE6EyxKPyFxCxzRBkmjuVx6UqXwygvAmFbwnsLuZ2YHsYJqkPTCygVBwXpNzssvWvUySbd'
const chainRef = 'near-mainnet'
const localProvider = KeyPair.fromString(privateKey)

class NearMockSigner {
  constructor(readonly provider: KeyPair) {}

  public async sign(message: string): Promise<{ signature: string; account: string }> {
    const { signature, publicKey } = await this.provider.sign(uint8arrays.fromString(message))
    return {
      signature: uint8arrays.toString(signature, 'base64pad'),
      account: uint8arrays.toString(publicKey.data, 'base64pad'),
    }
  }
}

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
}, 10000)

afterAll(async () => {
  await ipfs?.stop()
}, 10000)

test('happy path', async () => {
  const provider = new NearMockSigner(localProvider)
  const address = uint8arrays.toString(localProvider.getPublicKey().data, 'base64pad')
  const authProvider = new linking.NearAuthProvider(provider, address, chainRef)
  const accountId = await authProvider.accountId()
  const caip = await Caip10Link.fromAccount(ceramic, accountId)
  await caip.setDid(ceramic.did, authProvider)
  expect(caip.state.log.length).toEqual(2)
  expect(caip.did).toEqual(ceramic.did.id)
}, 20000)

test('wrong proof', async () => {
  const provider = new NearMockSigner(localProvider)
  const address = uint8arrays.toString(localProvider.getPublicKey().data, 'base64pad')
  const authProvider = new linking.NearAuthProvider(provider, address, chainRef)
  const accountId = await authProvider.accountId()
  accountId.address = 'wrong-test-user'
  const caip = await Caip10Link.fromAccount(ceramic, accountId)
  await expect(caip.setDid(ceramic.did, authProvider)).rejects.toThrow(
    /Address doesn't match stream controller/
  )
})
