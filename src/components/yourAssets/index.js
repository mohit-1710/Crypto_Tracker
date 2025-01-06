import { createChart } from './chart.js';
import { debounce } from '../../utils/debounce.js';
import { fetchCoinData } from '../exchange/api.js';

export function initializeAssets() {
    // Add the "+" button to the assets header
    const assetsHeader = document.querySelector('.assets-header .header-actions');
    const addButton = createAddButton();
    assetsHeader.insertBefore(addButton, assetsHeader.firstChild);

    // Initialize charts
    initializeCharts();

    // Add click handlers to existing trade buttons
    document.querySelectorAll('.trade-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const row = btn.closest('.table-row');
            const coinName = row.querySelector('.coin-name').textContent;
            const coinSymbol = row.querySelector('.coin-symbol').textContent;

            const secondCoinSymbol = prompt('Enter the symbol of the second coin:');
            if (!secondCoinSymbol) return;

            try {
                const coinData = await fetchCoinData([coinSymbol.toLowerCase(), secondCoinSymbol.toLowerCase()]);
                const firstCoinPrice = coinData[coinSymbol.toLowerCase()].usd;
                const secondCoinPrice = coinData[secondCoinSymbol.toLowerCase()].usd;

                const volume = parseFloat(row.querySelector('.volume-cell').textContent);
                const equivalentVolume = (volume * firstCoinPrice) / secondCoinPrice;

                // Remove the first coin's row
                row.remove();

                // Update or add the second coin
                updateOrAddCoin(secondCoinSymbol, equivalentVolume);

                updateAssetCount();
            } catch (error) {
                console.error('Error during coin conversion:', error);
            }
        });
    });

    // Initialize filters
    initializeFilters();

    // Initialize asset count
    updateAssetCount();
}

function createAddButton() {
    const addButton = document.createElement('button');
    addButton.className = 'icon-btn';
    addButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
    `;

    addButton.addEventListener('click', () => {
        const coinName = prompt('Enter cryptocurrency name:');
        if (coinName) {
            const volume = prompt('Enter volume:');
            if (volume && !isNaN(volume)) {
                addNewCryptoAsset(coinName, volume);
            } else {
                alert('Please enter a valid volume number');
            }
        }
    });

    return addButton;
}

function initializeCharts() {
    createChart('bitcoin', 'green-chart', '#a6ee66', 'rgba(166, 238, 102, 0.1)');
    createChart('tether', 'red-chart', '#ff6b6b', 'rgba(255, 107, 107, 0.1)');
    createChart('ethereum', 'purple-chart', '#9580ff', 'rgba(149, 128, 255, 0.1)');
    createChart('bitcoin', 'green-chart-small', '#a6ee66', 'rgba(166, 238, 102, 0.1)');
    createChart('tether', 'red-chart-small', '#ff6b6b', 'rgba(255, 107, 107, 0.1)');
    createChart('ethereum', 'purple-chart-small', '#9580ff', 'rgba(149, 128, 255, 0.1)');
}

const options = {
    method: 'GET',
    headers: {
        'accept': 'application/json'
    }
};

async function addNewCryptoAsset(coinName, volume) {
    try {
        // First, try to get coin ID from CoinGecko
        const searchResponse = await fetch(`https://api.coingecko.com/api/v3/search?query=${coinName}`, options);
        if (!searchResponse.ok) {
            throw new Error(`Search API error: ${searchResponse.status}`);
        }

        const searchData = await searchResponse.json();
        
        if (!searchData.coins || searchData.coins.length === 0) {
            throw new Error('Cryptocurrency not found');
        }

        const coinId = searchData.coins[0].id;
        const coinSymbol = searchData.coins[0].symbol.toUpperCase();

        // Create new table row
        const tableBody = document.querySelector('.table-body');
        if (!tableBody) {
            throw new Error('Table body not found');
        }

        const newRow = document.createElement('div');
        newRow.className = 'table-row';
        newRow.innerHTML = `
            <div class="cell coin-cell">
                <div class="coin-icon ${coinId}">
                    <img src="${searchData.coins[0].thumb}" alt="${coinSymbol}">
                </div>
                <div class="coin-info">
                    <span class="coin-name">${searchData.coins[0].name}</span>
                    <span class="coin-symbol">${coinSymbol}</span>
                </div>
            </div>
            <div class="cell price-cell">Loading...</div>
            <div class="cell trend-cell">--</div>
            <div class="cell volume-cell">${volume} M</div>
            <div class="cell chart-cell">
                <div class="chart-container">
                    <div class="${coinId}-chart-small"></div>
                </div>
            </div>
            <div class="cell action-cell">
                <button class="trade-btn">TRADE</button>
            </div>
        `;
        
        // Add click handler for the trade button
        const tradeBtn = newRow.querySelector('.trade-btn');
        tradeBtn.addEventListener('click', () => {
            if (confirm(`Are you sure you want to remove ${searchData.coins[0].name}?`)) {
                newRow.remove();
            }
        });
        
        tableBody.appendChild(newRow);

        // Create chart for new asset
        createChart(coinId, `${coinId}-chart-small`, '#9580ff', 'rgba(149, 128, 255, 0.1)');

        // Update asset count after adding new asset
        updateAssetCount();

        // Update price and trend
        const priceResponse = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`, options);
        if (!priceResponse.ok) {
            throw new Error(`Price API error: ${priceResponse.status}`);
        }

        const priceData = await priceResponse.json();
        
        if (priceData[coinId]) {
            const price = priceData[coinId].usd;
            const change = priceData[coinId].usd_24h_change;
            
            newRow.querySelector('.price-cell').textContent = `$${price.toLocaleString()}`;
            const trendCell = newRow.querySelector('.trend-cell');
            trendCell.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24">
                    <path d="M7 ${change >= 0 ? '14l5-5 5 5' : '10l5 5 5-5'}z"/>
                </svg>
                ${Math.abs(change).toFixed(2)}%
            `;
            trendCell.className = `cell trend-cell ${change >= 0 ? 'positive' : 'negative'}`;
        }

    } catch (error) {
        console.error('Error adding new crypto asset:', error);
        alert(`Error adding cryptocurrency: ${error.message}`);
    }
} 

