/**
 * Test subclasses and mocks.
 */
import IConnectionOptions from '../module/IConnectionOptions';
import IMessage from '../module/IMessage';
import { Client } from '../module/micro-mqtt';
import { INet, INetConnectOptions, ISocket } from '../module/Net';

export interface IEmittedEvent {
    event: string;
    args?: string | IMessage;
}

interface IEventSubscription {
    event: string;
    listener: Function;
}

export class MockSocket implements ISocket {
    public sentPackages: string[] = [];
    public eventSubscriptions: IEventSubscription[] = [];
    public ended: boolean = false;

    // tslint:disable-next-line:no-empty
    public setEncoding(encoding: string): void {
    }

    public write(data: string): void {
        this.sentPackages.push(data);
    }

    public receivePackage(data: string): void {
        const listeners: IEventSubscription[] = this.eventSubscriptions.filter((s : IEventSubscription) => s.event === 'data');
        listeners.should.have.length.greaterThan(0);
        // tslint:disable-next-line:no-unsafe-any
        listeners.forEach((s : IEventSubscription) => s.listener(data));
    }

    public close(): void {
        const listeners: IEventSubscription[] = this.eventSubscriptions.filter((s : IEventSubscription) => s.event === 'close');
        listeners.should.have.length.greaterThan(0);
        // tslint:disable-next-line:no-unsafe-any
        listeners.forEach((s : IEventSubscription) => s.listener());
    }

    public emitError(code: number, message: string): void {
        const listeners: IEventSubscription[] = this.eventSubscriptions.filter((s : IEventSubscription) => s.event === 'error');
        listeners.should.have.length.greaterThan(0);
        // tslint:disable-next-line:no-unsafe-any
        listeners.forEach((s : IEventSubscription) => s.listener({ code: code, message: message }));
    }

    public end(): void {
        this.ended = true;
    }

    public on(event: string, listener: Function): void {
        this.eventSubscriptions.push({ event: event, listener: listener });
    }

    public removeAllListeners(event: string): void {
        this.eventSubscriptions = this.eventSubscriptions.filter((s : IEventSubscription) => s.event !== event);
    }

    public clear(): void {
        this.sentPackages = [];
    }
}

export class MockNet implements INet {
    public connectIsCalled: boolean = false;
    public connectIsCalledTwice: boolean = false;
    public options?: INetConnectOptions;
    public socket: MockSocket;

    constructor(socket: MockSocket = new MockSocket()) {
        this.socket = socket;
    }

    public callback: () => void = () => { /* empty */ };

    public connect(options: INetConnectOptions, callback: () => void): ISocket {
        if (this.connectIsCalled) {
            this.connectIsCalledTwice = true;
        } else {
            this.connectIsCalled = true;
        }
        this.options = options;
        this.callback = callback;

        return this.socket;
    }
}

export class ClientTestSubclass extends Client {
    private emittedEvents: IEmittedEvent[] = [];

    constructor(options: IConnectionOptions, net: INet = new MockNet()) {
        super(options, net);
        this.emit = (event: string, args?: string | IMessage): boolean => {
            this.emittedEvents.push({ event: event, args: args });

            return true;
        };
    }

    public shouldHaveEmittedEvent(events: IEmittedEvent[], assert: (arg: string | IMessage | undefined) => Chai.Assertion): Chai.Assertion {
        events.should.have.lengthOf(1);

        return assert(events[0].args);
    }

    public emittedDebugInfo(): IEmittedEvent[] {
        return this.emittedEvents.filter((e: IEmittedEvent) => e.event === 'debug');
    }

    public shouldHaveEmittedDebugInfo(debugInfo: string): Chai.Assertion {
        return this.shouldHaveEmitted(this.emittedDebugInfo(), debugInfo);
    }

    public emittedInfo(): IEmittedEvent[] {
        return this.emittedEvents.filter((e: IEmittedEvent) => e.event === 'info');
    }

    public shouldHaveEmittedInfo(info: string): Chai.Assertion {
        return this.shouldHaveEmitted(this.emittedInfo(), info);
    }

    public emittedError(): IEmittedEvent[] {
        return this.emittedEvents.filter((e: IEmittedEvent) => e.event === 'error');
    }

    public shouldHaveEmittedError(error: string): Chai.Assertion {
        return this.shouldHaveEmitted(this.emittedError(), error);
    }

    public shouldNotEmitErrors(): void {
        this.emittedError().should.deep.equal([]);
    }

    public emittedConnected(): IEmittedEvent[] {
        return this.emittedEvents.filter((e: IEmittedEvent) => e.event === 'connected');
    }

    public emittedReceive(): IEmittedEvent[] {
        return this.emittedEvents.filter((e: IEmittedEvent) => e.event === 'receive');
    }

    public clearEmittedEvents(): void {
        this.emittedEvents = [];
    }

    private shouldHaveEmitted(events: IEmittedEvent[], text: string): Chai.Assertion {
        events.should.have.lengthOf(1);

        return (events[0].args || '').should.equal(text);
    }
}
