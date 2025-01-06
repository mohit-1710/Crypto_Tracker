const FIAT_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tron,tether,dogecoin&vs_currencies=usd,inr,eur,aed';

// Object to store current crypto prices
let cryptoPrices = {};

// Fetch crypto prices for predefined cryptocurrencies
async function fetchCryptoPrices() {
    try {
        const response = await fetch(COINGECKO_API_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        cryptoPrices = {
            BTC: data.bitcoin,
            ETH: data.ethereum,
            TRX: data.tron,
            USDT: data.tether,
            DOGE: data.dogecoin
        };

        console.log('Fetched Crypto Prices:', cryptoPrices);
    } catch (error) {
        console.error('Error fetching crypto prices:', error);
        throw error;
    }
}

// Populate fiat currency dropdown with options from HTML
function populateFiatDropdown() {
    const dropdown = document.getElementById('fiat-dropdown');
    const options = dropdown.querySelectorAll('option');

    // Clear existing options if needed
    dropdown.innerHTML = '';

    options.forEach(option => {
        const newOption = document.createElement('option');
        newOption.value = option.value;
        newOption.textContent = option.textContent;
        dropdown.appendChild(newOption);
    });
}

async function fetchConversionRate(coinId, currency) {
    const apiUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${currency}`;
    console.log(`Fetching conversion rate for ${coinId} to ${currency} from ${apiUrl}`);
    
    try {
        const response = await fetch(apiUrl);
        console.log('API response status:', response.status);
        
        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('API rate limit reached');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API response data:', data);
        
        if (!data[coinId] || !data[coinId][currency]) {
            throw new Error('Invalid response structure or unsupported currency');
        }
        
        return data[coinId][currency];
    } catch (error) {
        console.error('Error fetching conversion rate:', error);
        throw error;
    }
}

function setupConverter() {
    const convertBtn = document.querySelector('.convert-btn');
    const conversionResult = document.querySelector('.conversion-result');
    const cryptoDropdown = document.getElementById('crypto-dropdown');
    const fiatDropdown = document.getElementById('fiat-dropdown');

    convertBtn.addEventListener('click', async () => {
        const selectedCrypto = cryptoDropdown.value;
        const selectedFiat = fiatDropdown.value;

        console.log('Selected crypto:', selectedCrypto);
        console.log('Selected fiat:', selectedFiat);

        if (!selectedCrypto || !selectedFiat) {
            conversionResult.textContent = 'Please select valid options.';
            return;
        }

        conversionResult.textContent = 'Fetching price...';

        try {
            const convertedPrice = await fetchConversionRate(selectedCrypto, selectedFiat);
            conversionResult.textContent = `1 ${selectedCrypto.toUpperCase()} = ${convertedPrice} ${selectedFiat.toUpperCase()}`;
        } catch (error) {
            conversionResult.textContent = error.message || 'Error fetching price. Please try again.';
        }
    });
}

// Initialize the converter and fetch required data
document.addEventListener('DOMContentLoaded', () => {
    populateFiatDropdown();
    setupConverter();
});
