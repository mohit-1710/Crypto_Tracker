import { debounce } from '../../utils/debounce.js';
import { fetchCoinData, fetchAllCoinData, fetch7DayCoinData } from './api.js';
import { exchangeState } from './state.js';

export function initializeExchange() {
    const fromSelector = document.getElementById('crypto-selector-1');
    const toSelector = document.getElementById('crypto-selector-2');
    const swapBtn = document.querySelector('.swap-btn');
    const rateDisplay = document.querySelector('.exchange-rate');

    let selectedCoins = {
        from: null,
        to: null
    };

    setupCoinSelectors(fromSelector, toSelector, selectedCoins);
    setupSwapButton(swapBtn, selectedCoins);
    initializeRateUpdates(rateDisplay);

    console.debug('[Exchange] Initialized with elements:', { fromSelector, toSelector, swapBtn });
}

function setupCoinSelectors(fromSelector, toSelector, selectedCoins) {
    const selectors = [fromSelector, toSelector];
    
    selectors.forEach(selector => {
        selector.addEventListener('click', debounce(async (e) => {
            e.stopPropagation();
            
            selectors.forEach(s => {
                if (s !== selector) closeDropdown(s);
            });

            try {
                selector.classList.add('loading');
                const availableCoins = getAvailableCoins();
                
                const otherSelected = selectedCoins[getOtherType(selector.dataset.type)];
                const filteredCoins = availableCoins.filter(coin => 
                    coin.id !== otherSelected?.id
                );

                showCoinDropdown(selector, filteredCoins, selectedCoins);
            } catch (error) {
                console.error('[Exchange] Error loading coins:', error);
                showMessage('Failed to load coins', 'error');
            } finally {
                selector.classList.remove('loading');
            }
        }, 100));
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.crypto-selector') && !e.target.closest('.coin-dropdown')) {
            closeAllDropdowns();
        }
    });
}

function getOtherType(type) {
    return type === 'from' ? 'to' : 'from';
}

function showCoinDropdown(selector, coins, selectedCoins) {
    closeAllDropdowns();

    const dropdown = document.createElement('div');
    dropdown.className = 'coin-dropdown';
    dropdown.id = `${selector.id}-dropdown`;
    
    coins.forEach(coin => {
        const option = document.createElement('div');
        option.className = 'coin-option';
        
        const isSelected = selectedCoins[selector.dataset.type]?.id === coin.id;
        if (isSelected) option.classList.add('selected');

        option.innerHTML = `
            <div class="coin-info">
                <span class="coin-name">${coin.name}</span>
                <span class="coin-symbol">${coin.symbol}</span>
            </div>
        `;
        
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            selectCoin(selector, coin, selectedCoins);
        });
        
        dropdown.appendChild(option);
    });

    positionDropdown(dropdown, selector);
    document.body.appendChild(dropdown);
    
    requestAnimationFrame(() => dropdown.classList.add('visible'));
}

function selectCoin(selector, coin, selectedCoins) {
    selectedCoins[selector.dataset.type] = coin;
    
    selector.innerHTML = `
        <span>${coin.symbol}</span>
        <svg width="12" height="12" viewBox="0 0 24 24">
            <path d="M7 10l5 5 5-5z"/>
        </svg>
    `;
    
    selector.dataset.coinId = coin.id;
    
    console.debug('[Exchange] Coin selected:', {
        type: selector.dataset.type,
        coin: coin.id,
        selectedCoins
    });

    if (selectedCoins.from && selectedCoins.to) {
        updateRateDisplay(document.querySelector('.exchange-rate'));
    }
    
    closeAllDropdowns();
    renderYourAssets();
}

async function updateRateDisplay(rateDisplay) {
    const fromSelector = document.getElementById('crypto-selector-1');
    const toSelector = document.getElementById('crypto-selector-2');
    
    if (!fromSelector.dataset.coinId || !toSelector.dataset.coinId) {
        rateDisplay.textContent = 'Select coins to compare prices';
        return;
    }

    try {
        rateDisplay.textContent = 'Loading...';
        rateDisplay.classList.add('loading');

        const data = await fetchCoinData([fromSelector.dataset.coinId, toSelector.dataset.coinId]);
        exchangeState.setCoinData(data);

        const swapResult = exchangeState.calculateSwap(
            fromSelector.dataset.coinId,
            toSelector.dataset.coinId,
            1
        );

        if (swapResult) {
            rateDisplay.textContent = `1 ${fromSelector.querySelector('span').textContent} = ${swapResult.rate.toFixed(2)} ${toSelector.querySelector('span').textContent} = $${swapResult.usdValue.toFixed(2)}`;
        }
    } catch (error) {
        console.error('[Exchange] Error updating rate:', error);
        rateDisplay.textContent = 'Failed to fetch rates';
    } finally {
        rateDisplay.classList.remove('loading');
    }
}

