import * as funtypes from 'funtypes'
import { UnionToIntersection, assertNever } from './typescript.js'
import { IUnsignedTransaction } from './ethereum.js'

const BigIntParser: funtypes.ParsedValue<funtypes.String, bigint>['config'] = {
	parse: value => {
		if (!/^0x([a-fA-F0-9]{1,64})$/.test(value)) return { success: false, message: `${value} is not a hex string encoded number.` }
		else return { success: true, value: BigInt(value) }
	},
	serialize: value => {
		if (typeof value !== 'bigint') return { success: false, message: `${typeof value} is not a bigint.`}
		return { success: true, value: `0x${value.toString(16)}` }
	},
}

const SmallIntParser: funtypes.ParsedValue<funtypes.String, bigint>['config'] = {
	parse: value => {
		if (!/^0x([a-fA-F0-9]{1,64})$/.test(value)) return { success: false, message: `${value} is not a hex string encoded number.` }
		if (BigInt(value) >= 2n**64n) return { success: false, message: `${value} must be smaller than 2^64.` }
		else return { success: true, value: BigInt(value) }
	},
	serialize: value => {
		if (value >= 2n**64n) return { success: false, message: `${value} must be smaller than 2^64.` }
		if (typeof value !== 'bigint') return { success: false, message: `${typeof value} is not a bigint.`}
		return { success: true, value: `0x${value.toString(16)}` }
	},
}


const AddressParser: funtypes.ParsedValue<funtypes.String, bigint>['config'] = {
	parse: value => {
		if (!/^0x([a-fA-F0-9]{40})$/.test(value)) return { success: false, message: `${value} is not a hex string encoded address.` }
		else return { success: true, value: BigInt(value) }
	},
	serialize: value => {
		if (typeof value !== 'bigint') return { success: false, message: `${typeof value} is not a bigint.`}
		return { success: true, value: `0x${value.toString(16).padStart(40, '0')}` }
	},
}

const Bytes32Parser: funtypes.ParsedValue<funtypes.String, bigint>['config'] = {
	parse: value => {
		if (!/^0x([a-fA-F0-9]{64})$/.test(value)) return { success: false, message: `${value} is not a hex string encoded 32 byte value.` }
		else return { success: true, value: BigInt(value) }
	},
	serialize: value => {
		if (typeof value !== 'bigint') return { success: false, message: `${typeof value} is not a bigint.`}
		return { success: true, value: `0x${value.toString(16).padStart(64, '0')}` }
	},
}

const Bytes256Parser: funtypes.ParsedValue<funtypes.String, bigint>['config'] = {
	parse: value => {
		if (!/^0x([a-fA-F0-9]{512})$/.test(value)) return { success: false, message: `${value} is not a hex string encoded 256 byte value.` }
		else return { success: true, value: BigInt(value) }
	},
	serialize: value => {
		if (typeof value !== 'bigint') return { success: false, message: `${typeof value} is not a bigint.`}
		return { success: true, value: `0x${value.toString(16).padStart(512, '0')}` }
	},
}
const Bytes16Parser: funtypes.ParsedValue<funtypes.String, bigint>['config'] = {
	parse: value => {
		if (!/^0x([a-fA-F0-9]{16})$/.test(value)) return { success: false, message: `${value} is not a hex string encoded 256 byte value.` }
		else return { success: true, value: BigInt(value) }
	},
	serialize: value => {
		if (typeof value !== 'bigint') return { success: false, message: `${typeof value} is not a bigint.`}
		return { success: true, value: `0x${value.toString(16).padStart(16, '0')}` }
	},
}

export const BytesParser: funtypes.ParsedValue<funtypes.String, Uint8Array>['config'] = {
	parse: value => {
		const match = /^(?:0x)?([a-fA-F0-9]*)$/.exec(value)
		if (match === null) return { success: false, message: `Expected a hex string encoded byte array with an optional '0x' prefix but received ${value}` }
		const normalized = match[1]
		if (normalized.length % 2) return { success: false, message: `Hex string encoded byte array must be an even number of charcaters long.`}
		const bytes = new Uint8Array(normalized.length / 2)
		for (let i = 0; i < normalized.length; i += 2) {
			bytes[i/2] = Number.parseInt(`${normalized[i]}${normalized[i + 1]}`, 16)
		}
		return { success: true, value: new Uint8Array(bytes) }
	},
	serialize: value => {
		if (!(value instanceof Uint8Array)) return { success: false, message: `${typeof value} is not a Uint8Array.`}
		let result = ''
		for (let i = 0; i < value.length; ++i) {
			result += ('0' + value[i].toString(16)).slice(-2)
		}
		return { success: true, value: `0x${result}` }
	}
}

