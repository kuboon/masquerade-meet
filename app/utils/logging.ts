import { type ApiHistoryEntry } from 'partytracks/client'

export type LogEvent =
	| {
			eventName: 'onStart'
			meetingId?: string
	  }
	| {
			eventName: 'alarm'
			meetingId?: string
	  }
	| {
			eventName: 'onConnect'
			meetingId?: string
			foundInStorage: boolean
			connectionId: string
	  }
	| {
			eventName: 'onClose'
			meetingId?: string
			connectionId: string
			code: number
			reason: string
			wasClean: boolean
	  }
	| {
			eventName: 'userLeft'
			meetingId?: string
			connectionId: string
	  }
	| {
			eventName: 'cleaningUpConnections'
			meetingId?: string
			connectionsFound: number
			websocketsFound: number
			websocketStatuses: number[]
	  }
	| {
			eventName: 'userTimedOut'
			meetingId?: string
			connectionId: string
	  }
	| {
			eventName: 'hostReassigned'
			connectionId: string
	  }
	| {
			/** somebody who arrived at a full meeting, finally given a face */
			eventName: 'waitingParticipantAdmitted'
			connectionId: string
	  }
	| {
			/** a room opened with somebody else's roster, and got it */
			eventName: 'externalCharacterSetLoaded'
			source: string
	  }
	| {
			/**
			 * A room asked for somebody else's roster and is wearing ours
			 * instead. Worth a line: the person who published that file cannot
			 * see this failure from their side, and the room's own report of it
			 * goes away with the room.
			 */
			eventName: 'externalCharacterSetRefused'
			source: string
			problem: string
	  }
	| {
			eventName: 'meetingStarted'
			meetingId?: string
			users: number
	  }
	| {
			eventName: 'revealStarted'
			meetingId?: string
			revealAt: number
	  }
	| {
			eventName: 'meetingStarting'
			meetingId?: string
			startAt: number
	  }
	| {
			eventName: 'meetingRestarted'
			meetingId?: string
	  }
	| {
			eventName: 'startingMeeting'
			meetingId?: string
	  }
	| {
			eventName: 'endingMeeting'
			meetingId?: string
	  }
	| {
			eventName: 'meetingIdNotFoundInCleanup'
	  }
	| {
			eventName: 'errorBroadcastingToUser'
			meetingId?: string
			connectionId: string
	  }
	| {
			eventName: 'onErrorHandler'
			error: unknown
	  }
	| {
			eventName: 'onErrorHandlerDetails'
			meetingId?: string
			connectionId: string
			error: unknown
	  }
	| {
			eventName: 'errorHandlingMessage'
			meetingId?: string
			connectionId: string
			error: unknown
	  }
	| {
			eventName: 'clientNegotiationRecord'
			entry: ApiHistoryEntry
			meetingId?: string
			connectionId: string
			sessionId?: string
	  }

export function log(event: LogEvent) {
	console.log(event)
}
