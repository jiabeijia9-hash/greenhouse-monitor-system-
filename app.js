let serialPort = null;
let reader = null;
let temperatureValue = NaN;
let MaxTemperatureValue = 50;
let MinTemperatureValue = -40;
let historyData = [];
let currentPage = 1;
let pageSize = 10;
let showAlarmOnly = false;
let lineChart = null;
let thermometerChart = null;
let speechSynthesis = window.speechSynthesis;
let alarmUtterance = null;

const navItems = document.querySelectorAll('.nav-item');
const panels = document.querySelectorAll('.panel');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(i => i.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        item.classList.add('active');
        const panelId = item.getAttribute('data-panel');
        document.getElementById(panelId).classList.add('active');
        
        if (panelId === 'historyPanel') {
            refreshHistoryGrid();
        }
    });
});

const portSelect = document.getElementById('portSelect');
const baudRateSelect = document.getElementById('baudRateSelect');
const dataBitsSelect = document.getElementById('dataBitsSelect');
const stopBitsSelect = document.getElementById('stopBitsSelect');
const paritySelect = document.getElementById('paritySelect');
const connStatus = document.getElementById('connStatus');
const openSerialBtn = document.getElementById('openSerialBtn');
const closeSerialBtn = document.getElementById('closeSerialBtn');
const clearLogBtn = document.getElementById('clearLogBtn');
const logContainer = document.getElementById('logContainer');

async function listPorts() {
    try {
        const ports = await navigator.serial.getPorts();
        portSelect.innerHTML = '<option value="">请选择串口</option>';
        ports.forEach(port => {
            const option = document.createElement('option');
            option.value = port.getInfo().usbProductId ? port.getInfo().usbProductId : port.getInfo().path;
            option.text = port.getInfo().path || `USB Device ${port.getInfo().usbProductId}`;
            portSelect.appendChild(option);
        });
    } catch (e) {
        console.error('Error listing ports:', e);
    }
}

listPorts();

async function openSerial() {
    try {
        const baudRate = parseInt(baudRateSelect.value);
        const dataBits = parseInt(dataBitsSelect.value);
        const stopBits = parseFloat(stopBitsSelect.value);
        const parity = paritySelect.value;
        
        serialPort = await navigator.serial.requestPort();
        
        await serialPort.open({
            baudRate: baudRate,
            dataBits: dataBits,
            stopBits: stopBits === 1.5 ? 1.5 : (stopBits === 2 ? 2 : 1),
            parity: parity === 'none' ? 'none' : (parity === 'odd' ? 'odd' : 'even')
        });
        
        appendLog('串口已打开，正在验证设备...');
        
        const decoder = new TextDecoder();
        let handshakeTimeout;
        let handshakeSuccess = false;
        let handshakeTemp = NaN;
        
        const readLoop = async () => {
            while (serialPort && serialPort.readable) {
                try {
                    const reader = serialPort.readable.getReader();
                    const { value, done } = await reader.read();
                    reader.releaseLock();
                    
                    if (done) break;
                    
                    const text = decoder.decode(value);
                    const tempMatch = text.match(/-?\d+\.?\d*/);
                    
                    if (tempMatch) {
                        const temp = parseFloat(tempMatch[0]);
                        if (!isNaN(temp)) {
                            handshakeTemp = temp;
                            handshakeSuccess = true;
                            clearTimeout(handshakeTimeout);
                            handleTemperature(temp);
                        }
                    }
                } catch (e) {
                    console.error('Read error:', e);
                    break;
                }
            }
        };
        
        readLoop();
        
        handshakeTimeout = setTimeout(() => {
            if (!handshakeSuccess) {
                appendLog('设备验证失败：3秒内未收到温度数据');
                closeSerial();
            } else {
                appendLog(`设备验证成功，检测到温控设备（温度：${handshakeTemp.toFixed(1)}℃）`);
                connStatus.textContent = '已连接';
                connStatus.classList.add('connected');
                openSerialBtn.textContent = '关闭串口';
                openSerialBtn.classList.remove('primary');
                
                startAlarmCheck();
            }
        }, 3000);
        
    } catch (e) {
        appendLog('串口打开失败：' + e.message);
        console.error(e);
    }
}

async function closeSerial() {
    if (serialPort) {
        appendLog('正在关闭串口...');
        try {
            if (reader) {
                await reader.cancel();
                reader = null;
            }
            await serialPort.close();
            serialPort = null;
            appendLog('串口已关闭');
        } catch (e) {
            console.error('Close error:', e);
        }
    }
    
    connStatus.textContent = '未连接';
    connStatus.classList.remove('connected');
    openSerialBtn.textContent = '打开串口';
    openSerialBtn.classList.add('primary');
    
    stopAlarmCheck();
}

