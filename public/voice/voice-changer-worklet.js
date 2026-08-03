/**
 * Real-time voice disguiser.
 *
 * Pitch shifting is done with the classic two-tap delay-line technique: a
 * circular buffer is read back by two taps whose delay drifts at a rate
 * proportional to (1 - pitchRatio). Each tap is windowed with a raised
 * cosine and the two windows are half a period apart, so they always sum to
 * exactly 1 and the crossfade is inaudible. It is cheap enough to run on
 * every participant's machine and mangles formants along with pitch, which
 * is exactly what we want for a disguise.
 *
 * A vibrato LFO and a ring modulator are layered on top to give characters
 * that share a pitch ratio a distinct texture.
 */

/* global sampleRate */

const GRAIN_SIZE = 1024
const BUFFER_SIZE = 8192
const BUFFER_MASK = BUFFER_SIZE - 1
// Keeps the read taps comfortably behind the write head at all times.
const BASE_DELAY = GRAIN_SIZE
const MAX_VIBRATO_SAMPLES = 220
const TWO_PI = Math.PI * 2

class VoiceChangerProcessor extends AudioWorkletProcessor {
	static get parameterDescriptors() {
		return [
			{
				name: 'pitchRatio',
				defaultValue: 1,
				minValue: 0.25,
				maxValue: 4,
				automationRate: 'k-rate',
			},
			{
				name: 'vibratoRate',
				defaultValue: 0,
				minValue: 0,
				maxValue: 20,
				automationRate: 'k-rate',
			},
			{
				name: 'vibratoDepth',
				defaultValue: 0,
				minValue: 0,
				maxValue: 1,
				automationRate: 'k-rate',
			},
			{
				name: 'ringModHz',
				defaultValue: 0,
				minValue: 0,
				maxValue: 4000,
				automationRate: 'k-rate',
			},
			{
				name: 'ringModDepth',
				defaultValue: 0,
				minValue: 0,
				maxValue: 1,
				automationRate: 'k-rate',
			},
		]
	}

	constructor() {
		super()
		this.buffer = new Float32Array(BUFFER_SIZE)
		this.writeIndex = 0
		// position within the grain, 0..1
		this.grainPhase = 0
		this.lfoPhase = 0
		this.ringPhase = 0
	}

	read(delay) {
		let pos = this.writeIndex - delay
		while (pos < 0) pos += BUFFER_SIZE
		const i0 = Math.floor(pos)
		const frac = pos - i0
		const a = this.buffer[i0 & BUFFER_MASK]
		const b = this.buffer[(i0 + 1) & BUFFER_MASK]
		return a + (b - a) * frac
	}

	process(inputs, outputs, parameters) {
		const output = outputs[0]
		if (!output || output.length === 0) return true

		const input = inputs[0]
		const inputChannel = input && input.length > 0 ? input[0] : null
		const outputChannel = output[0]
		const frames = outputChannel.length

		const pitchRatio = parameters.pitchRatio[0]
		const vibratoRate = parameters.vibratoRate[0]
		const vibratoDepth = parameters.vibratoDepth[0]
		const ringModHz = parameters.ringModHz[0]
		const ringModDepth = parameters.ringModDepth[0]

		const grainStep = (1 - pitchRatio) / GRAIN_SIZE
		const lfoStep = vibratoRate / sampleRate
		const ringStep = ringModHz / sampleRate
		const vibratoAmount = vibratoDepth * MAX_VIBRATO_SAMPLES
		const ringActive = ringModHz > 0 && ringModDepth > 0

		for (let i = 0; i < frames; i++) {
			this.buffer[this.writeIndex] = inputChannel ? inputChannel[i] : 0

			let phase1 = this.grainPhase
			let phase2 = phase1 + 0.5
			if (phase2 >= 1) phase2 -= 1

			// Raised cosine windows half a period apart sum to exactly 1.
			const window1 = 0.5 - 0.5 * Math.cos(TWO_PI * phase1)
			const window2 = 0.5 - 0.5 * Math.cos(TWO_PI * phase2)

			const vibrato =
				vibratoAmount > 0 ? vibratoAmount * Math.sin(TWO_PI * this.lfoPhase) : 0
			const offset = BASE_DELAY + MAX_VIBRATO_SAMPLES + vibrato

			let sample =
				window1 * this.read(offset + phase1 * GRAIN_SIZE) +
				window2 * this.read(offset + phase2 * GRAIN_SIZE)

			if (ringActive) {
				const carrier = Math.cos(TWO_PI * this.ringPhase)
				sample = sample * (1 - ringModDepth + ringModDepth * carrier)
				this.ringPhase += ringStep
				if (this.ringPhase >= 1) this.ringPhase -= 1
			}

			outputChannel[i] = sample

			this.grainPhase += grainStep
			if (this.grainPhase >= 1) this.grainPhase -= 1
			else if (this.grainPhase < 0) this.grainPhase += 1

			if (lfoStep > 0) {
				this.lfoPhase += lfoStep
				if (this.lfoPhase >= 1) this.lfoPhase -= 1
			}

			this.writeIndex = (this.writeIndex + 1) & BUFFER_MASK
		}

		// Mono in, same signal out of every output channel.
		for (let c = 1; c < output.length; c++) {
			output[c].set(outputChannel)
		}

		return true
	}
}

registerProcessor('voice-changer', VoiceChangerProcessor)
