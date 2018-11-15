/**
 * Builders.
 */
import ConnectReturnCode from '../module/ConnectReturnCode';
import ControlPacketType from '../module/ControlPacketType';
import { ClientTestSubclass, MockNet, MockSocket } from './TestClasses';

export class ControlPacketBuilder {
    private controlPacketType: ControlPacketType;
    private connectReturnCode: ConnectReturnCode = ConnectReturnCode.Unknown;

    constructor(controlPacketType: ControlPacketType) {
        this.controlPacketType = controlPacketType;
    }

    public withConnectReturnCode(connectReturnCode: ConnectReturnCode) : ControlPacketBuilder {
        this.connectReturnCode = connectReturnCode;

        return this;
    }

    public build(): string {
        let result: string = String.fromCharCode(this.controlPacketType << 4);
        result += String.fromCharCode(0);
        result += String.fromCharCode(0);
        result += String.fromCharCode(this.connectReturnCode);

        return result;
    }
}

export class MqttClientTestSubclassBuilder {
    private client: ClientTestSubclass = new ClientTestSubclass({ host: 'some-host', clientId: 'some-client' });

    public whichJustSentAConnectPacketOn(net: MockNet = new MockNet(new MockSocket())) : MqttClientTestSubclassBuilder {
        this.client = new ClientTestSubclass({ host: 'some-host', clientId: 'some-client' }, net);
        this.client.connect();
        net.callback();
        this.client.clearEmittedEvents();

        return this;
    }

    public whichIsConnectedOn(net: MockNet = new MockNet(new MockSocket())): MqttClientTestSubclassBuilder {
        this.whichJustSentAConnectPacketOn(net);

        const connAckPacket: string = new ControlPacketBuilder(ControlPacketType.ConnAck)
            .withConnectReturnCode(ConnectReturnCode.Accepted)
            .build();

        const socket: MockSocket = net.socket;
        socket.receivePackage(connAckPacket);
        socket.clear();
        this.client.clearEmittedEvents();

        return this;
    }

    public build(): ClientTestSubclass {
        return this.client;
    }
}
