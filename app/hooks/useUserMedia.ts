import { getCamera, getMic, getScreenshare } from 'partytracks/client'
import { useObservable, useObservableAsValue } from 'partytracks/react'
import { useCallback, useEffect, useState } from 'react'
import { useLocalStorage } from 'react-use'
import {
	BehaviorSubject,
	combineLatest,
	map,
	shareReplay,
	switchMap,
} from 'rxjs'
import blurVideoTrack from '~/utils/blurVideoTrack'
import { mode } from '~/utils/mode'
import noiseSuppression from '~/utils/noiseSuppression'
import { stillImage$ } from '~/utils/stillImage'
import { stillImageVideoTrack } from '~/utils/stillImageTrack'

export const errorMessageMap = {
	NotAllowedError:
		'Permission was denied. Grant permission and reload to enable.',
	NotFoundError: 'No device was found.',
	NotReadableError: 'Device is already in use.',
	OverconstrainedError: 'No device was found that meets constraints.',
	DevicesExhaustedError: 'All devices failed to initialize.',
	UnknownError: 'An unknown error occurred.',
}

type UserMediaError = keyof typeof errorMessageMap

const broadcastByDefault = mode === 'production'
export const mic = getMic({ broadcasting: broadcastByDefault })
// The camera stays dark until the masks come off. Starting it broadcasting
// would light up the webcam indicator during the lobby and briefly publish a
// recognisable frame before useMasquerade could stop it.
export const camera = getCamera({
	broadcasting: false,
	constraints: { width: { ideal: 1280 }, height: { ideal: 720 } },
})
export const screenshare = getScreenshare({ audio: false })

/**
 * Whether the still image is allowed to stand in for the camera.
 *
 * Only true after the reveal: before it, the character is the disguise and
 * a photograph would defeat the whole thing.
 */
const stillImageAllowed$ = new BehaviorSubject(false)

export function allowStillImage(allowed: boolean) {
	stillImageAllowed$.next(allowed)
}

const stillImageActive$ = combineLatest([
	stillImageAllowed$,
	camera.isBroadcasting$,
	stillImage$,
]).pipe(
	// The camera wins if it is on: turning it on is a deliberate act, and the
	// picture is what you fall back to rather than something you are stuck
	// with.
	map(([allowed, broadcasting, image]) => allowed && !broadcasting && !!image),
	shareReplay({ bufferSize: 1, refCount: true })
)

/**
 * What actually goes out on the wire: the camera, or the stored picture
 * drawn onto a canvas.
 *
 * Deliberately NOT a camera transform. partytracks bypasses transforms
 * while the camera is not broadcasting, so a transform would mean opening
 * the webcam — light and all — for somebody whose entire reason for using
 * this is not to be seen.
 *
 * Module-level so its identity is stable: `partyTracks.push` is memoised on
 * it, and a new observable each render would renegotiate the track.
 */
export const outgoingVideoTrack$ = combineLatest([
	stillImageActive$,
	stillImage$,
]).pipe(
	switchMap(([active, image]) =>
		active && image ? stillImageVideoTrack(image) : camera.broadcastTrack$
	),
	shareReplay({ bufferSize: 1, refCount: true })
)

/**
 * What other people are told. They render the placeholder unless this is
 * true, so a picture nobody knows about would never be shown.
 */
const outgoingVideoEnabled$ = combineLatest([
	stillImageActive$,
	camera.isBroadcasting$,
]).pipe(map(([still, broadcasting]) => still || broadcasting))

function useNoiseSuppression() {
	const [suppressNoise, setSuppressNoise] = useLocalStorage(
		'suppress-noise',
		false
	)
	useEffect(() => {
		if (suppressNoise) mic.addTransform(noiseSuppression)
		return () => {
			mic.removeTransform(noiseSuppression)
		}
	}, [suppressNoise])

	return [suppressNoise, setSuppressNoise] as const
}

function useBlurVideo() {
	const [blurVideo, setBlurVideo] = useLocalStorage('blur-video', false)
	useEffect(() => {
		if (blurVideo) camera.addTransform(blurVideoTrack)
		return () => {
			camera.removeTransform(blurVideoTrack)
		}
	}, [blurVideo])

	return [blurVideo, setBlurVideo] as const
}

