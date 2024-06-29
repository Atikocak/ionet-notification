const axios = require("axios");
const chokidar = require("chokidar");

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

let isFetching = false;
let shouldRefetch = false;

// Watch the subscription data file for changes
chokidar.watch(subscriptionDataPath).on("change", async () => {
    console.log(
        `${subscriptionDataPath} updated. Fetching worker list again...`
    );
    if (isFetching) {
        shouldRefetch = true;
        return;
    }
    await fetchSubscribedWorkers();
});

async function ensureWorkerDataFileExists() {
    // Create the db directory if it doesn't exist
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }

    // Ensure workerData.json exists before reading it
    try {
        await fs.promises.access(workerDataPath);
    } catch (error) {
        if (error.code === "ENOENT") {
            // File does not exist, create it with an empty array
            await fs.promises.writeFile(
                workerDataPath,
                JSON.stringify([], null, 2)
            );
            console.log("workerData.json file created.");
        } else {
            throw error; // Rethrow if the error is not related to file existence
        }
    }
}

// Get the subscription data
async function getSubscriptionData() {
    try {
        const data = await fs.promises.readFile(subscriptionDataPath, "utf8");
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading subscription data: ", error);
        return [];
    }
}

async function getWorkerData() {
    try {
        const data = await fs.promises.readFile(workerDataPath, "utf8");
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading worker data: ", error);
        return [];
    }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function updateWorkerData(newDevice) {
    console.log("Updating worker data...");
    let currentData;
    try {
        currentData = await getWorkerData();
    } catch (error) {
        currentData = [];
    }

    const existingDeviceIndex = currentData.findIndex(
        (device) => device.device_id === newDevice.device_id
    );
    if (existingDeviceIndex !== -1) {
        let existingDevice = currentData[existingDeviceIndex];
        // Device is already in the workers array, update it
        if (newDevice.block_rewards && newDevice.block_rewards.length > 0) {
            // Update the block rewards data if there is new data
            newDevice.block_rewards.forEach((newReward) => {
                if (
                    !existingDevice.block_rewards.some(
                        (reward) => reward.block_id === newReward.block_id
                    )
                ) {
                    // If this block reward is not in the existing data, add it
                    existingDevice.block_rewards.push(newReward);
                }
            });
            // Apply other updates to the device object
            currentData[existingDeviceIndex] = {
                ...currentData[existingDeviceIndex],
                ...newDevice,
            };
        }
    } else {
        // Device is not in the workers array, add it
        currentData.push(newDevice);
    }

    // Write the updated worker data to the JSON file
    try {
        await fs.promises.writeFile(
            workerDataPath,
            JSON.stringify(currentData, null, 2)
        );
        console.log("workerData.json updated.");
    } catch (error) {
        console.error("Error updating worker data: ", error);
    }

    return currentData;
}

async function fetchBlockRewards(deviceId, timestamp) {
    const url = `${apiUrl2}/blocks/${timestamp}/workers/${deviceId}`;
    try {
        const res = await axios.get(url, {
            headers: { Token: `${apiToken}` },
        });
        return res.data; // Assuming this is the structure of the response
    } catch (error) {
        if (error.response && error.response.status === 404) {
            // No block rewards data for this timestamp, return a specific object indicating the failure
            return { status: "Not Found", block_id: timestamp };
        } else {
            console.error("Error fetching block rewards: ", error);
            return null;
        }
    }
}

async function fetchData(deviceId) {
    try {
        console.log(`Data fetching started for device ID: ${deviceId}..`);
        let url = `${apiUrl}/devices/${deviceId}/summary`;
        const res = await axios.get(url, {
            headers: {
                Token: `${apiToken}`,
            },
        });
        const newDevice = res.data.data;
        if (newDevice) {
            // Define the start time of block rewards (June 25, 2024 12:00:00 UTC)
            const startTime = new Date("2024-06-25T15:00:00");
            // Latest block rewards data is from 1 hour ago
            const endTime = new Date();
            endTime.setHours(endTime.getHours() - 1);
            await ensureWorkerDataFileExists();
            const currentData = await getWorkerData();
            if (!Array.isArray(currentData)) {
                console.error("currentData is not an array.");
                return;
            }

            const worker = currentData.find((w) => w.device_id == deviceId);
            let blockRewards = worker ? worker.block_rewards.slice() : [];

            // Fetch block rewards data for each hour
            for (
                let time = startTime;
                time <= endTime;
                time.setHours(time.getHours() + 1)
            ) {
                const formattedTimestamp =
                    time.toISOString().slice(0, 13) + ":00:00";
                console.log("Fetching block rewards for: ", formattedTimestamp);

                await ensureWorkerDataFileExists();

                const index = blockRewards.findIndex(
                    (br) => br.block_id === formattedTimestamp
                );

                if (index === -1) {
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
                    }
                }
            }

            if (blockRewards.length <= 0) {
                return;
            }
            // Add block rewards data to the device object
            newDevice.block_rewards = blockRewards;
            // Update the worker data
            await updateWorkerData(newDevice);
        }
    } catch (error) {
        console.error("Data fetching error: ", error);
    }
}

