/**
 * A message received in a Publish packet.
 */
export interface Message {
    pid?: number;
    topic: string;
    content: string;
    qos: number;
    retain: number;
    next?: number;
}