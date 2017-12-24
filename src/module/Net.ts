import { EventEmitter } from 'events';

/**
 * Interface for socket.
 */

export interface Socket extends EventEmitter {
    write(data: Buffer) : void;
    end(): void;
    connect(port: number, host: string, connectionListener?: Function) : Socket;
}