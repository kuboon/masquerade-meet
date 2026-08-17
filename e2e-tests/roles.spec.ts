import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import {
	card,
	installRoomSocket,
	leave,
	open,
	phase,
	send,
	user,
	userIds,
} from './roomSocket'

/**
 * Role cards, taken up with the room directly.
 *
 * A card is the one thing in this app that is deliberately not in the room
 * state, so there is nothing on any screen to look at and no way to check it
 * except by being the connection it was sent to. That is exactly what the
 * socket harness is: a page holding several participants, each with its own
 * inbox.
 */
test.describe.configure({ timeout: 90_000 })

const roomName = () => `roles-${Date.now()}-${Math.floor(Math.random() * 1000)}`

const deckOf = (page: Page, id: string) =>
	page.evaluate(
		(id) => window.__room.state[id]?.masquerade?.roleDeck ?? null,
		id
	) as Promise<string[] | null>

const gameMasterOf = (page: Page, id: string) =>
	page.evaluate(
		(id) => window.__room.state[id]?.masquerade?.gameMasterId ?? null,
		id
	) as Promise<string | null>

/** Everybody named, seated and waiting on the host to say go. */
async function lobbyOf(page: Page, room: string, ids: string[]) {
	await installRoomSocket(page)
	await page.goto('/')
	for (const id of ids) {
		await open(page, room, id)
		await send(page, id, { type: 'setDisplayName', name: id })
	}
	await expect.poll(() => userIds(page, ids[0])).toHaveLength(ids.length)
}

/** Says go and waits out the countdown. */
async function begin(page: Page, host: string, plan?: Record<string, string>) {
	await send(page, host, { type: 'startMeeting', rolePlan: plan })
	await expect
		.poll(() => phase(page, host), { timeout: 30_000 })
		.toBe('masquerade')
}

test('deals one card each, repeating the last one to fill the table', async ({
	page,
}) => {
	const room = roomName()
	const ids = ['aaa', 'bbb', 'ccc', 'ddd']
	await lobbyOf(page, room, ids)

	await send(page, 'aaa', { type: 'setRoleDeck', text: '人狼　占い師 村人' })
	// The deck is public: agreeing on which cards are in play is the whole
	// premise, and only who holds them is a secret.
	await expect
		.poll(() => deckOf(page, 'ddd'))
		.toEqual(['人狼', '占い師', '村人'])

	await begin(page, 'aaa')

	const dealt = []
	for (const id of ids) dealt.push((await card(page, id))?.role)
	expect(dealt.filter((r) => r === '人狼')).toHaveLength(1)
	expect(dealt.filter((r) => r === '占い師')).toHaveLength(1)
	expect(dealt.filter((r) => r === '村人')).toHaveLength(2)
})

test('keeps every card out of the room state until the reveal', async ({
	page,
}) => {
	const room = roomName()
	const ids = ['aaa', 'bbb']
	await lobbyOf(page, room, ids)
	await send(page, 'aaa', { type: 'setRoleDeck', text: '人狼 村人' })
	await begin(page, 'aaa')

	// Not merely hidden by the UI: not sent. Nobody's card is in anybody's
	// copy of the room state, their own included.
	for (const watcher of ids) {
		for (const of of ids) {
			expect((await user(page, watcher, of)).role).toBeUndefined()
		}
	}
	// And nobody is given the whole deal, because nobody is the game master.
	expect((await card(page, 'aaa'))?.deal).toBeFalsy()

	await send(page, 'aaa', { type: 'startReveal' })
	await expect
		.poll(() => phase(page, 'bbb'), { timeout: 30_000 })
		.toBe('revealed')

	// And then it is everybody's, which is what unmasking means here.
	const roles = []
	for (const of of ids) roles.push((await user(page, 'bbb', of)).role)
	expect(roles.sort()).toEqual(['人狼', '村人'])
})