function initializeFilters() {
    const filterContainer = document.querySelector('.filter-tags');
    const moreFiltersBtn = filterContainer.querySelector('.more-filters');
    
    // Clear existing filter tags
    Array.from(filterContainer.children).forEach(child => {
        if (!child.classList.contains('more-filters')) {
            child.remove();
        }
    });

    // Create and append dropdown
    const dropdown = createFilterDropdown();
    document.body.appendChild(dropdown);

    // Handle "More filters" button click
    moreFiltersBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = moreFiltersBtn.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom + 8}px`;
        dropdown.style.left = `${rect.left}px`;
        dropdown.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        dropdown.classList.remove('show');
    });
}

function createFilterDropdown() {
    const dropdown = document.createElement('div');
    dropdown.className = 'filter-dropdown';
    
    const filters = [
        { id: 'name', label: 'Sort by Coin Name', key: 'coinName' },
        { id: 'price', label: 'Sort by Last Price', key: 'price' },
        { id: 'trend', label: 'Sort by Trend', key: 'trend' },
        { id: 'volume', label: 'Sort by Volume', key: 'volume' }
    ];

    filters.forEach(filter => {
        const option = document.createElement('div');
        option.className = 'filter-option';
        option.innerHTML = filter.label;
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            applyFilter(filter);
            dropdown.classList.remove('show');
        });
        dropdown.appendChild(option);
    });

    return dropdown;
}

const activeFilters = new Set();

const applyFilter = debounce((filter) => {
    const filterContainer = document.querySelector('.filter-tags');
    const moreFiltersBtn = filterContainer.querySelector('.more-filters');

    // Add filter tag if it doesn't exist
    if (!activeFilters.has(filter.id)) {
        activeFilters.add(filter.id);
        const filterTag = createFilterTag(filter);
        filterContainer.insertBefore(filterTag, moreFiltersBtn);
    }

    sortAssets();
}, 250);

function createFilterTag(filter) {
    const tag = document.createElement('button');
    tag.className = 'filter-tag';
    tag.innerHTML = `
        ${filter.label}
        <svg class="close-icon" width="16" height="16" viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
    `;

    tag.querySelector('.close-icon').addEventListener('click', (e) => {
        e.stopPropagation();
        activeFilters.delete(filter.id);
        tag.remove();
        sortAssets();
    });

    return tag;
}

function sortAssets() {
    const tableBody = document.querySelector('.table-body');
    const rows = Array.from(tableBody.children);

    if (activeFilters.size === 0) {
        // Reset to original order if no filters
        rows.sort((a, b) => {
            return Array.from(tableBody.children).indexOf(a) - Array.from(tableBody.children).indexOf(b);
        });
    } else {
        rows.sort((a, b) => {
            for (const filterId of activeFilters) {
                const comparison = compareRows(a, b, filterId);
                if (comparison !== 0) return comparison;
            }
            return 0;
        });
    }

    // Apply animation class
    rows.forEach(row => row.classList.add('sorting'));
    
    // Reorder rows
    rows.forEach(row => tableBody.appendChild(row));

    // Update asset count after sorting
    updateAssetCount();

    // Remove animation class after reordering
    setTimeout(() => {
        rows.forEach(row => row.classList.remove('sorting'));
    }, 300);
}

function compareRows(a, b, filterId) {
    switch (filterId) {
        case 'name':
            return a.querySelector('.coin-name').textContent
                .localeCompare(b.querySelector('.coin-name').textContent);
        
        case 'price':
            const priceA = parseFloat(a.querySelector('.price-cell').textContent.replace('$', '').replace(',', ''));
            const priceB = parseFloat(b.querySelector('.price-cell').textContent.replace('$', '').replace(',', ''));
            return priceB - priceA;
        
        case 'trend':
            const trendA = parseFloat(a.querySelector('.trend-cell').textContent.replace('%', ''));
            const trendB = parseFloat(b.querySelector('.trend-cell').textContent.replace('%', ''));
            return trendB - trendA;
        
        case 'volume':
            const volumeA = parseFloat(a.querySelector('.volume-cell').textContent.replace(' M', ''));
            const volumeB = parseFloat(b.querySelector('.volume-cell').textContent.replace(' M', ''));
            return volumeB - volumeA;
        
        default:
            return 0;
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