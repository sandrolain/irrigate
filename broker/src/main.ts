import {createBroker} from "aedes";
import { createServer } from "aedes-server-factory";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const aedesPersistenceMongoDB = require("aedes-persistence-mongodb");

const PORT = 1883;
const MONGODB_URI = "mongodb://root:mypassword@mongodb:27017/aedes?authSource=admin"

const persistence = aedesPersistenceMongoDB({
  url: MONGODB_URI, // Optional when you pass db object
  // Optional ttl settings
  ttl: {
    packets: 300, // Number of seconds
    subscriptions: 300,
  }
})

const aedes = createBroker({
  persistence
})
const server = createServer(aedes, {
  ws: true
});

server.on('error', function (err) {
  console.log('Server error', err)
  process.exit(1)
})

aedes.on('subscribe', function (subscriptions, client) {
  console.log('MQTT client \x1b[32m' + (client ? client.id : client) +
          '\x1b[0m subscribed to topics: ' + subscriptions.map(s => s.topic).join('\n'), 'from broker', aedes.id)
})

aedes.on('unsubscribe', function (subscriptions, client) {
  console.log('MQTT client \x1b[32m' + (client ? client.id : client) +
          '\x1b[0m unsubscribed to topics: ' + subscriptions.join('\n'), 'from broker', aedes.id)
})

// fired when a client connects
aedes.on('client', function (client) {
  console.log('Client Connected: \x1b[33m' + (client ? client.id : client) + '\x1b[0m', 'to broker', aedes.id)
})

// fired when a client disconnects
aedes.on('clientDisconnect', function (client) {
  console.log('Client Disconnected: \x1b[31m' + (client ? client.id : client) + '\x1b[0m', 'to broker', aedes.id)
})

// fired when a message is published
aedes.on('publish', async function (packet, client) {
  console.log('Client \x1b[31m' + (client ? client.id : 'BROKER_' + aedes.id) + '\x1b[0m has published', packet.payload.toString(), 'on', packet.topic, 'to broker', aedes.id)
})

server.listen(PORT, function () {
  console.log('server started and listening on port ', PORT)
})
