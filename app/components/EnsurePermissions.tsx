import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from './Button'

export interface EnsurePermissionsProps {
	children?: ReactNode
	onMicSelected: (deviceId: string) => void
	onCameraSelected: (deviceId: string) => void
}

type PermissionState = 'denied' | 'granted' | 'prompt' | 'unable-to-determine'

async function getExistingPermissionState(): Promise<PermissionState> {
	try {
		const query = await navigator.permissions.query({
			name: 'microphone' as any,
		})
		return query.state
	} catch (error) {
		return 'unable-to-determine'
	}
}

export function EnsurePermissions(props: EnsurePermissionsProps) {
	const [permissionState, setPermissionState] =
		useState<PermissionState | null>(null)

	const mountedRef = useRef(true)

	useEffect(() => {
		getExistingPermissionState().then((result) => {
			if (mountedRef.current) setPermissionState(result)
		})
		return () => {
			mountedRef.current = false
		}
	}, [])

	if (permissionState === null) return null

	if (permissionState === 'denied') {
		return (
			<div className="grid min-h-full items-center">
				<div className="mx-auto space-y-2 max-w-80">
					<h1 className="text-2xl font-bold">権限が拒否されました</h1>
					<p>ブラウザの設定からマイクとカメラの権限を許可し直してください。</p>
				</div>
			</div>
		)
	}

	if (permissionState === 'prompt') {
		return (
			<div className="grid min-h-full items-center">
				<div className="mx-auto max-w-80">
					<p className="mb-8">
						マスカレードを使うには、カメラとマイクの権限が必要です。次の操作でブラウザが許可を求めます。
					</p>
					<p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
						カメラは変装が解けるまで一度も配信されません。声もこのブラウザの中で変換してから送ります。
					</p>
					<Button
						onClick={() => {
							navigator.mediaDevices
								.getUserMedia({
									video: true,
									audio: true,
								})
								.then((ms) => {
									if (mountedRef.current) setPermissionState('granted')
									const micId = ms.getAudioTracks()[0].getSettings().deviceId
									if (micId) props.onMicSelected(micId)
									const cameraId = ms.getVideoTracks()[0].getSettings().deviceId
									if (cameraId) props.onCameraSelected(cameraId)
									ms.getTracks().forEach((t) => t.stop())
								})
								.catch(() => {
									if (mountedRef.current) setPermissionState('denied')
								})
						}}
					>
						権限を許可する
					</Button>
				</div>
			</div>
		)
	}

	return props.children
}
