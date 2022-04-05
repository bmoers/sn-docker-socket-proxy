const log = require('../lib/logger').topic(module);
const parsePayload = require('../lib/parse-payload');

const {
    ClientSecretCredential
} = require('@azure/identity');
const {
    ContainerInstanceManagementClient
} = require('@azure/arm-containerinstance');


const mandatoryVars = ['CREG_AZURE_TENANT_ID', 'CREG_AZURE_CLIENT_ID', 'CREG_AZURE_CLIENT_SECRET', 'CREG_AZURE_RESOURCE_GROUP_NAME', 'CREG_AZURE_SUBSCRIPTION_ID', 'CREG_AZURE_RESOURCE_LOCATION', 'ATF_SN_PASSWORD']
require('../lib/mandatory.js')(mandatoryVars);


const containerGroupPrefix = 'atf-grp-';

const resourceGroupName = process.env.CREG_AZURE_RESOURCE_GROUP_NAME;
const subscriptionId = process.env.CREG_AZURE_SUBSCRIPTION_ID;
const containerGroupLocation = process.env.CREG_AZURE_RESOURCE_LOCATION;
const userPasswordBase64 = Buffer.from(process.env.ATF_SN_PASSWORD).toString('base64');

const resourceCpu = parseInt((process.env.CREG_AZURE_RESOURCES_CPU || 1), 10);
const resourceMemoryInGB = parseFloat((process.env.CREG_AZURE_RESOURCES_MEM_GB || 1.5), 10);

const containerInstances = {};
const options = {}

if (process.env.HTTP_PROXY_HOST) {
    const proxyOptions = {
        host: process.env.HTTP_PROXY_HOST
    }
    if (process.env.HTTP_PROXY_PORT) {
        proxyOptions.port = parseInt(process.env.HTTP_PROXY_PORT, 10);
    }
    options.proxyOptions = proxyOptions;
}

const credential = new ClientSecretCredential(process.env.CREG_AZURE_TENANT_ID, process.env.CREG_AZURE_CLIENT_ID, process.env.CREG_AZURE_CLIENT_SECRET, options);

/**
 * Safely delete a containerGroup
 * 
 * @param {String} containerGroupName 
 * @returns 
 */
const deleteContainerGroup = async (containerGroupName) => {

    // cancel the deleteTimeout
    clearTimeout(containerInstances[containerGroupName]);
    delete containerInstances[containerGroupName];

    // delete the container-group
    const client = new ContainerInstanceManagementClient(credential, subscriptionId);
    try {
        log.info('delete containerGroupName %s', containerGroupName);
        await client.containerGroups.get(resourceGroupName, containerGroupName);
        // get() fails if the container does not exist
        const containerGroup = await client.containerGroups.deleteMethod(resourceGroupName, containerGroupName);
        return log.info(`containerGroup ${containerGroup.name} (${containerGroup.id}) successfully deleted`);

    } catch (error) {
        if (error.response) {
            return log.error(`deletion of containerGroup '${containerGroupName}' failed with: %s %s`, error.response.status, error.response.body);
        }
    }
}

/**
 * fake response to servicenow - assuming the image is available on the Azure side
 * @param {*} filters 
 * @returns 
 */
