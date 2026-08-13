import { expect, test } from '@playwright/test'
import { installRoomSocket, open, send, user, userIds } from './roomSocket'

/**
 * Taking a character, taken up with the room directly.
 *
 * Two people pressing the same button at the same moment is the whole point
 * of this feature, and it is not something a pair of browser windows can be
 * made to do on cue. Over the socket both messages can be put on the wire
 * from one turn of the event loop, which is as close to simultaneous as the
 * room will ever see.
 */
const roomName = () => `lock-${Date.now()}-${Math.floor(Math.random() * 1000)}`

test('lets several people want one character, and one of them have it', async ({
	page,
}) => {
	const room = roomName()
	await installRoomSocket(page)
	await page.goto('/')
	for (const id of ['aaa', 'bbb']) await open(page, room, id)
	await expect.poll(() => userIds(page, 'aaa')).toHaveLength(2)

	// Both want the bear, and the room lets them: a wish is not a claim.
	for (const id of ['aaa', 'bbb']) {
		await send(page, id, { type: 'selectCharacter', characterId: 'bear' })
	}
	await expect
		.poll(() => user(page, 'aaa', 'aaa'))
		.toMatchObject({
			characterId: 'bear',
			characterConfirmed: false,
		})
	await expect
		.poll(() => user(page, 'aaa', 'bbb'))
		.toMatchObject({
			characterId: 'bear',
			characterConfirmed: false,
		})

	// Both confirm without waiting for the other, on the same turn.
	await page.evaluate(() => {
		window.__room.send('aaa', { type: 'confirmCharacter' })
		window.__room.send('bbb', { type: 'confirmCharacter' })
	})

	await expect
		.poll(async () => {
			const [a, b] = await Promise.all([
				user(page, 'aaa', 'aaa'),
				user(page, 'aaa', 'bbb'),
			])
			return [a?.characterConfirmed, b?.characterConfirmed]
		})
		.toContain(true)

	const [a, b] = await Promise.all([
		user(page, 'aaa', 'aaa'),
		user(page, 'aaa', 'bbb'),
	])
	// Exactly one, and the other is still only wishing.
	expect([a.characterConfirmed, b.characterConfirmed].filter(Boolean)).toEqual([
		true,
	])
	const loser = a.characterConfirmed ? 'bbb' : 'aaa'

	// And the loser cannot pick it up afterwards either, however they ask.
	await send(page, loser, { type: 'selectCharacter', characterId: 'bear' })
	await send(page, loser, { type: 'confirmCharacter' })
	await expect
		.poll(() => user(page, 'aaa', loser))
		.toMatchObject({ characterConfirmed: false })
})

test('will not let anybody change their mind once they have taken one', async ({
	page,
}) => {
	const room = roomName()
	await installRoomSocket(page)
	await page.goto('/')
	await open(page, room, 'aaa')

	await send(page, 'aaa', { type: 'selectCharacter', characterId: 'bear' })
	await send(page, 'aaa', { type: 'confirmCharacter' })
	await expect
		.poll(() => user(page, 'aaa', 'aaa'))
		.toMatchObject({ characterId: 'bear', characterConfirmed: true })

	// This is the promise that makes tuning a voice to a face worth doing.
	await send(page, 'aaa', { type: 'selectCharacter', characterId: 'rabbit' })
	await expect
		.poll(() => user(page, 'aaa', 'aaa'))
		.toMatchObject({ characterId: 'bear' })
})

test('settles everybody who never decided when the meeting begins', async ({
	page,
}) => {
	const room = roomName()
	await installRoomSocket(page)
	await page.goto('/')
	for (const id of ['aaa', 'bbb']) {
		await open(page, room, id)
		await send(page, id, { type: 'setDisplayName', name: id })
	}
	await expect.poll(() => userIds(page, 'aaa')).toHaveLength(2)

	// One takes the bear; the other wants it too and never says so out loud.
	await send(page, 'aaa', { type: 'selectCharacter', characterId: 'bear' })
	await send(page, 'aaa', { type: 'confirmCharacter' })
	await expect
		.poll(() => user(page, 'aaa', 'aaa'))
		.toMatchObject({ characterConfirmed: true })

	await send(page, 'aaa', { type: 'startMeeting' })
	await expect
		.poll(() => user(page, 'aaa', 'bbb'), { timeout: 30_000 })
		.toMatchObject({ characterConfirmed: true })

	const [a, b] = await Promise.all([
		user(page, 'aaa', 'aaa'),
		user(page, 'aaa', 'bbb'),
	])
	// The one who took it keeps it, and the draw finds the other another.
	expect(a.characterId).toBe('bear')
	expect(b.characterId).not.toBe('bear')
	expect(b.characterId).toBeTruthy()
})