const TimestampParser: funtypes.ParsedValue<funtypes.String, Date>['config'] = {
	parse: value => {
		if (!/^0x([a-fA-F0-9]{0,8})$/.test(value)) return { success: false, message: `${value} is not a hex string encoded timestamp.` }
		else return { success: true, value: new Date(Number.parseInt(value, 16) * 1000) }
	},
	serialize: value => {
		if (!(value instanceof Date)) return { success: false, message: `${typeof value} is not a Date.`}
		return { success: true, value: `0x${Math.floor(value.valueOf() / 1000).toString(16)}` }
	},
}

const OptionalBytesParser: funtypes.ParsedValue<funtypes.Union<[funtypes.String, funtypes.Literal<undefined>]>, Uint8Array>['config'] = {
	parse: value => BytesParser.parse(value || '0x'),
	serialize: value => BytesParser.serialize!(value || new Uint8Array()),
}

export const LiteralConverterParserFactory: <TInput, TOutput> (input: TInput, output: TOutput) => funtypes.ParsedValue<funtypes.Runtype<TInput>, TOutput>['config'] = (input, output) => {
	return {
		parse: value => (value === input) ? { success: true, value: output } : { success: false, message: `${value} was expected to be literal.` },
		serialize: value => (value === output) ? { success: true, value: input } : { success: false, message: `${value} was expected to be literal.`  }
	}
}

const BigIntParserNonHex: funtypes.ParsedValue<funtypes.String, bigint>['config'] = {
	parse: value => {
		if (!/^[0-9]+$/.test(value)) return { success: false, message: `${ value } is not a string encoded number.` }
		else return { success: true, value: BigInt(value) }
	},
	serialize: value => {
		if (typeof value !== 'bigint') return { success: false, message: `${ typeof value } is not a bigint.`}
		return { success: true, value: `${ value.toString() }` }
	},
}

export const NonHexBigInt = funtypes.String.withParser(BigIntParserNonHex)
export type NonHexBigInt = funtypes.Static<typeof NonHexBigInt>

//
// Ethereum
//

export const EthereumQuantity = funtypes.String.withParser(BigIntParser)
export type EthereumQuantity = funtypes.Static<typeof EthereumQuantity>

export const EthereumQuantitySmall = funtypes.String.withParser(SmallIntParser)
export type EthereumQuantitySmall = funtypes.Static<typeof EthereumQuantitySmall>

export const EthereumData = funtypes.String.withParser(BytesParser)
export type EthereumData = funtypes.Static<typeof EthereumData>

export const EthereumAddress = funtypes.String.withParser(AddressParser)
export type EthereumAddress = funtypes.Static<typeof EthereumAddress>

export const EthereumAddressOrMissing = funtypes.Union(EthereumAddress, funtypes.Literal('missing').withParser(LiteralConverterParserFactory('missing', undefined)))
export type EthereumAddressOrMissing = funtypes.Static<typeof EthereumAddressOrMissing>

export const EthereumBytes32 = funtypes.String.withParser(Bytes32Parser)
export type EthereumBytes32 = funtypes.Static<typeof EthereumBytes32>

export const EthereumBytes256 = funtypes.String.withParser(Bytes256Parser)
export type EthereumBytes256 = funtypes.Static<typeof EthereumBytes256>

export const EthereumBytes16 = funtypes.String.withParser(Bytes16Parser)
export type EthereumBytes16 = funtypes.Static<typeof EthereumBytes16>

export const EthereumTimestamp = funtypes.String.withParser(TimestampParser)
export type EthereumTimestamp = funtypes.Static<typeof EthereumTimestamp>

