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
    private emittedEvents: EmittedEvent[] = [];

    constructor(options: ConnectionOptions, network?: Network) {
        super(options, network);
        this.emit = (event: string, ...args: any[]) => {
            this.emittedEvents.push({ event: event, args: args });
            return true;
        };
    }

    public emittedDebugInfo() {
        return this.emittedEvents.filter(e => e.event === 'debug');
    }

    public emittedInfo() {
        return this.emittedEvents.filter(e => e.event === 'info');
    }

    public emittedError() {
        return this.emittedEvents.filter(e => e.event === 'error');
    }

    public emittedConnected() {
        return this.emittedEvents.filter(e => e.event === 'connected');
    }

    public clearEmittedEvents() {
        this.emittedEvents = [];
    }

    public shouldNotEmitErrors() {
        this.emittedError().should.deep.equal([]);
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
    public sentPackages: string[] = [];
    public eventSubscriptions: EventSubscription[] = [];

    public write(data: string) {
        this.sentPackages.push(data);
    };

    public receivePackage(data: string) {
        const listeners = this.eventSubscriptions.filter(s => s.event === 'data');
        listeners.should.have.length.greaterThan(0);
        listeners.forEach(s => s.listener(data));
    };

    public on(event: string, listener: Function) {
        this.eventSubscriptions.push({ event: event, listener: listener });
    };

    public clear() {
        this.sentPackages = [];
    }

    public end: () => void;
}