async function fetchMessage(deviceId, workerData) {
    console.log("Fetching message for device ID: ", deviceId);
    const worker = workerData.find((w) => w.device_id === deviceId);
    if (worker && worker.block_rewards && worker.block_rewards.length > 0) {
        let lastDayRewards = 0;
        let lastDayUptimeMinutes = 0.0;
        let lastDaySuccessfulBlocks = 0;
        let lastDayFailedBlocks = 0;
        let totalBlockRewards = 0.0;
        let missingBlockReward = 0;
        let processor = "";

        worker.block_rewards.forEach((blockReward) => {
            if (blockReward.status == "Not Found") {
                missingBlockReward++;
            }
            const rewardDate = new Date(blockReward.time_and_date);
            const diffHours = Math.abs(new Date() - rewardDate) / 36e5;

            if (diffHours <= 24) {
                if (blockReward.status == "Success") {
                    processor = blockReward.processor;
                    lastDayRewards += blockReward.rewarded;
                    lastDayUptimeMinutes += blockReward.uptime_in_minutes;
                    lastDaySuccessfulBlocks++;
                } else if (blockReward.status == "Failed") {
                    lastDayFailedBlocks++;
                }
            }
            totalBlockRewards += isNaN(parseFloat(blockReward.rewarded))
                ? 0
                : parseFloat(parseFloat(blockReward.rewarded).toFixed(3));
        });

        let lastDayUptime = lastDayUptimeMinutes / 60;
        // lastDayUptime += 3; // GMT offset between server and the ionet-backend

        worker.totalRevenue =
            parseFloat(totalBlockRewards) +
            parseFloat(
                isNaN(parseFloat(worker.total_earnings))
                    ? 0
                    : parseFloat(worker.total_earnings).toFixed(3)
            );

        worker.message = `Device: ${processor}, \nJobs: ${
            worker.total_jobs
        }, $: ${parseFloat(worker.total_earnings).toFixed(3)} $IO, Served: ${
            worker.total_compute_hours_served
        } hrs. \nLast 24h: ${lastDaySuccessfulBlocks} Succ, ${lastDayFailedBlocks} Fail, ${missingBlockReward} Miss, Uptime: ${lastDayUptime}hrs, +${parseFloat(
            lastDayRewards
        ).toFixed(3)} $IO \nTotal: ${worker.totalRevenue.toFixed(3)} $IO\n\n`;
    }

    // Update the worker data
    await updateWorkerData(worker);
}

async function fetchSubscribedWorkers() {
    if (isFetching) {
        return;
    }
    isFetching = true;
    try {
        const subscriptionData = await getSubscriptionData();
        console.log(
            "************** Next fetching cycle started **************"
        );
        for (const subscription of subscriptionData) {
            for (const deviceId of subscription.subscriptions) {
                await fetchData(deviceId);
                const workerData = await getWorkerData();
                await fetchMessage(deviceId, workerData);
                await delay(2000); // Add a delay to avoid rate limiting
            }
        }
        console.log(
            "************** Data fetching cycle completed **************"
        );
    } catch (error) {
        console.error("Error during data fetch: ", error);
    } finally {
        isFetching = false;
        if (shouldRefetch) {
            shouldRefetch = false;
            fetchSubscribedWorkers();
        }
        setTimeout(fetchSubscribedWorkers, 1000);
    }
}

// Fetch data on startup
fetchSubscribedWorkers();

module.exports = {
    fetchSubscribedWorkers,
};
