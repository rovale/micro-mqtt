/**
 * Interfaces for net and socket.
 */
export interface NetConnectOptions {
    host: string;
    port: number;
}

export interface Socket {
    write: (data: string) => void;
    on: (event: string, listener: (args: string) => void) => void;
    removeAllListeners: (event: string) => void;
    end: () => void;
}

export interface Net {
    connect: (options: NetConnectOptions, callback: (socket: Socket) => void) => Socket;
}

interface WifiStatus {
    station: string;
}

export interface Wifi {
    getStatus: () => WifiStatus;
}