import { initializeAssets } from './components/yourAssets/index.js';
import { initializeExchange } from './components/exchange/ui.js';

document.addEventListener('DOMContentLoaded', () => {
    initializeAssets();
    initializeExchange();
}); 