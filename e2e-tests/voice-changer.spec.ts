import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * Exercises the pitch shifter directly in an OfflineAudioContext. It needs a
 * real browser for AudioWorklet support, but no camera, no microphone and no
 * Calls credentials — so unlike the room test it always runs.
 */
test.describe('voice changer worklet', () => {
	test.beforeEach(async ({ page }) => {
		// any page on the origin will do; we only need the worklet URL to resolve
		await page.goto('/set-username')
	})

	async function analyse(
		page: Page,
		pitchRatio: number,
		extra: Record<string, number> = {}
	) {
		return page.evaluate(
			async ({ pitchRatio, extra }) => {
				// dominant frequency by autocorrelation
				function detectPitch(
					buf: Float32Array,
					sampleRate: number,
					from: number,
					length: number
				) {
					const slice = buf.slice(from, from + length)
					let bestLag = -1
					let bestCorrelation = 0
					const minLag = Math.floor(sampleRate / 800)
					const maxLag = Math.floor(sampleRate / 60)
					for (let lag = minLag; lag < maxLag; lag++) {
						let correlation = 0
						for (let i = 0; i < slice.length - lag; i++) {
							correlation += slice[i] * slice[i + lag]
						}
						correlation /= slice.length - lag
						if (correlation > bestCorrelation) {
							bestCorrelation = correlation
							bestLag = lag
						}
					}
					return bestLag > 0 ? sampleRate / bestLag : 0
				}

				const sampleRate = 48000
				const context = new OfflineAudioContext(1, sampleRate * 2, sampleRate)
				await context.audioWorklet.addModule('/voice/voice-changer-worklet.js')

				const oscillator = context.createOscillator()
				oscillator.type = 'sawtooth'
				oscillator.frequency.value = 200

				const node = new AudioWorkletNode(context, 'voice-changer', {
					numberOfInputs: 1,
					numberOfOutputs: 1,
					outputChannelCount: [1],
				})
				node.parameters.get('pitchRatio')!.value = pitchRatio
				for (const [name, value] of Object.entries(extra)) {
					node.parameters.get(name)!.value = value
				}

				oscillator.connect(node).connect(context.destination)
				oscillator.start()

				const data = (await context.startRendering()).getChannelData(0)
				let peak = 0
				for (let i = sampleRate; i < sampleRate * 2; i++) {
					peak = Math.max(peak, Math.abs(data[i]))
				}
				return {
					hz: detectPitch(data, sampleRate, sampleRate, 16384),
					peak,
				}
			},
			{ pitchRatio, extra }
		)
	}

	test('shifts a 200Hz tone down an octave', async ({ page }) => {
		const { hz, peak } = await analyse(page, 0.5)
		expect(hz).toBeGreaterThan(95)
		expect(hz).toBeLessThan(105)
		// the raised cosine windows sum to 1, so level survives the shift
		expect(peak).toBeGreaterThan(0.8)
	})

	test('shifts a 200Hz tone up a fifth', async ({ page }) => {
		const { hz } = await analyse(page, 1.5)
		expect(hz).toBeGreaterThan(290)
		expect(hz).toBeLessThan(310)
	})

	test('passes the signal through untouched at a ratio of 1', async ({
		page,
	}) => {
		const { hz, peak } = await analyse(page, 1)
		expect(hz).toBeGreaterThan(195)
		expect(hz).toBeLessThan(205)
		expect(peak).toBeGreaterThan(0.8)
	})

	test('ring modulation produces sidebands', async ({ page }) => {
		// 200Hz against a 100Hz carrier yields 100Hz and 300Hz components,
		// so the result becomes periodic at their common divisor.
		const { hz } = await analyse(page, 1, { ringModHz: 100, ringModDepth: 1 })
		expect(hz).toBeGreaterThan(95)
		expect(hz).toBeLessThan(105)
	})
})
