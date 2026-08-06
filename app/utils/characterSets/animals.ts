/**
 * The stock set: twelve animals, and three things that are not.
 *
 * Character ids are permanent once deployed — see the note in ./index.ts.
 */

import { voice, type CharacterSet } from '~/utils/characters'

export default {
	id: 'animals',
	name: 'どうぶつさん',
	tagline: 'くまからライオンまで、なじみのある 15 匹',
	banner: '/characters/animals/banner.webp',
	characters: [
		{
			id: 'bear',
			name: 'くまごろう',
			emoji: '🐻',
			tagline: 'のっそり低音',
			image: '/characters/animals/bear.png',
			voice: voice(-0.62, -0.55, -0.25),
		},
		{
			id: 'rabbit',
			name: 'うさぴょん',
			emoji: '🐰',
			tagline: 'ぴょこぴょこ高音',
			image: '/characters/animals/rabbit.png',
			voice: voice(0.82, 0.45, 0.35),
		},
		{
			id: 'fox',
			name: 'こんきち',
			emoji: '🦊',
			tagline: 'すこし高めの早口',
			image: '/characters/animals/fox.png',
			voice: voice(0.44, 0.35, 0.45),
		},
		{
			id: 'tanuki',
			name: 'ぽんぽこ',
			emoji: '🦝',
			tagline: 'まるっと落ち着いた声',
			image: '/characters/animals/tanuki.png',
			voice: voice(-0.4, -0.35, -0.4),
		},
		{
			id: 'cat',
			name: 'にゃんきち',
			emoji: '🐱',
			tagline: 'つんとした高音',
			image: '/characters/animals/cat.png',
			voice: voice(0.69, 0.3, 0.6),
		},
		{
			id: 'dog',
			name: 'わんすけ',
			emoji: '🐶',
			tagline: 'ちょっとだけ低い',
			image: '/characters/animals/dog.png',
			voice: voice(-0.18, 0.1, 0.1, 0.15),
		},
		{
			id: 'owl',
			name: 'ふくろうはかせ',
			emoji: '🦉',
			tagline: 'こもった重低音',
			image: '/characters/animals/owl.png',
			voice: voice(-0.73, -0.7, -0.55),
		},
		{
			id: 'penguin',
			name: 'ぺんぺん',
			emoji: '🐧',
			tagline: 'ぱたぱた明るい声',
			image: '/characters/animals/penguin.png',
			voice: voice(0.56, 0.55, 0.15),
		},
		{
			id: 'frog',
			name: 'けろすけ',
			emoji: '🐸',
			tagline: 'げこげこ潰れ声',
			image: '/characters/animals/frog.png',
			voice: voice(-0.51, -0.15, 0.3, 0.55),
		},
		{
			id: 'sheep',
			name: 'めーちゃん',
			emoji: '🐑',
			tagline: 'ふるえる甘い声',
			image: '/characters/animals/sheep.png',
			voice: voice(0.31, 0.2, 0.55, 0.3),
		},
		{
			id: 'dragon',
			name: 'どらごん',
			emoji: '🐲',
			tagline: '地の底からの声',
			image: '/characters/animals/dragon.png',
			voice: voice(-0.95, -0.45, -0.15, 0.35),
		},
		{
			id: 'robot',
			name: 'ロボ丸',
			emoji: '🤖',
			tagline: 'ビリビリ電子音',
			image: '/characters/animals/robot.png',
			// the disguise here comes from the ring modulator, not the pitch
			voice: voice(0.18, 0.25, 0.2, 0.85),
		},
		{
			id: 'alien',
			name: 'うちゅうくん',
			emoji: '👽',
			tagline: 'きんきん宇宙声',
			image: '/characters/animals/alien.png',
			voice: voice(0.95, 0.7, 0.5, 0.2),
		},
		{
			id: 'ghost',
			name: 'おばけん',
			emoji: '👻',
			tagline: 'ゆらゆら不気味な声',
			image: '/characters/animals/ghost.png',
			voice: voice(-0.29, -0.25, -0.65, 0.25),
		},
		{
			id: 'lion',
			name: 'らいおん丸',
			emoji: '🦁',
			tagline: 'どっしり太い声',
			image: '/characters/animals/lion.png',
			voice: voice(-0.84, -0.6, -0.05, 0.2),
		},
	],
} satisfies CharacterSet
