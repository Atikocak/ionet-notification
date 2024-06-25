const fs = require("fs");
const axios = require("axios");
const { apiUrl, apiToken } = require("../config");
const path = require("path");
const util = require("util");

let workers = []; // Store the worker data
const writeFileAsync = util.promisify(fs.writeFile);

const updateWorkerData = async (newDevice) => {
    console.log("Updating worker data...");
    const existingDeviceIndex = workers.findIndex(
        (device) => device.device_id === newDevice.device_id
    );
    if (existingDeviceIndex !== -1) {
        // Device is already in the workers array, update it
        workers[existingDeviceIndex] = {
            ...workers[existingDeviceIndex],
            ...newDevice,
        };
    } else {
        // Device is not in the workers array, add it
        workers.push(newDevice);
    }

    const filePath = path.join(__dirname, "../db/workerData.json");
    const dirPath = path.join(__dirname, "../db");

    // Create the db directory if it doesn't exist
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    // Write the updated data to the JSON file
    try {
        await writeFileAsync(filePath, JSON.stringify(workers, null, 2));
        console.log("workerData.json updated.");
    } catch (err) {
        console.error("JSON write error: ", err);
    }
};

const fetchSubscriptionDevices = async () => {
    const subscriptionData = JSON.parse(
        fs.readFileSync(
            path.join(__dirname, "../db/subscriptionData.json"),
            "utf8"
        )
    );
    for (const subscription of subscriptionData) {
        for (const deviceId of subscription.subscriptions) {
            await fetchData(deviceId);
            // 250ms delay between each device fetch
            await new Promise((resolve) => setTimeout(resolve, 250));
        }
    }
};

const fetchData = async (deviceId) => {
    try {
        console.log(`Data fetching started for device ID: ${deviceId}..`);
        let url = `${apiUrl}/devices/${deviceId}/details`;
        const res = await axios.get(url, {
            headers: {
                Token: `${apiToken}`,
            },
        });
        const newDevice = res.data.data;
        if (newDevice) {
            await updateWorkerData(newDevice);
        }
    } catch (error) {
        console.error("Data fetching error: ", error);
    }
};

// Fetch data on startup
fetchSubscriptionDevices();

// Continue to fetch data every 2 minutes
setInterval(fetchSubscriptionDevices, 120000);

module.exports = {
    fetchSubscriptionDevices,
    workers,
};