function handleTemperature(temp) {
    temperatureValue = temp;
    
    document.getElementById('temperatureValue').textContent = temp.toFixed(1);
    
    if (lineChart) {
        const now = new Date();
        const timeLabel = now.getHours().toString().padStart(2, '0') + ':' +
                         now.getMinutes().toString().padStart(2, '0') + ':' +
                         now.getSeconds().toString().padStart(2, '0');
        
        lineChart.data.labels.push(timeLabel);
        lineChart.data.datasets[0].data.push(temp);
        
        if (lineChart.data.labels.length > 50) {
            lineChart.data.labels.shift();
            lineChart.data.datasets[0].data.shift();
        }
        
        lineChart.update();
    }
    
    updateThermometer(temp);
    
    appendLog(`温度：${temp.toFixed(1)}℃`);
    
    addHistoryRecord(temp);
    
    checkAlarm(temp);
}

function appendLog(message) {
    const div = document.createElement('div');
    div.className = 'log-entry';
    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' +
                now.getMinutes().toString().padStart(2, '0') + ':' +
                now.getSeconds().toString().padStart(2, '0');
    div.innerHTML = `<span class="log-time">[${time}]</span>${message}`;
    logContainer.appendChild(div);
    logContainer.scrollTop = logContainer.scrollHeight;
}

openSerialBtn.addEventListener('click', () => {
    if (openSerialBtn.textContent === '打开串口') {
        if (!portSelect.value) {
            appendLog('请先选择串口');
            return;
        }
        openSerial();
    } else {
        closeSerial();
    }
});

closeSerialBtn.addEventListener('click', closeSerial);
clearLogBtn.addEventListener('click', () => {
    logContainer.innerHTML = '';
});

function updateThermometer(temp) {
    if (!thermometerChart) return;
    
    thermometerChart.data.datasets[0].data[0] = temp;
    thermometerChart.update();
}

function initCharts() {
    const thermometerCtx = document.getElementById('thermometerCanvas').getContext('2d');
    thermometerChart = new Chart(thermometerCtx, {
        type: 'doughnut',
        data: {
            labels: ['温度', ''],
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#007aff', '#e5e5ea'],
                borderWidth: 0,
                circumference: 180,
                rotation: 270
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                tooltip: { enabled: false },
                legend: { display: false }
            },
            scales: {
                ticks: { display: false },
                grid: { display: false }
            }
        }
    });
    
    const lineCtx = document.getElementById('lineChart').getContext('2d');
    lineChart = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '温度',
                data: [],
                borderColor: '#007aff',
                backgroundColor: 'rgba(0, 122, 255, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.5,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxTicksLimit: 10 }
                },
                y: {
                    beginAtZero: false
                }
            }
        }
    });
}

let alarmInterval = null;

function startAlarmCheck() {
    alarmInterval = setInterval(() => {
        if (!isNaN(temperatureValue)) {
            checkAlarm(temperatureValue);
        }
    }, 1500);
}

function stopAlarmCheck() {
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }
    speechSynthesis.cancel();
}

function checkAlarm(temp) {
    if (temp > MaxTemperatureValue) {
        speakAlarm('警告，警告，温室温度过高');
    } else if (temp < MinTemperatureValue) {
        speakAlarm('警告，警告，温室温度过低');
    } else {
        speechSynthesis.cancel();
    }
}

function speakAlarm(text) {
    if (speechSynthesis.speaking && alarmUtterance && alarmUtterance.text === text) {
        return;
    }
    
    speechSynthesis.cancel();
    alarmUtterance = new SpeechSynthesisUtterance(text);
    alarmUtterance.lang = 'zh-CN';
    alarmUtterance.rate = 1;
    speechSynthesis.speak(alarmUtterance);
}

const maxTempInput = document.getElementById('maxTempInput');
const minTempInput = document.getElementById('minTempInput');
const intervalSlider = document.getElementById('intervalSlider');
const intervalValue = document.getElementById('intervalValue');
const saveParamBtn = document.getElementById('saveParamBtn');
const restoreDefaultBtn = document.getElementById('restoreDefaultBtn');
const changePasswordBtn = document.getElementById('changePasswordBtn');

maxTempInput.addEventListener('change', () => {
    MaxTemperatureValue = parseFloat(maxTempInput.value);
    if (MaxTemperatureValue <= MinTemperatureValue) {
        MaxTemperatureValue = MinTemperatureValue + 1;
        maxTempInput.value = MaxTemperatureValue;
    }
});

