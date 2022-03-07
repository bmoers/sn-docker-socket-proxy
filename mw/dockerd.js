const log = require('../lib/logger').topic(module);

const http = require('http');

const agent = new http.Agent({
    socketPath: '/var/run/docker.sock',
})

const axios = require('axios');
const { path } = require('express/lib/application');
const instance = axios.create({
    baseURL: 'http://localhost',
    httpAgent: agent,
});

// curl --unix-socket /var/run/docker.sock http://localhost/containers/json

const containerInstances = {};

const getImage = async (filters = {}) => {
    const response = {
        status: 500,
        body: undefined
    }
    try {
        const request = await instance.get(`/images/json?all=&filters=${encodeURIComponent(JSON.stringify(filters))}`)
        response.status = request.status;
        response.body = request.data;
    } catch (error) {
        if (error.response) {
            response.status = error.response.status;
            response.body = {
                ...error.response.data
            };
        } else {
            throw error;
        }
    }
    return response;
}
const createService = async (payload) => {
    const response = {
        status: 500,
        body: undefined
    }
    try {
        const request = await instance.post('/services/create', payload);
        response.status = request.status;
        response.body = request.data;
        if(response.body['ID']){
            const serviceId = response.body['ID'];
            containerInstances[serviceId] = true;
        }

    } catch (error) {
        if (error.response) {
            response.status = error.response.status;
            response.body = {
                ...error.response.data
            };
        } else {
            throw error;
        }
    }
    return response;
}

const getLogs = async (serviceId) => {
    const response = {
        status: 500,
        body: undefined
    }
    try {
        const request = await instance.get(`/services/${serviceId}/logs?stdout=true&stderr=true`);
        response.status = request.status;
        response.body = request.data;
    } catch (error) {
        if (error.response) {
            response.status = error.response.status;
            response.body = {
                ...error.response.data
            };
        } else {
            throw error;
        }
    }
    return response;
}

const deleteService = async (serviceId) => {
    const response = {
        status: 500,
        body: undefined
    }
    try {
        const request = await instance.delete(`/services/${serviceId}`);
        response.status = request.status;
        response.body = request.data;

        delete containerInstances[serviceId];

    } catch (error) {
        if (error.response) {
            response.status = error.response.status;
            response.body = {
                ...error.response.data
            };
        } else {
            throw error;
        }
    }
    return response;
}

/**
 * remove all containerGroups where the  name starts with the 'containerGroupPrefix' prefix
 */
const cleanUp = async () => {

    const res = await Promise.all(Object.keys(containerInstances).map(((serviceId) => {
        log.info('Delete ServiceId %s', serviceId)
        return deleteService(serviceId);
    })))

    if (!res.length)
        return;

    log.info(`Number of deleted Docker Service: ${res.length}`)
}

module.exports = {
    getImage,
    createService,
    getLogs,
    deleteService,
    cleanUp
}
