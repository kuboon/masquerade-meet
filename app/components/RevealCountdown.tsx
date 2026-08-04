/**
 * Full-screen countdown shown to everyone once the host triggers the reveal.
 * It is purely decorative — the actual unmasking is driven by the deadline in
 * `useMasquerade`, so the visuals lagging a frame can never desynchronise it.
 */
export function RevealCountdown({ seconds }: { seconds: number }) {
	return (
		<div className="pointer-events-none absolute inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm">
			<div className="text-center text-white">
				<p className="text-lg font-medium tracking-widest md:text-2xl">
					アンマスクまで
				</p>
				<p
					key={seconds}
					className="animate-fadeIn text-[8rem] font-black leading-none md:text-[14rem]"
				>
					{seconds}
				</p>
				<p className="text-sm text-zinc-300 md:text-base">
					カメラとほんとうの声にもどります
				</p>
			</div>
		</div>
	)
}
