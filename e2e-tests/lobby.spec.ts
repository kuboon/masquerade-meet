import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { installRoomSocket, open, send, userIds } from './roomSocket'

/** The permission gate stands in front of the lobby on every load. */
async function pastPermissions(page: Page) {
	const allow = page.getByRole('button', { name: '権限を許可する' })
	await allow.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {})
	if (await allow.isVisible().catch(() => false)) await allow.click()
}

/**
 * Five seconds of the fake capture device, left to stop itself.
 *
 * Cutting the recording short is what a person would do, but it races the
 * recorder: too little audio to decode and the page reports that instead of
 * offering playback. The tests below are about the sliders, not about how
 * short a clip the decoder will take.
 */
async function record(page: Page) {
	await page.getByRole('button', { name: '声を録音する' }).click()
	await expect(page.getByRole('button', { name: '録音を止める' })).toBeVisible()
	await expect(page.getByRole('button', { name: '録音し直す' })).toBeVisible({
		timeout: 20_000,
	})
	await expect(
		page.getByRole('button', { name: '変換した声を聴く' })
	).toBeVisible({ timeout: 20_000 })
}

const room = () => `lobby-${Date.now()}-${Math.floor(Math.random() * 1000)}`

// Everything here waits on something real — five seconds of recording, ten
// of countdown — so the default budget is not enough on a loaded machine.
test.describe.configure({ timeout: 90_000 })

test('walks everybody in on the deadline, with nobody asked to say they are ready', async ({
	browser,
}) => {
	const name = room()

	// The host is a socket rather than a second lobby: the start button is
	// dead without a Cloudflare Realtime session, which is out of reach here.
	// Whoever arrives first runs the room, so this connects before the page
	// under test does.
	const backstage = await browser.newPage()
	await installRoomSocket(backstage)
	await backstage.goto('/')
	await open(backstage, name, 'host')
	await send(backstage, 'host', { type: 'setDisplayName', name: 'ホスト' })

	const page = await browser.newPage()
	await page.goto(`/${name}`)
	await pastPermissions(page)
	// Wait for the room itself to see both of them: the lobby's own headcount
	// is downstream of that, and asserting on it first only ever produces a
	// less informative timeout.
	await expect
		.poll(() => userIds(backstage, 'host'), { timeout: 30_000 })
		.toHaveLength(2)
	await expect(page.getByText('2人が待機中')).toBeVisible({ timeout: 20_000 })

	// A name is the whole of the entry requirement. Nothing else is asked
	// for, and there is no readiness to declare.
	await page.getByLabel('名前').fill('ゲスト')
	await expect(page.getByRole('button', { name: '準備完了' })).toHaveCount(0)

	await send(backstage, 'host', { type: 'startMeeting' })

	// The countdown reaches the people who did not press anything.
	await expect(page.getByText('まもなく始まります')).toBeVisible({
		timeout: 10_000,
	})
	await expect(page.getByText(/まもなく始まります（\d+秒）/)).toBeVisible()

	// And the deadline carries them in without another click.
	await expect(page).toHaveURL(new RegExp(`/${name}/room`), { timeout: 30_000 })
})

test('lets somebody hear and retune their voice before the meeting', async ({
	page,
}) => {
	await page.goto(`/${room()}`)
	await pastPermissions(page)

	// Nothing to tune until there is something to listen to.
	await expect(page.getByRole('slider')).toHaveCount(0)

	await record(page)

	// Four controls, and no more: the whole of what a person tunes fits on
	// one screen. The character's own throat is not among them — that one
	// belongs to the mask, and survives everything done here.
	const sliders = page.getByRole('slider')
	await expect(sliders).toHaveCount(4)
	await expect(
		page.getByText('いまはキャラクターの声です。動かすとあなたの声になります。')
	).toBeVisible()

	// Touching one takes ownership of the voice, and the browser keeps it.
	await sliders.first().fill('0.5')
	await expect(page.getByText('この声はこのブラウザに覚えてあり')).toBeVisible()

	await page.getByRole('button', { name: 'キャラクターの声にもどす' }).click()
	await expect(
		page.getByText('いまはキャラクターの声です。動かすとあなたの声になります。')
	).toBeVisible()
})

