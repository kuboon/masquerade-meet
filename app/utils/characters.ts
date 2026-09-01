/**
 * The shape of a character and of the voice it is disguised with.
 *
 * The types, the ranges and the disguise rule all come from
 * `@kuboon/masquerade-character-set`, which is the contract this app
 * publishes: a stranger writing a set on their own site has to know what
 * `size: -0.95` means and what will get their set refused, and there must be
 * exactly one answer to both.
 *
 * Imported by its published name rather than by a path into `packages/`, so
 * that the app is reading the same thing it hands out — an export map that
 * only works from inside this repository is an export map nobody else can
 * use. It resolves to the source next door, because it is an npm workspace;
 * `npm run character-set:check` is what keeps that honest by simulating the
 * publish on every CI run.
 *
 * Re-exported from here so that everything in the app can go on saying
 * `~/utils/characters`.
 *
 * This module is deliberately data-free: the rosters live in
 * `./characterSets/`, and keeping the types here means the set files can
 * import them without a cycle.
 *
 * Every character bundles two things:
 *  - a look (`image`), an artwork file under `public/characters/<set>/`
 *  - a voice (`voice`), five numbers, four of which anybody can be handed a
 *    slider for
 */

import type { VoiceParams } from '@kuboon/masquerade-character-set'

export type {
	Character,
	CharacterSet,
	VoiceParams,
} from '@kuboon/masquerade-character-set'
export {
	isDisguised,
	VOICE_RANGE,
} from '@kuboon/masquerade-character-set/check'

/** Shorthand for the set files, in the order the sliders appear. */
export function voice(
	size: number,
	weight: number,
	nasal: number,
	roughness = 0,
	/** last because it has no slider to appear on */
	throat = 0
): VoiceParams {
	return { size, weight, nasal, roughness, throat }
}

/** The voice applied when nobody is hiding: a straight passthrough. */
export const neutralVoice: VoiceParams = voice(0, 0, 0, 0)
