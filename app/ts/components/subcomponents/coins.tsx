import { useSignal } from '@preact/signals'
import { getTokenAmountsWorth } from '../../simulation/priceEstimator.js'
import { abs, bigintToDecimalString, bigintToRoundedPrettyDecimalString, checksummedAddress } from '../../utils/bigint.js'
import { TokenPriceEstimate, RpcNetwork, Erc20WithAmount, Erc1155WithAmount } from '../../utils/visualizer-types.js'
import { CopyToClipboard } from './CopyToClipboard.js'
import { Blockie } from './PreactBlocky.js'
import { JSX } from 'preact/jsx-runtime'
import { useEffect } from 'preact/hooks'

type EtherParams = {
	amount: bigint
	showSign?: boolean
	textColor?: string
	useFullTokenName?: boolean
	rpcNetwork: RpcNetwork
	style?: JSX.CSSProperties
}

export function Ether(param: EtherParams) {
	return <table class = 'log-table' style = 'width: fit-content'>
		<div class = 'log-cell' style = 'justify-content: right;'>
			<EtherAmount { ...param } />
		</div>
		<div class = 'log-cell'>
			<EtherSymbol { ...param } />
		</div>
	</table>
}
type EtherAmountParams = {
	amount: bigint
	showSign?: boolean
	textColor?: string
	style?: JSX.CSSProperties
}

export function EtherAmount(param: EtherAmountParams) {
	const sign = param.showSign ? (param.amount >= 0 ? ' + ' : ' - '): ''
	const style = {
		display: 'inline-block',
		overflow: 'hidden',
		'text-overflow': 'ellipsis',
		color: param.textColor ? param.textColor : 'var(--text-color)',
		...(param.style === undefined ? {} : param.style),
	}
	return <>
		<CopyToClipboard content = { bigintToDecimalString(abs(param.amount), 18n) } copyMessage = 'Ether amount copied!' >
			<p class = 'noselect nopointer' style = { style }>{ `${ sign }${ bigintToRoundedPrettyDecimalString(abs(param.amount), 18n ) }` }&nbsp; </p>
		</CopyToClipboard>
	</>
}

type EtherSymbolParams = {
	textColor?: string
	useFullTokenName?: boolean
	rpcNetwork: RpcNetwork
	style?: JSX.CSSProperties
}

export function EtherSymbol(param: EtherSymbolParams) {
	const style = {
		color: param.textColor ? param.textColor : 'var(--text-color)',
		display: 'inline-block',
		overflow: 'hidden',
		'text-overflow': 'ellipsis',
		'margin-left': '2px',
		...(param.style === undefined ? {} : param.style),
	}
	const etheName = param.useFullTokenName ? param.rpcNetwork.currencyName : param.rpcNetwork.currencyTicker

	return <>
		<div style = 'overflow: initial; height: 28px;'>
			<img class = 'noselect nopointer vertical-center' style = 'max-height: 25px; max-width: 25px;' src = '../../img/coins/ethereum.png'/>
		</div>
		<p class = 'noselect nopointer' style = { style }> { etheName } </p>
	</>
}

type TokenPriceParams = {
	textColor?: string,
	amount: bigint,
	rpcNetwork: RpcNetwork
	tokenPriceEstimate: TokenPriceEstimate | undefined
}

export function TokenPrice(param: TokenPriceParams) {
	if ( param.tokenPriceEstimate === undefined ) return <></>
	const value = getTokenAmountsWorth(param.amount, param.tokenPriceEstimate)
	const color = param.textColor ? param.textColor : 'var(--text-color)'
	return <>
		<p style = { `color: ${ color }` }>&nbsp;(</p>
		<Ether
			amount = { value }
			rpcNetwork = { param.rpcNetwork }
			textColor = { color }
		/>
		<p style = { `color: ${ color }` }>)</p>
	</>
}

export type TokenSymbolParams = {
	textColor?: string,
	name: string
	address: bigint
	symbol: string
	logoUri?: string
	tokenId?: bigint
	useFullTokenName?: boolean
	style?: JSX.CSSProperties
}

