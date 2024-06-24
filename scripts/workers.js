const fs = require("fs");
const axios = require("axios");
const { apiUrl, apiToken } = require("../config");
const path = require("path");
const util = require("util");

let workers = []; // Store the worker data
const writeFileAsync = util.promisify(fs.writeFile);

const updateWorkerData = async (newDevices) => {
    console.log("Updating worker data...");
    newDevices.forEach((newDevice) => {
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
    });

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

const fetchData = async (page = 1, pageSize = 100) => {
    try {
        console.log("Data fetching started..");
        await axios
            .get(`${apiUrl}?page=${page}&page_size=${pageSize}`, {
                headers: {
                    Token: `${apiToken}`,
                },
            })
            .then((res) => {
                const data = res.data;
                if (data && data.data && data.data.devices) {
                    updateWorkerData(data.data.devices);
                    if (page < data.data.total_pages) {
                        console.log(
                            `Fecting continues...page: ${page + 1} of ${
                                data.data.total_pages
                            }\n`
                        );
                        // Wait 0.35 seconds before fetching the next page
                        setTimeout(() => {
                            fetchData(page + 1, pageSize);
                        }, 350);
                    } else {
                        console.log("Data fetching completed!\n");
                    }
                }
            })
            .catch((error) => {
                console.error("Data fecthing error: ", error);
            });
    } catch (error) {
        console.error("Data fetching error: ", error);
    }
};

setInterval(() => {
    fetchData()
        .then(() => {
            console.log("\nData updated successfully!");
        })
        .catch((error) => {
            console.error("Data update error: ", error);
        });
}, 1000 * 60 * 60); // Fetch data every 60 minutes

module.exports = {
    fetchData,
    workers,
};
