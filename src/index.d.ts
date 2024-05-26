/// <reference types="node" />

import { EventEmitter } from 'events';
import { Socket } from 'net'
import * as Stream from 'stream'
import { Agent } from 'http'
import { Transform } from "readable-stream";
import { BinaryLike, KeyObject } from 'crypto';
import { Realm } from "prismarine-realms"

type PromiseLike = Promise<void> | void

declare module 'minecraft-protocol' {
	export class Client extends EventEmitter {
		constructor(isServer: boolean, version: string, customPackets?: any)
		state: States
		isServer: boolean
		socket: Socket
		uuid: string
		username: string
		session?: SessionOption
		profile?: any
		deserializer: FullPacketParser
		serializer: Serializer
		latency: number
		customPackets: any
		protocolVersion: number
		version: string
		write(name: string, params: any): void
		writeRaw(buffer: any): void
		compressionThreshold: string
		ended: boolean
		connect(port: number, host: string): void
		setSocket(socket: Socket): void
		end(reason?: string): void
		registerChannel(name: string, typeDefinition: any, custom?: boolean): void
		unregisterChannel(name: string): void
		writeChannel(channel: any, params: any): void
		signMessage(message: string, timestamp: BigInt, salt?: number, preview?: string, acknowledgements?: Buffer[]): Buffer
		verifyMessage(publicKey: Buffer | KeyObject, packet: object): boolean
		reportPlayer(uuid: string, reason: 'FALSE_REPORTING' | 'HATE_SPEECH' | 'TERRORISM_OR_VIOLENT_EXTREMISM' | 'CHILD_SEXUAL_EXPLOITATION_OR_ABUSE' | 'IMMINENT_HARM' | 'NON_CONSENSUAL_INTIMATE_IMAGERY' | 'HARASSMENT_OR_BULLYING' | 'DEFAMATION_IMPERSONATION_FALSE_INFORMATION' | 'SELF_HARM_OR_SUICIDE' | 'ALCOHOL_TOBACCO_DRUGS', signatures: Buffer[], comment?: string): Promise<true>
		chat(message: string, options?: { timestamp?: BigInt, salt?: BigInt, preview?: BinaryLike, didPreview?: boolean }): void
		on(event: 'error', listener: (error: Error) => PromiseLike): this
		on(event: 'packet', handler: (data: any, packetMeta: PacketMeta, buffer: Buffer, fullBuffer: Buffer) => PromiseLike): this
		on(event: 'raw', handler: (buffer: Buffer, packetMeta: PacketMeta) => PromiseLike): this
		on(event: 'session', handler: (session: SessionObject) => PromiseLike): this
		on(event: 'state', handler: (newState: States, oldState: States) => PromiseLike): this
		on(event: 'end', handler: (reason: string) => PromiseLike): this
		on(event: 'connect', handler: () => PromiseLike): this
		on(event: string, handler: (data: any, packetMeta: PacketMeta) => PromiseLike): this
		on(event: `raw.${string}`, handler: (buffer: Buffer, packetMeta: PacketMeta) => PromiseLike): this
		on(event: 'playerChat', handler: (data: {
			// (JSON string) The chat message preformatted, if done on server side
			formattedMessage: string,
			// (Plaintext) The chat message without formatting (for example no `<username> message` ; instead `message`), on version 1.19+
			plainMessage: string,
			// (JSON string) Unsigned formatted chat contents. Should only be present when the message is modified and server has chat previews disabled. Only on versions 1.19.0, 1.19.1 and 1.19.2
			unsignedContent?: string,
			type: string,
			sender: string,
			senderName: string,
			senderTeam: string,
			targetName: string,
			verified?: boolean
		}) => PromiseLike): this
		on(event: 'systemChat', handler: (data: { positionId: number, formattedMessage: string }) => PromiseLike): this
		// Emitted after the player enters the PLAY state and can send and recieve game packets
		on(event: 'playerJoin', handler: () => void): this
		once(event: 'error', listener: (error: Error) => PromiseLike): this
		once(event: 'packet', handler: (data: any, packetMeta: PacketMeta, buffer: Buffer, fullBuffer: Buffer) => PromiseLike): this
		once(event: 'raw', handler: (buffer: Buffer, packetMeta: PacketMeta) => PromiseLike): this
		once(event: 'sessionce', handler: (sessionce: any) => PromiseLike): this
		once(event: 'state', handler: (newState: States, oldState: States) => PromiseLike): this
		once(event: 'end', handler: (reasonce: string) => PromiseLike): this
		once(event: 'connect', handler: () => PromiseLike): this
		once(event: string, handler: (data: any, packetMeta: PacketMeta) => PromiseLike): this
		once(event: `raw.${string}`, handler: (buffer: Buffer, packetMeta: PacketMeta) => PromiseLike): this
	}

	class FullPacketParser extends Transform {
		proto: any
		mainType: any
		noErrorLogging: boolean
		constructor (proto: any, mainType: any, noErrorLogging?: boolean)

		parsePacketBuffer(buffer: Buffer): any
	}

	class Serializer extends Transform {
		proto: any
		mainType: any
		queue: Buffer
		constructor(proto: any, mainType: any)

		createPacketBuffer(packet: any): any
	}

	export interface SessionOption {
		accessToken: string,
		/** My be needed for mojang auth. Is send by mojang on username + password auth */
		clientToken?: string,
		selectedProfile: SessionProfile
	}

