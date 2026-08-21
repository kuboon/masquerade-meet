import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

/**
 * Holds the pitch shifter to a measured standard, in an OfflineAudioContext.
 *
 * It needs a real browser for AudioWorklet and WASM, but no camera, no
 * microphone and no Calls credentials — so unlike the room tests it always
 * runs. It loads `/voice/SignalsmithStretch.mjs` and configures it exactly as
 * `createVoiceGraph` does; a bundled copy could not be reached from here,
 * which is why the library is served rather than bundled.
 *
 * Two different faults are measured, because two different things go wrong
 * and one number cannot see both:
 *
 *  - **Smear** — energy sprayed into the gaps between the output's harmonics.
 *    This is what "metallic" and "watery" sound like.
 *  - **Leak-through** — energy still sitting on the *input's* harmonics, so
 *    the speaker's own pitch is audible underneath the disguise. In a room
 *    where the whole game is not being recognised, this is the one that
 *    matters most.
 *
 * Neither is measurable at every shift. At simple frequency ratios the two
 * harmonic series overlap — at a perfect fifth every second output harmonic
 * lands on every third input one — so there is nothing left to tell apart,
 * and leak-through is only asserted where the ratio is awkward enough to
 * separate them. Smear is asserted at the ends of the range, where the
 * engine this replaced fell apart.
 *
 * What it does not cover: the ring modulator and the tone stack are plain Web
 * Audio nodes now, and rebuilding them here would be testing the test. Their
 * numbers come from `toEngineParams`, which has unit tests.
 */

/** Matches STRETCH_BLOCK_MS in app/utils/voiceChanger.ts. */
const BLOCK_MS = 60

const INPUT_HZ = 150

/**
 * How far above each fault the wanted signal has to stand, in dB.
 *
 * A floor with room to spare rather than a target. Measured on this signal,
 * the two-tap delay-line shifter this replaced managed 10 dB of smear an
 * octave down — the bottom of the size slider, which is what a large
 * character uses — and leaked the speaker's own pitch back at between 9 and
 * 23 dB across the middle of the range. This engine measures in the sixties
 * for both.
 */
const FLOOR_DB = 45