function useScreenshare() {
	const screenShareIsBroadcasting = useObservableAsValue(
		screenshare.video.isBroadcasting$,
		false
	)
	const startScreenShare = useCallback(() => {
		screenshare.startBroadcasting()
	}, [])
	const endScreenShare = useCallback(() => {
		screenshare.stopBroadcasting()
	}, [])

	return {
		screenShareEnabled: screenShareIsBroadcasting,
		startScreenShare,
		endScreenShare,
		screenShareVideoTrack$: screenshare.video.broadcastTrack$,
		screenShareVideoTrack: useObservableAsValue(
			screenshare.video.broadcastTrack$
		),
	}
}

export default function useUserMedia(options: {
	micDeviceId?: string
	cameraDeviceId?: string
}) {
	useEffect(() => {
		if (!options.micDeviceId) return
		navigator.mediaDevices
			.enumerateDevices()
			.then((ds) => ds.find((d) => d.deviceId === options.micDeviceId))
			.then((d) => {
				d && mic.setPreferredDevice(d)
			})
	}, [options.micDeviceId])
	useEffect(() => {
		if (!options.cameraDeviceId) return
		navigator.mediaDevices
			.enumerateDevices()
			.then((ds) => ds.find((d) => d.deviceId === options.cameraDeviceId))
			.then((d) => {
				d && camera.setPreferredDevice(d)
			})
	}, [options.cameraDeviceId])

	const [suppressNoise, setSuppressNoise] = useNoiseSuppression()
	const [blurVideo, setBlurVideo] = useBlurVideo()

	const [videoUnavailableReason, setVideoUnavailableReason] =
		useState<UserMediaError>()
	const [audioUnavailableReason, setAudioUnavailableReason] =
		useState<UserMediaError>()

	const {
		endScreenShare,
		startScreenShare,
		screenShareEnabled,
		screenShareVideoTrack,
		screenShareVideoTrack$,
	} = useScreenshare()

	const micDevices = useObservableAsValue(mic.devices$, [])
	const cameraDevices = useObservableAsValue(camera.devices$, [])

	useObservable(mic.error$, (e) => {
		const reason =
			e.name in errorMessageMap ? (e.name as UserMediaError) : 'UnknownError'
		if (reason === 'UnknownError') {
			console.error('Unknown error getting audio track: ', e)
		}
		setAudioUnavailableReason(reason)
		mic.stopBroadcasting()
	})

	useObservable(camera.error$, (e) => {
		const reason =
			e.name in errorMessageMap ? (e.name as UserMediaError) : 'UnknownError'
		if (reason === 'UnknownError') {
			console.error('Unknown error getting video track: ', e)
		}
		setVideoUnavailableReason(reason)
		camera.stopBroadcasting()
	})

	return {
		turnMicOn: mic.startBroadcasting,
		turnMicOff: mic.stopBroadcasting,
		audioStreamTrack: useObservableAsValue(mic.broadcastTrack$),
		audioMonitorStreamTrack: useObservableAsValue(mic.localMonitorTrack$),
		audioEnabled: useObservableAsValue(mic.isBroadcasting$, broadcastByDefault),
		audioUnavailableReason,
		publicAudioTrack$: mic.broadcastTrack$,
		privateAudioTrack$: mic.localMonitorTrack$,
		audioDeviceId: useObservableAsValue(mic.activeDevice$)?.deviceId,
		setAudioDeviceId: (deviceId: string) => {
			const found = micDevices.find((d) => d.deviceId === deviceId)
			if (found) mic.setPreferredDevice(found)
		},

		setVideoDeviceId: (deviceId: string) => {
			const found = cameraDevices.find((d) => d.deviceId === deviceId)
			if (found) camera.setPreferredDevice(found)
		},
		videoDeviceId: useObservableAsValue(camera.activeDevice$)?.deviceId,
		turnCameraOn: camera.startBroadcasting,
		turnCameraOff: camera.stopBroadcasting,
		videoEnabled: useObservableAsValue(outgoingVideoEnabled$, false),
		/** true when the stored picture is standing in for the camera */
		stillImageActive: useObservableAsValue(stillImageActive$, false),
		videoUnavailableReason,
		blurVideo,
		setBlurVideo,
		suppressNoise,
		setSuppressNoise,
		videoTrack$: outgoingVideoTrack$,
		videoStreamTrack: useObservableAsValue(outgoingVideoTrack$),

		startScreenShare,
		endScreenShare,
		screenShareVideoTrack,
		screenShareEnabled,
		screenShareVideoTrack$,
	}
}

export type UserMedia = ReturnType<typeof useUserMedia>
