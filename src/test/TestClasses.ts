/**
 * Test subclasses and mocks.
 */
/// <reference path='_common.ts' />
import { MicroMqttClient } from '../module/micro-mqtt';
import ConnectionOptions from '../module/ConnectionOptions';
import { Network, NetworkConnectOptions, NetworkSocket } from '../module/micro-mqtt';

interface EmittedEvent {
    event: string;
    args: any[];
}

export class MicroMqttClientTestSubclass extends MicroMqttClient {
    public emittedEvents: EmittedEvent[] = [];

    constructor(options: ConnectionOptions, network?: Network) {
        super(options, network);
        this.emit = (event: string, ...args: any[]) => {
            this.emittedEvents.push({ event: event, args: args });
            return true;
        };
    }

    public emittedInfo() {
        return this.emittedEvents.filter(e => e.event === 'info');
    }
}

export class TestNetwork implements Network {
    public connectIsCalled = false;
    public options: NetworkConnectOptions;
    public callback: (socket: NetworkSocket) => void;

    public connect(options: NetworkConnectOptions, callback: (socket: NetworkSocket) => void) {
        this.connectIsCalled = true;
        this.options = options;
        this.callback = callback;
    };
}

interface EventSubscription {
    event: string;
    listener: Function;
}

export class TestNetworkSocket implements NetworkSocket {
    public written: string[] = [];
    public eventSubscriptions: EventSubscription[] = [];

    public write(data: string) {
        this.written.push(data);
    };
    public on(event: string, listener: Function) {
        this.eventSubscriptions.push({ event: event, listener: listener });
    };
    public end: () => void;
}