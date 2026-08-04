import { BehaviorSubject } from 'rxjs'

/**
 * The picture a participant shows instead of their camera once the masks
 * come off.
 *
 * It never leaves the browser it was chosen in. Storage is localStorage,
 * and the way other people see it is as an ordinary video track drawn from
 * a canvas — the SFU forwards it like any other camera feed and keeps no
 * copy. Nothing about it touches the Durable Object, D1, or the session
 * cookie (which is httpOnly and far too small for an image anyway).
 */
const STORAGE_KEY = 'masquerade:still-image'

/** Big enough to look deliberate in a tile, small enough for localStorage. */
const MAX_EDGE = 640
const JPEG_QUALITY = 0.85

function read(): string | null {
	if (typeof window === 'undefined') return null
	try {
		return window.localStorage.getItem(STORAGE_KEY)
	} catch {
		// Private-mode Safari and the like. Going without is fine.
		return null
	}
}

export const stillImage$ = new BehaviorSubject<string | null>(read())

export function setStillImage(dataUrl: string | null) {
	try {
		if (dataUrl === null) window.localStorage.removeItem(STORAGE_KEY)
		else window.localStorage.setItem(STORAGE_KEY, dataUrl)
	} catch {
		// Keep it for this session even if it cannot be persisted.
	}
	stillImage$.next(dataUrl)
}

/**
 * Shrinks a chosen file to something worth sending and worth storing.
 *
 * A phone photo is several megabytes and larger than any tile will ever be;
 * unscaled it would blow the localStorage quota and waste bandwidth on
 * detail nobody sees.
 */
export async function fileToDataUrl(file: File): Promise<string> {
	const bitmap = await createImageBitmap(file)
	const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
	const width = Math.round(bitmap.width * scale)
	const height = Math.round(bitmap.height * scale)

	const canvas = document.createElement('canvas')
	canvas.width = width
	canvas.height = height
	const context = canvas.getContext('2d')
	if (!context) throw new Error('2d canvas is unavailable')
	context.drawImage(bitmap, 0, 0, width, height)
	bitmap.close()

	return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}
