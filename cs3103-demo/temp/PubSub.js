// Main Class to be imported
var httpBridge = require('react-native-http-bridge');
import {NetworkInfo} from 'react-native-network-info';
import RequestManager, {HttpMethod} from "./RequestManager";
import NetInfo from "@react-native-community/netinfo";
import IpUtil from "./IpUtil";

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

    // Network mask
    subnet: "",

    // Users can register a listener to be notified when a peer joins
    peerJoinedListener: null,

    async init() {
        try {
            this.peers = {};
            this.channelIpAddressesPublishMap = {};
            this.channelCallbackSubscribeMap = {};
            this.ipAddress = await NetworkInfo.getIPAddress();
            this.subnet = await NetworkInfo.getSubnet();
console.log(this.ipAddress);
            // Set up http listeners for incoming requests
            // This method is asynchronous but the API doesn't reflect it :(
            httpBridge.start(this.PORT_NUMBER, 'react-native-pubsub', this._routes);

            // Hook to check connectivity of all peers every minute
            setTimeout(this._healthcheckPeers, this.HEALTHCHECK_INTERVAL);

            // Add callback to tell our peers that we're back online
            // The callback is called every time the connection state changes
            // Refer to https://github.com/react-native-community/react-native-netinfo
            NetInfo.addEventListener(state => {
                console.log(`PubSub ${this.ipAddress}: The connection state has changed to ${state.type} ${state.isConnected? 'connected' : 'disconnected'}`);
                if (state.type === "wifi" && state.isConnected) {
                   this._joinNetwork();
                }
            });
        } catch (error) {
            console.error(`PubSub ${this.ipAddress}: Error during init`);
            throw error;
        }
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
            RequestManager.request(HttpMethod.POST, ipAddress, this.PORT_NUMBER, '/subscribe', {
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
            RequestManager.request(HttpMethod.POST, ipAddress, this.PORT_NUMBER, '/unsubscribe', {
                requesterIpAddress: this.ipAddress,
                channel: channel,
            })
        }
    },

    publish(channel, data) {
        for (let peerIpAddress in this.peers) {
            RequestManager.request(HttpMethod.POST, peerIpAddress, this.PORT_NUMBER, '/publish', {
                requesterIpAddress: this.ipAddress,
                channel: channel,
                data: data,
            });
        }
    },

    getPeers() {
        return this.peers;
    },

    registerPeerJoinedListener(callback) {
        this.peerJoinedListener = callback;
    },

    /**
     * Broadcasts your arrival to all peers on the LAN via the http://broadcastIpAddress:portNum/healthcheck endpoint
     */
    async _joinNetwork() {
        try {
            const subnetInfo = IpUtil.calculateSubnetInfo(this.ipAddress, this.subnet);
            const numHosts = subnetInfo.numHosts;
            const firstAddress = subnetInfo.firstAddress;
            let targetIpAddress = firstAddress;
            for (let i = 0; i < numHosts; i++) {
                // Don't send to ourself
                if (targetIpAddress === this.ipAddress) {
                    targetIpAddress = IpUtil.fromLong(IpUtil.toLong(targetIpAddress) + 1); // Calculate the next IP address to poke
                    continue;
                }
                RequestManager.request(HttpMethod.POST, targetIpAddress, this.PORT_NUMBER, '/join', {
                    requesterIpAddress: this.ipAddress,
                });
                targetIpAddress = IpUtil.fromLong(IpUtil.toLong(targetIpAddress) + 1); // Calculate the next IP address to poke
                // await this.sleep(10);
            }
        } catch (error) {
            console.error(`PubSub ${this.ipAddress}: Failed to join network`);
            console.error(error);
            throw error;
        }
    },

    async sleep(ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        })
    },

    async _leaveNetwork() {
        try {
            return RequestManager.request(HttpMethod.POST, this.broadcastIpAddress, this.PORT_NUMBER, '/leave', {
                requesterIpAddress: this.ipAddress,
            });
        } catch (error) {
            console.error(`PubSub ${this.ipAddress}: Failed to leave network`);
            console.error(error);
            throw error;
        }
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
            console.error(`PubSub ${this.ipAddress}: ` + error);
            throw new Error("react-native-pubsub failed to shut down gracefully");
        }
    },

    // Iterates over all connected peers and performs a health check on them
    async _healthcheckPeers() {
        for (let ipAddress in this.peers) {
            try{
                const response = await RequestManager.request(HttpMethod.POST, ipAddress, this.PORT_NUMBER, '/healthcheck', null);
                if (response) {
                    this.peers[ipAddress] = true;
                } else {
                    this.peers[ipAddress] = false;
                }
            } catch(error) {
                console.log(`PubSub ${this.ipAddress}: ` + error);
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
        console.log(request);
        console.log(PubSub.peers);
        // Can use request.url, request.type and request.postData here

        /**
         * POST /join {requesterIpAddress}
         * Called when a new host tries to join the network / A disconnected host manages to reconnect
         * Similar to the POST /healthcheck endpoint,
         * But for /join, we immediately send the requester a /healthcheck request
         * Then send all the backlogged requests for the joining host sequentially
         */
        if (request.type === HttpMethod.POST && request.url.split("/")[1] === "join") {
            console.log("Found peer! Adding peer.......");

            if (!request.postData ||
                !request.postData.requesterIpAddress) {
                httpBridge.respond(request.requestId, 400, "application/json", JSON.stringify({
                    status: Status.FAILURE,
                    message: "requesterIpAddress missing from postData"
                }));
            }

            // Add the joining host
            const requesterIpAddress = request.postData.requesterIpAddress;
            PubSub.peers[requesterIpAddress] = true;

            // Call healthcheck on the host trying to join the network
            // We don't send the return data in the http response because the requester is broadcasting and may not be
            // listening specifically for this host
            // httpBridge.respond(request.requestId, 200, "application/json", null);

            RequestManager.request(HttpMethod.POST, requesterIpAddress, PubSub.PORT_NUMBER, '/healthcheck', {
                requesterIpAddress: PubSub.ipAddress,
            });

            // RequestManager.releaseBacklog(requesterIpAddress);

            if (PubSub.peerJoinedListener) {
                PubSub.peerJoinedListener();
            }
        }

        /**
         * POST /leave {requesterIpAddress}
         * Called when a host wants to leave the network
         */
        if (request.type === HttpMethod.POST && request.url.split("/")[1] === "leave") {
            if (!request.postData ||
                !request.postData.requesterIpAddress) {
                // httpBridge.respond(request.requestId, 400, "application/json", JSON.stringify({
                //     status: Status.FAILURE,
                //     message: "requesterIpAddress missing from postData"
                // }));
                console.log("requesterIpAddress missing from postData");
                return;
            }
            const requesterIpAddress = request.postData.requesterIpAddress;
            // Remove the host for all subscriptions
            for (let channel in PubSub.channelIpAddressesPublishMap) {
                const ipAddresses = PubSub.channelIpAddressesPublishMap[channel];
                if (ipAddresses.includes(requesterIpAddress)) {
                    PubSub.channelIpAddressesPublishMap[channel] = ipAddresses.filter(ipAddress => ipAddress !== requesterIpAddress);
                }
            }
            delete PubSub.peers[requesterIpAddress];

            httpBridge.respond(request.requestId, 200, "application/json", JSON.stringify({
                status: Status.SUCCESS
            }));
        }

        // POST /healthcheck {requesterIpAddress}
        if (request.type === HttpMethod.POST && request.url.split("/")[1] === "healthcheck") {
            if (!request.postData ||
                !request.postData.requesterIpAddress) {
                // httpBridge.respond(request.requestId, 400, "application/json", JSON.stringify({
                //     status: Status.FAILURE,
                //     message: "Missing fields from postData, expected [requesterIpAddress] fields",
                // }));
                console.log("Missing fields from postData, expected [requesterIpAddress] fields");
                return;
            }

            // Add to our list of connectedPeers
            const requesterIpAddress = request.postData.requesterIpAddress;
            console.log("Adding peer");
            if (!Object.keys(PubSub.peers).includes(requesterIpAddress)) {
                PubSub.peers[requesterIpAddress] = true;
                console.log("Adding peer 2");
                PubSub.peerJoinedListener();
            }

            // httpBridge.respond(request.requestId, 200, "application/json", JSON.stringify({
            //     status: Status.SUCCESS
            // }));
        }

        // POST /subscribe {requesterIpAddress, channel}
        if (request.type === HttpMethod.POST && request.url.split("/")[1] === "subscribe") {
            if (!request.postData ||
                !request.postData.requesterIpAddress ||
                !request.postData.channel) {
                // httpBridge.respond(request.requestId, 400, "application/json", JSON.stringify({
                //     status: Status.FAILURE,
                //     message: "Missing fields from postData, expected [requesterIpAddress, channel] fields",
                // }));
            }
            const requesterIpAddress = request.postData.requesterIpAddress;
            const channel = request.postData.channel;
            // Create a channel on this host if it doesn't exist
            if (!PubSub.channelIpAddressesPublishMap[channel]) {
                PubSub.channelIpAddressesPublishMap[channel] = [];
            }
            // Add the requester to this channelIpAddressesPublishMap if he is not in it yet
            if (!PubSub.channelIpAddressesPublishMap[channel].includes(requesterIpAddress)) {
                PubSub.channelIpAddressesPublishMap[channel].push(requesterIpAddress);
            }
            // httpBridge.respond(request.requestId, 200, "application/json", JSON.stringify({
            //     status: Status.SUCCESS
            // }));
        }

        // POST /unsubscribe {channel}
        if (request.type === HttpMethod.POST && request.url.split("/")[1] === "unsubscribe") {
            if (!request.postData ||
                !request.postData.requesterIpAddress ||
                !request.postData.channel) {
                // httpBridge.respond(request.requestId, 400, "application/json", JSON.stringify({
                //     status: Status.FAILURE,
                //     message: "Missing fields from postData, expected [requesterIpAddress, channel] fields",
                // }));
                console.log("Missing fields from postData, expected [requesterIpAddress, channel] fields");
                return;
            }
            const requesterIpAddress = request.postData.requesterIpAddress;
            const channel = request.postData.channel;
            if (PubSub.channelIpAddressesPublishMap[channel] &&
                PubSub.channelIpAddressesPublishMap[channel].includes(requesterIpAddress)) {
                PubSub.channelIpAddressesPublishMap[channel].remove(requesterIpAddress);
                // Delete the channel if there are no more hosts listening
                if (PubSub.channelIpAddressesPublishMap[channel].length === 0) {
                    delete PubSub.channelIpAddressesPublishMap[channel];
                }
            }
            // httpBridge.respond(request.requestId, 200, "application/json", JSON.stringify({
            //     status: Status.SUCCESS
            // }));
        }

        // POST /publish {requesterIpAddress, channel, data}
        if (request.type === HttpMethod.POST && request.url.split("/")[1] === "publish") {
            if (!request.postData ||
                !request.postData.requesterIpAddress ||
                !request.postData.channel ||
                !request.postData.data) {
                // httpBridge.respond(request.requestId, 400, "application/json", JSON.stringify({
                //     status: Status.FAILURE,
                //     message: "Missing fields from postData, expected [requesterIpAddress, channel, data] fields",
                // }));
                console.log("Missing fields from postData, expected [requesterIpAddress, channel, data] fields");
                return;
            }
            // Call the callback function if we are currently listening on the channel
            const channel = request.postData.channel;
            const callback = PubSub.channelCallbackSubscribeMap[channel];
            if (callback) {
                callback(request.postData.data);
            }

            // // Respond
            // httpBridge.respond(request.requestId, 200, "application/json", JSON.stringify({
            //     status: Status.SUCCESS
            // }));
        }

        // // Default
        // httpBridge.respond(request.requestId, 400, "application/json", JSON.stringify({
        //     status: Status.FAILURE,
        //     message: `Endpoint ${request.type} ${request.url} doesn't exist`,
        // }));
    },
}

const Status = Object.freeze({
    SUCCESS: "SUCCESS",
    FAILURE: "FAILURE"
});


export default PubSub;