test('says so when the sliders leave you sounding like yourself', async ({
	page,
}) => {
	await page.goto(`/${room()}`)
	await pastPermissions(page)

	await record(page)

	const warning = page.getByText('いまの設定では地声とほとんど変わりません')
	// Whichever character the room dealt, it is a disguise to begin with.
	await expect(warning).toHaveCount(0)

	// Two ways to be unrecognisable, and this gives up both: a body the size
	// of your own, said in your own clean voice.
	await page.getByLabel('体の大きさ (数値)').fill('0')
	await page.getByLabel('かすれ (数値)').fill('0')
	await expect(warning).toBeVisible()

	// Either one on its own is enough to hide behind.
	await page.getByLabel('かすれ (数値)').fill('0.5')
	await expect(warning).toHaveCount(0)
	await page.getByLabel('かすれ (数値)').fill('0')
	await page.getByLabel('体の大きさ (数値)').fill('-0.5')
	await expect(warning).toHaveCount(0)
})

test('keeps the host quiet until they ask to be heard', async ({ browser }) => {
	const name = room()

	// Whoever arrives first runs the room, so this page is the host.
	const host = await browser.newPage()
	await host.goto(`/${name}`)
	await pastPermissions(host)

	const invitation = host.getByText(
		'オンにすると、変換なしの地声で全員に話せます'
	)
	const live = host.getByText('あなたの声がそのまま全員に聞こえています')

	// Off to begin with, whatever the microphone itself is doing: this is the
	// one place an unprocessed voice leaves the browser, and it costs the
	// host their own reveal.
	const speak = host.getByLabel('待っている人に声をかける')
	await expect(speak).toBeVisible({ timeout: 20_000 })
	await expect(speak).not.toBeChecked()
	await expect(invitation).toBeVisible()
	await expect(live).toHaveCount(0)

	await speak.click()
	await expect(speak).toBeChecked()
	await expect(live).toBeVisible()
	await expect(invitation).toHaveCount(0)

	// Nobody else is offered it. A guest's microphone reaches no one in the
	// lobby, disguised or not, so there is nothing to tell them about.
	const guest = await browser.newPage()
	await guest.goto(`/${name}`)
	await pastPermissions(guest)
	await expect(guest.getByText('2人が待機中')).toBeVisible({ timeout: 20_000 })
	await expect(guest.getByLabel('待っている人に声をかける')).toHaveCount(0)
	await expect(
		guest.getByText('あなたの声がそのまま全員に聞こえています')
	).toHaveCount(0)
})

test('hands a contested character to whoever took it first', async ({
	browser,
}) => {
	const name = room()

	// The rival is a socket: two browsers cannot be made to click together,
	// and the race itself is covered in character-lock.spec.ts. What matters
	// here is what the lobby shows once somebody else has won.
	const backstage = await browser.newPage()
	await installRoomSocket(backstage)
	await backstage.goto('/')
	await open(backstage, name, 'rival')
	await send(backstage, 'rival', {
		type: 'selectCharacter',
		characterId: 'bear',
	})
	await send(backstage, 'rival', { type: 'confirmCharacter' })

	const page = await browser.newPage()
	await page.goto(`/${name}`)
	await pastPermissions(page)
	await expect(page.getByText('2人が待機中')).toBeVisible({ timeout: 20_000 })

	// Taken, and shown to be, before anybody wastes a click on it.
	await expect(page.getByText('1/2人が確定済み')).toBeVisible()
	const bear = page.getByRole('button', { name: 'くまごろう' })
	await expect(bear).toBeDisabled()

	// Anything else is still free, and free to be shared until it is taken.
	const confirm = page.getByRole('button', { name: 'このキャラクターに決める' })
	await page.getByRole('button', { name: 'うさぴょん' }).click()
	await expect(confirm).toBeEnabled()
	await confirm.click()

	await expect(
		page.getByRole('button', { name: 'このキャラクターで確定済み' })
	).toBeDisabled()
	await expect(page.getByText('2/2人が確定済み')).toBeVisible()
	// And it stays theirs: the picker is closed rather than merely marked.
	await expect(page.getByRole('button', { name: 'こんきち' })).toBeDisabled()
	await expect(
		page.getByText('声を調整しても、もうキャラクターは変わりません')
	).toBeVisible()
})
