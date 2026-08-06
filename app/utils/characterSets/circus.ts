/**
 * The circus troupe: fifteen performers under the big top.
 *
 * Character ids are permanent once deployed — see the note in ./index.ts.
 * Adding to this list later is safe; renaming or removing is not.
 *
 * The voices run bottom to top by size, with a gap between every neighbour
 * so that no two performers can be mistaken for one another, and nobody sits
 * near zero: a body the same size as your own leaves you recognisable, which
 * is the one thing a mask may not do. They have not been listened to
 * character by character — that is what /dev/voice is for.
 */

import { voice, type CharacterSet } from '~/utils/characters'

export default {
	id: 'circus',
	name: 'サーカス団',
	tagline: '天幕の下に集まった、はぐれ者の一座',
	banner: '/characters/circus/banner.webp',
	characters: [
		{
			id: 'lion',
			name: 'ライオン',
			emoji: '🦁',
			tagline: 'ごろごろ重低音',
			image: '/characters/circus/lion.png',
			voice: voice(-0.95, -0.6, -0.05, 0.2),
		},
		{
			id: 'ringmaster',
			name: 'だんちょう',
			emoji: '🎩',
			tagline: '威厳のある低音',
			image: '/characters/circus/ringmaster.png',
			voice: voice(-0.8, -0.4, -0.2),
		},
		{
			id: 'firebreather',
			name: '火吹き男',
			emoji: '🔥',
			tagline: 'しゃがれた大声',
			image: '/characters/circus/firebreather.png',
			voice: voice(-0.64, -0.1, 0.25, 0.6),
		},
		{
			id: 'organ',
			name: 'オルガン弾き',
			emoji: '🪗',
			tagline: 'しわがれた語り口',
			image: '/characters/circus/organ.png',
			voice: voice(-0.49, -0.3, -0.45, 0.3),
		},
		{
			id: 'magician',
			name: 'マジシャン',
			emoji: '🪄',
			tagline: 'しっとり低め',
			image: '/characters/circus/magician.png',
			voice: voice(-0.33, -0.2, 0.05),
		},
		{
			id: 'knifethrower',
			name: 'ナイフ投げ',
			emoji: '🔪',
			tagline: '鋭くとがった声',
			image: '/characters/circus/knifethrower.png',
			voice: voice(-0.18, 0.3, 0.35, 0.1),
		},
		{
			id: 'ticket',
			name: 'チケット係',
			emoji: '🎫',
			tagline: 'きっちり事務的',
			image: '/characters/circus/ticket.png',
			voice: voice(0.18, 0.05, 0.0),
		},
		{
			id: 'popcorn',
			name: 'ポップコーン屋',
			emoji: '🍿',
			tagline: 'はずんだ売り声',
			image: '/characters/circus/popcorn.png',
			voice: voice(0.37, 0.45, 0.2),
		},
		{
			id: 'juggler',
			name: 'ジャグラー',
			emoji: '🤹',
			tagline: '軽やかな早口',
			image: '/characters/circus/juggler.png',
			voice: voice(0.47, 0.35, 0.5),
		},
		{
			id: 'clown',
			name: 'ピエロ',
			emoji: '🤡',
			tagline: 'ふるえる裏声',
			image: '/characters/circus/clown.png',
			voice: voice(0.66, 0.25, 0.65, 0.25),
		},
		{
			id: 'cottoncandy',
			name: 'わたあめ屋',
			emoji: '🍭',
			tagline: 'ふわふわ甘い声',
			image: '/characters/circus/cottoncandy.png',
			voice: voice(0.28, 0.15, -0.2),
		},
		{
			id: 'dancer',
			name: 'ダンサー',
			emoji: '💃',
			tagline: 'よく通る高音',
			image: '/characters/circus/dancer.png',
			voice: voice(0.57, 0.5, 0.1),
		},
		{
			id: 'ropewalker',
			name: 'つなわたり',
			emoji: '🎪',
			tagline: 'ふわり高音',
			image: '/characters/circus/ropewalker.png',
			voice: voice(0.76, 0.6, -0.15),
		},
		{
			id: 'monkey',
			name: 'おさる',
			emoji: '🐒',
			tagline: 'きいきい騒がしい',
			image: '/characters/circus/monkey.png',
			voice: voice(0.86, 0.4, 0.55, 0.35),
		},
		{
			id: 'parrot',
			name: 'オウム',
			emoji: '🦜',
			tagline: 'かん高いしゃべり',
			image: '/characters/circus/parrot.png',
			voice: voice(0.95, 0.75, 0.7, 0.15),
		},
	],
} satisfies CharacterSet
