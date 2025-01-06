const API_BASE_URL = 'https://api.coingecko.com/api/v3';

const options = { 
    method: 'GET', 
    headers: { accept: 'application/json' }
};

const coinDataCache = new Map();
const cacheDuration = 5 * 60 * 1000; // Cache for 5 minutes

function setCoinData(coinId, data) {
    coinDataCache.set(coinId, {
        data,
        timestamp: Date.now()
    });
}

function getCoinData(coinId) {
    const cached = coinDataCache.get(coinId);
    if (cached && (Date.now() - cached.timestamp < cacheDuration)) {
        return cached.data;
    }
    return null;
}

async function fetch7DayCoinData(coinId) {
    try {
        const response = await fetch(`${API_BASE_URL}/coins/${coinId}/market_chart?vs_currency=usd&days=7`, options);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching 7-day data for ${coinId}:`, error);
        throw error;
    }
}

export async function createChart(cryptoId, chartClass, color, fillColor) {
    try {
        let data = getCoinData(cryptoId);
        if (!data) {
            data = await fetch7DayCoinData(cryptoId);
            setCoinData(cryptoId, data);
        }

        if (!data?.prices?.length) throw new Error('Invalid data format');
        
        const chartData = data.prices.map(price => ({
            x: new Date(price[0]),
            y: price[1]
        }));

        renderChart(chartClass, chartData, color, fillColor);
    } catch (err) {
        console.error(`Error creating ${cryptoId} chart:`, err);
        handleChartError(chartClass);
    }
}

function renderChart(chartClass, data, color, fillColor) {
    const chartContainer = document.querySelector(`.${chartClass}`);
    if (!chartContainer) return;

    // Set dimensions
    chartContainer.style.width = '100%';
    chartContainer.style.height = '40px';
    
    // Create canvas
    chartContainer.innerHTML = '<canvas></canvas>';
    const canvas = chartContainer.querySelector('canvas');
    const ctx = canvas.getContext('2d');

    // ... existing chart creation code ...
    try {
        if (!ctx || !data) {
            throw new Error('Invalid context or data for chart creation');
        }

        // Calculate min and max values for better scaling
        const values = data.map(d => d.y);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const padding = (max - min) * 0.1; // Add 10% padding

        return new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    data: data,
                    borderColor: color,
                    borderWidth: 1.5,
                    fill: true,
                    backgroundColor: fillColor,
                    tension: 0.4,
                    pointRadius: 0,
                    cubicInterpolationMode: 'monotone'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        left: 0,
                        right: 0,
                        top: 5,
                        bottom: 5
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: {
                                day: 'MMM d'
                            }
                        },
                        display: false,
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            display: false
                        }
                    },
                    y: {
                        display: false,
                        min: min - padding,
                        max: max + padding,
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            display: false
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                elements: {
                    line: {
                        borderCapStyle: 'round',
                        borderJoinStyle: 'round'
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error creating chart:', error);
        return null;
    }
}

function handleChartError(chartClass) {
    const chartContainer = document.querySelector(`.${chartClass}`);
    if (chartContainer) {
        chartContainer.innerHTML = `
            <div class="chart-error">
                <svg viewBox="0 0 24 24" width="16" height="16">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"/>
                </svg>
                Error loading chart
            </div>`;
    }
} 