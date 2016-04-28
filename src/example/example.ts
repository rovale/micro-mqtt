/**
 * Example usage of the MqttClient.
 */
declare let global: any;

/* tslint:disable:no-unused-variable */
import { MqttClient, PublishPacket } from '../module/micro-mqtt';

function onInit() {
    /* tslint:disable:variable-name */
    const MqttClient = require('micro-mqtt').MqttClient;
    /* tslint:enable:no-unused-variable variable-name */
    const mqttClient: MqttClient = new MqttClient({
        host: '192.168.2.4',
        clientId: 'espruino',
        username: 'username', password: 'password',
        will: {
            topic: 'rovale/espruino/status',
            message: 'offline',
            qos: 1,
            retain: true
        }
    });

    mqttClient.on('connected', () => {
        mqttClient.subscribe('rovale/#', 1);
        mqttClient.publish('rovale/espruino/status', 'online', 1, true);
    });

    mqttClient.on('publish', (pub: PublishPacket) => {
        console.log('on publish');
        console.log(pub);
    });

    mqttClient.on('debug', (debug: string) => {
        console.log('[debug] ' + debug);
    });

    mqttClient.on('info', (info: string) => {
        console.log('[info] ' + info);
    });

    mqttClient.on('error', (error: string) => {
        console.log('[error] ' + error);
    });

    mqttClient.connect();

    global.mqttClient = mqttClient;
}