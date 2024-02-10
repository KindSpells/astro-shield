/*
 * SPDX-FileCopyrightText: 2024 KindSpells Labs S.L.
 *
 * SPDX-License-Identifier: MIT
 */

import { createHash } from 'node:crypto'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

/**
 * @param {string} data
 * @returns {string}
 */
const generateSRIHash = data => {
	const hash = createHash('sha256')
	hash.update(data, 'utf8')
	return `sha256-${hash.digest('base64')}`
}

/**
 * @param {string} filePath
 */
const processHTMLFile = async filePath => {
	const content = await readFile(filePath, 'utf8')

	let match
	let updatedContent = content

	const inlineScriptHashes = /** @type {Set<string>} */ (new Set())
	const inlineStyleHashes = /** @type {Set<string>} */ (new Set())

	// Extracting current inline script SRI hashes
	{
		const scriptRegex = /<script integrity="([^"]+)">/g

		// biome-ignore lint/suspicious/noAssignInExpressions: safe
		while ((match = scriptRegex.exec(content)) !== null) {
			const sriHash = match[1]
			if (sriHash) {
				inlineScriptHashes.add(sriHash)
			}
		}
	}

	// Extracting current inline style SRI hashes
	{
		const styleRegex = /<style integrity="([^"]+)">/g

		// biome-ignore lint/suspicious/noAssignInExpressions: safe
		while ((match = styleRegex.exec(content)) !== null) {
			const sriHash = match[1]
			if (sriHash) {
				inlineStyleHashes.add(sriHash)
			}
		}
	}

	// Computing hashes for inline scripts without SRI hash
	{
		// Stateful object => we can use it to iterate over matches
		const scriptRegex = /<script>([\s\S]*?)<\/script>/g

		// biome-ignore lint/suspicious/noAssignInExpressions: safe
		while ((match = scriptRegex.exec(content)) !== null) {
			const scriptContent = match[1]?.trim()

			if (scriptContent) {
				const sriHash = generateSRIHash(scriptContent)
				updatedContent = updatedContent.replace(
					match[0],
					`<script integrity="${sriHash}">${scriptContent}</script>`,
				)
				inlineScriptHashes.add(sriHash)
			}
		}
	}

	// Computing hashes for inline styles without SRI hash
	{
		// Stateful object => we can use it to iterate over matches
		const styleRegex = /<style>([\s\S]*?)<\/style>/g

		// biome-ignore lint/suspicious/noAssignInExpressions: safe
		while ((match = styleRegex.exec(content)) !== null) {
			const styleContent = match[1]?.trim()

			if (styleContent) {
				const sriHash = generateSRIHash(styleContent)
				updatedContent = updatedContent.replace(
					match[0],
					`<style integrity="${sriHash}">${styleContent}</style>`,
				)
				inlineStyleHashes.add(sriHash)
			}
		}
	}

	if (updatedContent !== content) {
		await writeFile(filePath, updatedContent)
	}

	return { inlineScriptHashes, inlineStyleHashes }
}

/** @param {string} dirPath */
const scanDirectory = async dirPath => {
	const inlineScriptHashes = /** @type {Set<string>} */ (new Set())
	const inlineStyleHashes = /** @type {Set<string>} */ (new Set())

	for (const file of await readdir(dirPath)) {
		const filePath = join(dirPath, file)
		const stats = await stat(filePath)

		const hashes = stats.isDirectory()
			? await scanDirectory(filePath)
			: stats.isFile() && extname(file) === '.html'
			  ? await processHTMLFile(filePath)
			  : undefined

		// We don't have union :(, yet
		if (hashes !== undefined) {
			for (const hash of hashes.inlineScriptHashes) {
				inlineScriptHashes.add(hash)
			}
			for (const hash of hashes.inlineStyleHashes) {
				inlineStyleHashes.add(hash)
			}
		}
	}

	return { inlineScriptHashes, inlineStyleHashes }
}

/**
 * @param {string} path
 * @returns {Promise<boolean>}
 */
const doesFileExist = async path => {
	try {
		await stat(path)
		return true
	} catch (err) {
		if (/** @type {{ code: unknown }} */ (err).code === 'ENOENT') {
			return false
		}
		throw err
	}
}

/**
 * @param {unknown[]} a
 * @param {unknown[]} b
 * @returns {boolean}
 */
const arraysEqual = (a, b) => {
	if (a.length !== b.length) {
		return false
	}

	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false
		}
	}

	return true
}

/**
 * @param {string} distDir
 * @param {string | undefined} hashesOutputModule
 */
const generateSRIHashes = async (distDir, hashesOutputModule) => {
	const hashes = await scanDirectory(distDir)

	const inlineScriptHashes = Array.from(hashes.inlineScriptHashes).sort()
	const inlineStyleHashes = Array.from(hashes.inlineStyleHashes).sort()

	if (!hashesOutputModule) {
		return
	}

	let persistHashes = false

	if (await doesFileExist(hashesOutputModule)) {
		const hashesModule = /** @type {{
			inlineScriptHashes?: string[] | undefined
			inlineStyleHashes?: string[] | undefined
		}} */ (await import(hashesOutputModule))

		persistHashes =
			!arraysEqual(inlineScriptHashes, hashesModule.inlineScriptHashes ?? []) ||
			!arraysEqual(inlineStyleHashes, hashesModule.inlineStyleHashes ?? [])
	} else {
		persistHashes = true
	}

	if (persistHashes) {
		let hashesFileContent = '// Do not edit this file manually\n\n'
		hashesFileContent += `export const inlineScriptHashes = /** @type {const} */ (${JSON.stringify(
			inlineScriptHashes,
		)})\n\n`
		hashesFileContent += `export const inlineStyleHashes = /** @type {const} */ (${JSON.stringify(
			inlineStyleHashes,
		)})\n`

		await writeFile(hashesOutputModule, hashesFileContent)
	}
}

/**
 * @param {string} distDir
 * @param {string | undefined} hashesOutputModule
 */
export const sriCSP = (distDir, hashesOutputModule) => ({
	name: 'scp-sri-postbuild',
	hooks: {
		'astro:build:done': async () =>
			await generateSRIHashes(distDir, hashesOutputModule),
		'astro:server:setup': async () =>
			await generateSRIHashes(distDir, hashesOutputModule),
	},
})

export default sriCSP
