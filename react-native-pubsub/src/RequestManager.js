import axios from 'axios';

// todo: Add offline support
const RequestManager = {
    // A queue of axios config objects https://github.com/axios/axios
    map: {},

    /**
     *
     * @param ipAddress IP Address of the target
     * @param endpoint http endpoint to call
     * @param httpMethod HttpMethod enum("GET", "PUT", "POST", "DELETE")
     * @param message Arbitrary javascript object to be sent
     * @returns {Promise<void>}
     */
    async request(httpMethod, ipAddress, endpoint, data) {
        try {
            const axiosConfig = {
                baseURL: `http://${ipAddress}`,
                url: endpoint,
                method: httpMethod,
                data: data,
            }
            const response = await axios(axiosConfig);
            if (response.status !== 200) {
                this.map[ipAddress].push(axiosConfig);
                return null;
            }
            return response;
        } catch (error) {
            console.log(JSON.stringify(error));
        }
    },

    // /**
    //  * Recursively iterate through the queue of requests and sends all of them
    //  * Returns true if the flush succeeded for all requests
    //  *         false otherwise
    //  */
    // async flush() {
    //     try {
    //         // Base case: There are no more items in the queue
    //         if (this.queue.length === 0) {
    //             return true;
    //         }
    //         await this.process();
    //         this.queue.shift();
    //         this.flush();
    //     } catch (error) {
    //         console.log(error);
    //         return false;
    //     }
    //
    // }

    // /**
    //  * Processes the first item in the request queue
    //  * @returns {Promise<boolean>} true if the queue is successfully flushed
    //  *                             false if there are items in the queue that couldn't be processed
    //  */
    // async process() {
    //     try {
    //         if (this.queue.length === 0) {
    //             return true;
    //         }
    //         const requestConfig = this.queue[0];
    //         const response = await axios(requestConfig);
    //         return response.data;
    //     } catch (error) {
    //         console.log(error);
    //         return false;
    //     }
    // }
}

const HttpMethod = Object.freeze({
    GET: "GET",
    PUT: "PUT",
    POST: "POST",
    DELETE: "DELETE",
});



export default RequestManager;
export {
    HttpMethod,
}
