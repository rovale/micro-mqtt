/// <reference path="../typings/main.d.ts" />
import { should } from 'chai';
import { MicroMqttClient, ConnectionOptions, Network } from '../modules/micro-mqtt';
should();

interface EmittedEvent{
  event : string;
  args: any[];
}

class MicroMqttClientTestSubclass extends MicroMqttClient {
  public emittedEvents : EmittedEvent[] = [];
  
  constructor(options: ConnectionOptions, network?: Network) {
    super(options, network)
    this.emit = (event: string, ...args: any[]) => {
      this.emittedEvents.push({event: event, args: args});
      return true
    };
  }
}

describe('MicroMqttClient', () => {
  var subject: MicroMqttClientTestSubclass;

  beforeEach(function () {
    subject = new MicroMqttClientTestSubclass({ host: "host" });
  });

  describe('connect', () => {
    it('should not throw any exception', () => {
      subject.connect();
      subject.emittedEvents.should.have.length(1);
      console.log(subject.emittedEvents[0].event);
      subject.emittedEvents[0].event.should.be('info');
      subject.emittedEvents[0].args.should.have.length(1);
      console.log(subject.emittedEvents);
    });
  });
});