/**
 * Test subclasses and mocks.
 */
/// <reference path='_common.ts' />
import { Client } from '../module/micro-mqtt';
import ConnectionOptions from '../module/ConnectionOptions';
import Message from '../module/Message';
import { Net, NetConnectOptions, Socket, Wifi } from '../module/Net';

interface EmittedEvent {
    event: string;
    args: string | Message;
}

class ConnectedWifi implements Wifi {
    public getStatus() { return { station: 'connected' }; }
}

export class NotConnectedWifi implements Wifi {
    public getStatus() { return { station: 'off' }; }
}

export class ClientTestSubclass extends Client {
    private emittedEvents: EmittedEvent[] = [];

    constructor(options: ConnectionOptions, net?: Net, wifi: Wifi = new ConnectedWifi()) {
        super(options, net, wifi);
        this.emit = (event: string, args: string | Message) => {
            this.emittedEvents.push({ event: event, args: args });
            return true;
        };
    }

    private shouldHaveEmitted(events: EmittedEvent[], text: string) {
        events.should.have.lengthOf(1);
        return events[0].args.should.equal(text);
    }

    public shouldHaveEmittedEvent(events: EmittedEvent[], assert: (arg: string | Message) => Chai.Assertion) {
        events.should.have.lengthOf(1);
        return assert(events[0].args);
    }

    public emittedDebugInfo() {
        return this.emittedEvents.filter(e => e.event === 'debug');
    }

    public shouldHaveEmittedDebugInfo(debugInfo: string) {
        return this.shouldHaveEmitted(this.emittedDebugInfo(), debugInfo);
    }

    public emittedInfo() {
        return this.emittedEvents.filter(e => e.event === 'info');
    }

    public shouldHaveEmittedInfo(info: string) {
        return this.shouldHaveEmitted(this.emittedInfo(), info);
    }

    public emittedError() {
        return this.emittedEvents.filter(e => e.event === 'error');
    }

    public shouldHaveEmittedError(error: string) {
        return this.shouldHaveEmitted(this.emittedError(), error);
    }

    public shouldNotEmitErrors() {
        this.emittedError().should.deep.equal([]);
    }

    public emittedConnected() {
        return this.emittedEvents.filter(e => e.event === 'connected');
    }

    public emittedReceive() {
        return this.emittedEvents.filter(e => e.event === 'receive');
    }

    public clearEmittedEvents() {
        this.emittedEvents = [];
    }
}

export class MockNet implements Net {
    public connectIsCalled = false;
    public connectIsCalledTwice = false;
    public options: NetConnectOptions;
    public callback: () => void;
    public socket: MockSocket;

    constructor(socket: MockSocket = new MockSocket()) {
        this.socket = socket;
    }

    public connect(options: NetConnectOptions, callback: () => void) {
        if (this.connectIsCalled) {
            this.connectIsCalledTwice = true;
        } else {
            this.connectIsCalled = true;
        }
        this.options = options;
        this.callback = callback;

        return this.socket;
    };
}

interface EventSubscription {
    event: string;
    listener: Function;
}

export class MockSocket implements Socket {
    public sentPackages: string[] = [];
    public eventSubscriptions: EventSubscription[] = [];
    public ended = false;

    public write(data: string) {
        this.sentPackages.push(data);
    };

    public receivePackage(data: string) {
        const listeners = this.eventSubscriptions.filter(s => s.event === 'data');
        listeners.should.have.length.greaterThan(0);
        listeners.forEach(s => s.listener(data));
    };

    public close() {
        const listeners = this.eventSubscriptions.filter(s => s.event === 'close');
        listeners.should.have.length.greaterThan(0);
        listeners.forEach(s => s.listener());
    };

    public emitError(code: number, message: string) {
        const listeners = this.eventSubscriptions.filter(s => s.event === 'error');
        listeners.should.have.length.greaterThan(0);
        listeners.forEach(s => s.listener({ code: code, message: message }));
    };

    public end() {
        this.ended = true;
    };

    public on(event: string, listener: Function) {
        this.eventSubscriptions.push({ event: event, listener: listener });
    };

    public removeAllListeners(event: string) {
        this.eventSubscriptions = this.eventSubscriptions.filter(s => s.event !== event);
    };

    public clear() {
        this.sentPackages = [];
    }
}
