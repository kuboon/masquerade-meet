import { expect, test } from '@playwright/test'
import {
	deliveredSet,
	installRoomSocket,
	masquerade,
	open,
	user,
} from './roomSocket'

/**
 * Which roster a room ends up wearing, taken up with the room directly.
 *
 * A room settles this once, on the connection that opens it, and never again
 * — so the interesting cases are all about what a later connection cannot do
 * and what happens when the roster it was pointed at is not there.
 *
 * The one thing here that is not end-to-end is a borrowed roster that loads:
 * the room will only fetch over https and the dev server is http, so the
 * happy path is covered by unit tests around `fetchExternalCharacterSet`
 * instead. What these tests cover is everything the Durable Object does with
 * the answer, which is where a room can be left wearing the wrong faces.
 */
const roomName = () => `sets-${Date.now()}-${Math.floor(Math.random() * 1000)}`

/** An https address that is guaranteed to resolve to nothing, by RFC 6761. */
const nowhere = 'https://masquerade.invalid/set.json'

test.beforeEach(async ({ page }) => {
	await installRoomSocket(page)
	await page.goto('/')
})

test('wears the built-in set the room was opened with', async ({ page }) => {
	const room = roomName()
	await open(page, room, 'aaa', 'set=circus')
	await expect
		.poll(async () => (await masquerade(page, 'aaa'))?.characterSetId)
		.toBe('circus')
	// Nothing is sent: every browser already has this roster in its bundle,
	// and putting it on the wire would be paying for it twice.
	expect(await deliveredSet(page, 'aaa')).toBeNull()
	expect(await user(page, 'aaa')).toBeTruthy()
})

test('keeps the set it opened with when a latecomer asks for another', async ({
	page,
}) => {
	const room = roomName()
	await open(page, room, 'aaa', 'set=circus')
	await expect
		.poll(async () => (await masquerade(page, 'aaa'))?.characterSetId)
		.toBe('circus')

	// A guest with a URL bar is the threat model: half the room has already
	// chosen faces from one roster, and swapping it now would strand them.
	await open(page, room, 'bbb', 'set=animals')
	await expect
		.poll(async () => (await masquerade(page, 'bbb'))?.characterSetId)
		.toBe('circus')
	expect((await masquerade(page, 'aaa'))?.characterSetId).toBe('circus')
})

test('opens anyway when the borrowed roster is not there', async ({ page }) => {
	const room = roomName()
	await open(page, room, 'aaa', `set=${encodeURIComponent(nowhere)}`)

	// The room is the thing that has to survive this. Somebody's link was
	// wrong or their server is down; that is not a reason for the people who
	// showed up to have no meeting.
	await expect
		.poll(async () => (await masquerade(page, 'aaa'))?.characterSetId, {
			timeout: 20_000,
		})
		.toBe('animals')
	// And they are told, rather than quietly handed different faces than the
	// ones the link they followed showed them.
	expect((await masquerade(page, 'aaa'))?.characterSetProblem).toBeTruthy()
	expect(await deliveredSet(page, 'aaa')).toBeNull()
	// A face out of the fallback roster, not nothing.
	expect((await user(page, 'aaa')).characterId).toBeTruthy()
})

test('does not go back for a roster that already failed', async ({ page }) => {
	const room = roomName()
	await open(page, room, 'aaa', `set=${encodeURIComponent(nowhere)}`)
	await expect
		.poll(async () => (await masquerade(page, 'aaa'))?.characterSetProblem, {
			timeout: 20_000,
		})
		.toBeTruthy()

	// The failure is pinned like any other answer, so the second person is
	// not made to wait out the same dead server — and the room does not spend
	// a fetch on every arrival for the rest of the meeting.
	const before = Date.now()
	await open(page, room, 'bbb', `set=${encodeURIComponent(nowhere)}`)
	await expect
		.poll(async () => (await masquerade(page, 'bbb'))?.characterSetId)
		.toBe('animals')
	expect(Date.now() - before).toBeLessThan(4_000)
})

test('ignores a set nobody has', async ({ page }) => {
	const room = roomName()
	await open(page, room, 'aaa', 'set=not-a-real-set')
	await expect
		.poll(async () => (await masquerade(page, 'aaa'))?.characterSetId)
		.toBe('animals')
	// An unknown id is a typo, not a borrowed roster that failed — there is
	// nothing to report and nothing that went wrong.
	expect((await masquerade(page, 'aaa'))?.characterSetProblem).toBeFalsy()
})

test('sends nothing at all to a room that borrowed nothing', async ({
	page,
}) => {
	const room = roomName()
	await open(page, room, 'aaa')
	// Room state having arrived is what makes the absence meaningful: the
	// roster is sent ahead of it on the same socket, so if this is here and
	// that is not, there was never one to send.
	await expect.poll(() => masquerade(page, 'aaa')).toBeTruthy()
	expect(await deliveredSet(page, 'aaa')).toBeNull()
})
