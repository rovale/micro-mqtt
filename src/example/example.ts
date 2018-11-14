/**
 * Example usage of the MqttClient.
 */
declare let global: any;

/* tslint:disable:no-unused-variable */
import { Client } from '../module/micro-mqtt';
import Message from '../module/Message';

function onInit() {
    /* tslint:disable:variable-name */
    const Client = require('micro-mqtt').Client;
    /* tslint:enable:no-unused-variable variable-name */
    const client: Client = new Client({
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

    client.on('connected', () => {
        client.subscribe('rovale/#', 1);
        client.publish('rovale/espruino/status', 'online', 1, true);
    });

    client.on('receive', (message: Message) => {
        console.log('on receive');
        console.log(message);
    });

    client.on('debug', (debug: string) => {
        console.log('[debug] ' + debug);
    });

    client.on('info', (info: string) => {
        console.log('[info] ' + info);
    });

    client.on('error', (error: string) => {
        console.log('[error] ' + error);
    });

    client.connect();

    global.client = client;

    eval('delete onInit');
}