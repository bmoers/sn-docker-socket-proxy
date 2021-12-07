const {
    ClientSecretCredential
} = require("@azure/identity");
const {
    ContainerInstanceManagementClient
} = require("@azure/arm-containerinstance");


const containerGroupPrefix = 'atf-grp-';

const resourceGroupName = process.env.AZURE_RESOURCE_GROUP_NAME;
const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
const containerGroupLocation = process.env.AZURE_RESOURCE_LOCATION;
const userPasswordBase64 = Buffer.from(process.env.SN_PASSWORD).toString('base64');


const mandatoryVars = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'AZURE_RESOURCE_GROUP_NAME', 'AZURE_SUBSCRIPTION_ID', 'AZURE_RESOURCE_LOCATION', 'SN_PASSWORD']

const missing = mandatoryVars.reduce((out, varName) => {

    if (!process.env[varName])
        out.push(`${varName} variable is mandatory`);
    return out;
}, [])
if (missing.length) {
    throw new Error(missing.join('\n'));
}

const deleteTimeout = {};
const options = {}

if(process.env.HTTP_PROXY_HOST){
    const proxyOptions = {
        host: process.env.HTTP_PROXY_HOST
    }
    if(process.env.HTTP_PROXY_PORT){
        proxyOptions.port = parseInt(process.env.HTTP_PROXY_PORT, 10);
    }
    options.proxyOptions = proxyOptions;
}

const credential = new ClientSecretCredential(process.env.AZURE_TENANT_ID, process.env.AZURE_CLIENT_ID, process.env.AZURE_CLIENT_SECRET, options);

/**
 * Safely delete a containerGroup
 * 
 * @param {String} containerGroupName 
 * @returns 
 */
const deleteContainerGroup = async (containerGroupName) => {
    // delete the container-group
    const client = new ContainerInstanceManagementClient(credential, subscriptionId);
    try {
        await client.containerGroups.get(resourceGroupName, containerGroupName);
        // get() fails if the container does not exist
        await client.containerGroups.deleteMethod(resourceGroupName, containerGroupName);
        return console.log(`containerGroup '${containerGroupName}' successfully deleted`);

    } catch (error) {
        if (error.response) {
            return console.error(`deletion of containerGroup '${containerGroupName}' failed with:`, error.response.status, error.response.body);
        }
        console.error(error);
    }
}

/**
 * remove all containerGroups where the  name starts with the 'containerGroupPrefix' prefix
 */
const cleanUp = async () => {
    const client = new ContainerInstanceManagementClient(credential, subscriptionId);
    const list = await client.containerGroups.list();

    const res = await Promise.all(list.filter((group) => group.name.startsWith(containerGroupPrefix)).map((group) => {
        return client.containerGroups.deleteMethod(resourceGroupName, group.name);
    }));
    if (!res.length)
        return;

    console.log(`ContainerResources deleted: ${res.length}`)
    res.forEach((containerGroup, index) => {
        console.log(`#${index}\t${containerGroup.name} (${containerGroup.id})`);
    })
}

/**
 * fake response to servicenow - assuming the image is available on the Azure side
 * @param {*} filters 
 * @returns 
 */
const getImage = async (filters = {
    reference: []
}) => {

    const body = [{
        "Containers": -1,
        "Created": 1624041926,
        "Id": "sha256:564c2cc2729fab64024883404d64332ce20596f5b29444e44a539bc8615787f6",
        "Labels": null,
        "ParentId": "",
        "RepoDigests": null,
        "RepoTags": filters.reference,
        "SharedSize": -1,
        "Size": 1076704188,
        "VirtualSize": 1076704188
    }];

    const response = {
        status: 200,
        body: body
    }
    return response;
}

/**
 * create a containerGroup with one container.
 * Note: the creation of this service in Azure takes some time, therefore the request is executed in the background 
 * 
 * @param {*} payload 
 * @returns 
 */
