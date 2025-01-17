import { PopupOrTab, addWindowTabListener, closePopupOrTab, getPopupOrTabOnlyById, openPopupOrTab, removeWindowTabListener, tryFocusingTabOrWindow } from '../../components/ui-utils.js'
import { METAMASK_ERROR_ALREADY_PENDING } from '../../utils/constants.js'
import { Future } from '../../utils/future.js'
import { InterceptorAccessChangeAddress, InterceptorAccessRefresh, InterceptorAccessReply, PendingAccessRequestArray, Settings, WebsiteAccessArray, WindowMessage } from '../../utils/interceptor-messages.js'
import { Semaphore } from '../../utils/semaphore.js'
import { AddressInfo, AddressInfoEntry, Website, WebsiteSocket, WebsiteTabConnections } from '../../utils/user-interface-types.js'
import { getAssociatedAddresses, setAccess, updateWebsiteApprovalAccesses, verifyAccess } from '../accessManagement.js'
import { changeActiveAddressAndChainAndResetSimulation, handleContentScriptMessage, refuseAccess } from '../background.js'
import { INTERNAL_CHANNEL_NAME, createInternalMessageListener, getHtmlFile, sendPopupMessageToOpenWindows, websiteSocketToString } from '../backgroundUtils.js'
import { findAddressInfo } from '../metadataUtils.js'
import { getSettings } from '../settings.js'
import { getSignerName, getTabState, updatePendingAccessRequests, getPendingAccessRequests, clearPendingAccessRequests } from '../storageVariables.js'
import { InterceptedRequest } from '../../utils/requests.js'
import { replyToInterceptedRequest, sendSubscriptionReplyOrCallBack } from '../messageSending.js'
import { Simulator } from '../../simulation/simulator.js'

type OpenedDialogWithListeners = {
	popupOrTab: PopupOrTab
	onCloseWindow: (windowId: number) => void
} | undefined

let openedDialog: OpenedDialogWithListeners = undefined

const pendingInterceptorAccessSemaphore = new Semaphore(1)

const onCloseWindow = async (simulator: Simulator, windowId: number, websiteTabConnections: WebsiteTabConnections) => { // check if user has closed the window on their own, if so, reject signature
	if (openedDialog?.popupOrTab.windowOrTab.id !== windowId) return
	removeWindowTabListener(openedDialog.onCloseWindow)

	openedDialog = undefined
	const pendingRequests = await clearPendingAccessRequests()
	for (const pendingRequest of pendingRequests) {
		const reply: InterceptorAccessReply = {
			originalRequestAccessToAddress: pendingRequest.originalRequestAccessToAddress?.address,
			requestAccessToAddress: pendingRequest.requestAccessToAddress?.address,
			accessRequestId: pendingRequest.accessRequestId,
			userReply: 'NoResponse' as const
		}
		await resolve(simulator, websiteTabConnections, reply, pendingRequest.request, pendingRequest.website, pendingRequest.activeAddress)
	}
}

export async function resolveInterceptorAccess(simulator: Simulator, websiteTabConnections: WebsiteTabConnections, reply: InterceptorAccessReply) {
	const promises = await getPendingAccessRequests()
	const pendingRequest = promises.find((req) => req.accessRequestId === reply.accessRequestId)
	if (pendingRequest === undefined) throw new Error('Access request missing!')
	return await resolve(simulator, websiteTabConnections, reply, pendingRequest.request, pendingRequest.website, pendingRequest.activeAddress)
}

export function getAddressMetadataForAccess(websiteAccess: WebsiteAccessArray, addressInfos: readonly AddressInfo[]): AddressInfoEntry[] {
	const addresses = websiteAccess.map((x) => x.addressAccess === undefined ? [] : x.addressAccess?.map((addr) => addr.address)).flat()
	const addressSet = new Set(addresses)
	return Array.from(addressSet).map((x) => findAddressInfo(x, addressInfos))
}

export async function changeAccess(simulator: Simulator, websiteTabConnections: WebsiteTabConnections, confirmation: InterceptorAccessReply, website: Website, promptForAccessesIfNeeded: boolean = true) {
	if (confirmation.userReply === 'NoResponse') return
	await setAccess(website, confirmation.userReply === 'Approved', confirmation.requestAccessToAddress)
	updateWebsiteApprovalAccesses(simulator, websiteTabConnections, promptForAccessesIfNeeded, await getSettings())
	await sendPopupMessageToOpenWindows({ method: 'popup_websiteAccess_changed' })
}

export async function updateInterceptorAccessViewWithPendingRequests() {
	const requests = await getPendingAccessRequests()
	if (requests.length > 0) return await sendPopupMessageToOpenWindows({ method: 'popup_interceptorAccessDialog', data: requests })
}

