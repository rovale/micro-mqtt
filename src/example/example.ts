/**
 * Example usage of the MqttClient.
 */
import { Client } from '../module/micro-mqtt';
import { Message } from '../module/Message';
import { Socket } from 'net';

function onInit() {
    const client: Client = new Client({
        host: '192.168.2.4',
        clientId: 'clientId',
        username: 'username', password: 'password',
        will: {
            topic: 'rovale/clientId/status',
            message: 'offline',
            qos: 1,
            retain: true
        }
    }, new Socket());

    client.on('connected', () => {
        client.subscribe('rovale/#', 1);
        client.publish('rovale/clientId/status', 'online', 1, true);
    });

    client.on('receive', (message: string | Message) => {
        console.log('on receive');
        console.log(message);
    });

    client.on('debug', (debug: string | Message) => {
        console.log('[debug] ' + debug);
    });

    client.on('info', (info: string | Message) => {
        console.log('[info] ' + info);
    });

    client.on('error', (error: string | Message) => {
        console.log('[error] ' + error);
    });

    client.connect();
}

onInit();