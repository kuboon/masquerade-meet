/**
 * What a published `voice` actually means, in numbers a synthesiser takes.
 *
 * The five axes in a character set are written for people: 0 is "leave it
 * alone" and ±1 is as far as it goes. This module is where they stop being
 * a scale and become semitones and decibels — which is the other half of the
 * contract. Without it, `size: -0.95` is a number somebody made up.
 *
 * No Web Audio here, only arithmetic: the checker and the CLI need the same
 * conversion to say what a voice will sound like, and neither of them is in
 * a browser. The graph that consumes this is in `./graph.ts`.
 */

import type { VoiceParams } from './mod.ts'

/**
 * How far each axis goes, in the units the audio engine speaks.
 *
 * Here rather than in the app because these numbers are what a published
 * `voice` means: without them `size: -0.95` is a number, and with them it is
 * eleven and a half semitones down.
 */
export const VOICE_RANGE = {
	/** semitones at size = ±1, formants included */
	sizeSemitones: 12,
	/** dB on each shelf at weight = ±1, applied in opposite directions */
	weightDb: 7,
	/** dB on the mid peak at nasal = ±1 */
	nasalDb: 9,
	/** ring modulator depth at roughness = 1 */
	roughnessDepth: 0.55,
	/**
	 * semitones the formants move on their own at throat = ±1
	 *
	 * Narrower than `size`, because this one has nowhere to hide: shifting
	 * formants a whole octave away from the pitch stops sounding like a
	 * throat and starts sounding like a fault.
	 */
	throatSemitones: 8,
} as const

/**
 * Whether a voice is far enough from the speaker's own to be a disguise.
 *
 * Size is what carries it: two semitones is inside the range one person's
 * voice moves on its own, so anything smaller leaves them recognisable
 * however the other axes are set. A rasp nobody has can carry it instead, at
 * any pitch — and so can a throat that does not match the voice, which is a
 * thing no real speaker can do at all.
 *
 * The bar every character in a published set has to clear.
 */
export function isDisguised(params: VoiceParams): boolean {
	const semitones = Math.abs(params.size) * VOICE_RANGE.sizeSemitones
	const formants = Math.abs(params.throat ?? 0) * VOICE_RANGE.throatSemitones
	return semitones >= 2 || formants >= 2 || (params.roughness ?? 0) >= 0.3
}

/** The engine's own controls, worked out from the four a person sees. */
export interface EngineParams {
	/** how far the pitch moves */
	semitones: number
	/**
	 * Where the formants end up, measured from where they started rather
	 * than from the pitch — which is what `formantCompensation` buys, and
	 * why this is not simply `semitones`.
	 *
	 * Equal to `semitones` means they travel with it: one body, growing and
	 * shrinking together, which is what every character did before `throat`
	 * existed and what every character with no `throat` still does.
	 */
	formantSemitones: number
	ringModHz: number
	ringModDepth: number
	lowGain: number
	midGain: number
	highGain: number
}

/**
 * The four axes a person tunes, turned into the ones the engine takes.
 *
 * The whole point of the split: everything arbitrary lives here, in one
 * function with a test, rather than being spread across thirty character
 * files where nobody can see whether two of them mean the same thing.
 */
export function toEngineParams(params: VoiceParams): EngineParams {
	const rough = Math.max(0, Math.min(1, params.roughness))
	return {
		// Semitones all the way down now: the shifter speaks them, so the
		// exponential that used to live here does not have to exist twice.
		semitones: params.size * VOICE_RANGE.sizeSemitones,
		// The pitch, and then the throat on top of it.
		formantSemitones:
			params.size * VOICE_RANGE.sizeSemitones +
			(params.throat ?? 0) * VOICE_RANGE.throatSemitones,
		// Low enough to be heard as a rasp in the voice rather than as a tone
		// beside it, and rising a little so the top of the slider buzzes.
		ringModHz: rough > 0 ? 28 + rough * 45 : 0,
		ringModDepth: rough * VOICE_RANGE.roughnessDepth,
		// The two shelves move opposite ways, which is what makes this tilt
		// rather than volume.
		lowGain: -params.weight * VOICE_RANGE.weightDb,
		highGain: params.weight * VOICE_RANGE.weightDb,
		midGain: params.nasal * VOICE_RANGE.nasalDb,
	}
}
