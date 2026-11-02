import {
	ArrowRightIcon,
	CheckIcon,
	PlayIcon,
	VideoCameraSlashIcon,
} from '@heroicons/react/20/solid'
import type { LinksFunction } from '@remix-run/cloudflare'
import { Form, useNavigate } from '@remix-run/react'
import { nanoid } from 'nanoid'
import type { ReactNode } from 'react'
import { CharacterSetChooser } from '~/components/CharacterSetChooser'
import { Disclaimer } from '~/components/Disclaimer'
import { ExternalSetField } from '~/components/ExternalSetField'
import { characterSets } from '~/utils/characterSets'
import { chosenSet } from '~/utils/chosenSet'
import { cn } from '~/utils/style'

export const links: LinksFunction = () => [
	{ rel: 'preconnect', href: 'https://fonts.googleapis.com' },
	{
		rel: 'preconnect',
		href: 'https://fonts.gstatic.com',
		crossOrigin: 'anonymous',
	},
	{
		rel: 'stylesheet',
		href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;700;900&family=Outfit:wght@700;800&display=swap',
	},
	{ rel: 'preload', as: 'image', href: '/landing/hero.webp' },
]

const FORM_ID = 'new-room'

export default function Index() {
	const navigate = useNavigate()

	return (
		<div className="min-h-full bg-mm-paper font-landing text-mm-ink">
			<Header />

			<main>
				<Hero />
				<Steps />
				<Characters
					form={
						<Form
							id={FORM_ID}
							method="get"
							action="/new"
							className="space-y-4"
							onSubmit={(e) => {
								// We shouldn't need a whole server visit to start a new room,
								// so let's just do a redirect here
								e.preventDefault()
								const set = chosenSet(new FormData(e.currentTarget))
								navigate(
									`/${nanoid(8)}` +
										(set ? `?set=${encodeURIComponent(set)}` : '')
								)
								// if someone submits this before the js has loaded then the
								// browser posts to /new, which does the same redirect server side
							}}
						>
							{characterSets.length > 1 && <CharacterSetChooser />}
							<ExternalSetField />
						</Form>
					}
				/>
				<Faq />
			</main>

			<footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-8">
				<Disclaimer className="text-mm-ink/50 dark:text-mm-ink/50" />
			</footer>
		</div>
	)
}

function Header() {
	return (
		<header className="relative z-20 mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-8 lg:py-5">
			<a href="/" className="flex items-center gap-3">
				<MaskLogo className="h-8 w-14 shrink-0 sm:h-9 sm:w-16" />
				<span className="font-logo text-lg font-extrabold tracking-[0.12em] sm:text-2xl">
					MASQUERADE MEET
				</span>
			</a>
			<nav className="hidden items-center gap-10 text-[15px] font-medium md:flex">
				<a className="hover:text-mm-coral" href="#how">
					遊び方
				</a>
				<a className="hover:text-mm-coral" href="#characters">
					キャラクター
				</a>
				<a className="hover:text-mm-coral" href="#faq">
					FAQ
				</a>
			</nav>
		</header>
	)
}

