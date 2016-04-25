/**
 * Builders.
 */
import { ConnectReturnCode  } from '../module/micro-mqtt';
import ControlPacketType from '../module/ControlPacketType';
import { MicroMqttClientTestSubclass, TestNetwork, TestNetworkSocket } from './TestClasses';

export class MicroMqttClientTestSubclassBuilder {
    private client: MicroMqttClientTestSubclass;

    public whichJustSentAConnectPacketOn(networkSocket: TestNetworkSocket) {
        const network = new TestNetwork();
        this.client = new MicroMqttClientTestSubclass({ host: 'some-host', clientId: 'some-client' }, network);
        this.client.connect();
        network.callback(networkSocket);
        this.client.clearEmittedEvents();
        return this;
    }

    public whichIsConnectedOn(networkSocket: TestNetworkSocket) {
        this.whichJustSentAConnectPacketOn(networkSocket);

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