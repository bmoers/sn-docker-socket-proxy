

module.exports = (mandatoryVars = []) => {
    const missing = mandatoryVars.reduce((out, varName) => {

        if (!process.env[varName])
            out.push(`${varName} variable is mandatory`);
        return out;
    }, [])
    if (missing.length) {
        throw new Error(missing.join('\n'));
    }
}
