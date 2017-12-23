/**
 * Interface for socket.
 */

export interface Socket {
    write(data: string) : void;
    on(event: string, listener: (args: string) => void): void;
    removeAllListeners(event: string): void;
    end(): void;
    connect(port: number, host: string, connectionListener?: Function) : Socket;
}