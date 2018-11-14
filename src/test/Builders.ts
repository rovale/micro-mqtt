/**
 * Builders.
 */
import { ConnectReturnCode } from '../module/ConnectReturnCode';
import { ControlPacketType } from '../module/ControlPacketType';
import { Socket } from '../module/Net';
import { ClientTestSubclass, MockSocket } from './TestClasses';
import { Protocol } from '../module/micro-mqtt';

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
        let packet = String.fromCharCode(this.controlPacketType << 4);
        packet += String.fromCharCode(0);
        packet += String.fromCharCode(0);
        packet += String.fromCharCode(this.connectReturnCode);

        return Protocol.toBuffer(packet);
    }
}

export class MqttClientTestSubclassBuilder {
    private client: ClientTestSubclass;

    public whichJustSentAConnectPacketOn(socket: MockSocket = new MockSocket()) {
        this.client = new ClientTestSubclass({ host: 'some-host', clientId: 'some-client' }, socket);
        this.client.connect();
        socket.connectionListener();
        this.client.clearEmittedEvents();
        return this;
    }

    public whichIsConnectedOn(socket: MockSocket = new MockSocket()) {
        this.whichJustSentAConnectPacketOn(socket);

        const connAckPacket = new ControlPacketBuilder(ControlPacketType.ConnAck)
            .withConnectReturnCode(ConnectReturnCode.Accepted)
            .build();

        socket.receivePackage(connAckPacket);
        socket.clear();
        this.client.clearEmittedEvents();
        return this;
    }

    public build() {
        return this.client;
    }
}