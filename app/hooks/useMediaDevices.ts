import { useEffect } from 'react'
import { createGlobalState } from 'react-use'

const useMediaDevicesState = createGlobalState<MediaDeviceInfo[]>([])

export default function useMediaDevices(
	filter: (device: MediaDeviceInfo) => boolean = () => true
) {
	const [devices, setDevices] = useMediaDevicesState()
	const filterSource = filter.toString()

	useEffect(() => {
		let mounted = true
		const requestDevices = () => {
			navigator.mediaDevices.enumerateDevices().then((d) => {
				// A device the browser will admit to having but not name: that is
				// what enumerateDevices returns for a kind that has never been
				// permitted. There is nothing to select — the id is the empty
				// string — so it is not a device as far as anything here is
				// concerned. The camera is optional in this app, which makes it
				// the usual case rather than a corner one.
				if (mounted) setDevices(d.filter((device) => device.deviceId !== ''))
			})
		}
		navigator.mediaDevices.addEventListener('devicechange', requestDevices)
		requestDevices()
		return () => {
			mounted = false
			navigator.mediaDevices.removeEventListener('devicechange', requestDevices)
		}
	}, [filterSource, setDevices])

	return devices.filter(filter)
}