const HARNESS = `
window.__voice = (() => {
const SR = 48000
const INPUT_HZ = ${INPUT_HZ}

/** A vowel: a buzzing source through three formant resonances. */
function source(ctx) {
	const osc = ctx.createOscillator()
	osc.type = 'sawtooth'
	osc.frequency.value = INPUT_HZ
	let node = osc
	for (const [f, q, gain] of [[700, 6, 18], [1150, 8, 14], [2600, 9, 10]]) {
		const filter = ctx.createBiquadFilter()
		filter.type = 'peaking'
		filter.frequency.value = f
		filter.Q.value = q
		filter.gain.value = gain
		node.connect(filter)
		node = filter
	}
	const trim = ctx.createGain()
	trim.gain.value = 0.2
	node.connect(trim)
	return { osc, out: trim }
}

/** Energy at one frequency, by Goertzel over a Hann-windowed slice. */
function energyAt(buf, hz) {
	const w = 2 * Math.PI * hz / SR
	let re = 0, im = 0
	for (let i = 0; i < buf.length; i++) {
		const win = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / buf.length)
		re += buf[i] * win * Math.cos(w * i)
		im += buf[i] * win * Math.sin(w * i)
	}
	return (re * re + im * im) / (buf.length * buf.length)
}

/**
 * Normalised autocorrelation, taking the shortest lag that gets close to the
 * best one. Taking the best outright picks a multiple of the period as often
 * as not, and reports a voice an octave below the one that is there.
 */
function detectPitch(buf) {
	const minLag = Math.floor(SR / 900)
	const maxLag = Math.floor(SR / 50)
	const scores = []
	let best = 0
	for (let lag = minLag; lag < maxLag; lag++) {
		let c = 0, energy = 0
		for (let i = 0; i < buf.length - lag; i++) {
			c += buf[i] * buf[i + lag]
			energy += buf[i + lag] * buf[i + lag]
		}
		const score = energy > 0 ? c / Math.sqrt(energy) : 0
		scores.push([lag, score])
		if (score > best) best = score
	}
	for (const [lag, score] of scores) {
		if (score >= best * 0.9) return SR / lag
	}
	return 0
}

/**
 * The rendered samples for one configuration, plus a couple of numbers read
 * off them. Used to compare two configurations against each other, where the
 * audio itself is a sharper answer than any measurement of it.
 */
async function renderWith(semitones, opts) {
	const ctx = new OfflineAudioContext(1, SR * 2, SR)
	const src = source(ctx)
	const mod = await import('/voice/SignalsmithStretch.mjs')
	const node = await mod.default(ctx, {
		numberOfInputs: 1,
		numberOfOutputs: 1,
		outputChannelCount: [1],
	})
	await node.configure({ blockMs: ${BLOCK_MS}, splitComputation: true })
	await node.schedule({ active: true, semitones, ...opts })
	src.out.connect(node).connect(ctx.destination)
	src.osc.start()
	const rendered = (await ctx.startRendering()).getChannelData(0)
	const slice = rendered.slice(SR, SR + 32768)

	// Energy-weighted mean frequency. A throat shifted upwards drags it up
	// whatever the pitch is doing, which is the whole point of the axis.
	let weighted = 0, total = 0
	for (let hz = 200; hz < 4000; hz += 25) {
		const e = energyAt(slice, hz)
		weighted += hz * e
		total += e
	}
	return {
		samples: Array.from(slice.slice(0, 4096)),
		pitch: detectPitch(slice),
		centroid: total > 0 ? weighted / total : 0,
	}
}

async function render(semitones) {
	// Two seconds, and everything is read from the second one: the shifter
	// has a block to fill before it says anything.
	const ctx = new OfflineAudioContext(1, SR * 2, SR)
	const src = source(ctx)
	const mod = await import('/voice/SignalsmithStretch.mjs')
	const node = await mod.default(ctx, {
		numberOfInputs: 1,
		numberOfOutputs: 1,
		outputChannelCount: [1],
	})
	await node.configure({ blockMs: ${BLOCK_MS}, splitComputation: true })
	// Awaited, because until this message lands the node is not processing at
	// all — an offline render has no real time in it for a late one to arrive
	// and comes out silent.
	await node.schedule({ active: true, semitones, formantCompensation: false })
	src.out.connect(node).connect(ctx.destination)
	src.osc.start()
	const rendered = (await ctx.startRendering()).getChannelData(0)
	const slice = rendered.slice(SR, SR + 32768)

	const expected = INPUT_HZ * 2 ** (semitones / 12)
	const onInputGrid = (hz) => Math.abs(hz - Math.round(hz / INPUT_HZ) * INPUT_HZ) < 8
	const onOutputGrid = (hz) => Math.abs(hz - Math.round(hz / expected) * expected) < 8

	let wanted = 0, smear = 0, leak = 0
	for (let k = 1; k * expected < SR / 2 - 300; k++) {
		wanted += energyAt(slice, k * expected)
		// Probes that land on the input's own harmonics would be measuring
		// leak-through, which is the other fault entirely.
		const probe = (k + 0.5) * expected
		if (!onInputGrid(probe)) smear += energyAt(slice, probe)
	}
	for (let m = 1; m * INPUT_HZ < SR / 2 - 300; m++) {
		const hz = m * INPUT_HZ
		// Where the two series coincide there is nothing to separate.
		if (!onOutputGrid(hz)) leak += energyAt(slice, hz)
	}

	let peak = 0
	for (const v of slice) peak = Math.max(peak, Math.abs(v))

	const db = (part) => 10 * Math.log10(wanted / Math.max(part, 1e-20))
	return {
		hz: detectPitch(slice),
		expected,
		peak,
		smearDb: db(smear),
		leakDb: db(leak),
	}
}

return { render, renderWith }
})()
`

async function shift(page: Page, semitones: number) {
	await page.addScriptTag({ content: HARNESS })
	return page.evaluate(
		(semitones) =>
			(window as any).__voice.render(semitones) as Promise<{
				hz: number
				expected: number
				peak: number
				smearDb: number
				leakDb: number
			}>,
		semitones
	)
}

