import { type FC } from 'react'
import useMediaDevices from '~/hooks/useMediaDevices'
import { useRoomContext } from '~/hooks/useRoomContext'
import { errorMessageMap } from '~/hooks/useUserMedia'
import { Option, Select } from './Select'

export const VideoInputSelector: FC<{ id?: string }> = ({ id }) => {
	const videoInputDevices = useMediaDevices((d) => d.kind === 'videoinput')

	const {
		userMedia: { videoUnavailableReason, videoDeviceId, setVideoDeviceId },
	} = useRoomContext()

	if (videoUnavailableReason) {
		return (
			<div className="max-w-[40ch]">
				<Select
					tooltipContent={errorMessageMap[videoUnavailableReason]}
					id={id}
					defaultValue="unavailable"
				>
					<Option value={'unavailable'}>(Unavailable)</Option>
				</Select>
			</div>
		)
	}

	// Nothing to choose between. The camera is optional here and a browser
	// will not name — or even admit to — a camera it has never been allowed to
	// use, so this is the ordinary state for most people rather than a fault.
	if (videoInputDevices.length === 0) {
		return (
			<div className="max-w-[40ch]">
				<Select
					tooltipContent="カメラの使用を許可すると選べるようになります"
					id={id}
					disabled
					defaultValue="none"
				>
					<Option value="none">（カメラなし）</Option>
				</Select>
			</div>
		)
	}

	return (
		<div className="max-w-[40ch]">
			<Select value={videoDeviceId} onValueChange={setVideoDeviceId} id={id}>
				{videoInputDevices.map((d) => (
					<Option key={d.deviceId} value={d.deviceId}>
						{d.label}
					</Option>
				))}
			</Select>
		</div>
	)
}
