/**
 * Builders.
 */
import { ConnectReturnCode  } from '../module/micro-mqtt';
import ControlPacketType from '../module/ControlPacketType';
import { ClientTestSubclass, NetTestSubclass, MockNet, MockSocket } from './TestClasses';

export class ClientTestSubclassBuilder {
    private client: ClientTestSubclass;

    public whichJustSentAConnectPacketOn(socket: MockSocket, net: MockNet = new MockNet()) {
        this.client = new ClientTestSubclass(net, { host: 'some-host', clientId: 'some-client' });
        this.client.connect();
        net.callback(socket);
        this.client.clearEmittedEvents();
        return this;
    }

    public whichIsConnectedOn(socket: MockSocket, net: MockNet = new MockNet()) {
        this.whichJustSentAConnectPacketOn(socket, net);

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

export class NetTestSubclassBuilder {
    private result: NetTestSubclass;

    public whichIsConnectedOn(socket: MockSocket, net: MockNet = new MockNet()) {
        this.result = new NetTestSubclass(net);
        this.result.connect({host: 'some-host', port: 1234});
        net.callback(socket);
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