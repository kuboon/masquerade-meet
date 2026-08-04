import { describe, expect, it } from 'vitest'
import { chatSender, linkify } from './textChat'

const message = { from: 'abc', nameWhenSent: 'くまごろう' }
const masked = [{ id: 'abc', name: 'くまごろう', characterId: 'bear' }]
const revealed = [{ id: 'abc', name: 'たなか', characterId: 'bear' }]
const bear = (characterId?: string) =>
	characterId === 'bear' ? 'くまごろう' : undefined

describe('chatSender', () => {
	it('shows the character while the room is masked', () => {
		expect(chatSender(message, masked)).toEqual({ name: 'くまごろう' })
	})

	it('shows the real name once the reveal has renamed the roster', () => {
		// The message has not changed — the roster has. This is the whole
		// mechanism: everything said from behind a mask is attributed the
		// instant the masks come off.
		expect(chatSender(message, revealed)).toEqual({ name: 'たなか' })
	})

	it('says which mask it was, once there is a name beside it', () => {
		expect(chatSender(message, revealed, bear)).toEqual({
			name: 'たなか',
			character: 'くまごろう',
		})
	})

	it('does not say the same name twice before the reveal', () => {
		// The roster is still serving character names here, so the mask and the
		// name are the same string.
		expect(chatSender(message, masked, bear)).toEqual({ name: 'くまごろう' })
	})

	it('falls back to the mask for somebody who has left', () => {
		// The room forgets a departed session's real name, so there is nothing
		// left to unmask them with — but their lines should not go anonymous.
		expect(
			chatSender(message, [{ id: 'someone-else', name: 'きつね' }], bear)
		).toEqual({ name: 'くまごろう' })
	})

	it('does not confuse two people who happen to share a name', () => {
		expect(
			chatSender(message, [
				{ id: 'xyz', name: 'たなか' },
				{ id: 'abc', name: 'さとう' },
			])
		).toEqual({ name: 'さとう' })
	})
})

describe('linkify', () => {
	it('leaves a message without links alone', () => {
		expect(linkify('こんばんは')).toEqual([
			{ type: 'text', value: 'こんばんは' },
		])
	})

	it('picks a link out of the middle of a sentence', () => {
		expect(linkify('これ https://example.com/a を見て')).toEqual([
			{ type: 'text', value: 'これ ' },
			{ type: 'link', value: 'https://example.com/a' },
			{ type: 'text', value: ' を見て' },
		])
	})

	it('leaves the full stop out of the link', () => {
		expect(linkify('https://example.com/a。')).toEqual([
			{ type: 'link', value: 'https://example.com/a' },
			{ type: 'text', value: '。' },
		])
		expect(linkify('see https://example.com.')).toEqual([
			{ type: 'text', value: 'see ' },
			{ type: 'link', value: 'https://example.com' },
			{ type: 'text', value: '.' },
		])
	})

	it('keeps a bracket the link opened and drops one it did not', () => {
		expect(linkify('(https://example.com/a)')).toEqual([
			{ type: 'text', value: '(' },
			{ type: 'link', value: 'https://example.com/a' },
			{ type: 'text', value: ')' },
		])
		expect(linkify('https://ja.wikipedia.org/wiki/Foo_(bar)')).toEqual([
			{ type: 'link', value: 'https://ja.wikipedia.org/wiki/Foo_(bar)' },
		])
	})

	it('finds every link in a message', () => {
		expect(
			linkify('https://a.example と https://b.example').filter(
				(p) => p.type === 'link'
			)
		).toEqual([
			{ type: 'link', value: 'https://a.example' },
			{ type: 'link', value: 'https://b.example' },
		])
	})

	it('is not a way to hand somebody a javascript: url', () => {
		// Assembled rather than written out: eslint objects to the literal, and
		// it is right to, which is rather the point of the test.
		const script = ['javascript', 'alert(1)'].join(':')
		expect(linkify(script)).toEqual([{ type: 'text', value: script }])
		// Nor a bare domain, which is as likely to be prose as an address.
		expect(linkify('example.com')).toEqual([
			{ type: 'text', value: 'example.com' },
		])
	})

	it('does not let a message close the tag it lands in', () => {
		expect(linkify('https://example.com/"><script>')).toEqual([
			{ type: 'link', value: 'https://example.com/' },
			{ type: 'text', value: '"><script>' },
		])
	})
})