export const EthereumBlockTag = funtypes.Union(EthereumQuantitySmall, EthereumBytes32, funtypes.Literal('latest'), funtypes.Literal('pending'))
export type EthereumBlockTag = funtypes.Static<typeof EthereumBlockTag>

export const EthereumInput = funtypes.Union(funtypes.String, funtypes.Undefined).withParser(OptionalBytesParser)
export type EthereumInput = funtypes.Static<typeof EthereumInput>

export const EthereumAccessList = funtypes.ReadonlyArray(
	funtypes.ReadonlyObject({
		address: EthereumAddress,
		storageKeys: funtypes.ReadonlyArray(EthereumBytes32)
	}).asReadonly()
)
export type EthereumAccessList = funtypes.Static<typeof EthereumAccessList>

export type EthereumUnsignedTransactionLegacy = funtypes.Static<typeof EthereumUnsignedTransactionLegacy>
export const EthereumUnsignedTransactionLegacy = funtypes.Intersect(
	funtypes.ReadonlyObject({
		type: funtypes.Union(funtypes.Literal('0x0').withParser(LiteralConverterParserFactory('0x0', 'legacy' as const)), funtypes.Literal(undefined).withParser(LiteralConverterParserFactory(undefined, 'legacy' as const))),
		from: EthereumAddress,
		nonce: EthereumQuantity,
		gasPrice: EthereumQuantity,
		gas: EthereumQuantity,
		to: funtypes.Union(EthereumAddress, funtypes.Null),
		value: EthereumQuantity,
		input: EthereumInput,
	}).asReadonly(),
	funtypes.Partial({
		chainId: EthereumQuantity,
	}).asReadonly()
)

export type EthereumUnsignedTransaction2930 = funtypes.Static<typeof EthereumUnsignedTransaction2930>
export const EthereumUnsignedTransaction2930 = funtypes.Intersect(
	funtypes.ReadonlyObject({
		type: funtypes.Literal('0x1').withParser(LiteralConverterParserFactory('0x1', '2930' as const)),
		from: EthereumAddress,
		nonce: EthereumQuantity,
		gasPrice: EthereumQuantity,
		gas: EthereumQuantity,
		to: funtypes.Union(EthereumAddress, funtypes.Null),
		value: EthereumQuantity,
		input: EthereumInput,
		chainId: EthereumQuantity,
	}).asReadonly(),
	funtypes.Partial({
		accessList: EthereumAccessList,
	}).asReadonly(),
)

export type EthereumUnsignedTransaction1559 = funtypes.Static<typeof EthereumUnsignedTransaction1559>
export const EthereumUnsignedTransaction1559 = funtypes.Intersect(
	funtypes.ReadonlyObject({
		type: funtypes.Literal('0x2').withParser(LiteralConverterParserFactory('0x2', '1559' as const)),
		from: EthereumAddress,
		nonce: EthereumQuantity,
		maxFeePerGas: EthereumQuantity,
		maxPriorityFeePerGas: EthereumQuantity,
		gas: EthereumQuantity,
		to: funtypes.Union(EthereumAddress, funtypes.Null),
		value: EthereumQuantity,
		input: EthereumInput,
		chainId: EthereumQuantity,
	}).asReadonly(),
	funtypes.Partial({
		accessList: EthereumAccessList,
	}).asReadonly(),
)
export type EthereumUnsignedTransaction = funtypes.Static<typeof EthereumUnsignedTransaction>
export const EthereumUnsignedTransaction = funtypes.Union(EthereumUnsignedTransactionLegacy, EthereumUnsignedTransaction2930, EthereumUnsignedTransaction1559)

export type EthereumTransaction2930And1559Signature = funtypes.Static<typeof EthereumTransaction2930And1559Signature>
export const EthereumTransaction2930And1559Signature = funtypes.ReadonlyObject({
	r: EthereumQuantity,
	s: EthereumQuantity,
	hash: EthereumBytes32,
	yParity: funtypes.Union(funtypes.Literal('0x0').withParser(LiteralConverterParserFactory('0x0', 'even' as const)), funtypes.Literal('0x1').withParser(LiteralConverterParserFactory('0x1', 'odd' as const))),
})

