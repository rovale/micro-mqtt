/**
 * Builders.
 */
import ConnectReturnCode from '../module/ConnectReturnCode';
import ControlPacketType from '../module/ControlPacketType';
import { ClientTestSubclass, MockNet, MockSocket } from './TestClasses';

export class MqttClientTestSubclassBuilder {
    private client: ClientTestSubclass;

    public whichJustSentAConnectPacketOn(net: MockNet = new MockNet(new MockSocket())) {
        this.client = new ClientTestSubclass({ host: 'some-host', clientId: 'some-client' }, net);
        this.client.connect();
        net.callback();
        this.client.clearEmittedEvents();
        return this;
    }

    public whichIsConnectedOn(net: MockNet = new MockNet(new MockSocket())) {
        this.whichJustSentAConnectPacketOn(net);

        const connAckPacket = new ControlPacketBuilder(ControlPacketType.ConnAck)
            .withConnectReturnCode(ConnectReturnCode.Accepted)
            .build();

        let socket = net.socket;
        socket.receivePackage(connAckPacket);
        socket.clear();
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