	export interface SessionObject {
		accessToken: string,
		/** My be needed for mojang auth. Is send by mojang on username + password auth */
		clientToken?: string,
		selectedProfile: {
			name: string
			id: string
		}
		availableProfiles?: SessionProfile[]
		availableProfile?: SessionProfile[]
	}

	interface SessionProfile {
		/** Character in game name */
		name: string
		/** Character UUID in short form */
		id: string
	}

	export interface ClientOptions {
		username: string
		port?: number
		auth?: 'mojang' | 'microsoft' | 'offline' | ((client: Client, options: ClientOptions) => void)
		password?: string
		host?: string
		clientToken?: string
		accessToken?: string
		authServer?: string
		authTitle?: string
		sessionServer?: string
		keepAlive?: boolean
		closeTimeout?: number
		noPongTimeout?: number
		checkTimeoutInterval?: number
		version?: string
		customPackets?: any
		hideErrors?: boolean
		skipValidation?: boolean
		stream?: Stream
		connect?: (client: Client) => void
		agent?: Agent
		fakeHost?: string
		profilesFolder?: string | false
		onMsaCode?: (data: MicrosoftDeviceAuthorizationResponse) => void
		id?: number
		session?: SessionOption
		validateChannelProtocol?: boolean,
		realms?: RealmsOptions
		// 1.19+
		disableChatSigning?: boolean
		/** Pass custom client implementation if needed. */
		Client?: Client
	}

	export class Server extends EventEmitter {
		constructor(version: string, customPackets?: any)
		writeToClients(clients: Client[], name: string, params: any): void
		onlineModeExceptions: object
		clients: { [key: number]: ServerClient }
		playerCount: number
		maxPlayers: number
		motd: string
		motdMsg?: Object
		favicon: string
		close(): void
		on(event: 'connection', handler: (client: ServerClient) => PromiseLike): this
		on(event: 'error', listener: (error: Error) => PromiseLike): this
		on(event: 'login', handler: (client: ServerClient) => PromiseLike): this
		on(event: 'listening', listener: () => PromiseLike): this
		// Emitted after the player enters the PLAY state and can send and recieve game packets
		on(event: 'playerJoin', handler: (client: ServerClient) => void): this
		once(event: 'connection', handler: (client: ServerClient) => PromiseLike): this
		once(event: 'error', listener: (error: Error) => PromiseLike): this
		once(event: 'login', handler: (client: ServerClient) => PromiseLike): this
		once(event: 'listening', listener: () => PromiseLike): this
	}

	export interface ServerClient extends Client {
		id: number
		/** You must call this function when the server receives a message from a player and that message gets
		 broadcast to other players in player_chat packets. This function stores these packets so the server
		 can then verify a player's lastSeenMessages field in inbound chat packets to ensure chain integrity.  */
		logSentMessageFromPeer(packet: object): boolean
	}

	export interface ServerOptions {
		port?: number
		host?: string
		kickTimeout?: number
		checkTimeoutInterval?: number
		'online-mode'?: boolean
		beforePing?: (response: any, client: Client, callback?: (error: any, result: any) => any) => any
		beforeLogin?: (client: Client) => void
		motd?: string
		motdMsg?: Object
		maxPlayers?: number
		keepAlive?: boolean
		version?: string | false
		fallbackVersion?: string
		favicon?: string
		customPackets?: any
		errorHandler?: (client: Client, error: Error) => void
		hideErrors?: boolean
		agent?: Agent
		validateChannelProtocol?: boolean
		/** (1.19+) Require connecting clients to have chat signing support enabled */
		enforceSecureProfile?: boolean
		/** 1.19.1 & 1.19.2 only: If client should send previews of messages they are typing to the server */
		enableChatPreview?: boolean
		socketType?: 'tcp' | 'ipc'
		Server?: Server
	}

	export interface SerializerOptions {
		customPackets: any
		isServer?: boolean
		state?: States
		version: string
	}

	export interface MicrosoftDeviceAuthorizationResponse {
		device_code: string
		user_code: string
		verification_uri: string
		expires_in: number
		interval: number
		message: string
	}

	enum States {
		HANDSHAKING = 'handshaking',
		LOGIN = 'login',
		PLAY = 'play',
		STATUS = 'status',
	}

	export interface PacketMeta {
		name: string
		state: States
	}

	export interface PingOptions {
		host?: string
		majorVersion?: string
		port?: number
		protocolVersion?: string
		version?: string
		closeTimeout?: number
		noPongTimeout?: number
	}

	export interface OldPingResult {
		maxPlayers: number,
		motd: string
		playerCount: number
		prefix: string
		protocol: number
		version: string
	}

	export interface NewPingResult {
		description: {
			text?: string
			extra?: any[]
		} | string
		players: {
			max: number
			online: number
			sample?: {
				id: string
				name: string
			}[]
		}
		version: {
			name: string
			protocol: number
		}
		favicon?: string
		latency: number
	}

	export interface RealmsOptions {
		realmId?: string
		pickRealm?: (realms: Realm[]) => Realm
	}

	export const states: typeof States
	export const supportedVersions: string[]
	export const defaultVersion: string

	export function createServer(options: ServerOptions): Server
	export function createClient(options: ClientOptions): Client

	// TODO: Create typings on protodef to define here
	export function createSerializer({ state, isServer, version, customPackets }: SerializerOptions): any
	export function createDeserializer({ state, isServer, version, customPackets }: SerializerOptions): any

	export function ping(options: PingOptions, callback?: (error: Error, result: OldPingResult | NewPingResult) => void): Promise<OldPingResult | NewPingResult>
}
