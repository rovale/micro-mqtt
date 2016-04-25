/**
 * The options used to connect to the MQTT broker.
 */
interface ConnectionOptions {
    host: string;
    port?: number;
    username?: string;
    password?: string;
    clientId?: string;
}

export default ConnectionOptions;