const createService = async (payload) => {
    const response = {
        status: 500,
        body: undefined
    }
    try {
        const client = new ContainerInstanceManagementClient(credential, subscriptionId);

        const containerName = payload.Name;
        const containerGroupName = `${containerGroupPrefix}${containerName}`;

        const spec = payload.TaskTemplate.ContainerSpec;
        const image = spec.Image;
        const env = spec.Env.reduce((out, tmp) => {
            const arr = tmp.split('=');
            const name = arr[0];
            const value = arr.slice(1).join('=');
            out[name] = value;
            return out;
        }, {});

        const secretFileName = env.SECRET_PATH.split('/').pop();
        const secretMountPath = env.SECRET_PATH.substr(0, env.SECRET_PATH.length - secretFileName.length - 1);

        const environmentVariables = Object.keys(env).map((e) => {
            return {
                name: e,
                value: env[e]
            };
        });

        const data = {
            "location": containerGroupLocation,
            "name": containerGroupName,
            "type": "Microsoft.ContainerInstance/containerGroups",
            "apiVersion": "2021-07-01",
            "containers": [{
                "name": containerName,
                "image": image,
                "resources": {
                    "requests": {
                        "cpu": 1,
                        "memoryInGB": 1.5
                    }
                },
                "environmentVariables": environmentVariables,
                "volumeMounts": [{
                    "name": "secrets-volume-01",
                    "mountPath": secretMountPath
                }]
            }],
            "restartPolicy": "Never", //OnFailure
            "osType": "Linux",
            "volumes": [{
                "name": "secrets-volume-01",
                "secret": {
                    [secretFileName]: userPasswordBase64
                }
            }],
            "tags": {}
        };

        /*
        console.log('----------------createService body----------------------');
        console.dir(payload, {
            depth: null
        });

        console.log('----------------createService request----------------------');
        console.dir(data, {
            depth: null
        });
        */

        console.log(`Create containerGroup ${containerGroupName}`);

        /*
         * create the container-group but dont wait for it to be started!
           Unfortunately ServiceNow can't wait that long.... */
        client.containerGroups.createOrUpdate(resourceGroupName, containerGroupName, data).then((create) => {

            const timeOutSec = parseInt((env.TIMEOUT_MINS || 60), 10) * 60;

            console.log(`ContainerGroup ${resourceGroupName} ${containerGroupName} creation result:`);
            console.log(`\tcontainerGroup: ${create.name}`);
            console.log(`\tprovisioningState: ${create.provisioningState}`);
            console.log(`\tgroup will automatically be destroyed in ${timeOutSec} seconds`);

            deleteTimeout[containerGroupName] = setTimeout(async () => {
                console.log(`schedule delete containerGroup'${containerGroupName}' now`);
                await deleteContainerGroup(containerGroupName)

            }, timeOutSec * 1000);

        }).catch((error) => {
            if (error.response) {
                return console.log(`creation of containerGroup '${containerGroupName}' failed with:`, error.response.status, error.response.body);
            }
            console.error(error);
        });

        response.status = 201; // CREATED
        response.body = {
            ID: containerName
        }
    } catch (error) {
        console.log(error);
        if (error.response) {
            response.status = error.response.status;
            response.body = error.body;
        } else {
            console.error(error);
        }
    }
    return response;
}

/**
 * Get the container logs from Azure
 * @param {String} containerName 
 * @returns 
 */
const getLogs = async (containerName) => {
    const response = {
        status: 500,
        body: undefined
    }

    try {
        const containerGroupName = `${containerGroupPrefix}${containerName}`;
        const client = new ContainerInstanceManagementClient(credential, subscriptionId);
        const logs = await client.containers.listLogs(resourceGroupName, containerGroupName, containerName);

        response.status = 200;
        response.body = logs.content;

    } catch (error) {
        if (error.response) {
            response.status = error.response.status;
            response.body = error.body;
        } else {
            console.error(error);
        }
    }
    return response;
}

/**
 * Delete the containerGroup in Azure
 * @param {String} containerName 
 * @returns 
 */
const deleteService = async (containerName) => {

    const response = {
        status: 500,
        body: undefined
    }

    try {
        const containerGroupName = `${containerGroupPrefix}${containerName}`;

        // cancel the deleteTimeout
        clearTimeout(deleteTimeout[containerGroupName]);

        await deleteContainerGroup(containerGroupName);

        response.status = 200;
        response.body = '';
    } catch (error) {
        if (error.response) {
            response.status = error.response.status;
            response.body = error.body;
        } else {
            console.error(error);
        }
    }
    return response;
}

module.exports = {
    getImage,
    createService,
    getLogs,
    deleteService,
    cleanUp
}
