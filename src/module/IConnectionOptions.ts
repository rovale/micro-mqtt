/**
 * The options used to connect to the MQTT broker.
 */
interface IConnectionOptions {
    host: string;
    port?: number;
    username?: string;
    password?: string;
    clientId: string;
    will?: IConnectionOptionsWill;
}

interface IConnectionOptionsWill {
    topic: string;
    message: string;
    qos?: number;
    retain?: boolean;
}

export default IConnectionOptions;
