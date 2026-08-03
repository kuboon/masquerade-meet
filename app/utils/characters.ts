/**
 * The 15 stock characters players can hide behind.
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

function tone(
	low: number,
	midFreq: number,
	midGain: number,
	midQ: number,
	high: number
) {
	return { low, midFreq, midGain, midQ, high }
}

export const characters: Character[] = [
	{
		id: 'bear',
		name: 'くまごろう',
		emoji: '🐻',
		tagline: 'のっそり低音',
		colors: {
			base: '#8d6244',
			dark: '#5f3f2b',
			light: '#d9b191',
			accent: '#3f2a1c',
			bg: '#f4e3d3',
		},
		face: {
			head: 'round',
			ears: 'round',
			eyes: 'dot',
			mouth: 'smile',
			muzzle: true,
		},
		voice: {
			pitchRatio: 0.72,
			vibratoRate: 0,
			vibratoDepth: 0,
			ringModHz: 0,
			ringModDepth: 0,
			tone: tone(5, 900, -3, 1, -4),
		},
	},
	{
		id: 'rabbit',
		name: 'うさぴょん',
		emoji: '🐰',
		tagline: 'ぴょこぴょこ高音',
		colors: {
			base: '#f6f0f4',
			dark: '#cbb9c6',
			light: '#ffffff',
			accent: '#f19bb4',
			bg: '#fbe7ef',
		},
		face: {
			head: 'oval',
			ears: 'long',
			eyes: 'round',
			mouth: 'smile',
			muzzle: true,
			cheeks: true,
		},
		voice: {
			pitchRatio: 1.42,
			vibratoRate: 0,
			vibratoDepth: 0,
			ringModHz: 0,
			ringModDepth: 0,
			tone: tone(-4, 2600, 3, 1, 2),
		},
	},
	{
		id: 'fox',
		name: 'こんきち',
		emoji: '🦊',
		tagline: 'すこし高めの早口',
		colors: {
			base: '#e08343',
			dark: '#b25f2a',
			light: '#f7e3d0',
			accent: '#3d2a20',
			bg: '#fceadb',
		},
		face: {
			head: 'egg',
			ears: 'pointy',
			eyes: 'sleepy',
			mouth: 'smile',
			muzzle: true,
		},
		voice: {
			pitchRatio: 1.16,
			vibratoRate: 0,
			vibratoDepth: 0,
			ringModHz: 0,
			ringModDepth: 0,
			tone: tone(-2, 3000, 4, 1.2, 1),
		},
	},
	{
		id: 'tanuki',
		name: 'ぽんぽこ',
		emoji: '🦝',
		tagline: 'まるっと落ち着いた声',
		colors: {
			base: '#9a8b7a',
			dark: '#5c5147',
			light: '#e5ddd2',
			accent: '#2f2822',
			bg: '#efeae1',
		},
		face: {
			head: 'round',
			ears: 'round',
			eyes: 'round',
			mouth: 'smile',
			muzzle: true,
			mask: true,
		},
		voice: {
			pitchRatio: 0.86,
			vibratoRate: 0,
			vibratoDepth: 0,
			ringModHz: 0,
			ringModDepth: 0,
			tone: tone(3, 1200, 2, 0.9, -2),
		},
	},
	{
		id: 'cat',
		name: 'にゃんきち',
		emoji: '🐱',
		tagline: 'つんとした高音',
		colors: {
			base: '#f0b850',
			dark: '#c08a2c',
			light: '#fbe6bb',
			accent: '#3a2b16',
			bg: '#fdf1d8',
		},
		face: {
			head: 'round',
			ears: 'pointy',
			eyes: 'round',
			mouth: 'fang',
			muzzle: true,
			cheeks: true,
		},
		voice: {
			pitchRatio: 1.32,
			vibratoRate: 0,
			vibratoDepth: 0,
			ringModHz: 0,
			ringModDepth: 0,
			tone: tone(-3, 3400, 3, 1.4, 2),
		},
	},
	{
		id: 'dog',
		name: 'わんすけ',
		emoji: '🐶',
		tagline: 'ちょっとだけ低い',
		colors: {
			base: '#c9945c',
			dark: '#8f6437',
			light: '#f3e0c8',
			accent: '#33251a',
			bg: '#f8ecdc',
		},
		face: {
			head: 'oval',
			ears: 'round',
			eyes: 'round',
			mouth: 'smile',
			muzzle: true,
		},
		voice: {
			pitchRatio: 0.92,
			vibratoRate: 0,
			vibratoDepth: 0,
			ringModHz: 0,
			ringModDepth: 0,
			tone: tone(2, 800, 3, 0.8, -1),
		},
	},
	{
		id: 'owl',
		name: 'ふくろうはかせ',
		emoji: '🦉',
		tagline: 'こもった重低音',
		colors: {
			base: '#8a7a63',
			dark: '#574b3c',
			light: '#ddd0ba',
			accent: '#f0a92e',
			bg: '#eee7da',
		},
		face: { head: 'round', ears: 'tuft', eyes: 'wide', mouth: 'beak' },
		voice: {
			pitchRatio: 0.78,
			vibratoRate: 0,
			vibratoDepth: 0,
			ringModHz: 0,
			ringModDepth: 0,
			tone: tone(4, 500, 5, 0.7, -8),
		},
	},
	{
		id: 'penguin',
		name: 'ぺんぺん',
		emoji: '🐧',
		tagline: 'ぱたぱた明るい声',
		colors: {
			base: '#37414d',
			dark: '#1f262e',
			light: '#f4f7fa',
			accent: '#f5a623',
			bg: '#dfe9f2',
		},
		face: { head: 'egg', ears: 'none', eyes: 'round', mouth: 'beak' },
		voice: {
			pitchRatio: 1.24,
			vibratoRate: 0,
			vibratoDepth: 0,
			ringModHz: 0,
			ringModDepth: 0,
			tone: tone(-2, 2200, 3, 1, 1),
		},
	},
	{
		id: 'frog',
		name: 'けろすけ',
		emoji: '🐸',
		tagline: 'げこげこ潰れ声',
		colors: {
			base: '#6cb04a',
			dark: '#44772e',
			light: '#d3ecc2',
			accent: '#2c4a1c',
			bg: '#e4f4d8',
		},
		face: {
			head: 'round',
			ears: 'none',
			eyes: 'bulge',
			mouth: 'wide',
			cheeks: true,
		},
		voice: {
			pitchRatio: 0.66,
			vibratoRate: 0,
			vibratoDepth: 0,
			ringModHz: 55,
			ringModDepth: 0.22,
			tone: tone(2, 700, 6, 1.6, -6),
		},
	},
	{
		id: 'sheep',
		name: 'めーちゃん',
		emoji: '🐑',
		tagline: 'ふるえる甘い声',
		colors: {
			base: '#f5f2ee',
			dark: '#cdc6bd',
			light: '#ffffff',
			accent: '#4a4038',
			bg: '#f2efe8',
		},
		face: {
			head: 'round',
			ears: 'round',
			eyes: 'sleepy',
			mouth: 'smile',
			muzzle: true,
			cheeks: true,
			mane: true,
		},
		voice: {
			pitchRatio: 1.1,
			vibratoRate: 5.5,
			vibratoDepth: 0.55,
			ringModHz: 0,
			ringModDepth: 0,
			tone: tone(-1, 2000, 2, 1, 1),
		},
	},
	{
		id: 'dragon',
		name: 'どらごん',
		emoji: '🐲',
		tagline: '地の底からの声',
		colors: {
			base: '#4f9d7a',
			dark: '#2f6650',
			light: '#c4e6d6',
			accent: '#f2c14e',
			bg: '#dcefe5',
		},
		face: {
			head: 'square',
			ears: 'horns',
			eyes: 'star',
			mouth: 'fang',
			muzzle: true,
		},
		voice: {
			pitchRatio: 0.58,
			vibratoRate: 0,
			vibratoDepth: 0,
			ringModHz: 0,
			ringModDepth: 0,
			tone: tone(7, 600, 3, 0.8, -6),
		},
	},
	{
		id: 'robot',
		name: 'ロボ丸',
		emoji: '🤖',
		tagline: 'ビリビリ電子音',
		// the disguise here comes from the ring modulator, not the pitch
		colors: {
			base: '#9aa7b4',
			dark: '#5e6b78',
			light: '#e3e9ef',
			accent: '#39d0d8',
			bg: '#e2e8ee',
		},
		face: { head: 'square', ears: 'antenna', eyes: 'visor', mouth: 'grid' },
		voice: {
			// deliberately not exactly 1.0: a static grain phase would turn the
			// shifter's two taps into a fixed comb filter
			pitchRatio: 0.94,
			vibratoRate: 0,
			vibratoDepth: 0,
			ringModHz: 42,
			ringModDepth: 0.85,
			tone: tone(-6, 1600, 6, 2, 3),
		},
	},
	{
		id: 'alien',
		name: 'うちゅうくん',
		emoji: '👽',
		tagline: 'きんきん宇宙声',
		colors: {
			base: '#8fd66f',
			dark: '#5da344',
			light: '#d9f5c9',
			accent: '#1d2b12',
			bg: '#e6f7dc',
		},
		face: { head: 'egg', ears: 'antenna', eyes: 'wide', mouth: 'none' },
		voice: {
			pitchRatio: 1.62,
			vibratoRate: 7,
			vibratoDepth: 0.2,
			ringModHz: 0,
			ringModDepth: 0,
			tone: tone(-8, 3800, 5, 1.5, 3),
		},
	},
	{
		id: 'ghost',
		name: 'おばけん',
		emoji: '👻',
		tagline: 'ゆらゆら不気味な声',
		colors: {
			base: '#c9c6e4',
			dark: '#8f8ab5',
			light: '#f2f1fb',
			accent: '#38325c',
			bg: '#eae8f6',
		},
		face: { head: 'ghost', ears: 'none', eyes: 'dot', mouth: 'ooo' },
		voice: {
			pitchRatio: 0.82,
			vibratoRate: 3.2,
			vibratoDepth: 0.85,
			ringModHz: 0,
			ringModDepth: 0,
			tone: tone(2, 1100, -4, 0.8, -3),
		},
	},
	{
		id: 'lion',
		name: 'らいおん丸',
		emoji: '🦁',
		tagline: 'どっしり太い声',
		colors: {
			base: '#e0a94a',
			dark: '#a9761f',
			light: '#f7e2b6',
			accent: '#4a3113',
			bg: '#fbeed2',
		},
		face: {
			head: 'round',
			ears: 'round',
			eyes: 'dot',
			mouth: 'fang',
			muzzle: true,
			mane: true,
		},
		voice: {
			pitchRatio: 0.7,
			vibratoRate: 0,
			vibratoDepth: 0,
			ringModHz: 0,
			ringModDepth: 0,
			tone: tone(6, 700, 4, 0.9, -5),
		},
	},
]

export const characterIds = characters.map((c) => c.id)

const charactersById = new Map(characters.map((c) => [c.id, c]))

export function getCharacter(id?: string): Character | undefined {
	return id === undefined ? undefined : charactersById.get(id)
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
