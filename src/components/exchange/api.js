const API_BASE_URL = 'https://api.coingecko.com/api/v3';
const options = { 
    method: 'GET', 
    headers: { accept: 'application/json' }
};

export async function fetchCoinData(coinIds) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd`,
            options
        );
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching coin data:', error);
        throw error;
    }
}

export async function searchCoin(query) {
    try {
        const response = await fetch(`${API_BASE_URL}/search?query=${query}`, options);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error searching coin:', error);
        throw error;
    }
}

export async function fetchAllCoinData() {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,cardano&vs_currencies=usd&include_24hr_change=true');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching all coin data:', error);
        throw error;
    }
}

export async function fetch7DayCoinData(coinId) {
    try {
        const response = await fetch(`${API_BASE_URL}/coins/${coinId}/market_chart?vs_currency=usd&days=7`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching 7-day data for ${coinId}:`, error);
        throw error;
    }
} 