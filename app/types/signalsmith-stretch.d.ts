/**
 * Hand-written types for `signalsmith-stretch`, which ships none.
 *
 * Only the parts we use. The library's own README is the reference for the
 * rest: https://github.com/Signalsmith-Audio/signalsmith-stretch
 */
declare module 'signalsmith-stretch' {
	export interface StretchSchedule {
		/** audio context time for this change; immediate if left out */
		output?: number
		/** whether it is processing audio at all */
		active?: boolean
		/** pitch shift */
		semitones?: number
		/** above this, content is treated as noise rather than tone */
		tonalityHz?: number
		/**
		 * Formant shift. On its own it is absolute; with
		 * `formantCompensation` it is measured from where the formants
		 * already were, so 0 holds them still against the pitch shift.
		 */
		formantSemitones?: number
		formantCompensation?: boolean
		/** rough fundamental for formant analysis, or 0 to track the pitch */
		formantBaseHz?: number
	}

	export interface StretchConfig {
		/** analysis block length; 0 or null falls back to `preset` */
		blockMs?: number | null
		intervalMs?: number
		/** spread the work across time rather than doing it in bursts */
		splitComputation?: boolean
		preset?: 'default' | 'cheaper'
	}

	export interface StretchNode extends AudioWorkletNode {
		schedule(change: StretchSchedule): Promise<void>
		configure(config: StretchConfig): Promise<void>
		/** processing delay in live-input mode, in seconds */
		latency(): Promise<number>
		start(when?: number): Promise<void>
		stop(when?: number): Promise<void>
	}

	export default function SignalsmithStretch(
		context: BaseAudioContext,
		options?: AudioWorkletNodeOptions
	): Promise<StretchNode>
}