test.describe('voice changer', () => {
	test.describe.configure({ timeout: 120_000 })

	test.beforeEach(async ({ page }) => {
		// Any page on the origin will do; only the module URL has to resolve.
		await page.goto('/')
	})

	for (const semitones of [-12, -7, 0, 7, 12]) {
		test(`moves the voice ${semitones} semitones`, async ({ page }) => {
			const { hz, expected, peak } = await shift(page, semitones)
			expect(hz).toBeGreaterThan(expected * 0.97)
			expect(hz).toBeLessThan(expected * 1.03)
			// A disguise nobody can hear is not a disguise.
			expect(peak).toBeGreaterThan(0.05)
		})
	}

	// The ends of the size slider, which runs to ±12 semitones. This is where
	// the shifter this replaced came apart.
	for (const semitones of [-12, -7, 7, 12]) {
		test(`keeps the harmonics clean at ${semitones} semitones`, async ({
			page,
		}) => {
			expect((await shift(page, semitones)).smearDb).toBeGreaterThan(FLOOR_DB)
		})
	}

	// The middle of the slider, where the ratios are awkward enough that the
	// speaker's own pitch can be told apart from the disguised one.
	for (const semitones of [-5, -3, 3, 5]) {
		test(`keeps the speaker's own pitch out of it at ${semitones} semitones`, async ({
			page,
		}) => {
			expect((await shift(page, semitones)).leakDb).toBeGreaterThan(FLOOR_DB)
		})
	}

	test('moves the formants with the pitch unless a throat says otherwise', async ({
		page,
	}) => {
		// The compatibility promise, and the reason `applyVoiceParams` can
		// compensate unconditionally: asking for exactly the pitch shift is
		// the same thing as not compensating at all. Every character written
		// before `throat` existed depends on this being true.
		await page.addScriptTag({ content: HARNESS })
		const [following, uncompensated] = await page.evaluate(() =>
			Promise.all([
				(window as any).__voice.renderWith(-7, {
					formantCompensation: true,
					formantSemitones: -7,
				}),
				(window as any).__voice.renderWith(-7, { formantCompensation: false }),
			])
		)
		const worst = following.samples.reduce(
			(max: number, v: number, i: number) =>
				Math.max(max, Math.abs(v - uncompensated.samples[i])),
			0
		)
		expect(worst).toBeLessThan(1e-6)
	})

	test('a throat moves the formants and leaves the pitch where it was', async ({
		page,
	}) => {
		await page.addScriptTag({ content: HARNESS })
		const [matching, small] = await page.evaluate(() =>
			Promise.all([
				(window as any).__voice.renderWith(-7, {
					formantCompensation: true,
					formantSemitones: -7,
				}),
				// The same voice out of a mouth eight semitones too small.
				(window as any).__voice.renderWith(-7, {
					formantCompensation: true,
					formantSemitones: -7 + 8,
				}),
			])
		)
		// Still the same person, speaking just as low.
		expect(small.pitch).toBeGreaterThan(matching.pitch * 0.97)
		expect(small.pitch).toBeLessThan(matching.pitch * 1.03)
		// Out of a much smaller mouth.
		expect(small.centroid).toBeGreaterThan(matching.centroid * 1.15)
	})

	test('stays close enough behind to hold a conversation', async ({ page }) => {
		const latencyMs = await page.evaluate(async () => {
			const ctx = new AudioContext({ sampleRate: 48000 })
			// Through a variable so that this stays a runtime import of a
			// served URL: it runs in the page, not in the bundle, and it is
			// the file that ships that matters.
			const url = '/voice/SignalsmithStretch.mjs'
			const mod: any = await import(/* @vite-ignore */ url)
			const node = await mod.default(ctx, {
				numberOfInputs: 1,
				numberOfOutputs: 1,
				outputChannelCount: [1],
			})
			await node.configure({ blockMs: 60, splitComputation: true })
			await node.schedule({ active: true, semitones: -7 })
			const seconds = await node.latency()
			await ctx.close()
			return seconds * 1000
		})
		// The disguise is on top of whatever the network costs, and everybody
		// in the room is talking over everybody else.
		expect(latencyMs).toBeLessThanOrEqual(80)
	})
})
