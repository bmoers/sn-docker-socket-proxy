# Docker Socket Proxy (DSP) for ServiceNow ATF Headless Browser Integration

By design, ServiceNow [ATF Headless Browser integration](https://docs.servicenow.com/bundle/rome-application-development/page/administer/auto-test-framework/concept/atf-headless-browser.html) requires:

- a VM with Dockerd, swarm enabled
- the docker host to be public available
- the dockerd unix socket to be shared to the public (via Mutual Auth)

Unfortunately the OOB solution does not:

- integrate with cloud container service providers (Azure, AWS, etc)
- work with on-prem VM (Mutual Auth is not available via MID server)

This socket proxy exposes a REST API with the endpoints called by ServiceNow to create, monitor and delete the headless browser container and forwards these requests to services like:

- dockerd on a local VM (swarm enabled to lb over multiple VM)
- Azure to start the containers in the cloud (in progress)
- AWS (tbd)

The integration process is:

1. ATF scheduler run in ServiceNow
2. Headless Docker request via MID server to this DSP REST API
3. DSP forward request to container service like
   - dockerd (wia unix socket)
   - Azure (via [REST Api](https://docs.microsoft.com/en-us/rest/api/container-instances/))

