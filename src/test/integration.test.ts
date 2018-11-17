/**
 * Integration tests for the MQTT client.
 */

// @ts-ignore
import { NodeClient } from './NodeClient';
import { Client } from '../module/micro-mqtt';

// tslint:disable-next-line: promise-function-async
const waitMax10SecondsFor: (expression: () => boolean) => Promise<void> = (expression: () => boolean): Promise<void> => {
    // tslint:disable-next-line:promise-must-complete typedef
    return new Promise((resolve) => {
        let attempts: number = 1;
        const poll: () => void = (): void => {
            setTimeout(() => {
                if (expression() || attempts > 100) {
                    resolve();
                } else {
                    attempts = attempts + 1;
                    poll();
                }
            },         100);
        };
        poll();
    });
};

describe('The MQTT client', () => {
    let client: Client;
    let isConnected: boolean;

    beforeEach(() => {
        // tslint:disable-next-line:no-unsafe-any
        client = new NodeClient({
            host: 'test.mosquitto.org',
            clientId: 'micro-mqtt',
            will: {
                topic: 'rovale/micro-mqtt/status',
                message: 'offline',
                qos: 1,
                retain: true
            }
        });

        isConnected = false;
        client.on('connected', () => {
            isConnected = true;
        });
    });

    afterEach(() => {
        client.disconnect();
    });

    it('should be able to connect to an MQTT broker.', async () => {
        client.connect();
        await waitMax10SecondsFor(() => isConnected);
        expect(isConnected).toBe(true);
    });
});
