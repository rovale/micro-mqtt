/**
 * Builders.
 */
import { ConnectReturnCode  } from '../module/micro-mqtt';
import ControlPacketType from '../module/ControlPacketType';
import { ClientTestSubclass, TestNetwork, TestNetworkSocket } from './TestClasses';

export class MqttClientTestSubclassBuilder {
    private client: ClientTestSubclass;

    public whichJustSentAConnectPacketOn(networkSocket: TestNetworkSocket, network: TestNetwork = new TestNetwork()) {
        this.client = new ClientTestSubclass({ host: 'some-host', clientId: 'some-client' }, network);
        this.client.connect();
        network.callback(networkSocket);
        this.client.clearEmittedEvents();
        return this;
    }

    public whichIsConnectedOn(networkSocket: TestNetworkSocket, network: TestNetwork = new TestNetwork()) {
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