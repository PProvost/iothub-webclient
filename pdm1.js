import { AzDpsClient, createHmac } from './AzDpsClient.js'
import { AzIoTHubClient, ackPayload } from './AzIoTHubClient.js'

const createApp = () => {
  let telemetryInterval
  /** @type {AzIoTHubClient} client */
  let client
  // @ts-ignore
  const app = new Vue({
    el: '#app',
    data: {
      saveConfig: false,
      viewDpsForm: false,
      disableDeviceKey: false,
      runningProvision: false,
      connectionInfo: {
        scopeId: '0ne004D6589',
        hubName: '',
        deviceId: 'motion_sensor_1',
        deviceKey: 'w/j9/hMtShumcrOuiC7683gtabCNhQ3yS61yMMZbM9w=',
        modelId: 'dtmi:mydevicesinc:netvox:rb11e_motion;1',
        status: 'Disconnected',
        masterKey: 'SW0DLKyf5MNB59mSOI55ESy5crLSLUhrzy2vLhAf1fH8TIldeaZpsj8mxZ5A6QalpGuqtFj9h3wc0umPie07PQ==',
        connected: false
      },
      /** @type {Array<CommandInfo>} */
      commands: [],
      reportedJson: '{}',
      desiredJson: '{}',
      desiredCalls: [],
      reportedPropJson: '{ deviceStatus: "200 OK" }',
      telemetryJson: '{ channel_3: 21.3, channel_5: 96.2, channel_8: 52.3, channel_9: 1.0 }',
      sentMessages: 0,
      isTelemetryRunning: false,
      isMotionDetected: false,
      motionValue: 0,
      currentTemp: 25,
      telemetry: {
        "channel_3": 20.0,
        "channel_5": 50,
        "channel_8": 20,
        "channel_9": 0,
        "channel_100": 0
      }
    },
    async created () {
      /** @type { ConnectionInfo } connInfo */
      const connInfo = this.connectionInfo

      connInfo.deviceId = connInfo.deviceId || 'device' + Date.now()

      if (connInfo.scopeId) {
        this.connectionInfo.scopeId = connInfo.scopeId
        if (connInfo.masterKey) {
          this.connectionInfo.masterKey = connInfo.masterKey
          this.connectionInfo.deviceKey = await createHmac(this.connectionInfo.masterKey, this.connectionInfo.deviceId)
        }
      }

      // if (connInfo.hubName) {
      //   this.connectionInfo.hubName = connInfo.hubName
      //   this.connectionInfo.deviceId = connInfo.deviceId
      //   this.connectionInfo.deviceKey = connInfo.deviceKey
      //   this.connectionInfo.modelId = connInfo.modelId
      // }
    },
    methods: {
      async provision () {
        // window.localStorage.setItem('connectionInfo',
        //     JSON.stringify(
        //       {
        //         scopeId: this.connectionInfo.scopeId,
        //         hubName: this.connectionInfo.hubName,
        //         deviceId: this.connectionInfo.deviceId,
        //         deviceKey: this.connectionInfo.deviceKey,
        //         masterKey: this.connectionInfo.masterKey,
        //         modelId: this.connectionInfo.modelId
        //       }))
        const dpsClient = new AzDpsClient(this.connectionInfo.scopeId, this.connectionInfo.deviceId, this.connectionInfo.deviceKey, this.connectionInfo.modelId)
        this.runningProvision = true
        const result = await dpsClient.registerDevice()
        this.runningProvision = false
        if (result.status === 'assigned') {
          this.connectionInfo.hubName = result.registrationState.assignedHub
        } else {
          this.connectionInfo.hubName = result.status
        }
        console.log("3" + this.connectionInfo.hubName)
        this.viewDpsForm = false
      },
      async refreshDeviceId() {
        this.connectionInfo.deviceId = 'device' + Date.now()
        await this.updateDeviceKey()
      },
      async connect () {
        const result = await this.provision()
        console.log("##" + result)
        let host = this.connectionInfo.hubName
        if (host.indexOf('.azure-devices.net') === -1) {
          host += '.azure-devices.net'
        }
        client = new AzIoTHubClient(host,
          this.connectionInfo.deviceId,
          this.connectionInfo.deviceKey,
          this.connectionInfo.modelId)
        client.setDirectMehodCallback((method, payload, rid) => {
          const response = JSON.stringify({ responsePayload: 'sample response' })
          /** @type {CommandInfo} */
          const command = { method, payload, rid, response, dirty: false }
          this.commands.push(command)
        })
        client.setDesiredPropertyCallback(desired => {
          this.desiredCalls.push(desired)
          this.readTwin()
        })
        client.disconnectCallback = (err) => {
          console.log(err)
          this.connectionInfo.connected = false
          this.connectionInfo.status = 'Disconnected'
        }
        await client.connect()
        this.connectionInfo.status = 'Connected'
        this.connectionInfo.connected = true
        await this.readTwin()
      },
      async readTwin () {
        if (client.connected) {
          const twin = await client.getTwin()
          this.reportedJson = JSON.stringify(twin.reported)
          this.desiredJson = JSON.stringify(twin.desired)
        } else {
          console.log('not connected')
        }
      },
      async reportProp () {
        const payload = this.reportedPropJson
        const updateResult = await client.updateTwin(payload)
        if (updateResult === 204) {
          await this.readTwin()
        }
      },
      /**
       *
       * @param {CommandInfo} cmd
       * @param {number} status
       */
      cmdResponse (cmd, status) {
        // console.log('sending response ' + method + response + rid)
        client.commandResponse(cmd.method, cmd.response, cmd.rid, status)
        cmd.dirty = true
      },
      clearCommands () {
        this.commands = []
      },
      startTelemetry_orig () {
        telemetryInterval = setInterval(() => {
          this.sentMessages++
          const telemetryMessage = this.telemetryJson.replace('%d', this.sentMessages)
          client.sendTelemetry(telemetryMessage)
        }, 1000)
        this.isTelemetryRunning = true
      },
      startTelemetry () {
        telemetryInterval = setInterval(() => {
          this.sentMessages++
          const telemetryMessage = JSON.stringify(this.telemetry)
          client.sendTelemetry(telemetryMessage)
        }, 1000)
        this.isTelemetryRunning = true
      },
      stopTelemetry () {
        clearInterval(telemetryInterval)
        this.isTelemetryRunning = false
        this.sentMessages = 0
      },
      updateMotion() {
        this.telemetry.channel_9 = this.isMotionDetected ? 0 : 1
      },
      async ackDesired (dc, status) {
        const dco = JSON.parse(dc)
        const payload = ackPayload(dco, status, dco.$version)
        const updateResult = await client.updateTwin(JSON.stringify(payload))
        if (updateResult === 204) {
          await this.readTwin()
          this.desiredCalls = []
        } else console.log('error updating ack' + updateResult)
      },
      showDpsForm () {
        this.disableDeviceKey = false
        this.viewDpsForm = !this.viewDpsForm
      },
      clearUpdates () {
        this.desiredCalls = []
      },
      async updateDeviceKey () {
        if (this.viewDpsForm) {
          if (this.connectionInfo.masterKey.length>0) {
            this.disableDeviceKey = true
            this.connectionInfo.deviceKey = await createHmac(this.connectionInfo.masterKey, this.connectionInfo.deviceId)
          } else {
            this.disableDeviceKey = false
          }
        }
      }
    },
    computed: {
      connectionString () {
        let host = this.connectionInfo.hubName || "unknown"
        if (host.indexOf('.azure-devices.net') === -1) {
          host += '.azure-devices.net'
        }
        return `HostName=${host};DeviceId=${this.connectionInfo.deviceId};SharedAccessKey=${this.connectionInfo.deviceKey}`
      }
    },
    filters: {
      pretty: function (value) {
        return JSON.stringify(JSON.parse(value), null, 2)
      }
    }
  })
  return app
}

(() => {
  createApp()
})()
