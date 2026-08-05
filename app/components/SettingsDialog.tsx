import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import type { FC, ReactNode } from 'react'
import { useRoomContext } from '~/hooks/useRoomContext'
import { AudioInputSelector } from './AudioInputSelector'
import { Button } from './Button'
import {
	Dialog,
	DialogContent,
	DialogOverlay,
	DialogTitle,
	Portal,
	Trigger,
} from './Dialog'
import { Icon } from './Icon/Icon'
import { Label } from './Label'
import { StillImagePicker } from './StillImagePicker'
import { Toggle } from './Toggle'
import { Tooltip } from './Tooltip'
import { VideoInputSelector } from './VideoInputSelector'

interface SettingsDialogProps {
	onOpenChange?: (open: boolean) => void
	open?: boolean
	children?: ReactNode
}

export const SettingsButton = () => {
	return (
		<SettingsDialog>
			<Tooltip content="Settings">
				<Trigger asChild>
					<Button className="text-sm" displayType="secondary">
						<Icon type="cog" />
						{/* The tooltip is not a name: it lives in a portal and only
						    appears on hover, so without this the button is a
						    picture to a screen reader. */}
						<VisuallyHidden>設定</VisuallyHidden>
					</Button>
				</Trigger>
			</Tooltip>
		</SettingsDialog>
	)
}

export const SettingsDialog: FC<SettingsDialogProps> = ({
	onOpenChange,
	open,
	children,
}) => {
	const {
		userMedia: { blurVideo, setBlurVideo, suppressNoise, setSuppressNoise },
	} = useRoomContext()

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{children}
			<Portal>
				<DialogOverlay />
				<DialogContent>
					<DialogTitle>設定</DialogTitle>
					<div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 mt-8 items-center">
						<Label
							className="text-base -mb-2 md:mb-0 text-left md:text-right"
							htmlFor="camera"
						>
							カメラ
						</Label>
						<VideoInputSelector id="camera" />
						<Label
							className="text-base -mb-2 md:mb-0 text-left md:text-right"
							htmlFor="mic"
						>
							マイク
						</Label>
						<AudioInputSelector id="mic" />
						<Label
							className="text-base -mb-2 md:mb-0 text-left md:text-right"
							htmlFor="blurBackground"
						>
							背景をぼかす
						</Label>
						<div>
							<Toggle
								id="blurBackground"
								checked={blurVideo}
								onCheckedChange={setBlurVideo}
							/>
						</div>
						<Label
							className="text-base -mb-2 md:mb-0 text-left md:text-right"
							htmlFor="suppressNoise"
						>
							ノイズ抑制
						</Label>
						<div>
							<Toggle
								id="suppressNoise"
								checked={suppressNoise}
								onCheckedChange={setSuppressNoise}
							/>
						</div>
					</div>
					{/* Also offered when first entering a room, but a returning
					    visitor never sees that form — their name is already set. */}
					<StillImagePicker className="mt-6" />
				</DialogContent>
			</Portal>
		</Dialog>
	)
}
