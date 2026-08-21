import type { VoiceParams } from './characters'

/**
 * The four sliders the lobby offers, once, so the lobby and the tuner cannot
 * disagree about what they are called or how far they go.
 */
export const VOICE_AXES = [
	{
		key: 'size',
		label: '体の大きさ',
		unit: '大きく低い ↔ 小さく高い',
		min: -1,
		max: 1,
	},
	{
		key: 'weight',
		label: '声の重心',
		unit: '太く暗い ↔ 細く明るい',
		min: -1,
		max: 1,
	},
	{
		key: 'nasal',
		label: '響き',
		unit: 'こもった ↔ 鼻にかかった',
		min: -1,
		max: 1,
	},
	{
		key: 'roughness',
		label: 'かすれ',
		unit: 'きれい ↔ ざらざら',
		min: 0,
		max: 1,
	},
] as const satisfies readonly {
	key: keyof VoiceParams
	label: string
	unit: string
	min: number
	max: number
}[]

/**
 * Everything a character can be, which is one more than a person is offered.
 *
 * `throat` has no slider in the lobby on purpose — see the note on it in
 * `characters.ts` — but the tuner is where character voices are written, so
 * it has to be able to reach every part of one.
 */
export const TUNING_AXES = [
	...VOICE_AXES,
	{
		key: 'throat',
		label: '口の大きさ（キャラ専用）',
		unit: '大きな口 ↔ 小さな口',
		min: -1,
		max: 1,
	},
] as const satisfies readonly {
	key: keyof VoiceParams
	label: string
	unit: string
	min: number
	max: number
}[]