function Hero() {
	return (
		<section className="relative flex flex-col overflow-hidden lg:-mt-20 lg:block lg:min-h-[720px]">
			{/* The illustration. On wide screens it sits behind the copy and
			    melts into the paper on its left; on narrow ones it is a
			    picture between the headline and the button. */}
			<img
				src="/landing/hero.webp"
				alt="仮面をつけたキャラクターたちが、楽屋のような部屋で声を変えておしゃべりしている"
				width={936}
				height={690}
				className={cn(
					'w-full object-cover',
					'max-lg:order-2 max-lg:mt-2 max-lg:[mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)]',
					'lg:absolute lg:inset-y-0 lg:right-0 lg:h-full lg:w-[62%] lg:object-left',
					'lg:[-webkit-mask-composite:source-in] lg:[mask-composite:intersect] lg:[mask-image:linear-gradient(to_right,transparent,black_22%),linear-gradient(to_bottom,black_88%,transparent)]'
				)}
			/>

			<div className="relative z-10 order-1 px-4 pt-6 sm:px-8 lg:max-w-[50%] lg:pt-40 lg:pl-[max(2rem,calc((100vw-1440px)/2+2rem))]">
				<Spark className="absolute left-[clamp(19rem,34vw,31rem)] top-[7rem] hidden h-10 w-10 lg:block" />
				<h1 className="text-[clamp(2.5rem,9.5vw,3.75rem)] whitespace-nowrap font-black lg:text-[clamp(3.25rem,4.9vw,5rem)] leading-[1.15] tracking-tight">
					<span className="sr-only">マスカレード — </span>
					別の自分で、
					<br />
					ちょっと話そう。
				</h1>
				<p className="mt-6 text-lg font-bold leading-relaxed sm:text-2xl">
					声と姿を変えて出会う、
					<br />
					オンラインの仮面トーク。
				</p>
			</div>

			<div className="relative z-10 order-3 flex flex-wrap items-center gap-x-6 gap-y-3 px-4 pb-4 pt-8 sm:px-8 lg:max-w-[50%] lg:pb-28 lg:pt-12 lg:pl-[max(2rem,calc((100vw-1440px)/2+2rem))]">
				<button
					type="submit"
					form={FORM_ID}
					className="inline-flex items-center gap-6 rounded-full bg-mm-coral px-10 py-5 text-xl font-bold text-white shadow-[0_8px_24px_-8px_rgba(238,90,71,0.7)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mm-coral active:translate-y-px"
				>
					ルームを作る
					<ArrowRightIcon aria-hidden className="h-6 w-6" />
				</button>
				<a
					href="#how"
					className="inline-flex items-center gap-2 font-bold underline decoration-2 underline-offset-4 hover:text-mm-coral"
				>
					遊び方を見る
					<span className="grid h-7 w-7 place-items-center rounded-full border-2 border-current">
						<PlayIcon aria-hidden className="h-3.5 w-3.5 translate-x-px" />
					</span>
				</a>
				<p className="w-full text-sm text-mm-ink/60">
					参加する人は、招待リンクから
				</p>
			</div>
		</section>
	)
}

function Steps() {
	return (
		<section
			id="how"
			className="mx-auto max-w-[1440px] scroll-mt-4 px-4 sm:px-8"
		>
			<h2 className="sr-only">遊び方</h2>
			<ol className="grid items-center gap-8 rounded-2xl border border-mm-coral/30 bg-white/40 px-6 py-8 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-4 lg:px-10">
				<Step
					number="01"
					color="text-mm-coral"
					label="キャラを選ぶ"
					note={
						<span className="inline-flex items-center gap-2 text-sm">
							<VideoCameraSlashIcon
								aria-hidden
								className="h-6 w-6 text-mm-coral"
							/>
							カメラはオフ
						</span>
					}
				>
					<div className="flex gap-1.5">
						{['owl', 'cat', 'rabbit'].map((id, i) => (
							<div
								key={id}
								className={cn(
									'relative h-16 w-16 overflow-hidden rounded-lg border-2 bg-white sm:h-20 sm:w-20',
									i === 1 ? 'border-mm-teal' : 'border-mm-coral/30'
								)}
							>
								<img
									src={`/characters/animals/${id}.png`}
									alt=""
									className="h-full w-full object-cover"
									loading="lazy"
								/>
								{i === 1 && (
									<CheckIcon
										aria-hidden
										className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-mm-teal p-0.5 text-white"
									/>
								)}
							</div>
						))}
					</div>
				</Step>
				<StepArrow />
				<Step number="02" color="text-mm-teal" label="声を変えて話す">
					<VoiceBubbles className="h-24 w-44" />
				</Step>
				<StepArrow />
				<Step number="03" color="text-mm-sun" label="最後にアンマスク">
					<UnmaskBurst className="h-24 w-48" />
				</Step>
			</ol>
		</section>
	)
}