function setupSwapButton(swapBtn, selectedCoins) {
    swapBtn.addEventListener('click', async () => {
        try {
            swapBtn.classList.add('loading');
            await performSwap();
            showSuccess();
        } catch (error) {
            console.error('Error performing swap:', error);
            showError(swapBtn);
        } finally {
            swapBtn.classList.remove('loading');
        }
    });
}

function validateSwap(fromCoin, toCoin, fromAmount) {
    if (!fromCoin || !toCoin) {
        throw new Error('Please select both coins for the swap');
    }
    
    if (fromCoin === toCoin) {
        throw new Error('Cannot swap the same coin');
    }
    
    if (isNaN(fromAmount) || fromAmount <= 0) {
        throw new Error('Please enter a valid amount to swap');
    }
    
    const row = document.querySelector(`.table-row[data-coin-id="${fromCoin}"]`);
    if (!row) {
        throw new Error('Source coin not found in your assets');
    }
    
    const currentVolume = parseFloat(row.querySelector('.volume-cell').textContent);
    if (currentVolume < fromAmount) {
        throw new Error('Insufficient balance for swap');
    }
}

async function performSwap() {
    const fromSelector = document.querySelector('.crypto-selector:first-of-type');
    const toSelector = document.querySelector('.crypto-selector:last-of-type');
    const fromAmount = parseFloat(document.querySelector('.input-value span').textContent);

    const fromCoin = fromSelector.dataset.coinId;
    const toCoin = toSelector.dataset.coinId;

    // Debug logging
    console.debug('[Exchange] Starting swap:', {
        fromCoin,
        toCoin,
        fromAmount
    });

    try {
        // Validate swap parameters
        validateSwap(fromCoin, toCoin, fromAmount);

        // Calculate swap
        const swapResult = exchangeState.calculateSwap(fromCoin, toCoin, fromAmount);
        if (!swapResult) {
            throw new Error('Failed to calculate swap rates');
        }

        // Debug logging
        console.debug('[Exchange] Swap calculation:', swapResult);

        // Update assets in the table
        await updateAssetTable(fromCoin, -swapResult.fromAmount);
        await updateAssetTable(toCoin, swapResult.toAmount);

        // Show success message
        showMessage('Swap completed successfully!', 'success');

        return swapResult;
    } catch (error) {
        console.error('[Exchange] Swap error:', error);
        showMessage(error.message, 'error');
        throw error;
    }
}

async function updateAssetTable(coinId, amountChange) {
    const row = document.querySelector(`.table-row[data-coin-id="${coinId}"]`);
    
    // Debug logging
    console.debug('[Exchange] Updating asset table:', {
        coinId,
        amountChange,
        rowFound: !!row
    });

    if (!row && amountChange > 0) {
        // Create new row for purchased coin
        await createNewAssetRow(coinId, amountChange);
    } else if (row) {
        const volumeCell = row.querySelector('.volume-cell');
        const currentVolume = parseFloat(volumeCell.textContent);
        const newVolume = currentVolume + amountChange;

        if (newVolume <= 0) {
            row.remove();
        } else {
            volumeCell.textContent = `${newVolume.toFixed(2)} M`;
        }
    }

    // Update price and trend data
    await updatePriceData([coinId]);

    // Update asset count
    const updateAssetCount = window.updateAssetCount;
    if (typeof updateAssetCount === 'function') {
        updateAssetCount();
    }
}

