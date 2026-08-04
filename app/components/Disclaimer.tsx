import type { FC } from 'react'
import { cn } from '~/utils/style'

interface DisclaimerProps {
	className?: string
}

export const Disclaimer: FC<DisclaimerProps> = ({ className }) => {
	return (
		<p
			className={cn(
				'text-xs text-zinc-400 dark:text-zinc-500 max-w-prose',
				className
			)}
		>
			マスカレード は{' '}
			<a className="underline" href="https://github.com/cloudflare/orange">
				Cloudflare Orange Meets
			</a>{' '}
			をベースにした、{' '}
			<a className="underline" href="https://developers.cloudflare.com/calls/">
				Cloudflare Calls
			</a>{' '}
			製のデモアプリケーションです。
		</p>
	)
}