export type EthereumTransactionLegacySignature = funtypes.Static<typeof EthereumTransactionLegacySignature>
export const EthereumTransactionLegacySignature = funtypes.Intersect(
	funtypes.ReadonlyObject({
		r: EthereumQuantity,
		s: EthereumQuantity,
		hash: EthereumBytes32,
		v: EthereumQuantity,
	}),
	funtypes.Union(
		funtypes.ReadonlyObject({
			v: EthereumQuantity,
		}),
		funtypes.ReadonlyObject({
			yParity: funtypes.Union(funtypes.Literal('0x0').withParser(LiteralConverterParserFactory('0x0', 'even' as const)), funtypes.Literal('0x1').withParser(LiteralConverterParserFactory('0x1', 'odd' as const))),
			chainId: EthereumQuantity,
		})
	)
)

export type EthereumSignedTransactionLegacy = funtypes.Static<typeof EthereumSignedTransactionLegacy>
export const EthereumSignedTransactionLegacy = funtypes.Intersect(
	EthereumUnsignedTransactionLegacy,
	EthereumTransactionLegacySignature,
)

export type EthereumSignedTransaction2930 = funtypes.Static<typeof EthereumSignedTransaction2930>
export const EthereumSignedTransaction2930 = funtypes.Intersect(
	EthereumUnsignedTransaction2930,
	EthereumTransaction2930And1559Signature,
)

export type EthereumSignedTransaction1559 = funtypes.Static<typeof EthereumSignedTransaction1559>
export const EthereumSignedTransaction1559 = funtypes.Intersect(
	EthereumUnsignedTransaction1559,
	EthereumTransaction2930And1559Signature,
)

export type EthereumSignedTransaction = funtypes.Static<typeof EthereumSignedTransaction>
export const EthereumSignedTransaction = funtypes.Union(EthereumSignedTransactionLegacy, EthereumSignedTransaction2930, EthereumSignedTransaction1559)

export type EthereumSignedTransactionWithBlockData = funtypes.Static<typeof EthereumSignedTransactionWithBlockData>
export const EthereumSignedTransactionWithBlockData = funtypes.Intersect(
	funtypes.Union(
		EthereumSignedTransactionLegacy,
		EthereumSignedTransaction2930,
		funtypes.Intersect(EthereumSignedTransaction1559, funtypes.ReadonlyObject({gasPrice: EthereumQuantity})),
	),
	funtypes.ReadonlyObject({
		data: EthereumInput,
		blockHash: funtypes.Union(EthereumBytes32, funtypes.Null),
		blockNumber: funtypes.Union(EthereumQuantity, funtypes.Null),
		transactionIndex: funtypes.Union(EthereumQuantity, funtypes.Null),
		v: EthereumQuantity,
	})
)

export type EthereumBlockHeader = funtypes.Static<typeof EthereumBlockHeader>
export const EthereumBlockHeader = funtypes.ReadonlyObject({
	author: EthereumAddress,
	difficulty: EthereumQuantity,
	extraData: EthereumData,
	gasLimit: EthereumQuantity,
	gasUsed: EthereumQuantity,
	hash: EthereumBytes32,
	logsBloom: EthereumBytes256,
	miner: EthereumAddress,
	mixHash: EthereumBytes32,
	nonce: EthereumBytes16,
	number: EthereumQuantity,
	parentHash: EthereumBytes32,
	receiptsRoot: EthereumBytes32,
	sha3Uncles: EthereumBytes32,
	stateRoot: EthereumBytes32,
	timestamp: EthereumTimestamp,
	size: EthereumQuantity,
	totalDifficulty: EthereumQuantity,
	transactions: funtypes.ReadonlyArray(EthereumSignedTransaction),
	uncles: funtypes.ReadonlyArray(EthereumBytes32),
	baseFeePerGas: funtypes.Union(EthereumQuantity, funtypes.Undefined),
	transactionsRoot: EthereumBytes32
}).asReadonly()

