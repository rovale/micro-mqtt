/**
 * The options used to connect to the MQTT broker.
 */
interface ConnectionOptions {
    host: string;
    port?: number;
    username?: string;
    password?: string;
    clientId?: string;
    will?: ConnectionOptionsWill;
}

interface ConnectionOptionsWill {
    topic: string;
    message: string;
    qos?: number;
    retain?: boolean;
}

export default ConnectionOptions;