const getImage = async (filters = { reference: [] }) => {

    const body = [{
        'Containers': -1,
        'Created': 1624041926,
        'Id': 'sha256:564c2cc2729fab64024883404d64332ce20596f5b29444e44a539bc8615787f6',
        'Labels': null,
        'ParentId': '',
        'RepoDigests': null,
        'RepoTags': filters.reference,
        'SharedSize': -1,
        'Size': 1076704188,
        'VirtualSize': 1076704188
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
        
        const {image, osType, env } = parsePayload(payload);

        const secretFileName = env.SECRET_PATH.split('/').pop();
        const secretMountPath = env.SECRET_PATH.substr(0, env.SECRET_PATH.length - secretFileName.length - 1);

        const environmentVariables = Object.keys(env).map((e) => {
            return {
                name: e,
                value: env[e]
            };
        });

        const data = {
            'location': containerGroupLocation,
            'name': containerGroupName,
            'type': 'Microsoft.ContainerInstance/containerGroups',
            'apiVersion': '2021-07-01',
            'containers': [{
                'name': containerName,
                'image': image,
                'resources': {
                    'requests': {
                        'cpu': resourceCpu,
                        'memoryInGB': resourceMemoryInGB
                    }
                },
                'environmentVariables': environmentVariables,
                'volumeMounts': [{
                    'name': 'secrets-volume-01',
                    'mountPath': secretMountPath
                }]
            }],
            'restartPolicy': 'Never', //OnFailure
            'osType': osType,
            'volumes': [{
                'name': 'secrets-volume-01',
                'secret': {
                    [secretFileName]: userPasswordBase64
                }
            }],
            'tags': {}
        };

        if (process.env.DEBUG) {
            log.debug('----------------createService body----------------------');
            log.debug(payload);

            log.debug('----------------createService request----------------------');
            log.debug(data);
        }


        log.info(`Create containerGroup ${containerGroupName}`);
        containerInstances[containerGroupName] = true;
        log.info('Container instances : %s', Object.keys(containerInstances))

        /*
         * create the container-group but dont wait for it to be started!
           Unfortunately ServiceNow can't wait that long.... */
        client.containerGroups.createOrUpdate(resourceGroupName, containerGroupName, data).then((create) => {

            const timeOutSec = parseInt((env.TIMEOUT_MINS || 60), 10) * 60;

            log.info(`ContainerGroup ${resourceGroupName} ${containerGroupName} creation result:`);
            log.info(`\tcontainerGroup: ${create.name}`);
            log.info(`\tprovisioningState: ${create.provisioningState}`);
            log.info(`\tgroup will automatically be destroyed in ${timeOutSec} seconds`);

            containerInstances[containerGroupName] = setTimeout(async () => {
                log.info(`schedule delete containerGroup'${containerGroupName}' now`);
                await deleteContainerGroup(containerGroupName)

            }, timeOutSec * 1000);

        }).catch((error) => {
            if (error.response) {
                return log.info(`creation of containerGroup '${containerGroupName}' failed with: %s %s`, error.response.status, error.response.body);
            }
            log.error(error);
        });

        response.status = 201; // CREATED
        response.body = {
            ID: containerName
        }
    } catch (error) {
        log.info(error);
        if (error.response) {
            response.status = error.response.status;
            response.body = error.body;
        } else {
            log.error(error);
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
            log.error(error);
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
        await deleteContainerGroup(containerGroupName);

        response.status = 200;
        response.body = '';
    } catch (error) {
        if (error.response) {
            response.status = error.response.status;
            response.body = error.body;
        } else {
            log.error(error);
        }
    }
    return response;
}

/**
 * remove all containerGroups where the  name starts with the 'containerGroupPrefix' prefix
 */
const cleanUp = async () => {

    log.info('Container instances : %s', Object.keys(containerInstances))
    const res = await Promise.all(Object.keys(containerInstances).map((containerGroupName => {

        log.info('Container instance to be stopped : %s', containerGroupName)
        return deleteContainerGroup(containerGroupName);
        
    })))

    if (!res.length)
        return;

    log.info(`Number of deleted ContainerResources: ${res.length}`);
}

/**
 * periodically delete unused container instances
 * Criteria is:
 *  - name starts with the containerGroupPrefix
 *  - CreatedOnDate exists and is older than process.env.CONTAINER_TIMEOUT_MINS
 */
const scheduleCleanUp = async ({ CONTAINER_CLEANUP_INTERVAL: timeoutMinutes = 1440 }) => {

    log.info('Clean Up old Container Instances older than %d', timeoutMinutes);

    const client = new ContainerInstanceManagementClient(credential, subscriptionId);
    const list = await client.containerGroups.list();

    const timeOutMsSec = (timeoutMinutes + 2) * 60 * 1000;
    const now = new Date().getTime();
    await Promise.all(list.filter((group) => {

        const isRunnerContainer = group.name.startsWith(containerGroupPrefix);
        if (!isRunnerContainer)
            return false;

        // if there is no date, delete it
        if (!group.tags.CreatedOnDate)
            return true;

        const created = new Date(group.tags.CreatedOnDate).getTime();
        return (now > created + timeOutMsSec)

    }).map((group) => {
        return deleteContainerGroup(group.name);
    }));
}

module.exports = {
    getImage,
    createService,
    getLogs,
    deleteService,
    cleanUp,
    scheduleCleanUp
}
