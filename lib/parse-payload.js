module.exports = (payload) => {

    const spec = payload.TaskTemplate?.ContainerSpec || {};
    const image = spec.Image;
    const osType = (image || '').toLowerCase().includes(':win') ? 'Windows' : 'Linux';
    const env = spec.Env?.reduce((out, tmp) => {
        const arr = tmp.split('=');
        const name = arr[0];
        const value = arr.slice(1).join('=');
        out[name] = value;
        return out;
    }, {});

    if(!spec || !image || !env){
        throw Error(`Payload invalid. Spec valid: ${!!spec}, Image valid: ${!!image}, Env valid: ${!!env}`)
    }

    return {
        payload,
        spec,
        image,
        osType,
        env
    }
    
}
