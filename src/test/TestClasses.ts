/**
 * Test subclasses and mocks.
 */
// tslint:disable-next-line:no-reference
/// <reference path='_common.ts'/>
import { Client } from '../module/micro-mqtt';
import { ConnectionOptions } from '../module/ConnectionOptions';
import { Message } from '../module/Message';
import { Socket } from '../module/Net';
import { EventEmitter } from 'events';

interface EmittedEvent {
    event: string;
    args?: string | Message;
}

export class ClientTestSubclass extends Client {
    private emittedEvents: EmittedEvent[] = [];

    constructor(options: ConnectionOptions, socket: Socket) {
        super(options, socket);
        this.emit = (event: string, args?: string | Message) => {
            this.emittedEvents.push({ event: event, args: args });
            return true;
        };
    }

    private shouldHaveEmitted(events: EmittedEvent[], text: string) {
        events.should.have.lengthOf(1);
        return (events[0].args || '').should.equal(text);
    }

    public shouldHaveEmittedEvent(events: EmittedEvent[], assert: (arg: string | Message) => Chai.Assertion) {
        events.should.have.lengthOf(1);
        return assert(events[0].args || '');
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

export class MockSocket extends EventEmitter implements Socket  {
    public sentPackages: Buffer[] = [];
    public eventSubscriptions: EventSubscription[] = [];
    public ended: boolean = false;

    public connectIsCalled: boolean = false;
    public connectIsCalledTwice: boolean = false;

    public host: string;
    public port: number;

    public connectionListener() {
        this.emit('connect');
    }

    public write(data: Buffer) {
        this.sentPackages.push(data);
    }

    public receivePackage(data: Buffer) {
        this.emit('data', data);
    }

    public close() {
        this.emit('close');
    }

    public emitError(code: number, message: string) {
        this.emit('error', { code: code, message: message });
    }

    public end() {
        this.ended = true;
    }

    public clear() {
        this.sentPackages = [];
    }

    public connect(port: number, host: string ) {
        if (this.connectIsCalled) {
            this.connectIsCalledTwice = true;
        } else {
            this.connectIsCalled = true;
        }

        this.port = port;
        this.host = host;

        return this;
    }
}

interface EventSubscription {
    event: string;
    listener: Function;
}