export function TokenSymbol(param: TokenSymbolParams) {
	const address = useSignal<bigint>(param.address)
	useEffect(() => { address.value = param.address }, [param.address])

	const tokenString = checksummedAddress(param.address)

	const style = {
		color: param.textColor ? param.textColor : 'var(--text-color)',
		display: 'inline-block',
		overflow: 'hidden',
		'text-overflow': 'ellipsis',
		'margin-left': '2px',
		...(param.style === undefined ? {} : param.style),
	}
	return <>
		<CopyToClipboard content = { tokenString } copyMessage = 'Token address copied!' >
			{ param.tokenId !== undefined ? 
				<p class = 'noselect nopointer' style = { style }>
					{ `#${ truncate(param.tokenId.toString(), 9) } ` }
				</p>
			: <></> }
		</CopyToClipboard>
		<div style = 'overflow: initial; height: 28px;'>
			<CopyToClipboard content = { tokenString } copyMessage = 'Token address copied!' >
				{ param.logoUri === undefined ?
					<Blockie
						address = { useSignal(param.address) }
						scale = { useSignal(3) }
						style = { { 'vertical-align': 'baseline', borderRadius: '50%' } }
					/>
				:
					<img class = 'noselect nopointer vertical-center' style = 'max-height: 25px; max-width: 25px;' src = { param.logoUri }/>
				}
			</CopyToClipboard>
		</div>
		<CopyToClipboard content = { tokenString } copyMessage = 'Token address copied!' >
			{ param.useFullTokenName ?
				<p class = 'noselect nopointer' style = { style }>
					{ `${ param.name === undefined ? tokenString : param.name }` }
				</p>
			:
				<p class = 'noselect nopointer' style = { style }>
					{ `${ param.symbol }` }
				</p>
			}
		</CopyToClipboard>
	</>
}

type TokenAmountParams = {
	amount: bigint
	showSign?: boolean
	textColor?: string
	decimals: bigint | undefined
	style?: JSX.CSSProperties
}

export function TokenAmount(param: TokenAmountParams) {
	const sign = param.showSign ? (param.amount >= 0 ? ' + ' : ' - '): ''
	const style = {
		color: param.textColor ? param.textColor : 'var(--text-color)',
		display: 'inline-block',
		...(param.style === undefined ? {} : param.style),
	}

	if (param.decimals === undefined) {
		return <>
			<CopyToClipboard content = { `${ abs(param.amount) } (decimals unknown)`} copyMessage = 'Token amount copied!' >
				<p class = 'noselect nopointer' style = { style }>{ `${ sign }${ abs(param.amount).toString() }` }&nbsp; </p>
			</CopyToClipboard>
		</>
	}
	return <>
		<CopyToClipboard content = { bigintToDecimalString(abs(param.amount), param.decimals) } copyMessage = 'Token amount copied!' >
			<p class = 'noselect nopointer' style = { style }>{ `${ sign }${ bigintToRoundedPrettyDecimalString(abs(param.amount), param.decimals ) }` }&nbsp; </p>
		</CopyToClipboard>
	</>
}

type TokenWithAmountParams = (Erc20WithAmount | Erc1155WithAmount) & {
	showSign?: boolean
	textColor?: string
	useFullTokenName: boolean
	style?: JSX.CSSProperties
}

export function TokenWithAmount(param: TokenWithAmountParams) {
	return <table class = 'log-table' style = 'width: fit-content'>
		<div class = 'log-cell' style = 'justify-content: right;'>
			<TokenAmount { ...param } />
		</div>
		<div class = 'log-cell'>
			<TokenSymbol { ... param }/>
		</div>
	</table>
}

export type TokenOrEtherParams = TokenWithAmountParams | EtherParams | TokenSymbolParams

export function TokenOrEth(param: TokenOrEtherParams) {
	if ('decimals' in param) {
		return <TokenWithAmount { ...param }/>
	}
	if ('symbol' in param) {
		return <TokenSymbol { ...param }/>
	}
	return <Ether { ...param }/>
}

export function TokenOrEthSymbol(param: TokenSymbolParams | EtherSymbolParams) {
	if ('symbol' in param) {
		return <TokenSymbol { ...param }/>
	}
	return <EtherSymbol { ...param }/>
}

export function TokenOrEthValue(param: TokenAmountParams | EtherAmountParams) {
	if ('decimals' in param) {
		return <TokenAmount { ...param }/>
	}
	return <EtherAmount { ...param }/>
}

function truncate(str: string, n: number){
	return (str.length > n) ? `${str.slice(0, n-1)}…` : str;
}

type AllApprovalParams = {
	textColor?: string
	style?: JSX.CSSProperties
	type: 'NFT All approval'
	allApprovalAdded: boolean
}

export function AllApproval(param: AllApprovalParams ) {
	const style = {
		color: param.textColor ? param.textColor : 'var(--text-color)',
		...(param.style === undefined ? {} : param.style),
	}
	if (!param.allApprovalAdded) return <p style = { style }><b>NONE</b></p>
	return <p style = { style }><b>ALL</b></p>
}