function Step(props: {
	number: string
	color: string
	label: string
	note?: ReactNode
	children: ReactNode
}) {
	return (
		<li className="flex flex-col items-center gap-2">
			<div className="flex items-center gap-4">
				<span className={cn('font-logo text-4xl font-extrabold', props.color)}>
					{props.number}
				</span>
				{props.children}
			</div>
			<span className="text-2xl font-bold tracking-wide">{props.label}</span>
			{props.note}
		</li>
	)
}

function StepArrow() {
	return (
		<li aria-hidden className="hidden text-mm-coral/70 md:block">
			<svg viewBox="0 0 100 12" className="w-24" fill="none">
				<path
					d="M2 6h88"
					stroke="currentColor"
					strokeWidth="2"
					strokeDasharray="2 5"
					strokeLinecap="round"
				/>
				<path
					d="M90 1l6 5-6 5"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</li>
	)
}

function Characters({ form }: { form: ReactNode }) {
	return (
		<section
			id="characters"
			className="mx-auto mt-20 grid max-w-6xl scroll-mt-4 gap-10 px-4 sm:px-8 lg:grid-cols-[1fr_1.4fr]"
		>
			<div className="space-y-4">
				<SectionTitle>キャラクター</SectionTitle>
				<p className="leading-relaxed">
					ルームを作るときに、みんなで使うキャラクターセットを選びます。1
					セットは 15 体。参加者は招待リンクを開いて、その中から好きな 1
					体を選びます。
				</p>
				<p className="leading-relaxed text-mm-ink/70">
					希望が重なっても早い者勝ちにはなりません。ミーティング開始の瞬間に抽選します。
					ミーティング中は声もアイコンもそのキャラクターになり、本名は表示されません。
				</p>
			</div>
			<div className="rounded-2xl bg-white/60 p-5 shadow-sm ring-1 ring-mm-ink/5 [&_legend]:sr-only">
				{form}
				<p className="pt-4 text-xs text-mm-ink/60">
					選んだら、ページ上の「ルームを作る」から。作成すると URL
					が発行され、それを共有すれば受け取った人はそのまま参加できます。
				</p>
			</div>
		</section>
	)
}

const faqs: { q: string; a: ReactNode }[] = [
	{
		q: '参加するにはどうすればいい？',
		a: '招待リンクを開くだけです。アカウント登録はいりません。ロビーでキャラクターと、アンマスク後に表示する名前を決めて準備完了にしてください。',
	},
	{
		q: '自分の生の声は相手に届きますか？',
		a: '届きません。声は自分のブラウザの中で変換してから送るので、生の声はサーバーにも他の参加者にも渡りません。例外は開始前のロビーでのルーム管理者だけで、段取りを伝えられるよう地声のまま流れます。',
	},
	{
		q: 'カメラは必要ですか？',
		a: '必要なのはマイクだけです。カメラはアンマスクまで一度も配信されません。顔を出したくなければ、ロビーで登録した画像がカメラの代わりに流れます。画像はブラウザから外に出ません。',
	},
	{
		q: 'アンマスクはいつ？',
		a: 'ルーム管理者の合図で 5 秒のカウントダウンが始まり、全員のボイスチェンジが同時に外れます。本名とカメラ映像が現れ、それまでのキャラクターは枠の隅に小さく残ります。',
	},
]

function Faq() {
	return (
		<section
			id="faq"
			className="mx-auto mt-20 max-w-3xl scroll-mt-4 space-y-6 px-4 pb-16 sm:px-8"
		>
			<SectionTitle>FAQ</SectionTitle>
			<div className="divide-y divide-mm-ink/10 border-y border-mm-ink/10">
				{faqs.map(({ q, a }) => (
					<details key={q} className="group py-4">
						<summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-bold [&::-webkit-details-marker]:hidden">
							{q}
							<span
								aria-hidden
								className="text-2xl leading-none text-mm-coral transition group-open:rotate-45"
							>
								+
							</span>
						</summary>
						<p className="pt-3 leading-relaxed text-mm-ink/75">{a}</p>
					</details>
				))}
			</div>
		</section>
	)
}

