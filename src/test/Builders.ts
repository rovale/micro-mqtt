/**
 * Builders.
 */
import { ConnectReturnCode  } from '../module/micro-mqtt';
import ControlPacketType from '../module/ControlPacketType';
import { ClientTestSubclass, MqttNetTestSubclass, MockNet, MockSocket } from './TestClasses';

export class ClientTestSubclassBuilder {
    private client: ClientTestSubclass;

    public whichJustSentAConnectPacketOn(socket: MockSocket, mqttNet: MqttNetTestSubclass = new MqttNetTestSubclass('some-host')) {
        this.client = new ClientTestSubclass(mqttNet, { clientId: 'some-client' });
        this.client.connect();
        mqttNet.callback(socket);
        this.client.clearEmittedEvents();
        return this;
    }

    public whichIsConnectedOn(socket: MockSocket, mqttNet: MqttNetTestSubclass = new MqttNetTestSubclass('some-host')) {
        this.whichJustSentAConnectPacketOn(socket, mqttNet);

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
    private result: MqttNetTestSubclass;

    public whichIsConnectedOn(socket: MockSocket, net: MockNet = new MockNet()) {
        this.result = new MqttNetTestSubclass('some-host', 1234, net);
        this.result.connect();
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