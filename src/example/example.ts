/**
 * Example usage of the MqttClient.
 */
declare let global: any;

/* tslint:disable:no-unused-variable */
import { Net } from '../module/mqtt-net';
import { Client, Message } from '../module/micro-mqtt';

function onInit() {
    /* tslint:disable:variable-name */
    const Net = require('mqtt-net').Net;
    const Client = require('micro-mqtt').Client;
    /* tslint:enable:no-unused-variable variable-name */
    const net = new Net();

    const client: Client = new Client(
        net,
        {
            host: '192.168.2.4',
            clientId: 'espruino',
            username: 'username', password: 'password',
            will: {
                topic: 'rovale/espruino/status',
                message: 'offline',
                qos: 1,
                retain: true
            }
        }
    );

    net.on('info', (info: string) => {
        console.log('[net - info] ' + info);
    });

    net.on('error', (error: string) => {
        console.log('[net - error] ' + error);
    });

    client.on('connected', () => {
        client.subscribe('rovale/#', 1);
        client.publish('rovale/espruino/status', 'online', 1, true);
    });

    client.on('receive', (message: Message) => {
        console.log('on receive');
        console.log(message);
    });

    client.on('debug', (debug: string) => {
        console.log('[client - debug] ' + debug);
    });

    client.on('info', (info: string) => {
        console.log('[client - info] ' + info);
    });

    client.on('error', (error: string) => {
        console.log('[client - error] ' + error);
    });

    client.connect();

    global.client = client;
}