export function serializeUnsignedTransactionToJson(transaction: IUnsignedTransaction): unknown {
	switch (transaction.type) {
		case 'legacy':
			return {
				type: '0x0',
				from: serialize(EthereumAddress, transaction.from),
				nonce: serialize(EthereumQuantity, transaction.nonce),
				gasPrice: serialize(EthereumQuantity, transaction.gasPrice),
				gas: serialize(EthereumQuantity, transaction.gasLimit),
				to: transaction.to !== null ? serialize(EthereumAddress, transaction.to) : null,
				value: serialize(EthereumQuantity, transaction.value),
				data: serialize(EthereumData, transaction.input),
				...'chainId' in transaction && transaction.chainId !== undefined ? { chainId: serialize(EthereumQuantity, transaction.chainId) } : {},
			}
		case '2930':
			return {
				type: '0x1',
				from: serialize(EthereumAddress, transaction.from),
				nonce: serialize(EthereumQuantity, transaction.nonce),
				gasPrice: serialize(EthereumQuantity, transaction.gasPrice),
				gas: serialize(EthereumQuantity, transaction.gasLimit),
				to: transaction.to !== null ? serialize(EthereumAddress, transaction.to) : null,
				value: serialize(EthereumQuantity, transaction.value),
				data: serialize(EthereumData, transaction.input),
				chainId: serialize(EthereumQuantity, transaction.chainId),
				accessList: serialize(EthereumAccessList, transaction.accessList),
			}
		case '1559':
			return {
				type: '0x2',
				from: serialize(EthereumAddress, transaction.from),
				nonce: serialize(EthereumQuantity, transaction.nonce),
				maxFeePerGas: serialize(EthereumQuantity, transaction.maxFeePerGas),
				maxPriorityFeePerGas: serialize(EthereumQuantity, transaction.maxPriorityFeePerGas),
				gas: serialize(EthereumQuantity, transaction.gasLimit),
				to: transaction.to !== null ? serialize(EthereumAddress, transaction.to) : null,
				value: serialize(EthereumQuantity, transaction.value),
				data: serialize(EthereumData, transaction.input),
				chainId: serialize(EthereumQuantity, transaction.chainId),
				accessList: serialize(EthereumAccessList, transaction.accessList),
			}
		default: assertNever(transaction)
	}
}

export function serialize<T, U extends funtypes.Codec<T>>(funtype: U, value: T) {
	return funtype.serialize(value) as ToWireType<U>
}

export type ToWireType<T> =
	T extends funtypes.Intersect<infer U> ? UnionToIntersection<{ [I in keyof U]: ToWireType<U[I]> }[number]>
	: T extends funtypes.Union<infer U> ? { [I in keyof U]: ToWireType<U[I]> }[number]
	: T extends funtypes.Record<infer U, infer V> ? Record<funtypes.Static<U>, ToWireType<V>>
	: T extends funtypes.Partial<infer U, infer V> ? V extends true ? { readonly [K in keyof U]?: ToWireType<U[K]> } : { [K in keyof U]?: ToWireType<U[K]> }
	: T extends funtypes.Object<infer U, infer V> ? V extends true ? { readonly [K in keyof U]: ToWireType<U[K]> } : { [K in keyof U]: ToWireType<U[K]> }
	: T extends funtypes.Readonly<funtypes.Tuple<infer U>> ? { readonly [P in keyof U]: ToWireType<U[P]>}
	: T extends funtypes.Tuple<infer U> ? { [P in keyof U]: ToWireType<U[P]>}
	: T extends funtypes.ReadonlyArray<infer U> ? readonly ToWireType<U>[]
	: T extends funtypes.Array<infer U> ? ToWireType<U>[]
	: T extends funtypes.ParsedValue<infer U, infer _> ? ToWireType<U>
	: T extends funtypes.Codec<infer U> ? U
	: never

export const RevertErrorParser: funtypes.ParsedValue<funtypes.String, string>['config'] = {
	parse: value => {
		if (!value.startsWith('Reverted ')) return { success: true, value }
		const parseResult = BytesParser.parse(value.slice('Reverted '.length))
		if (!parseResult.success) return parseResult
		const decoded = new TextDecoder().decode(parseResult.value)
		return { success: true, value: decoded }
	},
	serialize: value => {
		const encoded = new TextEncoder().encode(value)
		const serializationResult = BytesParser.serialize!(encoded)
		if (!serializationResult.success) return serializationResult
		return { success: true, value: `Reverted ${serializationResult.value}` }
	},
}