async function askForSignerAccountsFromSignerIfNotAvailable(websiteTabConnections: WebsiteTabConnections, socket: WebsiteSocket) {
	const tabState = await getTabState(socket.tabId)
	if (tabState.signerAccounts.length !== 0) return tabState.signerAccounts

	const future = new Future<void>
	const listener = createInternalMessageListener( (message: WindowMessage) => {
		if (message.method === 'window_signer_accounts_changed' && websiteSocketToString(message.data.socket) === websiteSocketToString(socket)) return future.resolve()
	})
	const channel = new BroadcastChannel(INTERNAL_CHANNEL_NAME)
	try {
		channel.addEventListener('message', listener)
		const messageSent = sendSubscriptionReplyOrCallBack(websiteTabConnections, socket, { method: 'request_signer_to_eth_requestAccounts' as const, result: [] })
		if (messageSent) await future
	} finally {
		channel.removeEventListener('message', listener)
		channel.close()
	}
	return (await getTabState(socket.tabId)).signerAccounts
}

export async function requestAccessFromUser(
	simulator: Simulator,
	websiteTabConnections: WebsiteTabConnections,
	socket: WebsiteSocket,
	website: Website,
	request: InterceptedRequest | undefined,
	requestAccessToAddress: AddressInfoEntry | undefined,
	settings: Settings,
	activeAddress: bigint | undefined,
) {
	// check if we need to ask address access or not. If address is put to never need to have address specific permision, we don't need to ask for it
	const askForAddressAccess = requestAccessToAddress !== undefined && settings.userAddressBook.addressInfos.find((x) => x.address === requestAccessToAddress.address)?.askForAddressAccess !== false
	const accessAddress = askForAddressAccess ? requestAccessToAddress : undefined
	const closeWindowCallback = (windowId: number) => onCloseWindow(simulator, windowId, websiteTabConnections) 

	const pendingAccessRequests = new Future<PendingAccessRequestArray>()

	await pendingInterceptorAccessSemaphore.execute(async () => {
		const verifyPendingRequests = async () => {
			const previousRequests = await getPendingAccessRequests()
			if (previousRequests.length !== 0) {
				if (await getPopupOrTabOnlyById(previousRequests[0].dialogId) !== undefined) {
					return true
				} else {
					await clearPendingAccessRequests()
				}
			}
			return false
		}

		const justAddToPending = await verifyPendingRequests()
		if (verifyAccess(websiteTabConnections, socket, true, website.websiteOrigin, activeAddress, await getSettings()) !== 'askAccess') return
		if (!justAddToPending) {
			addWindowTabListener(closeWindowCallback)
			const popupOrTab = await openPopupOrTab({
				url: getHtmlFile('interceptorAccess'),
				type: 'popup',
				height: 800,
				width: 600,
			})
			if (popupOrTab?.windowOrTab.id === undefined) {
				if (request !== undefined) refuseAccess(websiteTabConnections, request)
				throw new Error('Opened dialog does not exist')
			}
			if (openedDialog) {
				removeWindowTabListener(openedDialog.onCloseWindow)
				await closePopupOrTab(openedDialog.popupOrTab)
			}
			openedDialog = { popupOrTab, onCloseWindow: closeWindowCallback, }
		}

		if (openedDialog?.popupOrTab.windowOrTab.id === undefined) {
			if (request !== undefined) refuseAccess(websiteTabConnections, request)
			throw new Error('Opened dialog does not exist')
		}
		const accessRequestId =  `${ accessAddress?.address } || ${ website.websiteOrigin }`
		const pendingRequest = {
			dialogId: openedDialog.popupOrTab.windowOrTab.id,
			socket,
			request,
			accessRequestId,
			website,
			requestAccessToAddress: accessAddress,
			originalRequestAccessToAddress: accessAddress,
			associatedAddresses: requestAccessToAddress !== undefined ? getAssociatedAddresses(settings, website.websiteOrigin, requestAccessToAddress) : [],
			addressInfos: settings.userAddressBook.addressInfos,
			signerAccounts: [],
			signerName: await getSignerName(),
			simulationMode: settings.simulationMode,
			activeAddress: activeAddress,
		}

		const requests = await updatePendingAccessRequests(async (previousPendingAccessRequests) => {
			// check that it doesn't have access already
			if (verifyAccess(websiteTabConnections, socket, true, website.websiteOrigin, activeAddress, await getSettings()) !== 'askAccess') return previousPendingAccessRequests
			
			// check that we are not tracking it already
			if (previousPendingAccessRequests.find((x) => x.accessRequestId === accessRequestId) === undefined) {
				return previousPendingAccessRequests.concat(pendingRequest)
			}
			return previousPendingAccessRequests
		})
		if (requests.current.find((x) => x.accessRequestId === accessRequestId) === undefined) return pendingAccessRequests.resolve(requests.current)

		if (requests.previous.find((x) => x.accessRequestId === accessRequestId) !== undefined) {
			if (request !== undefined) {
				replyToInterceptedRequest(websiteTabConnections, {
					uniqueRequestIdentifier: request.uniqueRequestIdentifier,
					method: request.method,
					error: METAMASK_ERROR_ALREADY_PENDING.error,
				})
			}
			return
		}
		if (justAddToPending) {
			if (requests.current.findIndex((x) => x.accessRequestId === accessRequestId) === 0) {
				await sendPopupMessageToOpenWindows({ method: 'popup_interceptorAccessDialog', data: requests.current })
			}
			await sendPopupMessageToOpenWindows({ method: 'popup_interceptor_access_dialog_pending_changed', data: requests.current })
			return await tryFocusingTabOrWindow({ type: openedDialog.popupOrTab.type === 'tab' ? 'tab' : 'window', id: openedDialog.popupOrTab.windowOrTab.id })
		}
		pendingAccessRequests.resolve(requests.current)
	})
}

