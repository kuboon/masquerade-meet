import { describe, expect, it } from 'vitest'
import { chatSenderName } from './textChat'

const message = { from: 'abc', nameWhenSent: 'くまごろう' }

describe('chatSenderName', () => {
	it('shows the character while the room is masked', () => {
		expect(chatSenderName(message, [{ id: 'abc', name: 'くまごろう' }])).toBe(
			'くまごろう'
		)
	})

	it('shows the real name once the reveal has renamed the roster', () => {
		// The message has not changed — the roster has. This is the whole
		// mechanism: everything said from behind a mask is attributed the
		// instant the masks come off.
		expect(chatSenderName(message, [{ id: 'abc', name: 'たなか' }])).toBe(
			'たなか'
		)
	})

	it('falls back to the mask for somebody who has left', () => {
		// The room forgets a departed session's real name, so there is nothing
		// left to unmask them with — but their lines should not go anonymous.
		expect(
			chatSenderName(message, [{ id: 'someone-else', name: 'きつね' }])
		).toBe('くまごろう')
	})

	it('does not confuse two people who happen to share a name', () => {
		expect(
			chatSenderName(message, [
				{ id: 'xyz', name: 'たなか' },
				{ id: 'abc', name: 'さとう' },
			])
		).toBe('さとう')
	})
})
