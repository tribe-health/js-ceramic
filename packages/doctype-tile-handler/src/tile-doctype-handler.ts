import type CID from 'cids'

import * as didJwt from 'did-jwt'
import * as uint8arrays from 'uint8arrays'
import type { PublicKey } from 'did-resolver'

import jsonpatch from 'fast-json-patch'
import cloneDeep from 'lodash.clonedeep'

import { TileDoctype, TileParams, DOCTYPE_NAME } from "@ceramicnetwork/doctype-tile"
import {
    AnchorStatus,
    Context,
    DocOpts,
    DocState,
    RecordType,
    DoctypeConstructor,
    DoctypeHandler,
    DoctypeUtils,
    SignatureStatus,
    CeramicRecord,
    AnchorRecord,
} from "@ceramicnetwork/common"

/**
 * Tile doctype handler implementation
 */
export class TileDoctypeHandler implements DoctypeHandler<TileDoctype> {
    /**
     * Gets doctype name
     */
    get name(): string {
        return DOCTYPE_NAME
    }

    /**
     * Gets doctype class
     */
    get doctype(): DoctypeConstructor<TileDoctype> {
        return TileDoctype
    }

    /**
     * Create new Tile doctype instance
     * @param params - Create parameters
     * @param context - Ceramic context
     * @param opts - Initialization options
     */
    async create(params: TileParams, context: Context, opts?: DocOpts): Promise<TileDoctype> {
        return TileDoctype.create(params, context, opts)
    }

    /**
     * Applies record (genesis|signed|anchor)
     * @param record - Record
     * @param cid - Record CID
     * @param context - Ceramic context
     * @param state - Document state
     */
    async applyRecord(record: CeramicRecord, cid: CID, context: Context, state?: DocState): Promise<DocState> {
        if (state == null) {
            // apply genesis
            return this._applyGenesis(record, cid, context)
        }

        if ((record as AnchorRecord).proof) {
            return this._applyAnchor(context, record as AnchorRecord, cid, state);
        }

        return this._applySigned(record, cid, state, context)
    }

    /**
     * Applies genesis record
     * @param record - Genesis record
     * @param cid - Genesis record CID
     * @param context - Ceramic context
     * @private
     */
    async _applyGenesis(record: any, cid: CID, context: Context): Promise<DocState> {
        let payload = record
        const isSigned = DoctypeUtils.isSignedRecord(record)
        if (isSigned) {
            payload = (await context.ipfs.dag.get(record.link)).value
            await this._verifySignature(record, context, payload.header.controllers[0])
        } else if (payload.data) {
            throw Error('Genesis record with contents should always be signed')
        }
        return {
            doctype: DOCTYPE_NAME,
            content: payload.data || {},
            metadata: payload.header,
            signature: isSigned? SignatureStatus.SIGNED : SignatureStatus.GENESIS,
            anchorStatus: AnchorStatus.NOT_REQUESTED,
            log: [{ cid, type: RecordType.GENESIS }]
        }
    }

    /**
     * Applies signed record
     * @param record - Signed record
     * @param cid - Signed record CID
     * @param state - Document state
     * @param context - Ceramic context
     * @private
     */
    async _applySigned(record: any, cid: CID, state: DocState, context: Context): Promise<DocState> {
        // TODO: Assert that the 'prev' of the record being applied is the end of the log in 'state'
        await this._verifySignature(record, context, state.metadata.controllers[0])

        const payload = (await context.ipfs.dag.get(record.link)).value
        if (!payload.id.equals(state.log[0].cid)) {
            throw new Error(`Invalid docId ${payload.id}, expected ${state.log[0].cid}`)
        }

        const nextState = cloneDeep(state)

        nextState.signature = SignatureStatus.SIGNED
        nextState.anchorStatus = AnchorStatus.NOT_REQUESTED

        nextState.log.push({ cid, type: RecordType.SIGNED })

        const content = state.next?.content ?? state.content
        const metadata = state.next?.metadata ?? state.metadata
        nextState.next = {
            content: jsonpatch.applyPatch(content, payload.data).newDocument,
            metadata: {...metadata, ...payload.header}
        }
        return nextState
    }

    /**
     * Applies anchor record
     * @param context - Ceramic context
     * @param record - Anchor record
     * @param cid - Anchor record CID
     * @param state - Document state
     * @private
     */
    async _applyAnchor(context: Context, record: AnchorRecord, cid: CID, state: DocState): Promise<DocState> {
        // TODO: Assert that the 'prev' of the record being applied is the end of the log in 'state'
        const proof = (await context.ipfs.dag.get(record.proof)).value;

        const supportedChains = await context.api.getSupportedChains()
        if (!supportedChains.includes(proof.chainId)) {
            throw new Error("Anchor proof chainId '" + proof.chainId
                + "' is not supported. Supported chains are: '"
                + supportedChains.join("', '") + "'")
        }

        state.log.push({ cid, type: RecordType.ANCHOR })
        let content = state.content
        let metadata = state.metadata

        if (state.next?.content) {
            content = state.next.content
            delete state.next.content
        }

        if (state.next?.metadata) {
            metadata = state.next.metadata
            delete state.next.metadata
        }

        delete state.next

        return {
            ...state, content, metadata, anchorStatus: AnchorStatus.ANCHORED, anchorProof: proof,
        }
    }

    /**
     * Verifies record signature
     * @param record - Record to be verified
     * @param context - Ceramic context
     * @param did - DID value
     * @private
     */
    async _verifySignature(record: any, context: Context, did: string): Promise<void> {
        const { payload, signatures } = record
        const { signature,  protected: _protected } = signatures[0]

        const jsonString = uint8arrays.toString(uint8arrays.fromString(_protected, 'base64url'))
        const decodedHeader = JSON.parse(jsonString)
        const { kid } = decodedHeader
        if (!kid.startsWith(did)) {
            throw new Error(`Signature was made with wrong DID. Expected: ${did}, got: ${kid}`)
        }

        const { publicKey } = await context.resolver.resolve(kid)
        const jws = [_protected, payload, signature].join('.')
        try {
            await this.verifyJWS(jws, publicKey)
        } catch (e) {
            throw new Error('Invalid signature for signed record. ' + e)
        }
    }

    /**
     * Verifies JWS token
     * @param jws - JWS token
     * @param pubkeys - public key(s)
     */
    async verifyJWS(jws: string, pubkeys: PublicKey[]): Promise<void> {
        await didJwt.verifyJWS(jws, pubkeys)
    }

}