const GA_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const GA_DEBUG_ENDPOINT = 'https://www.google-analytics.com/debug/mp/collect';
const MEASUREMENT_ID = 'G-5GX8K6ZDCM';
const API_SECRET = 'M2SjVl_PT1mBIZR12yXEPg';
const DEFAULT_ENGAGEMENT_TIME_MSEC = 100;
const SESSION_EXPIRATION_IN_MIN = 30;
class Analytics {
    constructor() {
        this.debug = false;
        this.local = chrome.storage.local;
    }
    async getOrCreateClientId() {
        const result = await this.local.get('clientId');
        let clientId = result.clientId;
        if (!clientId) {
            clientId = self.crypto.randomUUID();
            await this.local.set({ clientId });
        }
        return clientId;
    }
    async getOrCreateSessionId() {
        let { sessionData } = await this.local.get('sessionData');
        const currentTimeInMs = Date.now();
        if (sessionData && sessionData.timestamp) {
            const durationInMin = (currentTimeInMs - sessionData.timestamp) / 60000;
            if (durationInMin > SESSION_EXPIRATION_IN_MIN) {
                sessionData = null;
            } else {
                sessionData.timestamp = currentTimeInMs;
                await this.local.set({ sessionData });
            }
        }
        if (!sessionData) {
            sessionData = {
                session_id: currentTimeInMs.toString(),
                timestamp: currentTimeInMs.toString()
            };
            await this.local.set({ sessionData });
        }
        return sessionData.session_id;
    }
    async fireEvent(name, params = {}) {
        if (!params.session_id) {
            params.session_id = await this.getOrCreateSessionId();
        }
        if (!params.engagement_time_msec) {
            params.engagement_time_msec = DEFAULT_ENGAGEMENT_TIME_MSEC;
        }
        try {
            params.app_version = chrome.runtime.getManifest().version;
        } catch (e) {
        }
        try {
            await fetch(
                `${GA_ENDPOINT}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        client_id: await this.getOrCreateClientId(),
                        events: [
                            {
                                name,
                                params
                            }
                        ]
                    })
                }
            );
        } catch (e) {
        }
    }
    async fireErrorEvent(error, additionalParams = {}) {
        return this.fireEvent('extension_error', {
            ...error,
            ...additionalParams
        });
    }
}
self.Analytics = new Analytics();