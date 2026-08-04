/**
 * The shape of a character and of the voice it is disguised with.
 *
 * This module is deliberately data-free: the rosters live in
 * `./characterSets/`, and keeping the types here means the set files can
 * import them without a cycle.
 *
 * Every character bundles two things:
 *  - a look (`face`), rendered as a parametric SVG by `CharacterAvatar`
 *  - a voice (`voice`), fed to the voice changer worklet + EQ chain
 *
 * Pitch ratios are deliberately spread across a wide range so that two
 * players are never mistaken for one another.
 */

export type HeadShape = 'round' | 'oval' | 'egg' | 'square' | 'ghost'
export type EarShape =
	| 'none'
	| 'round'
	| 'pointy'
	| 'long'
	| 'horns'
	| 'antenna'
	| 'tuft'
export type EyeShape =
	| 'dot'
	| 'round'
	| 'sleepy'
	| 'wide'
	| 'bulge'
	| 'visor'
	| 'star'
export type MouthShape =
	| 'none'
	| 'smile'
	| 'beak'
	| 'wide'
	| 'fang'
	| 'grid'
	| 'ooo'

export interface FaceSpec {
	head: HeadShape
	ears: EarShape
	eyes: EyeShape
	mouth: MouthShape
	/** light coloured snout behind the mouth */
	muzzle?: boolean
	/** blushed cheeks */
	cheeks?: boolean
	/** dark patches around the eyes, raccoon style */
	mask?: boolean
	/** ring of fur or wool behind the head */
	mane?: boolean
}

export interface VoiceParams {
	/** playback ratio of the granular pitch shifter. 1 = untouched */
	pitchRatio: number
	/** vibrato speed in Hz (0 disables) */
	vibratoRate: number
	/** vibrato intensity, 0..1 */
	vibratoDepth: number
	/** ring modulator carrier in Hz (0 disables) */
	ringModHz: number
	/** ring modulator wet amount, 0..1 */
	ringModDepth: number
	/** post pitch-shift tone shaping, gains in dB */
	tone: {
		low: number
		midFreq: number
		midGain: number
		midQ: number
		high: number
	}
}

export interface Character {
	id: string
	/** the name everyone else sees while the mask is on */
	name: string
	emoji: string
	/** one line of flavour text shown in the picker */
	tagline: string
	colors: {
		base: string
		dark: string
		light: string
		accent: string
		bg: string
	}
	face: FaceSpec
	voice: VoiceParams
}

export interface CharacterSet {
	/** url-safe slug; travels in the room-creation URL as `?set=<id>` */
	id: string
	/** what the room creator sees when picking a set */
	name: string
	/** one line of flavour for the set chooser */
	tagline: string
	characters: Character[]
}

export function tone(
	low: number,
	midFreq: number,
	midGain: number,
	midQ: number,
	high: number
) {
	return { low, midFreq, midGain, midQ, high }
}

/** The voice applied when nobody is hiding: a straight passthrough. */
export const neutralVoice: VoiceParams = {
	pitchRatio: 1,
	vibratoRate: 0,
	vibratoDepth: 0,
	ringModHz: 0,
	ringModDepth: 0,
	tone: tone(0, 1000, 0, 1, 0),
}
