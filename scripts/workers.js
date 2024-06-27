const axios = require("axios");
const { apiUrl, apiUrl2, apiToken } = require("../config");
const fs = require("fs");
const path = require("path");
const util = require("util");

// Define the paths to the JSON files
const dirPath = path.join(__dirname, "../db");
const workerDataPath = path.join(__dirname, "../db/workerData.json");
const subscriptionDataPath = path.join(
    __dirname,
    "../db/subscriptionData.json"
);

// Read the JSON files
const workerData = JSON.parse(fs.readFileSync(workerDataPath), "utf8");
const subscriptionData = JSON.parse(
    fs.readFileSync(subscriptionDataPath),
    "utf8"
);

let workers = []; // Store the worker data
const writeFileAsync = util.promisify(fs.writeFile);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

    // Create the db directory if it doesn't exist
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    // Write the updated data to the JSON file
    try {
        await writeFileAsync(workerDataPath, JSON.stringify(workers, null, 2));
        console.log("workerData.json updated.");
    } catch (err) {
        console.error("JSON write error: ", err);
    }
};

const fetchBlockRewards = async (deviceId, timestamp) => {
    const url = `${apiUrl2}/blocks/${timestamp}/workers/${deviceId}`;
    try {
        const response = await axios.get(url, {
            headers: { Token: `${apiToken}` },
        });
        return response.data; // Assuming this is the structure of the response
    } catch (error) {
        if (error.response && error.response.status === 404) {
            // No block rewards data for this timestamp, return a specific object indicating the failure
            return { status: "Not Found", block_id: timestamp };
        } else {
            console.error("Error fetching block rewards: ", error);
            return null;
        }
    }
};

const fetchSubscribedWorkers = async () => {
    console.log("************** Next fetching cycle started **************");
    for (const subscription of subscriptionData) {
        for (const deviceId of subscription.subscriptions) {
            await fetchData(deviceId);
        }
    }
    console.log("************** Data fetching cycle completed **************");
    setTimeout(fetchSubscribedWorkers, 0);
};

const fetchData = async (deviceId) => {
    try {
        console.log(`Data fetching started for device ID: ${deviceId}..`);
        let url = `${apiUrl}/devices/${deviceId}/summary`;
        const res = await axios.get(url, {
            headers: {
                Token: `${apiToken}`,
            },
        });
        await delay(250); // Add a delay to avoid rate limiting
        const newDevice = res.data.data;
        if (newDevice) {
            // Define the start time of block rewards (June 25, 2024 12:00:00 UTC)
            const startTime = new Date("2024-06-25T15:00:00");
            // Latest block rewards data is from 1 hour ago
            const endTime = new Date();
            endTime.setHours(endTime.getHours() - 1);
            const blockRewards = [];

            // Fetch block rewards data for each hour
            for (
                let time = startTime;
                time <= endTime;
                time.setHours(time.getHours() + 1)
            ) {
                const formattedTimestamp =
                    time.toISOString().slice(0, 13) + ":00:00";
                console.log("Fetching block rewards for: ", formattedTimestamp);
                const rewards = await fetchBlockRewards(
                    deviceId,
                    formattedTimestamp
                );
                await delay(250); // Add a delay to avoid rate limiting

                // Handle the case where there is no block rewards data for this timestamp
                if (rewards && rewards.status === "Not Found") {
                    blockRewards.push(rewards);
                } else if (rewards) {
                    blockRewards.push(rewards);
                    subscriptionData.forEach((sub) => {
                        sub.subscriptions.forEach((deviceId) => {
                            const worker = workers.find(
                                (w) => w.device_id === deviceId
                            );
                            if (
                                worker &&
                                worker.block_rewards &&
                                worker.block_rewards.length > 0
                            ) {
                                let lastDayRewards = 0;
                                let lastDayUptimeMinutes = 0;
                                let lastDaySuccessfulBlocks = 0;
                                let lastDayFailedBlocks = 0;
                                let totalBlockRewards = 0;
                                let missingBlockReward = 0;

                                worker.block_rewards.forEach((blockReward) => {
                                    if (blockReward.status == "Not Found") {
                                        missingBlockReward++;
                                        return;
                                    }
                                    const rewardDate = new Date(
                                        blockReward.time_and_date
                                    );
                                    console.log(`Reward date: ${rewardDate}`);
                                    const diffHours =
                                        Math.abs(new Date() - rewardDate) /
                                        36e5;
                                    console.log(
                                        `********* Difference in hours: ${parseFloat(
                                            diffHours.toFixed(2)
                                        )}`
                                    );

                                    if (diffHours <= 24) {
                                        if (blockReward.status == "Success") {
                                            lastDayRewards +=
                                                blockReward.rewarded;
                                            lastDayUptimeMinutes +=
                                                blockReward.uptime_in_minutes;
                                            lastDaySuccessfulBlocks++;
                                        } else if (
                                            blockReward.status == "Failed"
                                        ) {
                                            lastDayFailedBlocks++;
                                        }
                                    }

                                    totalBlockRewards += blockReward.rewarded;
                                });

                                let lastDayUptime =
                                    lastDayUptimeMinutes / 60 +
                                    missingBlockReward;
                                // lastDayUptime += 3; // GMT offset between server and the ionet-backend

                                worker.totalRevenue = parseFloat(
                                    totalBlockRewards + worker.total_earnings
                                ).toFixed(3);

                                worker.message = `Device Name: ${
                                    newDevice.device_name
                                } has completed ${
                                    worker.total_jobs
                                } jobs and earned ${parseFloat(
                                    worker.total_earnings
                                ).toFixed(3)} $IO by serving ${
                                    worker.total_compute_hours_served
                                } hours. \nIn the last 24 hours, this device completed ${lastDaySuccessfulBlocks} successful and ${lastDayFailedBlocks} failed block events, gained ${parseFloat(
                                    lastDayRewards
                                ).toFixed(3)} $IO coin within ${Math.floor(
                                    lastDayUptime
                                )} hours uptime. Total $IO earnings of this device: ${
                                    worker.totalRevenue
                                }\n\n`;
                            }
                        });
                    });
                }
            }

            // Add block rewards data to the device object
            if (blockRewards.length > 0) {
                newDevice.block_rewards = blockRewards;
            }

            // Update the worker data
            await updateWorkerData(newDevice);
        }
    } catch (error) {
        console.error("Data fetching error: ", error);
    }
};

// Fetch data on startup
fetchSubscribedWorkers();

module.exports = {
    fetchSubscribedWorkers,
    workers,
};
