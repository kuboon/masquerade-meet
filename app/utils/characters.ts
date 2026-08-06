/**
 * The shape of a character and of the voice it is disguised with.
 *
 * This module is deliberately data-free: the rosters live in
 * `./characterSets/`, and keeping the types here means the set files can
 * import them without a cycle.
 *
 * Every character bundles two things:
 *  - a look (`image`), an artwork file under `public/characters/<set>/`
 *  - a voice (`voice`), four numbers that anybody can be handed a slider for
 */

/**
 * A voice, in the four things people actually tell each other apart by.
 *
 * These are not the engine's controls. The engine wants a pitch ratio, a
 * vibrato, a ring modulator and three filter bands — ten numbers, most of
 * which mean nothing to anyone, several of which do nothing on their own,
 * and two of which sound identical until a third is moved. Somebody tuning
 * their own voice in the lobby needs axes they can guess from the name,
 * where every one changes something audible by itself.
 *
 * Each is scaled so that 0 is "leave it alone" and ±1 is as far as this
 * goes, which makes a voice readable at a glance and a slider easy to draw.
 */
export interface VoiceParams {
	/**
	 * How big the speaker sounds. -1 a much larger body, +1 a much smaller one.
	 *
	 * One axis rather than two, because the shifter resamples: the formants
	 * move with the pitch, so the whole vocal tract grows and shrinks
	 * together. That is a limitation worth writing down as a feature — it is
	 * how a body of a different size actually sounds, and size is the
	 * strongest cue anybody has for telling two voices apart.
	 */
	size: number
	/**
	 * Where the weight of the voice sits. -1 dark and chesty, +1 thin and
	 * bright.
	 *
	 * Spectral tilt. In a person this is vocal effort and how open the mouth
	 * is — the difference between a mumble and a voice called across a room —
	 * and it is independent of how big they are.
	 */
	weight: number
	/**
	 * -1 hollow, as if speaking into a box; +1 nasal, pinched at the nose.
	 *
	 * A resonance around 1.8 kHz, roughly where a nose doing too much or too
	 * little of the work shows up. Distinct from tilt: a voice can be bright
	 * and hollow, or dark and nasal.
	 */
	nasal: number
	/**
	 * 0 clean, 1 rasping. Hoarseness — the irregularity of a voice that has
	 * been shouting, or that never quite settles onto a pitch.
	 */
	roughness: number
}

export interface Character {
	id: string
	/** the name everyone else sees while the mask is on */
	name: string
	emoji: string
	/** one line of flavour text shown in the picker */
	tagline: string
	/** public path of the artwork, e.g. '/characters/animals/bear.png' */
	image: string
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

/** Shorthand for the set files, in the order the sliders appear. */
export function voice(
	size: number,
	weight: number,
	nasal: number,
	roughness = 0
): VoiceParams {
	return { size, weight, nasal, roughness }
}

/** The voice applied when nobody is hiding: a straight passthrough. */
export const neutralVoice: VoiceParams = voice(0, 0, 0, 0)

/**
 * How far each axis goes, and how much of the engine it is worth spending.
 *
 * `size` is deliberately the widest: an octave either way is the difference
 * between a lion and a parrot, and everything else is decoration beside it.
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
} as const

/**
 * Whether a voice is far enough from the speaker's own to be a disguise.
 *
 * Size is what carries it: two semitones is inside the range one person's
 * voice moves on its own, so anything smaller leaves them recognisable
 * however the other three are set. A rasp nobody has can carry it instead,
 * at any pitch.
 */
export function isDisguised(params: VoiceParams): boolean {
	const semitones = Math.abs(params.size) * VOICE_RANGE.sizeSemitones
	return semitones >= 2 || params.roughness >= 0.3
}