minTempInput.addEventListener('change', () => {
    MinTemperatureValue = parseFloat(minTempInput.value);
    if (MinTemperatureValue >= MaxTemperatureValue) {
        MinTemperatureValue = MaxTemperatureValue - 1;
        minTempInput.value = MinTemperatureValue;
    }
});

intervalSlider.addEventListener('input', () => {
    intervalValue.textContent = intervalSlider.value + '秒';
});

saveParamBtn.addEventListener('click', () => {
    appendLog('参数已保存');
});

restoreDefaultBtn.addEventListener('click', () => {
    maxTempInput.value = 50;
    minTempInput.value = -40;
    intervalSlider.value = 10;
    intervalValue.textContent = '10秒';
    MaxTemperatureValue = 50;
    MinTemperatureValue = -40;
    appendLog('已恢复默认参数');
});

changePasswordBtn.addEventListener('click', () => {
    alert('密码修改功能在网页版本中暂不可用');
});

const saveDataBtn = document.getElementById('saveDataBtn');

saveDataBtn.addEventListener('click', () => {
    if (isNaN(temperatureValue)) {
        appendLog('没有可保存的数据');
        return;
    }
    
    const now = new Date();
    const data = `${now.toISOString()},${temperatureValue.toFixed(1)}\n`;
    
    const blob = new Blob([data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `temperature_log_${now.getTime()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    appendLog('数据已保存');
});

function addHistoryRecord(temp) {
    let status = '正常';
    if (temp > MaxTemperatureValue) {
        status = '高温告警';
    } else if (temp < MinTemperatureValue) {
        status = '低温告警';
    }
    
    const now = new Date();
    historyData.push({
        time: now.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        temperature: temp.toFixed(1),
        status: status,
        fullTime: now
    });
    
    if (historyData.length > 5000) {
        historyData.shift();
    }
    
    if (document.getElementById('historyPanel').classList.contains('active')) {
        refreshHistoryGrid();
    }
}

const segNormal = document.getElementById('segNormal');
const segAlarm = document.getElementById('segAlarm');
const searchInput = document.getElementById('searchInput');
const queryBtn = document.getElementById('queryBtn');
const historyBody = document.getElementById('historyBody');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageInfo = document.getElementById('pageInfo');

segNormal.addEventListener('click', () => {
    segNormal.classList.add('active');
    segAlarm.classList.remove('active');
    showAlarmOnly = false;
    currentPage = 1;
    refreshHistoryGrid();
});

segAlarm.addEventListener('click', () => {
    segAlarm.classList.add('active');
    segNormal.classList.remove('active');
    showAlarmOnly = true;
    currentPage = 1;
    refreshHistoryGrid();
});

queryBtn.addEventListener('click', () => {
    currentPage = 1;
    refreshHistoryGrid();
});

searchInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
        currentPage = 1;
        refreshHistoryGrid();
    }
});

prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        refreshHistoryGrid();
    }
});

nextPageBtn.addEventListener('click', () => {
    const filtered = getFilteredHistory();
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (currentPage < totalPages) {
        currentPage++;
        refreshHistoryGrid();
    }
});

function getFilteredHistory() {
    let result = [...historyData];
    
    if (showAlarmOnly) {
        result = result.filter(r => r.status !== '正常');
    }
    
    const keyword = searchInput.value.trim();
    if (keyword) {
        result = result.filter(r => 
            r.time.includes(keyword) ||
            r.temperature.includes(keyword) ||
            r.status.includes(keyword)
        );
    }
    
    return result.reverse();
}

function refreshHistoryGrid() {
    const filtered = getFilteredHistory();
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    
    const skip = (currentPage - 1) * pageSize;
    const pageData = filtered.slice(skip, skip + pageSize);
    
    historyBody.innerHTML = '';
    
    pageData.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${record.time}</td>
            <td>${record.temperature}℃</td>
            <td class="${record.status !== '正常' ? 'status-alarm' : ''}">${record.status}</td>
        `;
        historyBody.appendChild(row);
    });
    
    pageInfo.textContent = `第 ${currentPage} / ${totalPages} 页`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
}

function minimizeWindow() {
    if (window.chrome && window.chrome.app && window.chrome.app.window) {
        chrome.app.window.current().minimize();
    } else {
        console.log('Minimize not supported in this environment');
    }
}

function maximizeWindow() {
    if (window.chrome && window.chrome.app && window.chrome.app.window) {
        const win = chrome.app.window.current();
        if (win.isMaximized()) {
            win.restore();
        } else {
            win.maximize();
        }
    } else {
        console.log('Maximize not supported in this environment');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    appendLog('系统启动完成，等待连接...');
});