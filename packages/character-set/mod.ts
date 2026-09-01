/**
 * The shape of a masquerade character set.
 *
 * Types only — importing this adds nothing to a bundle. It is here so that a
 * page publishing its own characters can be checked by its own editor while
 * it is being written, rather than by a room after somebody has followed a
 * link to it.
 *
 * A character set is a JSON document you publish on your own site. Link to
 * `https://masq.kbn.one/new?set=<its url>` and the room that opens wears your
 * characters. There is nothing to register.
 *
 * ```ts
 * import type { CharacterSetDocument } from '@kuboon/masquerade-character-set'
 *
 * const set: CharacterSetDocument = {
 * 	name: 'サーカス団',
 * 	characters: [
 * 		{
 * 			id: 'lion',
 * 			name: 'ライオン',
 * 			emoji: '🦁',
 * 			image: 'lion.png',
 * 			voice: { size: -0.95, weight: -0.6, nasal: -0.05, roughness: 0.2 },
 * 		},
 * 	],
 * }
 * ```
 *
 * Run the checker over it before you publish — `@kuboon/masquerade-character-set/check`,
 * or the CLI at `/cli` — because a room that cannot use your set will quietly
 * open with its own characters instead.
 */

/**
 * A voice, in the things people actually tell each other apart by.
 *
 * Each axis is scaled so that 0 is "leave it alone" and ±1 is as far as it
 * goes. They are not the audio engine's controls — those are a pitch ratio,
 * a ring modulator and three filter bands, most of which mean nothing on
 * their own — but five numbers anybody can guess from the name.
 */
export interface VoiceParams {
	/**
	 * How big the speaker sounds. -1 a much larger body, +1 a much smaller one.
	 * ±1 is an octave.
	 *
	 * The formants move with the pitch, so the whole vocal tract grows and
	 * shrinks together — which is how a body of a different size actually
	 * sounds, and the strongest cue anybody has for telling two voices apart.
	 * **This is the axis that does the disguising.** The others colour it.
	 */
	size: number
	/**
	 * Where the weight of the voice sits. -1 dark and chesty, +1 thin and
	 * bright.
	 *
	 * Spectral tilt: in a person, vocal effort and how open the mouth is —
	 * the difference between a mumble and a voice called across a room.
	 * Independent of how big they are.
	 */
	weight: number
	/**
	 * -1 hollow, as if speaking into a box; +1 nasal, pinched at the nose.
	 *
	 * A resonance around 1.8 kHz. Distinct from tilt: a voice can be bright
	 * and hollow, or dark and nasal.
	 */
	nasal: number
	/**
	 * 0 clean, 1 rasping. Hoarseness — a voice that has been shouting, or
	 * that never quite settles onto a pitch.
	 */
	roughness: number
	/**
	 * How big the speaker's head is, against how big `size` says the rest of
	 * them is. -1 a mouth far too large for the voice, +1 far too small.
	 *
	 * The formants alone, moved apart from the pitch. `size` moves both
	 * together because that is what a bigger or smaller person is; this is
	 * the mismatch — and a mismatch is not something people come in, which is
	 * exactly why it suits a character who is not a person. A deep voice out
	 * of a tiny mouth is a cartoon, and there is no way to arrive at one by
	 * moving `size`.
	 *
	 * Optional; absent means 0.
	 */
	throat?: number
}

/**
 * A voice as you write it, where everything that is nothing is left out.
 *
 * The same axes as `VoiceParams`; the difference is only which of them you
 * have to spell. Most characters have no rasp and a throat that matches
 * their body, and writing `"roughness": 0` fifteen times says nothing.
 */
export interface VoiceDocument {
	/** see {@link VoiceParams.size} — and this is the one that disguises */
	size: number
	/** see {@link VoiceParams.weight} */
	weight: number
	/** see {@link VoiceParams.nasal} */
	nasal: number
	/** see {@link VoiceParams.roughness}. Optional; absent means 0. */
	roughness?: number
	/** see {@link VoiceParams.throat}. Optional; absent means 0. */
	throat?: number
}

/** One character, as you write it. */
export interface CharacterDocument {
	/**
	 * Letters, digits, `-` and `_`; unique within the set.
	 *
	 * Rooms store this, so **changing it later strands rooms that are already
	 * running.** Add characters rather than renaming them.
	 */
	id: string
	/** the name everyone else sees while the mask is on */
	name: string
	/** shown before the name. Optional; a generic mask is used without one. */
	emoji?: string
	/** one line of flavour shown in the picker. Optional. */
	tagline?: string
	/**
	 * The artwork. `https:` only; a path relative to this document is
	 * resolved against it, so `"lion.png"` beside the JSON works.
	 *
	 * Loaded by each participant's browser directly from wherever it is, so
	 * whoever serves it can see that these people are in a meeting.
	 */
	image: string
	/**
	 * How this character sounds. Must be a disguise — see `isDisguised` in
	 * `/check`. A set containing one voice that is not is refused whole.
	 */
	voice: VoiceDocument
}

/** A character set, as you write it. */
export interface CharacterSetDocument {
	/** what the room shows when it says which set it is wearing */
	name: string
	/** one line of flavour. Optional. */
	tagline?: string
	/**
	 * Wide artwork for the set. Optional, resolved like `image`; the first
	 * character's picture stands in without one.
	 */
	banner?: string
	/**
	 * 2 to 40 of them. **This is the room's capacity** — a set of eight seats
	 * eight people.
	 */
	characters: CharacterDocument[]
}

/**
 * A character with nothing left unsaid: what a set becomes once it has been
 * checked, with the optional fields filled in and the images resolved to
 * absolute URLs. What a room actually wears.
 */
export interface Character {
	id: string
	name: string
	emoji: string
	tagline: string
	image: string
	voice: VoiceParams
}

/** A checked set, named by the address it was fetched from. */
export interface CharacterSet {
	/** where it came from, which is how a room refers to it */
	id: string
	name: string
	tagline: string
	banner: string
	characters: Character[]
}
