// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyA9kvTkns1vM_mhzn7m5cA5iBd_RRYuTqc",
    authDomain: "rythemestl.firebaseapp.com",
    projectId: "rythemestl",
    databaseURL: "https://rythemestl-default-rtdb.firebaseio.com/"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- UI Elements ---
const totalPowerEl = document.getElementById('totalPower');
const deviceCountEl = document.getElementById('deviceCount');
const activeDevicesList = document.getElementById('activeDevicesList');
const unrecognizedCard = document.getElementById('unrecognizedCard');
const unknownWattsEl = document.getElementById('unknownWatts');
const deviceNameInput = document.getElementById('deviceNameInput');
const trainBtn = document.getElementById('trainBtn');

// --- State ---
let currentUnknownDevice = null; // Will store { deltaP, startTime } when Unknown is detected

// --- Initialize Chart.js ---
const ctx = document.getElementById('powerChart').getContext('2d');

const gradient = ctx.createLinearGradient(0, 0, 0, 400);
gradient.addColorStop(0, 'rgba(0, 240, 255, 0.4)');
gradient.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

const powerChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Power (W)',
            data: [],
            borderColor: '#00F0FF',
            backgroundColor: gradient,
            borderWidth: 2,
            pointBackgroundColor: '#00F0FF',
            pointRadius: 0,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.4
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(20, 25, 35, 0.9)',
                titleColor: '#8B949E',
                bodyColor: '#00F0FF',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1
            }
        },
        scales: {
            x: { display: false },
            y: {
                grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                ticks: { color: '#8B949E', callback: function(value) { return value + 'W'; } },
                min: 0
            }
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false }
    }
});

// --- Real-time Firebase Listeners ---
let pointIndex = 0;
db.ref('/NILM/power').on('value', (snapshot) => {
    const power = snapshot.val() || 0;
    
    // Update Chart
    powerChart.data.labels.push(pointIndex++);
    powerChart.data.datasets[0].data.push(power);
    
    // Keep only last 50 points
    if (powerChart.data.labels.length > 50) {
        powerChart.data.labels.shift();
        powerChart.data.datasets[0].data.shift();
    }
    
    powerChart.update('none'); 
    
    // Update text
    totalPowerEl.innerHTML = `${power} <span class="unit">W</span>`;
});

db.ref('/NILM/devices').on('value', (snapshot) => {
    const devices = snapshot.val() || [];
    
    // Count non-unknown devices for display
    const knownDevices = devices.filter(d => d.name !== 'Unknown');
    deviceCountEl.textContent = `${knownDevices.length} Online`;
    activeDevicesList.innerHTML = '';

    let foundUnknown = false;
    
    devices.forEach(dev => {
        // --- Handle Unknown Device ---
        if (dev.name === 'Unknown') {
            foundUnknown = true;
            currentUnknownDevice = dev;
            unknownWattsEl.textContent = Math.round(dev.deltaP) + 'W';
            unrecognizedCard.classList.add('show');
            return; // Don't add to device list
        }

        let icon = '🔌';
        if(dev.name === 'Fridge' || dev.name === 'Freezer') icon = '❄️';
        else if(dev.name === 'Oven') icon = '🔥';
        else if(dev.name === 'Phone Charger') icon = '📱';
        else if(dev.name === 'Water Heater') icon = '♨️';
        else if(dev.name === 'Split') icon = '🌬️';
        else if(dev.name === 'Solder') icon = '🔧';
        else if(dev.name === 'TV') icon = '📺';
        
        const item = document.createElement('div');
        item.className = 'device-item';
        item.innerHTML = `
            <div class="device-info">
                <div class="device-icon">${icon}</div>
                <div>
                    <span class="device-name">${dev.name}</span>
                    <span class="device-time">Started at ${dev.startTime}</span>
                </div>
            </div>
            <div class="device-power">+${Math.round(dev.deltaP)}W</div>
        `;
        activeDevicesList.appendChild(item);
    });

    // Hide card if no Unknown device anymore
    if (!foundUnknown) {
        unrecognizedCard.classList.remove('show');
        currentUnknownDevice = null;
    }
});

// --- Train AI Button ---
trainBtn.addEventListener('click', () => {
    const newName = deviceNameInput.value.trim();
    if (!newName) {
        deviceNameInput.style.border = '1px solid #FF4B6E';
        deviceNameInput.placeholder = '⚠️ Please enter a device name!';
        setTimeout(() => {
            deviceNameInput.style.border = '';
            deviceNameInput.placeholder = 'e.g., Microwave, Hair Dryer';
        }, 2000);
        return;
    }

    if (!currentUnknownDevice) return;

    // Save training data to Firebase
    const trainingEntry = {
        label: newName,
        deltaP: currentUnknownDevice.deltaP,
        timestamp: new Date().toISOString()
    };

    db.ref('/NILM/training_data').push(trainingEntry)
        .then(() => {
            // Show success feedback
            trainBtn.textContent = '✅ Saved!';
            trainBtn.style.background = 'linear-gradient(135deg, #00F0AA, #00A878)';
            deviceNameInput.value = '';

            // Hide card after 2 seconds
            setTimeout(() => {
                unrecognizedCard.classList.remove('show');
                trainBtn.textContent = 'Train AI';
                trainBtn.style.background = '';
                currentUnknownDevice = null;
            }, 2000);
        })
        .catch((err) => {
            console.error('Firebase write error:', err);
            trainBtn.textContent = '❌ Error!';
            setTimeout(() => { trainBtn.textContent = 'Train AI'; }, 2000);
        });
});
