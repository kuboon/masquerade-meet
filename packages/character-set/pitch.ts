/**
 * Turning pitch readings into a shift that follows the voice.
 *
 * A fixed shift moves a voice but keeps everything it does: the rise at a
 * question, the drop at the end of a sentence, how far it wanders — and that
 * wandering is as much a signature as the pitch itself. This is the other
 * half of `size`: how much of the speaker's own inflection to take out,
 * so the voice settles around the character's pitch rather than carrying
 * the speaker's up and down with it.
 *
 * Pure arithmetic, like `voice.ts`, so it can be tested without a browser.
 * The readings come from `pitch-tracker-worklet.js`; the graph feeds them in
 * and schedules the result on the shifter.
 *
 * ```
 * centre  — where the speaker's own voice sits, learned as they talk
 * d(t)    — how far above or below it they are right now, in semitones
 * shift   — base − flatten · d(t)
 * ```
 *
 * At `flatten = 0` the shift is the base shift and the voice is left to move
 * as it pleases; at `1` every rise and fall is cancelled and the voice holds
 * one note at the base shift from its own middle. Anywhere between is a voice
 * that still has some expression, with the speaker's own range narrowed.
 */

/** readings per second the tracker produces, which the time constants assume */
const READINGS_PER_SECOND = 47

/**
 * How long the speaker's middle takes to settle, in voiced readings. About
 * three seconds of speech: long enough to ride out a single sentence's
 * shape, short enough that a voice warmed up by the second sentence is
 * being measured where it actually sits.
 */
const CENTRE_SECONDS = 3

/**
 * How far a reading is allowed to pull in one go. Real inflection changes
 * an octave in a few hundred milliseconds at most, so the deviation is
 * eased over a few readings — which also turns an octave error from the
 * tracker into a moment's wobble rather than a jump.
 */
const DEVIATION_SMOOTHING = 0.5

/**
 * The most the shift is ever bent away from the base, in semitones. The
 * widest a speaking voice moves; anything the tracker claims beyond it is
 * an error, and a shift that big on top of the base would take the shifter
 * past where it sounds like anything.
 */
const MAX_DEVIATION = 12

const semitonesOf = (hz: number) => 12 * Math.log2(hz)

/**
 * Keeps up with one speaker.
 *
 * Fed every reading the tracker produces; asked, at any time, how far the
 * speaker currently sits from their own middle. Survives a change of
 * character — the middle belongs to the person, not to the mask.
 */
export class PitchFollower {
	/** the speaker's middle, in semitones; `undefined` until they have spoken */
	private centre: number | undefined
	private voicedReadings = 0
	private smoothed = 0

	/** The speaker's middle, in Hz, or `undefined` before they have spoken. */
	get centreHz(): number | undefined {
		return this.centre === undefined ? undefined : 2 ** (this.centre / 12)
	}

	/**
	 * How far the voice is from its own middle, in semitones, eased. Holds
	 * its last value through silence and unvoiced sounds, so a shift that
	 * follows it never jumps on a consonant.
	 */
	get deviation(): number {
		return this.smoothed
	}

	/** Takes one reading. `f0` is ignored unless `voiced`. */
	observe(f0: number, voiced: boolean): void {
		if (!voiced || !(f0 > 0)) return
		const semitones = semitonesOf(f0)
		this.voicedReadings++
		// Quick to start, then steady: the first reading is the middle, the
		// second averages the two, and from a few seconds in it drifts only
		// slowly, so that one long high note does not drag it along.
		const settled = CENTRE_SECONDS * READINGS_PER_SECOND
		const rate = Math.max(1 / this.voicedReadings, 1 / settled)
		this.centre =
			this.centre === undefined
				? semitones
				: this.centre + rate * (semitones - this.centre)
		const deviation = Math.max(
			-MAX_DEVIATION,
			Math.min(MAX_DEVIATION, semitones - this.centre)
		)
		this.smoothed += DEVIATION_SMOOTHING * (deviation - this.smoothed)
	}

	/**
	 * The shift to ask the shifter for right now.
	 *
	 * @param base what the character asks for, in semitones
	 * @param flatten how much of the speaker's inflection to take out, 0–1
	 */
	shift(base: number, flatten: number): number {
		const amount = Math.max(0, Math.min(1, flatten))
		return base - amount * this.smoothed
	}

	/** Forgets the speaker. For a new person at the same microphone. */
	reset(): void {
		this.centre = undefined
		this.voicedReadings = 0
		this.smoothed = 0
	}
}
