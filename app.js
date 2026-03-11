import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

// Firebase configuration
const firebaseConfig = {
    databaseURL: "https://vayuveer-aaa33-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// DOM Elements
const gasValueEl = document.getElementById('gas-value');
const tempValueEl = document.getElementById('temp-value');
const humValueEl = document.getElementById('humidity-value');
const leakValueEl = document.getElementById('leak-value');
const leakWarningEl = document.getElementById('leak-warning');
const systemStatusEl = document.getElementById('system-status');
const statusCardEl = document.getElementById('status-card');
const thresholdValEl = document.getElementById('threshold-val');
const thresholdSlider = document.getElementById('threshold-slider');
const alertBanner = document.getElementById('alert-banner');
const connDot = document.getElementById('conn-dot');
const connText = document.getElementById('conn-text');

// State variables
let lastUpdateTime = 0;
let currentGasValue = 0;
let currentThreshold = 1000;
const MAX_DATA_POINTS = 50;
let updateTimer = null;

// Initialize Chart.js
const ctx = document.getElementById('gasChart').getContext('2d');

// Chart styling options
Chart.defaults.color = '#8b949e';
Chart.defaults.font.family = "'Inter', sans-serif";

const gasChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Gas Level',
            data: [],
            borderColor: '#58a6ff',
            backgroundColor: 'rgba(88, 166, 255, 0.1)',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.4
        }, {
            label: 'Threshold',
            data: [],
            borderColor: '#f85149',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
            tension: 0
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    usePointStyle: true,
                    boxWidth: 8
                }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(22, 27, 34, 0.9)',
                titleColor: '#f0f6fc',
                bodyColor: '#8b949e',
                borderColor: '#30363d',
                borderWidth: 1
            }
        },
        scales: {
            x: {
                display: false // Hide X-axis labels to look cleaner as data streams
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: '#30363d'
                }
            }
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        }
    }
});

// Firebase path ref
const lpgRef = ref(db, 'LPG');

// Listen for RTDB changes
onValue(lpgRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        updateDashboard(data);
    }
});

function updateDashboard(data) {
    lastUpdateTime = Date.now();
    setConnectionStatus(true);
    
    // De-structure data
    const { gasValue, status, threshold, temperature, humidity, leakRate } = data;
    
    currentGasValue = gasValue !== undefined ? gasValue : currentGasValue;
    currentThreshold = threshold !== undefined ? threshold : currentThreshold;
    const sysStatus = status || 'WAITING';

    // Update Gas, Temp, Hum, Leak values
    gasValueEl.textContent = currentGasValue;
    tempValueEl.textContent = temperature !== undefined ? temperature : '--';
    humValueEl.textContent = humidity !== undefined ? humidity : '--';
    leakValueEl.textContent = leakRate !== undefined ? leakRate : '--';
    
    // Leak Rate Warning
    if (leakRate !== undefined && leakRate > 200) {
        leakWarningEl.classList.remove('hidden');
    } else {
        leakWarningEl.classList.add('hidden');
    }
    
    // Update Slider & its label if not actively being dragged (for 2-way sync)
    // We check document.activeElement so we don't fight user input
    if (document.activeElement !== thresholdSlider) {
        thresholdSlider.value = currentThreshold;
        thresholdValEl.textContent = currentThreshold;
    }

    // Update Status Card
    systemStatusEl.textContent = sysStatus.toUpperCase();
    if (sysStatus.toUpperCase() === 'DANGER') {
        statusCardEl.classList.remove('safe');
        statusCardEl.classList.add('danger');
    } else {
        statusCardEl.classList.remove('danger');
        statusCardEl.classList.add('safe');
    }

    // Update Alert Banner (Based on user request logic: gasValue > threshold -> show banner)
    if (currentGasValue > currentThreshold) {
        alertBanner.classList.remove('hidden');
        alertBanner.style.display = 'block'; // Ensure display is updated right away
    } else {
        alertBanner.classList.add('hidden');
        setTimeout(() => {
            if(alertBanner.classList.contains('hidden')) {
                alertBanner.style.display = 'none';
            }
        }, 300); // 300ms transition time
    }

    // Update Chart
    const now = new Date();
    const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
    
    gasChart.data.labels.push(timeString);
    gasChart.data.datasets[0].data.push(currentGasValue);
    gasChart.data.datasets[1].data.push(currentThreshold);

    // Keep length to MAX_DATA_POINTS
    if (gasChart.data.labels.length > MAX_DATA_POINTS) {
        gasChart.data.labels.shift();
        gasChart.data.datasets[0].data.shift();
        gasChart.data.datasets[1].data.shift();
    }
    gasChart.update('none'); // Update without animation for smooth streaming
}

// Threshold Slider Listener
thresholdSlider.addEventListener('input', (e) => {
    thresholdValEl.textContent = e.target.value;
});

thresholdSlider.addEventListener('change', (e) => {
    const newThreshold = parseInt(e.target.value, 10);
    set(ref(db, 'LPG/threshold'), newThreshold);
});

// Connection Status Monitor
function setConnectionStatus(isOnline) {
    if (isOnline) {
        connDot.classList.remove('offline');
        connDot.classList.add('online');
        connText.textContent = 'Online';
        connText.style.color = '#2ea043';
    } else {
        connDot.classList.remove('online');
        connDot.classList.add('offline');
        connText.textContent = 'Offline';
        connText.style.color = '#8b949e';
    }
}

// Check every second if last update was more than 6 seconds ago
setInterval(() => {
    if (Date.now() - lastUpdateTime > 6000 && lastUpdateTime !== 0) {
        setConnectionStatus(false);
    }
}, 1000);

// Initial state
setConnectionStatus(false);