function SectionTitle({ children }: { children: ReactNode }) {
	return (
		<h2 className="flex items-center gap-3 text-3xl font-black">
			<span aria-hidden className="h-7 w-1.5 rounded-full bg-mm-coral" />
			{children}
		</h2>
	)
}

/* ---- drawings ---- */

function MaskLogo({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 72 40" className={className} aria-hidden>
			<path
				d="M3 14c6-6 16-6 22-1 3 2 4 6 4 9-3 7-12 11-19 8C4 27 1 20 3 14z"
				fill="#EE5A47"
			/>
			<path d="M9 18c3-3 8-3 11 0-3 3-8 3-11 0z" fill="#FCF7EF" />
			<path
				d="M65 10c-6-6-17-5-23 1-3 3-4 7-4 10 3 7 13 10 19 6 7-4 10-11 8-17z"
				fill="#1AA39A"
			/>
			<path d="M46 17c3-3 9-3 12 0-3 3-9 3-12 0z" fill="#FCF7EF" />
			<path
				d="M66 1l1.4 3.6L71 6l-3.6 1.4L66 11l-1.4-3.6L61 6l3.6-1.4z"
				fill="#F2B12F"
			/>
		</svg>
	)
}

function Spark({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 40 40" className={className} aria-hidden fill="none">
			<path
				d="M14 4l4 14"
				stroke="#EE5A47"
				strokeWidth="4"
				strokeLinecap="round"
			/>
			<path
				d="M24 26l12-2"
				stroke="#F2B12F"
				strokeWidth="4"
				strokeLinecap="round"
			/>
		</svg>
	)
}

function Wave({ x, y, color }: { x: number; y: number; color: string }) {
	const bars = [6, 12, 18, 10, 20, 14, 8]
	return (
		<g fill={color}>
			{bars.map((h, i) => (
				<rect
					key={i}
					x={x + i * 5}
					y={y - h / 2}
					width="2.6"
					height={h}
					rx="1.3"
				/>
			))}
		</g>
	)
}

function VoiceBubbles({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 176 96" className={className} aria-hidden fill="none">
			<path
				d="M8 36c0-17 15-30 38-30s38 13 38 30-15 30-38 30c-4 0-7 0-10-1l-14 9 3-12C14 56 8 47 8 36z"
				fill="#fff"
				stroke="#EE5A47"
				strokeWidth="2.5"
			/>
			<Wave x={29} y={36} color="#EE5A47" />
			<path
				d="M168 58c0-17-15-30-38-30s-38 13-38 30 15 30 38 30c4 0 7 0 10-1l14 8-3-12c11-6 17-14 17-23z"
				fill="#fff"
				stroke="#2F5BD8"
				strokeWidth="2.5"
			/>
			<Wave x={113} y={58} color="#2F5BD8" />
		</svg>
	)
}

function UnmaskBurst({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 192 96" className={className} aria-hidden fill="none">
			<g strokeWidth="4" strokeLinecap="round">
				<path d="M40 22l10 10" stroke="#EE5A47" />
				<path d="M28 44h14" stroke="#F2B12F" />
				<path d="M34 70l10-6" stroke="#1AA39A" />
				<path d="M150 18l-8 12" stroke="#EE5A47" />
				<path d="M164 52l-14 4" stroke="#F2B12F" />
				<path d="M156 78l-10-8" stroke="#EE5A47" />
				<path d="M96 6v10" stroke="#F2B12F" />
			</g>
			<path d="M176 16l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#1AA39A" />
			<path
				d="M58 40c10-12 28-14 38-4 10-10 28-8 38 4 2 14-6 30-20 32-8 1-14-4-18-10-4 6-10 11-18 10-14-2-22-18-20-32z"
				fill="#FBE9DA"
				stroke="#F1CDB0"
				strokeWidth="2"
			/>
			<path d="M68 46c5-6 14-6 19 0-5 5-14 5-19 0z" fill="#1AA39A" />
			<path d="M105 46c5-6 14-6 19 0-5 5-14 5-19 0z" fill="#1AA39A" />
		</svg>
	)
}
