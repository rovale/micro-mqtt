/**
 * Tests for the MQTT client.
 */
/// <reference path='_common.ts' />
import { NetworkSocket } from '../module/mqtt-net';
import { NetTestSubclass, MockNetwork, MockNetworkSocket } from './TestClasses';
import { NetTestSubclassBuilder } from './Builders';
import * as sinon from 'sinon';

describe('The MQTT over TCP/IP sockets', () => {
    let subject: NetTestSubclass;
    let networkSocket: MockNetworkSocket;

    context('When establishing a network connection', () => {
        let network: MockNetwork;

        context('to a specific host and port', () => {
            beforeEach(() => {
                network = new MockNetwork();
                network.connectIsCalled.should.equal(false, 'did not expect the client to connect to the network yet');
                subject = new NetTestSubclass(network);
                subject.connect({ host: 'some-host', port: 1234 });
            });

            it('it should emit information about this action.', () => {
                subject.shouldHaveEmittedInfo('Connecting to some-host:1234');
            });

            it('it should try to establish a connection to the expected host and port.', () => {
                network.connectIsCalled.should.equal(true, 'expected the client to connect to the network');
                network.options.host.should.equal('some-host');
                network.options.port.should.equal(1234);
            });
        });
    });

    context('When the network connection is not established within 5 seconds', () => {
        let network: MockNetwork;
        let clock: Sinon.SinonFakeTimers;

        beforeEach(() => {
            clock = sinon.useFakeTimers();

            network = new MockNetwork();
            subject = new NetTestSubclass(network);
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
            network.connectIsCalledTwice.should.equal(false, 'because it is the first attempt.');
            clock.tick(5000);
            network.connectIsCalledTwice.should.equal(true, 'because it should try it again.');
        });
    });

    context('When the network connection is established', () => {
        let network: MockNetwork;
        let expectedSocket: MockNetworkSocket;
        let actualSocket: NetworkSocket;

        beforeEach(() => {
            network = new MockNetwork();
            subject = new NetTestSubclass(network);
            subject.connect({ host: 'some-host', port: 1234 }, socket => actualSocket = socket);
            expectedSocket = new MockNetworkSocket();
            network.callback(expectedSocket);
        });

        it('it should invoke the callback.', () => {
            actualSocket.should.equal(expectedSocket);
        });
    });

    context('When the network connection is lost', () => {
        let clock: Sinon.SinonFakeTimers;
        let network: MockNetwork;

        beforeEach(() => {
            clock = sinon.useFakeTimers();
            network = new MockNetwork();
            networkSocket = new MockNetworkSocket();

            subject = new NetTestSubclassBuilder()
                .whichIsConnectedOn(networkSocket, network)
                .build();

            networkSocket.end();
        });

        afterEach(() => {
            clock.restore();
        });

        it('it should emit an error.', () => {
            subject.shouldHaveEmittedError('Connection lost. Reconnecting.');
        });

        it('it should reconnect.', () => {
            network.connectIsCalledTwice.should.equal(true, 'because it should reconnect.');
        });
    });
});