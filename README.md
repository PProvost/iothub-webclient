# IoTHub WebClient

Web application to connect to Azure IoT Hub from the browser (no server code required), written completely in JavaScript ES6

[![JavaScript Style Guide](https://cdn.rawgit.com/standard/standard/master/badge.svg)](https://github.com/standard/standard)

## https://mqtt.rido.dev 

## MQTT in the browser

This app uses the [Eclipse Paho JavaScript Client](https://www.eclipse.org/paho/clients/js/) to communicate to Azure IoT Hub as described in [Communicate with your IoT hub using the MQTT protocol](https://docs.microsoft.com/en-us/azure/iot-hub/iot-hub-mqtt-support)

## Sample code

```js
const client = new HubClient(host,
  this.connectionInfo.deviceId,
  this.connectionInfo.deviceKey,
  this.connectionInfo.modelId)

client.setDirectMehodCallback((method, payload) => {
    // execute command
})
        
client.setDesiredPropertyCallback((desired) => {
  // desired property received
})

await client.connect()
await client.updateTwin('{}')
```


## Authentication

Azure IoT Hub uses an HMAC signature to produce a SaS token used to authenticate the MQTT client. This client uses the HMAC primitives avaiable on modern browsers.

## Device features

Using MQTT the client can read **reported** and **desired** properties, but also **reported** properties can be updated.

Desired properties updates and **commands** will be received in a web socket callback.