async function updatePriceData(coinIds) {
    try {
        const data = await fetchCoinData(coinIds);
        exchangeState.setCoinData(data);

        coinIds.forEach(coinId => {
            const row = document.querySelector(`.table-row[data-coin-id="${coinId}"]`);
            if (!row) return;

            const coinData = exchangeState.getCoinData(coinId);
            if (!coinData) return;

            // Update price
            const priceCell = row.querySelector('.price-cell');
            priceCell.textContent = `$${coinData.usd.toLocaleString()}`;

            // Update trend
            const trendCell = row.querySelector('.trend-cell');
            const trend = coinData.usd_24h_change;
            trendCell.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24">
                    <path d="M7 ${trend >= 0 ? '14l5-5 5 5' : '10l5 5 5-5'}z"/>
                </svg>
                ${Math.abs(trend).toFixed(2)}%
            `;
            trendCell.className = `cell trend-cell ${trend >= 0 ? 'positive' : 'negative'}`;
        });
    } catch (error) {
        console.error('[Exchange] Error updating price data:', error);
        showMessage('Failed to update price data', 'error');
    }
}

function showMessage(message, type) {
    const messageElement = document.createElement('div');
    messageElement.className = `${type}-message message`;
    messageElement.textContent = message;
    document.body.appendChild(messageElement);

    setTimeout(() => {
        messageElement.remove();
    }, 3000);
}

async function initializeRateUpdates(rateDisplay) {
    async function updateRate() {
        const fromSelector = document.querySelector('.crypto-selector:first-of-type');
        const toSelector = document.querySelector('.crypto-selector:last-of-type');
        
        if (!fromSelector.dataset.coinId || !toSelector.dataset.coinId) return;

        if (exchangeState.needsUpdate()) {
            const data = await fetchCoinData([fromSelector.dataset.coinId, toSelector.dataset.coinId]);
            exchangeState.setCoinData(data);
        }

        const swapResult = exchangeState.calculateSwap(
            fromSelector.dataset.coinId,
            toSelector.dataset.coinId,
            1
        );

        if (swapResult) {
            rateDisplay.textContent = `1 ${fromSelector.textContent.trim()} = ${swapResult.rate.toFixed(2)} ${toSelector.textContent.trim()} = $${swapResult.usdValue.toFixed(2)}`;
        }
    }

    // Update rate every 30 seconds
    setInterval(updateRate, 30000);
    // Initial update
    await updateRate();
}

function positionDropdown(dropdown, selector) {
    const rect = selector.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    dropdown.style.position = 'absolute';
    dropdown.style.top = `${rect.bottom + scrollTop + 8}px`;
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.minWidth = `${rect.width}px`;
}

function closeDropdown(selector) {
    const dropdown = document.querySelector(`#${selector.id}-dropdown`);
    if (dropdown) {
        dropdown.classList.remove('visible');
        setTimeout(() => dropdown.remove(), 200);
    }
}

function closeAllDropdowns() {
    document.querySelectorAll('.coin-dropdown').forEach(dropdown => {
        dropdown.classList.remove('visible');
        setTimeout(() => dropdown.remove(), 200);
    });
}

function getAvailableCoins() {
    const coins = [];
    document.querySelectorAll('.table-row').forEach(row => {
        coins.push({
            id: row.dataset.coinId,
            name: row.querySelector('.coin-name').textContent,
            symbol: row.querySelector('.coin-symbol').textContent
        });
    });
    return coins;
}

function createNewAssetRow(coinId, amountChange) {
    const row = document.createElement('div');
    row.className = 'table-row';
    row.dataset.coinId = coinId;

    const nameCell = document.createElement('div');
    nameCell.className = 'coin-name';
    nameCell.textContent = getCoinName(coinId);

    const symbolCell = document.createElement('div');
    symbolCell.className = 'coin-symbol';
    symbolCell.textContent = getCoinSymbol(coinId);

    const volumeCell = document.createElement('div');
    volumeCell.className = 'volume-cell';
    volumeCell.textContent = `0 M`;

    const priceCell = document.createElement('div');
    priceCell.className = 'price-cell';
    priceCell.textContent = `$${getCoinPrice(coinId).toFixed(2)}`;

    const trendCell = document.createElement('div');
    trendCell.className = 'trend-cell';
    trendCell.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24">
            <path d="M7 10l5 5 5-5z"/>
        </svg>
        0.00%
    `;
    trendCell.className = 'cell trend-cell positive';

    row.appendChild(nameCell);
    row.appendChild(symbolCell);
    row.appendChild(volumeCell);
    row.appendChild(priceCell);
    row.appendChild(trendCell);

    document.querySelector('.table-body').appendChild(row);
}

function getCoinName(coinId) {
    const row = document.querySelector(`.table-row[data-coin-id="${coinId}"]`);
    if (!row) return '';
    return row.querySelector('.coin-name').textContent;
}

function getCoinSymbol(coinId) {
    const row = document.querySelector(`.table-row[data-coin-id="${coinId}"]`);
    if (!row) return '';
    return row.querySelector('.coin-symbol').textContent;
}

function getCoinPrice(coinId) {
    const row = document.querySelector(`.table-row[data-coin-id="${coinId}"]`);
    if (!row) return 0;
    const priceCell = row.querySelector('.price-cell');
    if (!priceCell) return 0;
    return parseFloat(priceCell.textContent.replace('$', ''));
}

async function renderYourAssets() {
    try {
        const assetsTable = document.querySelector('.assets-table-body');
        assetsTable.innerHTML = ''; // Clear existing entries

        const coinIds = ['bitcoin', 'ethereum', 'cardano']; // Example coin IDs
        for (const coinId of coinIds) {
            let data = exchangeState.getCoinData(coinId);
            if (!data) {
                data = await fetch7DayCoinData(coinId);
                exchangeState.setCoinData(coinId, data);
            }

            console.debug(`[Assets] Fetched 7-day data for ${coinId}:`, data);

            const lastPrice = data.prices[data.prices.length - 1][1];
            const trend = ((lastPrice - data.prices[0][1]) / data.prices[0][1]) * 100;

            const row = document.createElement('div');
            row.className = 'table-row';
            row.dataset.coinId = coinId;

            row.innerHTML = `
                <div class="coin-name">${coinId.toUpperCase()}</div>
                <div class="coin-price">$${lastPrice.toFixed(2)}</div>
                <div class="coin-trend">${trend.toFixed(2)}%</div>
            `;

            assetsTable.appendChild(row);
        }
    } catch (error) {
        console.error('[Assets] Error rendering assets:', error);
        showMessage('Unable to load coins. Please try again.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const selectors = [
        { button: document.getElementById('crypto-selector-1'), menu: document.getElementById('crypto-dropdown-menu-1') },
        { button: document.getElementById('crypto-selector-2'), menu: document.getElementById('crypto-dropdown-menu-2') }
    ];

    selectors.forEach(({ button, menu }) => {
        // Toggle dropdown visibility on button click
        button.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent event from bubbling up
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
        });

        // Update button text and close dropdown on option select
        menu.addEventListener('click', (event) => {
            if (event.target.tagName === 'LI') {
                const selectedCrypto = event.target.getAttribute('data-value');
                const selectedText = event.target.textContent;
                button.querySelector('span').textContent = selectedText;
                menu.style.display = 'none';
                console.log('Selected crypto:', selectedCrypto);
                // Update any other logic or state as needed
            }
        });
    });

    // Close the dropdown if clicked outside
    document.addEventListener('click', (event) => {
        selectors.forEach(({ menu }) => {
            if (!menu.contains(event.target)) {
                menu.style.display = 'none';
            }
        });
    });

    const swapBtn = document.querySelector('.swap-btn');
    const fromSelector = document.getElementById('crypto-selector-1');
    const toSelector = document.getElementById('crypto-selector-2');

    swapBtn.addEventListener('click', async () => {
        const fromCoin = fromSelector.querySelector('span').textContent.trim();
        const toCoin = toSelector.querySelector('span').textContent.trim();

        try {
            // Fetch latest prices for both coins
            const coinData = await fetchCoinData([fromCoin.toLowerCase(), toCoin.toLowerCase()]);
            const fromCoinPrice = coinData[fromCoin.toLowerCase()].usd;
            const toCoinPrice = coinData[toCoin.toLowerCase()].usd;

            // Get the volume of the first coin from the "Your Assets" section
            const fromVolume = parseFloat(document.querySelector(`.table-row .coin-symbol:contains(${fromCoin})`).closest('.table-row').querySelector('.volume-cell').textContent);

            // Calculate equivalent volume of the second coin
            const equivalentVolume = (fromVolume * fromCoinPrice) / toCoinPrice;

            // Remove the first coin's row
            document.querySelector(`.table-row .coin-symbol:contains(${fromCoin})`).closest('.table-row').remove();

            // Update or add the second coin
            updateOrAddCoin(toCoin, equivalentVolume);

            // Update asset count
            updateAssetCount();
        } catch (error) {
            console.error('Error during coin conversion:', error);
        }
    });
});

function updateOrAddCoin(coinSymbol, volume) {
    const existingRow = [...document.querySelectorAll('.table-row')].find(row => 
        row.querySelector('.coin-symbol').textContent === coinSymbol
    );

    if (existingRow) {
        const currentVolume = parseFloat(existingRow.querySelector('.volume-cell').textContent);
        existingRow.querySelector('.volume-cell').textContent = (currentVolume + volume).toFixed(2);
    } else {
        const newRow = document.createElement('div');
        newRow.className = 'table-row';
        newRow.innerHTML = `
            <div class="cell coin-cell">
                <div class="coin-info">
                    <span class="coin-name">${coinSymbol}</span>
                    <span class="coin-symbol">${coinSymbol}</span>
                </div>
            </div>
            <div class="cell price-cell">-</div>
            <div class="cell trend-cell">-</div>
            <div class="cell volume-cell">${volume.toFixed(2)}</div>
            <div class="cell chart-cell"></div>
            <div class="cell action-cell">
                <button class="trade-btn">TRADE</button>
            </div>
        `;
        document.querySelector('.table-body').appendChild(newRow);
    }
}

function updateAssetCount() {
    const tableBody = document.querySelector('.table-body');
    const visibleAssets = tableBody ? tableBody.children.length : 0;

    // Update count in Your Assets section
    const assetsCount = document.querySelector('.assets-section .assets-count');
    if (assetsCount) {
        assetsCount.textContent = `${visibleAssets} Assets`;
    }

    // Update count in Top Gainers section
    const gainersCount = document.querySelector('.gainers-section .asset-count');
    if (gainersCount) {
        gainersCount.textContent = `${visibleAssets} Assets`;
    }
} 