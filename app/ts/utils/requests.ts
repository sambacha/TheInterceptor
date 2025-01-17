import * as funtypes from 'funtypes'
import { WebsiteSocket } from './user-interface-types.js'

export type UniqueRequestIdentifier = funtypes.Static<typeof UniqueRequestIdentifier>
export const UniqueRequestIdentifier = funtypes.ReadonlyObject({
	requestId: funtypes.Number,
	requestSocket: WebsiteSocket,
}).asReadonly()

export type RawInterceptedRequest = funtypes.Static<typeof RawInterceptedRequest>
export const RawInterceptedRequest = funtypes.Intersect(
	funtypes.Union(
		funtypes.ReadonlyObject({
			method: funtypes.String,
			params: funtypes.Union(funtypes.Array(funtypes.Unknown), funtypes.Undefined)
		}).asReadonly(),
		funtypes.ReadonlyObject({ method: funtypes.String }).asReadonly()
	),
	funtypes.ReadonlyObject({
		interceptorRequest: funtypes.Boolean,
		usingInterceptorWithoutSigner: funtypes.Boolean,
		requestId: funtypes.Number,
	})
)

export type InterceptedRequest = funtypes.Static<typeof InterceptedRequest>
export const InterceptedRequest = funtypes.Intersect(
	funtypes.Union(
		funtypes.ReadonlyObject({
			method: funtypes.String,
			params: funtypes.Union(funtypes.Array(funtypes.Unknown), funtypes.Undefined)
		}).asReadonly(),
		funtypes.ReadonlyObject({ method: funtypes.String }).asReadonly()
	),
	funtypes.ReadonlyObject({
		interceptorRequest: funtypes.Boolean,
		usingInterceptorWithoutSigner: funtypes.Boolean,
		uniqueRequestIdentifier: UniqueRequestIdentifier,
	})
)
export type ProviderMessage = InterceptedRequest

export const getUniqueRequestIdentifierString = (uniqueRequestIdentifier: UniqueRequestIdentifier) => {
	return `${ uniqueRequestIdentifier.requestSocket.tabId }-${ uniqueRequestIdentifier.requestSocket.connectionName }-${ uniqueRequestIdentifier.requestId }`
}

export const doesUniqueRequestIdentifiersMatch = (a: UniqueRequestIdentifier, b: UniqueRequestIdentifier) => {
	return a.requestId == b.requestId && a.requestSocket.connectionName === b.requestSocket.connectionName && a.requestSocket.tabId === b.requestSocket.tabId
}
