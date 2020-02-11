/// <reference types="node" />

import { EventEmitter } from 'events';
import { Socket } from 'net'
import * as Stream from 'stream'
import { Agent } from 'http'

declare module 'minecraft-protocol' {
	export class Client extends EventEmitter {
		constructor(isServer: boolean, version: string, customPackets?: any)
		isServer: boolean
		latency: number
		profile: any
		session: any
		socket: Socket
		state: States
		username: string
		uuid: string
		protocolVersion: number
		connect(port: number, host: string): void
		end(reason: string): void
		registerChannel(name: string, typeDefinition: any, custom?: boolean): void
		unregisterChannel(name: string): void
		write(name: string, params: any): void
		writeRaw(buffer: any): void
		writeChannel(channel: any, params: any): void
		on(event: 'error', listener: (error: Error) => void): this
		on(event: 'packet', handler: (data: any, packetMeta: PacketMeta) => void): this
		on(event: 'raw', handler: (data: any, packetMeta: PacketMeta) => void): this
		on(event: 'session', handler: (session: any) => void): this
		on(event: 'state', handler: (newState: States, oldState: States) => void): this
		on(event: 'end', handler: (reason: string) => void): this
		on(event: string, handler: (data: any, packetMeta: PacketMeta)=> unknown): this
	}

	export interface ClientOptions {
		accessToken?: string
		checkTimeoutInterval?: number
		clientToken?: string
		customPackets?: any
		hideErrors?: boolean
		host?: string
		keepAlive?: boolean
		password?: string
		port?: number
		username: string
		version?: string
		skipValidation?: boolean
		stream?: Stream
		connect?: (client: Client) => void
		agent?: Agent
	}

	export class Server extends EventEmitter {
		constructor(version: string, customPackets?: any)
		clients: ClientsMap
		favicon: string
		maxPlayers: number
		motd: string
		onlineModeExceptions: object
		playerCount: number
		close(): void
		on(event: 'connection', handler: (client: Client) => void): this
		on(event: 'error', listener: (error: Error) => void): this
		on(event: 'login', handler: (client: Client) => void): this
	}

	export interface ServerOptions {
		'online-mode'?: boolean
		checkTimeoutInterval?: number
		customPackets?: any
		hideErrors?: boolean
		host?: string
		keepAlive?: boolean
		kickTimeout?: number
		maxPlayers?: number
		motd?: string
		port?: number
		version?: string
		beforePing?: (response: any, client: Client, callback?: (result: any) => any) => any
		errorHandler?: (client: Client, error: Error) => void
		agent?: Agent
	}

	export interface SerializerOptions {
		customPackets: any
		isServer?: boolean
		state?: States
		version: string
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

	interface ClientsMap {
		[key: string]: Client
	}

	export interface PingOptions {
		host?: string
		majorVersion?: string
		port?: number
		protocolVersion?: string
		version?: string
	}

	export interface OldPingResult {
		maxPlayers: number,
		motd: string
		playerCount: number
		prefix: string
		protocol: string
		version: string
	}

	export interface NewPingResult {
		description: string
		players: {
			max: number
			online: number
			sample: {
				id: string
				name: string
			}[]
		}
		version: {
			name: string
			protocol: string
		}
		favicon: string
		latency: number
	}

	export const states: typeof States
	export const supportedVersions: ['1.7', '1.8', '1.9', '1.10', '1.11.2', '1.12.2', '1.13.1']

	export function createServer(options: ServerOptions): Server
	export function createClient(options: ClientOptions): Client

	// TODO: Create typings on protodef to define here
	export function createSerializer({ state, isServer, version, customPackets }: SerializerOptions): any
	export function createDeserializer({ state, isServer, version, customPackets }: SerializerOptions): any

	export function ping(options: PingOptions, callback: (error: Error, result: OldPingResult | NewPingResult) => void): void
}
