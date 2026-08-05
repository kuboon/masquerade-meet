/**
 * The circus troupe: fifteen performers under the big top.
 *
 * Character ids are permanent once deployed — see the note in ./index.ts.
 * Adding to this list later is safe; renaming or removing is not.
 *
 * The voices are laid out in one pass, spread from 0.58 to 1.90 with a gap
 * between every neighbour so that no two performers can be mistaken for one
 * another. Nothing sits near 1.0: a ratio that close leaves the speaker
 * recognisable, which is the one thing a mask may not do. They have not been
 * listened to character by character — that is what /dev/voice is for, and
 * these numbers are meant to be replaced.
 */

import { tone, type CharacterSet } from '~/utils/characters'

export default {
	id: 'circus',
	name: 'サーカス団',
	tagline: '天幕の下に集まった、はぐれ者の一座',
	characters: [
		{
			id: 'lion',
			name: 'ライオン',
			emoji: '🦁',
			tagline: 'ごろごろ重低音',
			image: '/characters/circus/lion.png',
			voice: {
				pitchRatio: 0.58,
				vibratoRate: 0,
				vibratoDepth: 0,
				ringModHz: 0,
				ringModDepth: 0,
				tone: tone(6, 700, -3, 1, -6),
			},
		},
		{
			id: 'ringmaster',
			name: 'だんちょう',
			emoji: '🎩',
			tagline: '威厳のある低音',
			image: '/characters/circus/ringmaster.png',
			voice: {
				pitchRatio: 0.66,
				vibratoRate: 0,
				vibratoDepth: 0,
				ringModHz: 0,
				ringModDepth: 0,
				tone: tone(4, 900, -2, 1, -3),
			},
		},
		{
			id: 'firebreather',
			name: '火吹き男',
			emoji: '🔥',
			tagline: 'しゃがれた大声',
			image: '/characters/circus/firebreather.png',
			voice: {
				pitchRatio: 0.72,
				vibratoRate: 0,
				vibratoDepth: 0,
				// A little rasp rather than a robot: the carrier is low and the
				// wet amount small, so it roughens the voice instead of ringing.
				ringModHz: 38,
				ringModDepth: 0.18,
				tone: tone(1, 1600, 5, 1.4, 0),
			},
		},
		{
			id: 'organ',
			name: 'オルガン弾き',
			emoji: '🪗',
			tagline: 'しわがれた語り口',
			image: '/characters/circus/organ.png',
			voice: {
				pitchRatio: 0.8,
				vibratoRate: 0,
				vibratoDepth: 0,
				tone: tone(3, 1300, -4, 1.1, -1),
				ringModHz: 0,
				ringModDepth: 0,
			},
		},
		{
			id: 'magician',
			name: 'マジシャン',
			emoji: '🪄',
			tagline: 'しっとり低め',
			image: '/characters/circus/magician.png',
			voice: {
				pitchRatio: 0.88,
				vibratoRate: 0,
				vibratoDepth: 0,
				ringModHz: 0,
				ringModDepth: 0,
				tone: tone(2, 1100, -3, 1.2, 2),
			},
		},
		{
			id: 'knifethrower',
			name: 'ナイフ投げ',
			emoji: '🔪',
			tagline: '鋭くとがった声',
			image: '/characters/circus/knifethrower.png',
			voice: {
				pitchRatio: 0.94,
				vibratoRate: 0,
				vibratoDepth: 0,
				ringModHz: 0,
				ringModDepth: 0,
				tone: tone(-3, 2200, 4, 1.6, 3),
			},
		},
		{
			id: 'ticket',
			name: 'チケット係',
			emoji: '🎫',
			tagline: 'きっちり事務的',
			image: '/characters/circus/ticket.png',
			voice: {
				pitchRatio: 1.1,
				vibratoRate: 0,
				vibratoDepth: 0,
				ringModHz: 0,
				ringModDepth: 0,
				tone: tone(-1, 1800, 1, 1, 0),
			},
		},
		{
			id: 'popcorn',
			name: 'ポップコーン屋',
			emoji: '🍿',
			tagline: 'はずんだ売り声',
			image: '/characters/circus/popcorn.png',
			voice: {
				pitchRatio: 1.18,
				vibratoRate: 0,
				vibratoDepth: 0,
				ringModHz: 0,
				ringModDepth: 0,
				tone: tone(-2, 2400, 3, 1.2, 2),
			},
		},
		{
			id: 'juggler',
			name: 'ジャグラー',
			emoji: '🤹',
			tagline: '軽やかな早口',
			image: '/characters/circus/juggler.png',
			voice: {
				pitchRatio: 1.26,
				vibratoRate: 0,
				vibratoDepth: 0,
				ringModHz: 0,
				ringModDepth: 0,
				tone: tone(-2, 2600, 2, 1.4, 2),
			},
		},
		{
			id: 'clown',
			name: 'ピエロ',
			emoji: '🤡',
			tagline: 'ふるえる裏声',
			image: '/characters/circus/clown.png',
			voice: {
				pitchRatio: 1.34,
				vibratoRate: 6.5,
				vibratoDepth: 0.5,
				ringModHz: 0,
				ringModDepth: 0,
				tone: tone(-3, 2000, 4, 1.2, 3),
			},
		},
		{
			id: 'cottoncandy',
			name: 'わたあめ屋',
			emoji: '🍭',
			tagline: 'ふわふわ甘い声',
			image: '/characters/circus/cottoncandy.png',
			voice: {
				pitchRatio: 1.44,
				vibratoRate: 0,
				vibratoDepth: 0,
				ringModHz: 0,
				ringModDepth: 0,
				tone: tone(-2, 2200, 1, 0.9, 1),
			},
		},
		{
			id: 'dancer',
			name: 'ダンサー',
			emoji: '💃',
			tagline: 'よく通る高音',
			image: '/characters/circus/dancer.png',
			voice: {
				pitchRatio: 1.54,
				vibratoRate: 0,
				vibratoDepth: 0,
				ringModHz: 0,
				ringModDepth: 0,
				tone: tone(-3, 2500, 4, 1.1, 2),
			},
		},
		{
			id: 'ropewalker',
			name: 'つなわたり',
			emoji: '🎪',
			tagline: 'ふわり高音',
			image: '/characters/circus/ropewalker.png',
			voice: {
				pitchRatio: 1.64,
				vibratoRate: 3,
				vibratoDepth: 0.2,
				ringModHz: 0,
				ringModDepth: 0,
				tone: tone(-4, 2800, 3, 1, 3),
			},
		},
		{
			id: 'monkey',
			name: 'おさる',
			emoji: '🐒',
			tagline: 'きいきい騒がしい',
			image: '/characters/circus/monkey.png',
			voice: {
				pitchRatio: 1.76,
				vibratoRate: 8,
				vibratoDepth: 0.35,
				ringModHz: 0,
				ringModDepth: 0,
				tone: tone(-6, 3000, 5, 1.6, 3),
			},
		},
		{
			id: 'parrot',
			name: 'オウム',
			emoji: '🦜',
			tagline: 'かん高いしゃべり',
			image: '/characters/circus/parrot.png',
			voice: {
				pitchRatio: 1.9,
				vibratoRate: 0,
				vibratoDepth: 0,
				ringModHz: 0,
				ringModDepth: 0,
				tone: tone(-8, 3200, 6, 2, 4),
			},
		},
	],
} satisfies CharacterSet
