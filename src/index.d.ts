import {Socket} from 'net'
import * as Stream from 'stream'
import EventEmitter = NodeJS.EventEmitter

declare enum EnumStates {
  HANDSHAKING = 'handshaking',
  STATUS = 'status',
  LOGIN = 'login',
  PLAY = 'play',
}

export interface IPacketMeta {
  name: string
  state: EnumStates
}

export declare class Client extends EventEmitter {
  constructor(isServer: boolean, version: string, customPackets?: any)
  write(name: string, params: any)
  end(reason: string)
  state: EnumStates
  isServer: boolean
  socket: Socket
  uuid: string
  username: string
  session: any
  profile: any
  latency: number
  on(event: 'packet', handler: (data: any, packetMeta: IPacketMeta) => any)
  on(event: 'raw', handler: (data: any, packetMeta: IPacketMeta) => any)
  on(event: 'state', handler: (newState: EnumStates, oldState: EnumStates) => any)
  on(event: 'session', handler: (session: any) => any)
  writeChannel(channel: any, params: any)
  registerChannel(name: string, typeDefinition: any, custom?: boolean)
  unregisterChannel(name: string)
}

interface IClientsMap {
  [key: string]: Client
}

export declare class Server extends EventEmitter {
  constructor(version: string, customPackets?: any)
  onlineModeExceptions: object
  clients: IClientsMap
  playerCount: number
  maxPlayers: number
  motd: string
  favicon: string
  on(event: 'connection', handler: (client: Client) => any)
  on(event: 'login', handler: (client: Client) => any)
}

export interface ICreateServerOptions {
  host?: string
  port?: number
  kickTimeout?: number
  checkTimeoutInterval?: number
  'online-mode'?: boolean
  motd?: string
  maxPlayers?: number
  keepAlive?: boolean
  version?: string
  customPackets?: any
  stream?: Stream
  beforePing?: (response: any, client: Client, callback?: (result: any) => any) => any
  errorHandler?: (client: Client, error: Error) => any
  connect?: (client: Client) => any
  hideErrors?: boolean
}

export interface ICreateClientOptions {
  username: string
  port?: number
  password?: string
  host?: string
  clientToken?: string
  accessToken?: string
  keepAlive?: boolean
  checkTimeoutInterval?: number
  version?: string
  customPackets?: any
  hideErrors?: boolean
}

export interface ICreateSerializerOptions {
  state?: EnumStates
  isServer?: boolean
  version: string
  customPackets: any
}

export interface IPingOptions {
  host?: string
  port?: number
  version?: string
  majorVersion?: string
  protocolVersion?: string
}

export interface IPingOldResult {
  prefix: string
  protocol: string
  version: string
  motd: string
  playerCount: number
  maxPlayers: number,
}

export interface IPingNewResult {
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

export declare function createServer(options: ICreateServerOptions): Server
export declare function createClient(options: ICreateClientOptions): Client

export const state: EnumStates

export declare function createSerializer({state, isServer, version, customPackets}: ICreateSerializerOptions)
export declare function createDeserializer({state, isServer, version, customPackets}: ICreateSerializerOptions)

export declare function ping(options: IPingOptions, callback: (err: Error, result: IPingOldResult | IPingNewResult) => any);

export const supportedVersions: string[]
