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

  describe('When connecting', () => {
    it('it should emit some information', () => {
      subject.connect();
      subject.emittedEvents.should.have.length(1);
      subject.emittedEvents[0].event.should.equal('info');
      subject.emittedEvents[0].args.should.have.length(1);
      subject.emittedEvents[0].args[0].should.equal(`Connecting MicroMqttClient ${subject.version} to host:1883`);
    });
  });
});