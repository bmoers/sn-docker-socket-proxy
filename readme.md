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
- Azure to start the containers in the cloud
- AWS (tbd)

The integration process is:

1. ATF scheduler run in ServiceNow
2. Headless Docker request via MID server to this DSP REST API
3. DSP forward request to container service like
   - dockerd (wia unix socket)
   - Azure (via [REST Api](https://docs.microsoft.com/en-us/rest/api/container-instances/))

## Setup

### Azure Settings

- A [service principal](https://docs.microsoft.com/en-us/azure/active-directory/develop/app-objects-and-service-principals#service-principal-object) (AZURE_CLIENT_ID / AZURE_CLIENT_SECRET / AZURE_TENANT_ID)
- A [subscription ID](https://portal.azure.com/#blade/Microsoft_Azure_Billing/SubscriptionsBlade) (AZURE_SUBSCRIPTION_ID)
- A [resource group](https://portal.azure.com/#blade/HubsExtension/BrowseResourceGroups) (AZURE_RESOURCE_GROUP_NAME)
- A [resouce location](https://azure.microsoft.com/en-us/regions/) 

As a quick-start [Install the Azure CLI](https://docs.microsoft.com/cli/azure/install-azure-cli) and do:

```bash
az login
# select your active Azure subscription
az account set -s [00000000-0000-0000-0000-00000000000000000]
# create the service principal
az ad sp create-for-rbac

# get list of locations, select one for AZURE_RESOURCE_LOCATION
az account list-locations -o table

# create the resource group 
az group create --name rg-co-cicdsnow-dev-001
```

Service Principal example:

```JSON
{
  "appId": "798256c4-bbdc-4f7a-a20a-",             // AZURE_CLIENT_ID
  "displayName": ".....",
  "name": "...",
  "password": "",                                  // AZURE_CLIENT_SECRET
  "tenant": "72f988bf-86f1-41af-91ab-"             // AZURE_TENANT_ID
}
```

### SN Docker Socket Proxy

**TBD**

NOTE: 
Run the `ghcr.io/bmoers/sn/sn-docker-socket-proxy:latest` behind a reverse proxy, like Trafik, to terminate TLS. Otherwise the BasicAuth credentials are sent in plaintext over the network.

### ServiceNow

1. Read (but don't follow!) all the ServiceNow [Headless Browser for Automated Test Framework](https://docs.servicenow.com/bundle/rome-application-development/page/administer/auto-test-framework/concept/atf-headless-browser.html) guide ton configure the instance to automatically request a new ATF Docker container for scheduled ATF runs.

2. As the integration with docker is done by this proxy, there is no need to configure ServiceNow to connect to the Docker socket via MutualAuth. Instead a simple REST connection with BasicAuth - and if required via MID server - can be made.
   1. Create a Connections alias: Navigate to **Connections & Credentials > Connection & Credential Aliases** to open the **sys_alias** table.
   2. Select the alias with the name **Docker**.
   3. Under the Connections related list, select **New**.
   4. Fill in these fields:
      - Name: Any text you prefer
      - Credential field: Create a new Credential of type **Basic Auth Credentials** with user/password to connect to this proxy (Traefik BasicAuth user)
      - Select the URL Builder check box.
      - Make sure the Mutual authentication check box is **unchecked**.
      - Check **Use MID server** if this proxy service runs in your internal network
      - In the Host field, add the Host name of your server.
      - In case this proxy is not running on the default port (443) specify the port in the **Override default port** filed
      - Select Submit.
        The Connection URL is automatically created by the system.
