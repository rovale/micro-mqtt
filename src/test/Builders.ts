/**
 * Builders.
 */
import { ConnectReturnCode  } from '../module/micro-mqtt';
import ControlPacketType from '../module/ControlPacketType';
import { ClientTestSubclass, NetTestSubclass, MockNetwork, MockNetworkSocket } from './TestClasses';

export class ClientTestSubclassBuilder {
    private client: ClientTestSubclass;

    public whichJustSentAConnectPacketOn(networkSocket: MockNetworkSocket, network: MockNetwork = new MockNetwork()) {
        this.client = new ClientTestSubclass(network, { host: 'some-host', clientId: 'some-client' });
        this.client.connect();
        network.callback(networkSocket);
        this.client.clearEmittedEvents();
        return this;
    }

    public whichIsConnectedOn(networkSocket: MockNetworkSocket, network: MockNetwork = new MockNetwork()) {
        this.whichJustSentAConnectPacketOn(networkSocket, network);

        const connAckPacket = new ControlPacketBuilder(ControlPacketType.ConnAck)
            .withConnectReturnCode(ConnectReturnCode.Accepted)
            .build();

        networkSocket.receivePackage(connAckPacket);
        networkSocket.clear();
        this.client.clearEmittedEvents();
        return this;
    }

    public build() {
        return this.client;
    }
}

export class NetTestSubclassBuilder {
    private result: NetTestSubclass;

    public whichIsConnectedOn(networkSocket: MockNetworkSocket, network: MockNetwork = new MockNetwork()) {
        this.result = new NetTestSubclass(network);
        this.result.connect({host: 'some-host', port: 1234});
        network.callback(networkSocket);
        this.result.clearEmittedEvents();
        return this;
    }

    public build() {
        return this.result;
    }
}

export class ControlPacketBuilder {
    private controlPacketType: ControlPacketType;
    private connectReturnCode: ConnectReturnCode;

    constructor(controlPacketType: ControlPacketType) {
        this.controlPacketType = controlPacketType;
    }

    public withConnectReturnCode(connectReturnCode: ConnectReturnCode) {
        this.connectReturnCode = connectReturnCode;
        return this;
    }

    public build() {
        let result = String.fromCharCode(this.controlPacketType << 4);
        result += String.fromCharCode(0);
        result += String.fromCharCode(0);
        result += String.fromCharCode(this.connectReturnCode);
        return result;
    }
}