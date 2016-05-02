/**
 * Test subclasses and mocks.
 */
/// <reference path='_common.ts' />
import { Client, Message } from '../module/micro-mqtt';
import { MqttNet } from '../module/mqtt-net';
import { Net, NetConnectOptions, Socket } from '../module/mqtt-net';
import ConnectionOptions from '../module/ConnectionOptions';

interface EmittedEvent {
    event: string;
    args: string | Message;
}

export class ClientTestSubclass extends Client {
    private emittedEvents: EmittedEvent[] = [];

    constructor(mqttNet: MqttNet, options: ConnectionOptions) {
        super(mqttNet, options);
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

export class MqttNetTestSubclass extends MqttNet {
    private mockNet: MockNet;
    private emittedEvents: EmittedEvent[] = [];

    constructor(host: string, port?: number, mockNet: MockNet = new MockNet()) {
        super(host, port, mockNet);
        this.mockNet = mockNet;
        this.emit = (event: string, args: string) => {
            this.emittedEvents.push({ event: event, args: args });
            return true;
        };
    }

    private shouldHaveEmitted(events: EmittedEvent[], text: string) {
        events.should.have.lengthOf(1);
        return events[0].args.should.equal(text);
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

    public clearEmittedEvents() {
        this.emittedEvents = [];
    }

    public callback(socket: Socket) {
        this.mockNet.callback(socket);
    }

    public connectIsCalledTwice() {
        return this.mockNet.connectIsCalledTwice;
    }
}

export class MockNet implements Net {
    public connectIsCalled = false;
    public connectIsCalledTwice = false;
    public options: NetConnectOptions;
    public callback: (socket: Socket) => void;

    public connect(options: NetConnectOptions, callback: (socket: Socket) => void) {
        if (this.connectIsCalled) {
            this.connectIsCalledTwice = true;
        } else {
            this.connectIsCalled = true;
        }
        this.options = options;
        this.callback = callback;
    };
}

interface EventSubscription {
    event: string;
    listener: Function;
}

export class MockSocket implements Socket {
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

    public end() {
        const listeners = this.eventSubscriptions.filter(s => s.event === 'end');
        listeners.should.have.length.greaterThan(0);
        listeners.forEach(s => s.listener());
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
