const GA_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const MEASUREMENT_ID = 'G-5GX8K6ZDCM';
const API_SECRET = 'M2SjVl_PT1mBIZR12yXEPg';
const DEFAULT_ENGAGEMENT_TIME_MSEC = 100;
const SESSION_EXPIRATION_IN_MIN = 30;

class Analytics {
    constructor() {
        this.isStorageAvailable = false;
        try {
            this.local = chrome.storage.local;
            this.session = chrome.storage.session || chrome.storage.local;
            this.isStorageAvailable = true;
        } catch (e) {
            console.warn('PCH Analytics: Storage not accessible in this context. Analytics disabled.');
        }
        this.cachedClientId = null;
        this.cachedSessionId = null;
    }

    async getOrCreateClientId() {
        if (!this.isStorageAvailable) return 'anonymous-client';
        if (this.cachedClientId) return this.cachedClientId;
        try {
            const result = await this.local.get('clientId');
            let clientId = result.clientId;
            if (!clientId) {
                clientId = self.crypto.randomUUID();
                await this.local.set({ clientId });
            }
            this.cachedClientId = clientId;
            return clientId;
        } catch (e) {
            return 'anonymous-client';
        }
    }

    async getOrCreateSessionId() {
        if (!this.isStorageAvailable) return 'anonymous-session';
        if (this.cachedSessionId) return this.cachedSessionId;

        try {
            let { sessionData } = await this.session.get('sessionData');
            const currentTimeInMs = Date.now();

            if (sessionData && sessionData.timestamp) {
                const durationInMin = (currentTimeInMs - sessionData.timestamp) / 60000;

                if (durationInMin > SESSION_EXPIRATION_IN_MIN) {
                    sessionData = null;
                } else {
                    sessionData.timestamp = currentTimeInMs;
                    await this.session.set({ sessionData });
                }
            }

            if (!sessionData) {
                sessionData = {
                    session_id: currentTimeInMs.toString(),
                    timestamp: currentTimeInMs.toString()
                };
                await this.session.set({ sessionData });
            }

            this.cachedSessionId = sessionData.session_id;
            return sessionData.session_id;
        } catch (e) {
            return 'anonymous-session';
        }
    }

    async fireEvent(name, params = {}) {
        if (!this.isStorageAvailable) return;

        if (!params.session_id) {
            params.session_id = await this.getOrCreateSessionId();
        }

        if (!params.engagement_time_msec) {
            params.engagement_time_msec = DEFAULT_ENGAGEMENT_TIME_MSEC;
        }

        try {
            params.pch_version = chrome.runtime.getManifest().version;
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
        if (!this.isStorageAvailable) return;
        return this.fireEvent('extension_error', {
            ...error,
            ...additionalParams
        });
    }
}

self.Analytics = new Analytics();