async function resolve(simulator: Simulator, websiteTabConnections: WebsiteTabConnections, accessReply: InterceptorAccessReply, request: InterceptedRequest | undefined, website: Website, activeAddress: bigint | undefined) {
	if (accessReply.userReply === 'NoResponse') {
		if (request !== undefined) refuseAccess(websiteTabConnections, request)
	} else {
		const userRequestedAddressChange = accessReply.requestAccessToAddress !== accessReply.originalRequestAccessToAddress
		if (!userRequestedAddressChange) {
			await changeAccess(simulator, websiteTabConnections, accessReply, website)
		} else {
			if (accessReply.requestAccessToAddress === undefined) throw new Error('Changed request to page level')
			await changeAccess(simulator, websiteTabConnections, accessReply, website, false)
			const settings = await getSettings()
			await changeActiveAddressAndChainAndResetSimulation(simulator, websiteTabConnections, {
				simulationMode: settings.simulationMode,
				activeAddress: accessReply.requestAccessToAddress,
			})
		}
		if (request !== undefined) await handleContentScriptMessage(simulator, websiteTabConnections, request, website, activeAddress)
	}
	
	const pendingRequests = await updatePendingAccessRequests(async (previousPendingAccessRequests) => {
		return previousPendingAccessRequests.filter((x) => !(x.website.websiteOrigin === website.websiteOrigin && (x.requestAccessToAddress?.address === accessReply.requestAccessToAddress || x.requestAccessToAddress?.address === accessReply.originalRequestAccessToAddress)))
	})

	if (pendingRequests.current.length > 0) return sendPopupMessageToOpenWindows({ method: 'popup_interceptorAccessDialog', data: pendingRequests.current })

	if (openedDialog) {
		removeWindowTabListener(openedDialog.onCloseWindow)
		await closePopupOrTab(openedDialog.popupOrTab)
		openedDialog = undefined
	}
}

export async function requestAddressChange(websiteTabConnections: WebsiteTabConnections, message: InterceptorAccessChangeAddress | InterceptorAccessRefresh) {
	const newRequests = await updatePendingAccessRequests(async (previousPendingAccessRequests) => {
		if (message.data.requestAccessToAddress === undefined) throw new Error('Requesting account change on site level access request')
		async function getProposedAddress() {
			if (message.method === 'popup_interceptorAccessRefresh' || message.data.newActiveAddress === 'signer') {
				const signerAccounts = await askForSignerAccountsFromSignerIfNotAvailable(websiteTabConnections, message.data.socket)
				return signerAccounts === undefined || signerAccounts.length == 0 ? undefined : signerAccounts[0]
			}
			return message.data.newActiveAddress
		}

		const proposedAddress = await getProposedAddress()
		const settings = await getSettings()
		const newActiveAddress = proposedAddress === undefined ? message.data.requestAccessToAddress : proposedAddress
		const newActiveAddressAddressInfo = findAddressInfo(newActiveAddress, settings.userAddressBook.addressInfos)
		const associatedAddresses = getAssociatedAddresses(settings, message.data.website.websiteOrigin, newActiveAddressAddressInfo)
		
		return previousPendingAccessRequests.map((request) => {
			if (request.accessRequestId === message.data.accessRequestId) {
				return {
					...request,
					associatedAddresses,
					requestAccessTo: newActiveAddress
				}
			}
			return request
		})
	})
	return await sendPopupMessageToOpenWindows({
		method: 'popup_interceptorAccessDialog',
		data: newRequests.current,
	})
}

export async function interceptorAccessMetadataRefresh() {
	const settings = await getSettings()
	const signerName = await getSignerName()
	return await sendPopupMessageToOpenWindows({
		method: 'popup_interceptorAccessDialog',
		data: (await getPendingAccessRequests()).map((request) => {
			const requestAccessTo = request.requestAccessToAddress === undefined ? undefined : findAddressInfo(request.requestAccessToAddress?.address, settings.userAddressBook.addressInfos)
			const associatedAddresses = getAssociatedAddresses(settings, request.website.websiteOrigin, requestAccessTo)
			return {
				...request,
				associatedAddresses,
				signerName: signerName,
				requestAccessTo
			}
		})
	})
}
