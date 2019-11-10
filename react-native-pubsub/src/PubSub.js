// Main Class to be imported
var httpBridge = require('react-native-http-bridge');
import {NetworkInfo} from 'react-native-network-info';
import RequestManager, {HttpMethod} from "./RequestManager";
import NetInfo from "@react-native-community/netinfo";

const PubSub = {

    // Port number to listen to requests on
    PORT_NUMBER: 3103,

    // Time (in milliseconds) for the interval which healthchecks are made
    HEALTHCHECK_INTERVAL: 60000,

    // Mapping of {peerIpAddress: bool} where bool indicates whether we were able to reach this peer during
    // The previous health check
    peers: {},

    // Mapping of {channel: [peerIpAddress]}
    channelIpAddressesPublishMap: {},

    // Mapping of {channel, callback} for this host
    channelCallbackSubscribeMap: {},

    // Local IP address for this device
    ipAddress: "",

    broadcastIpAddress: "",

    async init() {
        this.peers = {};
        this.channelIpAddressesPublishMap = {};
        this.channelCallbackSubscribeMap = {};
        this.ipAddress = await NetworkInfo.getIPAddress();
        this.broadcastIpAddress = NetworkInfo.getBroadcast();

        // Set up http listeners for incoming requests
        httpBridge.start(this.PORT_NUMBER, this._routes);

        // Hook to check connectivity of all peers every minute
        setTimeout(this._healthcheckPeers, this.HEALTHCHECK_INTERVAL);

        // Add callback to tell our peers that we're back online
        // The callback is called every time the connection state changes
        // Refer to https://github.com/react-native-community/react-native-netinfo
        NetInfo.addEventListener(state => {
            console.log(`PubSub: The connection state has changed to ${state.type}`);
            if (state.type === "wifi" && state.isConnected) {
                this.joinNetwork();
            }
        });
    },

    subscribe(channel, callback) {
        // Subscribe the callback to this channel
        this.channelCallbackSubscribeMap[channel] = callback;
        // Create the channel on this peer and add ourselves to it, if it doesn't exist
        if (!this.channelIpAddressesPublishMap[channel]) {
            this.channelIpAddressesPublishMap[channel] = [];
        }
        if (!this.channelIpAddressesPublishMap[channel].includes(this.ipAddress)) {
            this.channelIpAddressesPublishMap[channel].push(this.ipAddress);
        }

        // Tell peers that we've subscribed to this channel
        for (let ipAddress in this.peers) {
            RequestManager.request(HttpMethod.POST, ipAddress, '/subscribe', {
                requesterIpAddress: this.ipAddress,
                channel: channel,
            });
        }
    },

    unsubscribe(channel) {
        if (this.channelCallbackSubscribeMap[channel]) {
            delete this.channelCallbackSubscribeMap[channel];
        }
        // Unsubscribe ourselves from this channel
        if (this.channelIpAddressesPublishMap[channel].includes(this.ipAddress)) {
            this.channelIpAddressesPublishMap[channel].remove(this.ipAddress);
            if (this.channelIpAddressesPublishMap[channel].length === 0) {
                delete this.channelIpAddressesPublishMap[channel];
            }
        }
        // Tell peers that we've unsubscribed from this channel
        for (let ipAddress in this.peers) {
            RequestManager.request(HttpMethod.POST, ipAddress, '/unsubscribe', {
                requesterIpAddress: this.ipAddress,
                channel: channel,
            })
        }
    },

    publish(channel, data) {
        for (let peerIpAddress in this.peers) {
            RequestManager.request(HttpMethod.POST, peerIpAddress, '/publish', {
                requesterIpAddress: this.ipAddress,
                channel: channel,
                data: data,
            });
        }
    },

    getPeers() {
        return this.peers;
    },

    /**
     * Broadcasts your arrival to all peers on the LAN via the http://broadcastIpAddress:portNum/healthcheck endpoint
     */
    async _joinNetwork() {
        return RequestManager.request(HttpMethod.POST, this.broadcastIpAddress, '/join', {
            requesterIpAddress: this.ipAddress,
        });
    },

    async _leaveNetwork() {
        return RequestManager.request(HttpMethod.POST, this.broadcastIpAddress, '/leave', {
            requesterIpAddress: this.ipAddress,
        });
    },

    /**
     * Terminate and clean up PubSub
     * todo: Wipe all state clean
     */
    async stop() {
        try {
            await this._leaveNetwork();
            httpBridge.stop();
        } catch (error) {
            console.error(error);
            throw new Error("react-native-pubsub failed to shut down gracefully");
        }
    },

    // Iterates over all connected peers and performs a health check on them
    async _healthcheckPeers() {
        for (let ipAddress in this.peers) {
            try{
                const response = await RequestManager.request(HttpMethod.GET, ipAddress, '/healthcheck', null);
                if (response) {
                    this.peers[ipAddress] = true;
                } else {
                    this.peers[ipAddress] = false;
                }
            } catch(error) {
                console.log(error);
                this.peers[ipAddress] = false;
            }
        }
    },

    /**
     * Routes for our http server
     * To be fed into httpBridge.start method
     * @param request
     * @private
     */
    _routes(request) {
        // Can use request.url, request.type and request.postData here

        /**
         * POST /join {requesterIpAddress}
         * Called when a new host tries to join the network / A disconnected host manages to reconnect
         * Similar to the GET /healthcheck endpoint,
         * But for /join, we immediately send the requester a /healthcheck request
         * Then send all the backlogged requests for the joining host sequentially
         */
        if (request.type === HttpMethod.POST && request.url.split("/")[1] === "join") {
            if (!request.postData ||
                !request.postData.requesterIpAddress) {
                httpBridge.respond(400, "application/json", JSON.stringify({
                    status: Status.FAILURE,
                    message: "requesterIpAddress missing from postData"
                }));
            }

            // Add the joining host
            const requesterIpAddress = request.postData.requesterIpAddress;
            this.peers[requesterIpAddress] = true;

            // Call healthcheck on the host trying to join the network
            // We don't send the return data in the http response because the requester is broadcasting and may not be
            // listening specifically for this host
            httpBridge.respond(200, "application/json", null);
            RequestManager.request('GET', requesterIpAddress, '/healthcheck', {
                requesterIpAddress: this.ipAddress,
            });
            RequestManager.releaseBacklog(requesterIpAddress);
        }

        /**
         * POST /leave {requesterIpAddress}
         * Called when a host wants to leave the network
         */
        if (request.type === HttpMethod.POST && request.url.split("/")[1] === "leave") {
            if (!request.postData ||
                !request.postData.requesterIpAddress) {
                httpBridge.respond(400, "application/json", JSON.stringify({
                    status: Status.FAILURE,
                    message: "requesterIpAddress missing from postData"
                }));
            }
            const requesterIpAddress = request.postData.requesterIpAddress;
            // Remove the host for all subscriptions
            for (let channel in this.channelIpAddressesPublishMap) {
                const ipAddresses = this.channelIpAddressesPublishMap[channel];
                if (ipAddresses.includes(requesterIpAddress)) {
                    this.channelIpAddressesPublishMap[channel] = ipAddresses.filter(ipAddress => ipAddress !== requesterIpAddress);
                }
            }
            delete this.peers[requesterIpAddress];

            httpBridge.respond(200, "application/json", JSON.stringify({
                status: Status.SUCCESS
            }));
        }

        // GET /healthcheck {requesterIpAddress}
        if (request.type === HttpMethod.POST && request.url.split("/")[1] === "healthcheck") {
            if (!request.postData ||
                !request.postData.requesterIpAddress) {
                httpBridge.respond(400, "application/json", JSON.stringify({
                    status: Status.FAILURE,
                    message: "Missing fields from postData, expected [requesterIpAddress] fields",
                }));
            }

            // Add to our list of connectedPeers
            const requesterIpAddress = request.postData.requesterIpAddress;
            if (!this.peers.includes(requesterIpAddress)) {
                this.peers[requesterIpAddress] = true;
            }

            httpBridge.respond(200, "application/json", JSON.stringify({
                status: Status.SUCCESS
            }));
        }

        // POST /subscribe {requesterIpAddress, channel}
        if (request.type === HttpMethod.POST && request.url.split("/")[1] === "subscribe") {
            if (!request.postData ||
                !request.postData.requesterIpAddress ||
                !request.postData.channel) {
                httpBridge.respond(400, "application/json", JSON.stringify({
                    status: Status.FAILURE,
                    message: "Missing fields from postData, expected [requesterIpAddress, channel] fields",
                }));
            }
            const requesterIpAddress = request.postData.requesterIpAddress;
            const channel = request.postData.channel;
            // Create a channel on this host if it doesn't exist
            if (!this.channelIpAddressesPublishMap[channel]) {
                this.channelIpAddressesPublishMap[channel] = [];
            }
            // Add the requester to this channelIpAddressesPublishMap if he is not in it yet
            if (!this.channelIpAddressesPublishMap[channel].includes(requesterIpAddress)) {
                this.channelIpAddressesPublishMap[channel].push(requesterIpAddress);
            }
            httpBridge.respond(200, "application/json", JSON.stringify({
                status: Status.SUCCESS
            }));
        }

        // POST /unsubscribe {channel}
        if (request.type === HttpMethod.POST && request.url.split("/")[1] === "unsubscribe") {
            if (!request.postData ||
                !request.postData.requesterIpAddress ||
                !request.postData.channel) {
                httpBridge.respond(400, "application/json", JSON.stringify({
                    status: Status.FAILURE,
                    message: "Missing fields from postData, expected [requesterIpAddress, channel] fields",
                }));
            }
            const requesterIpAddress = request.postData.requesterIpAddress;
            const channel = request.postData.channel;
            if (this.channelIpAddressesPublishMap[channel] &&
                this.channelIpAddressesPublishMap[channel].includes(requesterIpAddress)) {
                this.channelIpAddressesPublishMap[channel].remove(requesterIpAddress);
                // Delete the channel if there are no more hosts listening
                if (this.channelIpAddressesPublishMap[channel].length === 0) {
                    delete this.channelIpAddressesPublishMap[channel];
                }
            }
            httpBridge.respond(200, "application/json", JSON.stringify({
                status: Status.SUCCESS
            }));
        }

        // POST /publish {requesterIpAddress, channel, data}
        if (request.type === HttpMethod.POST && request.url.split("/")[1] === "publish") {
            if (!request.postData ||
                !request.postData.requesterIpAddress ||
                !request.postData.channel ||
                !request.postData.data) {
                httpBridge.respond(400, "application/json", JSON.stringify({
                    status: Status.FAILURE,
                    message: "Missing fields from postData, expected [requesterIpAddress, channel, data] fields",
                }));
            }
            // Call the callback function if we are currently listening on the channel
            const channel = request.postData.channel;
            const callback = this.channelCallbackSubscribeMap[channel];
            if (callback) {
                callback(request.postData.data);
            }

            // Respond
            httpBridge.respond(200, "application/json", JSON.stringify({
                status: Status.SUCCESS
            }));
        }

        // Default
        httpBridge.respond(400, "application/json", JSON.stringify({
            status: Status.FAILURE,
            message: `Endpoint ${request.type} ${request.url} doesn't exist`,
        }));
    },
}

const Status = Object.freeze({
    SUCCESS: "SUCCESS",
    FAILURE: "FAILURE"
});


export default PubSub;
