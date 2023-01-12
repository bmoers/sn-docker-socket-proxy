# Request

1. GET /images/json

   Params:
    - all
    - filters: {"reference":["ghcr.io/servicenow/atf-headless-runner:lin-1.0.0"]}

   Example:
    - `/images/json?all=&filters=%7B%22reference%22%3A%5B%22ghcr.io%2Fservicenow%2Fatf-headless-runner%3Alin-1.0.0%22%5D%7D`

   Response:
    - Status: 200 OK
    - Body:

   ```JSON
    [
        {
            "Containers": -1,
            "Created": 1624041926,
            "Id": "sha256:564c2cc2729fab64024883404d64332ce20596f5b29444e44a539bc8615787f6",
            "Labels": null,
            "ParentId": "",
            "RepoDigests": null,
            "RepoTags": [
                "ghcr.io/servicenow/atf-headless-runner:lin-1.0.0"
            ],
            "SharedSize": -1,
            "Size": 1076704188,
            "VirtualSize": 1076704188
        }
    ]
   ```

2. POST /services/create
   Body:

   ```JSON

    {
        "Name": "dd5d46f0f18cc5507255bb19f00d353f",
        "TaskTemplate": {
            "ContainerSpec": {
                "Mounts": [
                    {
                        "Type": "bind",
                        "Source": "/opt/atf-docker-socket-proxy/screens",
                        "Target": "/usr/src/app/screens"
                    }
                ],
                "Image": "ghcr.io/servicenow/atf-headless-runner:lin-1.0.0",
                "Env": [
                    "AGENT_ID=555d46f01b8cc5504aa7524b92f4933f",
                    "BROWSER=headlesschrome",
                    "INSTANCE_URL=https://dev102702.service-now.com",
                    "SN_USERNAME=ATF-HEADLESS-BROWSER-TEST",
                    "TIMEOUT_MINS=1440",
                    "LOGIN_PAGE=login.do",
                    "RUNNER_URL=atf_test_runner.do?sysparm_nostack=true&sysparm_scheduled_tests_only=true&sysparm_headless=true",
                    "LOGIN_BUTTON_ID=sysverb_login",
                    "USER_FIELD_ID=user_name",
                    "PASSWORD_FIELD_ID=user_password",
                    "HEADLESS_VALIDATION_PAGE=atf_headless_validation_page",
                    "VP_VALIDATION_ID=headless_vp_validation",
                    "VP_HAS_ROLE_ID=headless_vp_has_role",
                    "VP_SUCCESS_ID=headless_vp_success",
                    "TEST_RUNNER_BANNER_ID=test_runner_banner",
                    "HEARTBEAT_ENABLED=true",
                    "HEARTBEAT_URI=/api/now/atf_agent/online",
                    "BROWSER_OPTIONS=add_argument('--no-sandbox');add_argument('--disable-gpu');add_argument('--ignore-certificate-errors')",
                    "SECRET_PATH=/run/secrets/sn_password"
                ],
                "Secrets": [
                    {
                        "SecretName": "sn_password",
                        "SecretID": "u19fa97lheuy0jg7xmy7nwtzh",
                        "File": {
                            "GID": "1000",
                            "Mode": 256,
                            "Name": "sn_password",
                            "UID": "1000"
                        }
                    }
                ]
            },
            "RestartPolicy": {
                "Condition": "any",
                "Delay": 0,
                "MaxAttempts": 1,
                "Window": 60000000000
            }
        }
    }
   ```

   Response:
    - Status: 201 Created
    - Body:

      ```JSON
        {
            "ID": "ts3fak4s0pevuvvkm9u81xmb2"
        }
      ```

3. Get Service Logs

   GET http://scl000103789.sccloud.swissre.com:8443/services/{{service-id}}/logs

   Params:
    - stdout: true
    - stderr: true

   Example:
    - `/services/ts3fak4s0pevuvvkm9u81xmb2/logs?stdout=true&stderr=true`

   Response:
    - Status: 200 OK
    - Body:

       ```TEXT
        ==============================================================================
        Robot :: Script to startup a headless client test runner                      
        ==============================================================================
        Open browser
        AGENT_ID is 93a84ebcb14cc5508ce073bef25d0f1c
        BROWSER is headlesschrome
        INSTANCE_URL is https://dev102702.service-now.com
        USERNAME is ATF-HEADLESS-BROWSER-TEST
        Secret Path: /run/secrets/sn_password
        TIMEOUT is 1440 minutes
        LOGIN_PAGE is login.do
        RUNNER_URL is atf_test_runner.do?sysparm_nostack=true&sysparm_scheduled_tests_only=true&sysparm_headless=true
        BROWSER_OPTIONS is add_argument('--no-sandbox');add_argument('--disable-gpu');add_argument('--ignore-certificate-errors')
        LOGIN_BUTTON_ID is sysverb_login
        USER_FIELD_ID is user_name
        PASSWORD_FIELD_ID is user_password
        9HEADLESS_VALIDATION_PAGE is atf_headless_validation_page
        VP_VALIDATION_ID is headless_vp_validation
        VP_HAS_ROLE_ID is headless_vp_has_role
        VP_SUCCESS_ID is headless_vp_success
        TEST_RUNNER_BANNER_ID is test_runner_banner
        HEARTBEAT_ENABLED is true
        HEARTBEAT_URI is /api/now/atf_agent/online
        Login URL is https://dev102702.service-now.com/login.do
        Logging in user: ATF-HEADLESS-BROWSER-TEST
        Clicked Login Button
        OGoing to entry: https://dev102702.service-now.com/atf_headless_validation_page
        Going to runner: https://dev102702.service-now.com/atf_test_runner.do?sysparm_nostack=true&sysparm_scheduled_tests_only=true&sysparm_headless=true&sys_atf_agent=93a84ebcb14cc5508ce073bef25d0f1c
        Waiting for agent to come online
        I2021-11-23 14:39:30 | Heartbeat Response: {'result': {'online': 'true'}}
        Agent is online
        I2021-11-23 14:39:32 | Heartbeat Response: {'result': {'online': 'true'}}
        I2021-11-23 14:40:34 | Heartbeat Response: {'result': {'online': 'true'}}
        I2021-11-23 14:41:35 | Heartbeat Response: {'result': {'online': 'true'}}
        I2021-11-23 14:42:37 | Heartbeat Response: {'result': {'online': 'true'}}
       ```

4. DELETE /services/{{service-id}}

   Example:
    - `/services/ts3fak4s0pevuvvkm9u81xmb2`

   Response:
    - Status: 200 OK
    - Body: none
