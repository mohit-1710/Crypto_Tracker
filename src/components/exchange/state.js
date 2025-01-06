// Singleton to manage exchange state
class ExchangeState {
    constructor() {
        this.coinDataCache = new Map();
        this.cacheDuration = 5 * 60 * 1000; // Cache for 5 minutes
    }

    setCoinData(coinId, data) {
        this.coinDataCache.set(coinId, {
            data,
            timestamp: Date.now()
        });
    }

    getCoinData(coinId) {
        const cached = this.coinDataCache.get(coinId);
        if (cached && (Date.now() - cached.timestamp < this.cacheDuration)) {
            return cached.data;
        }
        return null;
    }
}

export const exchangeState = new ExchangeState(); 