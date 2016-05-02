/**
 * The options used to connect to the MQTT broker.
 */
interface ConnectionOptions {
    username?: string;
    password?: string;
    clientId?: string;
    will?: Will;
}

interface Will {
    topic: string;
    message: string;
    qos?: number;
    retain?: boolean;
}

export default ConnectionOptions;
