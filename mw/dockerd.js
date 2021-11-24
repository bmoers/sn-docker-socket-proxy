const http = require('http');

const agent = new http.Agent({
    socketPath: "/var/run/docker.sock",
})

const axios = require('axios');
const instance = axios.create({
    baseURL: 'http://localhost',
    httpAgent: agent,
    //socketPath: "/var/run/docker.sock",
});


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
        const request = await instance.post(`/services/create`, payload);
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

const getLogs = async (serviceId) => {
    const response = {
        status: 500,
        body: undefined
    }
    try {
        const request = await instance.get(`/services/${serviceId}/logs?stdout=true&stderr=true`);
        console.log(request.headers)
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
        console.log(request.headers)
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

module.exports = {
    getImage,
    createService,
    getLogs,
    deleteService
}