test('leaves the game master out of the deal and tells them the rest of it', async ({
	page,
}) => {
	const room = roomName()
	const ids = ['aaa', 'bbb', 'ccc']
	await lobbyOf(page, room, ids)
	await send(page, 'aaa', { type: 'setRoleDeck', text: '人狼 村人' })
	await send(page, 'aaa', { type: 'setGameMaster', isGameMaster: true })
	await expect.poll(() => gameMasterOf(page, 'ccc')).toBe('aaa')

	await begin(page, 'aaa')

	const master = await card(page, 'aaa')
	expect(master?.role).toBeFalsy()
	// They dealt it, so they hold it: two players, and neither of them is them.
	expect(master?.deal).toEqual({
		bbb: expect.any(String),
		ccc: expect.any(String),
	})
	expect(Object.values(master!.deal!).sort()).toEqual(['人狼', '村人'])
	// The players get their own and nothing else.
	expect((await card(page, 'bbb'))?.deal).toBeFalsy()
	expect((await card(page, 'ccc'))?.role).toBeTruthy()
})

test('hands out the cards the game master asked for', async ({ page }) => {
	const room = roomName()
	const ids = ['aaa', 'bbb', 'ccc', 'ddd']
	await lobbyOf(page, room, ids)
	await send(page, 'aaa', { type: 'setRoleDeck', text: '人狼 占い師 村人' })
	await send(page, 'aaa', { type: 'setGameMaster', isGameMaster: true })

	await begin(page, 'aaa', { ccc: '人狼', bbb: '占い師' })

	expect((await card(page, 'ccc'))?.role).toBe('人狼')
	expect((await card(page, 'bbb'))?.role).toBe('占い師')
	expect((await card(page, 'ddd'))?.role).toBe('村人')
})

test('lets nobody but the host set up the game', async ({ page }) => {
	const room = roomName()
	await lobbyOf(page, room, ['aaa', 'bbb'])
	await send(page, 'aaa', { type: 'setRoleDeck', text: '人狼 村人' })

	// A guest with a socket and a text editor is the whole threat model here:
	// they can send anything the host can, so the room has to be the one
	// saying no.
	await send(page, 'bbb', { type: 'setRoleDeck', text: '村人 村人' })
	await send(page, 'bbb', { type: 'setGameMaster', isGameMaster: true })

	// Nothing to wait for — a refusal is silence — so this leans on the room
	// having answered the messages that came after it.
	await send(page, 'aaa', { type: 'setRoleDeck', text: '人狼 占い師 村人' })
	await expect
		.poll(() => deckOf(page, 'bbb'))
		.toEqual(['人狼', '占い師', '村人'])
	expect(await gameMasterOf(page, 'bbb')).toBeFalsy()
})

test('gives a card back to somebody who reloads, and only theirs', async ({
	page,
}) => {
	const room = roomName()
	const ids = ['aaa', 'bbb']
	await lobbyOf(page, room, ids)
	await send(page, 'aaa', { type: 'setRoleDeck', text: '人狼 村人' })
	await begin(page, 'aaa')

	const before = (await card(page, 'bbb'))?.role
	expect(before).toBeTruthy()

	// A real reload says goodbye on the way out, and the room deletes the
	// seat when it hears that — the card has to be somewhere else entirely to
	// still be there when the same connection id comes back.
	await leave(page, 'bbb')
	await open(page, room, 'bbb')
	await expect.poll(async () => (await card(page, 'bbb'))?.role).toBe(before)
})

test('takes the cards back when the host runs it again', async ({ page }) => {
	const room = roomName()
	const ids = ['aaa', 'bbb']
	await lobbyOf(page, room, ids)
	await send(page, 'aaa', { type: 'setRoleDeck', text: '人狼 村人' })
	await begin(page, 'aaa')
	expect((await card(page, 'bbb'))?.role).toBeTruthy()

	await send(page, 'aaa', { type: 'restartMeeting' })
	await expect.poll(() => phase(page, 'bbb')).toBe('lobby')
	// Empty hands in the lobby, and a deck still on the table for the next
	// round — that is what makes another game one button.
	await expect.poll(async () => (await card(page, 'bbb'))?.role).toBeFalsy()
	expect(await deckOf(page, 'bbb')).toEqual(['人狼', '村人'])
})
