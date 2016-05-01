/**
 * Tests for the MQTT client.
 */
/// <reference path='_common.ts' />
import { Socket } from '../module/mqtt-net';
import { NetTestSubclass, MockNet, MockSocket } from './TestClasses';
import { NetTestSubclassBuilder } from './Builders';
import * as sinon from 'sinon';

describe('The MQTT over TCP/IP sockets', () => {
    let subject: NetTestSubclass;
    let socket: MockSocket;

    context('When establishing a network connection', () => {
        let net: MockNet;

        context('to a specific host and port', () => {
            beforeEach(() => {
                net = new MockNet();
                net.connectIsCalled.should.equal(false, 'did not expect the client to connect to the network yet');
                subject = new NetTestSubclass(net);
                subject.connect({ host: 'some-host', port: 1234 });
            });

            it('it should emit information about this action.', () => {
                subject.shouldHaveEmittedInfo('Connecting to some-host:1234');
            });

            it('it should try to establish a connection to the expected host and port.', () => {
                net.connectIsCalled.should.equal(true, 'expected the client to connect to the network');
                net.options.host.should.equal('some-host');
                net.options.port.should.equal(1234);
            });
        });
    });

    context('When the network connection is not established within 5 seconds', () => {
        let net: MockNet;
        let clock: Sinon.SinonFakeTimers;

        beforeEach(() => {
            clock = sinon.useFakeTimers();

            net = new MockNet();
            subject = new NetTestSubclass(net);
            subject.connect({ host: 'some-host', port: 1234 });
        });

        afterEach(() => {
            clock.reset();
        });

        it('it should emit an error.', () => {
            clock.tick(5000);
            subject.shouldHaveEmittedError('Network connection timeout. Retrying.');
        });

        it('it should try it again.', () => {
            net.connectIsCalledTwice.should.equal(false, 'because it is the first attempt.');
            clock.tick(5000);
            net.connectIsCalledTwice.should.equal(true, 'because it should try it again.');
        });
    });

    context('When the network connection is established', () => {
        let net: MockNet;
        let expectedSocket: MockSocket;
        let actualSocket: Socket;

        beforeEach(() => {
            net = new MockNet();
            subject = new NetTestSubclass(net);
            subject.connect({ host: 'some-host', port: 1234 }, socket => actualSocket = socket);
            expectedSocket = new MockSocket();
            net.callback(expectedSocket);
        });

        it('it should invoke the callback.', () => {
            actualSocket.should.equal(expectedSocket);
        });
    });

    context('When the network connection is lost', () => {
        let clock: Sinon.SinonFakeTimers;
        let net: MockNet;

        beforeEach(() => {
            clock = sinon.useFakeTimers();
            net = new MockNet();
            socket = new MockSocket();

            subject = new NetTestSubclassBuilder()
                .whichIsConnectedOn(socket, net)
                .build();

            socket.end();
        });

        afterEach(() => {
            clock.restore();
        });

        it('it should emit an error.', () => {
            subject.shouldHaveEmittedError('Connection lost. Reconnecting.');
        });

        it('it should reconnect.', () => {
            net.connectIsCalledTwice.should.equal(true, 'because it should reconnect.');
        });
    });
});