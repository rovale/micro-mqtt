/**
 * A message received in a Publish packet.
 */
interface IMessage {
    pid?: number;
    topic: string;
    content: string;
    qos: number;
    retain: number;
    next?: number;
}

export default IMessage;
