import * as path from 'path'
import * as url from 'url'
import { promises as fs } from 'fs'

const directoryOfThisFile = path.dirname(url.fileURLToPath(import.meta.url))

const dependencyPaths = [
	{ packageName: 'ethers', subfolderToVendor: 'dist', entrypointFile: 'ethers.esm.js' },
	{ packageName: 'webextension-polyfill', subfolderToVendor: 'dist', entrypointFile: 'browser-polyfill.js' },
	{ packageName: 'preact', subfolderToVendor: 'dist', entrypointFile: 'preact.module.js' },
	{ packageName: 'preact/jsx-runtime', subfolderToVendor: 'dist', entrypointFile: 'jsxRuntime.module.js' },
	{ packageName: 'preact/hooks', subfolderToVendor: 'dist', entrypointFile: 'hooks.module.js' },
	{ packageName: 'funtypes', subfolderToVendor: 'lib', entrypointFile: 'index.mjs' },
	{ packageName: 'node-fetch', subfolderToVendor: 'lib', entrypointFile: 'index.mjs' },
	{ packageName: '@zoltu/ethereum-abi-encoder', subfolderToVendor: 'output-esm', entrypointFile: 'index.js' },
	{ packageName: '@zoltu/ethereum-crypto', subfolderToVendor: 'output-esm', entrypointFile: 'index.js' },
	{ packageName: '@zoltu/rlp-encoder', subfolderToVendor: 'output-esm', entrypointFile: 'index.js' },
	{ packageName: '@darkflorist/address-metadata', subfolderToVendor: 'lib', entrypointFile: 'index.js' },
]

export function replaceImport(filePath: string, text: string) {
	let replaced = text
	dependencyPaths.forEach((dependency) => {
		const newLocation = path.join(directoryOfThisFile, '..', 'app', 'vendor', dependency.packageName, dependency.entrypointFile)
		const fileFolder = path.dirname(filePath)
		replaced = replaced.replace(`import '${ dependency.packageName }'`, `import '${ path.relative(fileFolder, newLocation).replace(/\\/g, '/') }'`)
		replaced = replaced.replace(` from '${ dependency.packageName }'`, ` from '${ path.relative(fileFolder, newLocation).replace(/\\/g, '/') }'`)
		replaced = replaced.replace(` from "${ dependency.packageName }"`, ` from '${ path.relative(fileFolder, newLocation).replace(/\\/g, '/') }'`)
		replaced = replaced.replace(`from'${ dependency.packageName }'`, ` from '${ path.relative(fileFolder, newLocation).replace(/\\/g, '/') }'`)
		replaced = replaced.replace(`from"${ dependency.packageName }"`, ` from '${ path.relative(fileFolder, newLocation).replace(/\\/g, '/') }'`)
		replaced = replaced.replace(`require("${ dependency.packageName }")`, `require('${ path.relative(fileFolder, newLocation).replace(/\\/g, '/') }')`)
	})
	return replaced
}

async function* getFiles(topDir: string): AsyncGenerator<string, any, undefined> {
	const dirContents = await fs.readdir(topDir, { withFileTypes: true })
	for (const dir of dirContents) {
		const res = path.resolve(topDir, dir.name);
		if (dir.isDirectory()) {
			yield* getFiles(res)
		} else {
			yield res
		}
	}
}

async function replaceImportsInJSFiles() {
	const folders = [
		path.join(directoryOfThisFile, '..', 'app', 'js'),
		path.join(directoryOfThisFile, '..', 'app', 'vendor')
	]
	for (const folder of folders) {
		for await (const filePath of getFiles(folder)) {
			if (path.extname(filePath) !== '.js' && path.extname(filePath) !== '.mjs') continue
			const replaced = replaceImport(filePath, await fs.readFile(filePath, 'utf8'))
			await fs.writeFile(filePath, replaced)
		}
	}
}

replaceImportsInJSFiles().catch(error => {
	console.error(error)
	debugger
	process.exit(1)
})