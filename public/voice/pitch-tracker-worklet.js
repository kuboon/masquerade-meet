/**
 * Listens for the speaker's pitch, and passes the audio through untouched.
 *
 * Sits in front of the pitch shifter so that the shift can be decided from
 * what the voice is doing rather than fixed for the whole call — see
 * `packages/character-set/pitch.ts` for what is done with the readings. It
 * does not change the audio at all: input is copied to output, block for
 * block, so putting it in the chain costs no latency. Being in the chain is
 * what keeps it running; a worklet with nothing downstream is one the
 * browser is free to stop pulling.
 *
 * YIN (de Cheveigné & Kawahara, 2002) on a 4x decimated copy of the input,
 * at 12 kHz when the context runs at 48 kHz. A voice's fundamental lives
 * below 1 kHz, where that is more than enough, and it cuts the work by
 * sixteen: one reading is about a hundred thousand multiplies, every 21 ms.
 *
 * Posts `{ f0, voiced, time }` after every hop. `f0` is in Hz, and only
 * meaningful when `voiced` is true; `time` is the context time of the end of
 * the window the reading came from, which the receiver needs in order to
 * schedule a change against the audio it was read from.
 */

/* global sampleRate, currentTime */

/** input samples per analysed sample */
const DECIMATION = 4
/** the analysis window, in decimated samples: 43 ms at 12 kHz */
const WINDOW = 512
/** how often a reading is taken, in decimated samples: 21 ms */
const HOP = 256
const MIN_HZ = 60
const MAX_HZ = 1000
/**
 * How deep the first dip in the difference function has to be. YIN's
 * recommended 0.1–0.15; a touch higher here because the input is a live
 * microphone rather than a clean recording.
 */
const THRESHOLD = 0.15
/** no dip below this, and there is no pitch worth reporting */
const UNVOICED_ABOVE = 0.35
/** below this RMS (about -46 dBFS) the room is quiet, whatever YIN says */
const SILENCE_RMS = 0.005

class PitchTracker extends AudioWorkletProcessor {
	constructor() {
		super()
		const rate = sampleRate / DECIMATION
		this.minLag = Math.max(2, Math.floor(rate / MAX_HZ))
		this.maxLag = Math.ceil(rate / MIN_HZ)
		// Enough history for one window plus the longest lag it compares to.
		const length = WINDOW + this.maxLag
		this.history = new Float32Array(length)
		this.write = 0
		this.filled = 0
		this.sinceHop = 0
		this.accumulator = 0
		this.phase = 0
		this.difference = new Float32Array(this.maxLag + 1)
		this.frame = new Float32Array(length)
	}

	process(inputs, outputs) {
		const input = inputs[0]
		const output = outputs[0]
		if (input.length === 0) return true
		const channel = input[0]
		for (let c = 0; c < output.length; c++) {
			output[c].set(c < input.length ? input[c] : channel)
		}
		for (let i = 0; i < channel.length; i++) {
			// A box filter over the four samples being folded into one. Crude
			// as anti-aliasing goes, but nothing above 6 kHz tells YIN
			// anything about a voice's fundamental.
			this.accumulator += channel[i]
			if (++this.phase < DECIMATION) continue
			this.push(this.accumulator / DECIMATION)
			this.accumulator = 0
			this.phase = 0
		}
		return true
	}

	push(sample) {
		this.history[this.write] = sample
		this.write = (this.write + 1) % this.history.length
		if (this.filled < this.history.length) this.filled++
		if (++this.sinceHop < HOP) return
		this.sinceHop = 0
		if (this.filled < this.history.length) return
		this.port.postMessage(this.analyse())
	}

	/** The oldest-first copy of the history, and a reading taken off it. */
	analyse() {
		const { history, frame, difference, minLag, maxLag } = this
		const length = history.length
		// Unroll the ring so the window is contiguous: `frame[0]` is the
		// oldest sample, `frame[length - 1]` the newest.
		const head = length - this.write
		frame.set(history.subarray(this.write), 0)
		frame.set(history.subarray(0, this.write), head)

		let energy = 0
		for (let i = 0; i < WINDOW; i++) energy += frame[i] * frame[i]
		const rms = Math.sqrt(energy / WINDOW)
		const time = currentTime
		if (rms < SILENCE_RMS) return { f0: 0, voiced: false, rms, time }

		// The difference function, then its cumulative mean normalisation —
		// which is the part that makes YIN prefer the fundamental over the
		// lag of zero and over the octave below it.
		difference[0] = 1
		let running = 0
		for (let lag = 1; lag <= maxLag; lag++) {
			let sum = 0
			for (let i = 0; i < WINDOW; i++) {
				const d = frame[i] - frame[i + lag]
				sum += d * d
			}
			running += sum
			difference[lag] = running > 0 ? (sum * lag) / running : 1
		}

		// The first dip below the threshold, followed to its bottom; failing
		// that, the deepest dip there is.
		let lag = -1
		for (let candidate = minLag; candidate <= maxLag; candidate++) {
			if (difference[candidate] >= THRESHOLD) continue
			while (
				candidate + 1 <= maxLag &&
				difference[candidate + 1] < difference[candidate]
			) {
				candidate++
			}
			lag = candidate
			break
		}
		if (lag < 0) {
			let best = Infinity
			for (let candidate = minLag; candidate <= maxLag; candidate++) {
				if (difference[candidate] < best) {
					best = difference[candidate]
					lag = candidate
				}
			}
		}
		const depth = difference[lag]
		if (depth > UNVOICED_ABOVE) return { f0: 0, voiced: false, rms, time }

		// Parabolic interpolation around the dip: at 12 kHz a whole lag is
		// a third of a semitone at 200 Hz, which is too coarse to follow.
		let refined = lag
		if (lag > minLag && lag < maxLag) {
			const a = difference[lag - 1]
			const b = difference[lag]
			const c = difference[lag + 1]
			const denominator = a - 2 * b + c
			if (denominator !== 0) refined = lag + (0.5 * (a - c)) / denominator
		}
		const f0 = sampleRate / DECIMATION / refined
		return { f0, voiced: true, rms, time }
	}
}

registerProcessor('masquerade-pitch-tracker', PitchTracker)
