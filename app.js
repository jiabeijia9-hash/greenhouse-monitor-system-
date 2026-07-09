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

const AuthService = {
    DEFAULT_USERNAME: 'qwe',
    DEFAULT_PASSWORD: '123',
    STORAGE_KEY: 'greenhouse_auth',
    MAX_ATTEMPTS: 5,

    _username: null,
    _passwordHash: null,

    init() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this._username = data.username;
                this._passwordHash = data.passwordHash;
                return;
            } catch (e) {}
        }
        this._username = this.DEFAULT_USERNAME;
        this._hashPassword(this.DEFAULT_PASSWORD).then(hash => {
            this._passwordHash = hash;
            this._save();
        });
    },

    async _hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    async login(username, password) {
        if (!username || !password) return false;
        if (username !== this._username) return false;
        const hash = await this._hashPassword(password);
        return hash === this._passwordHash;
    },

    async changePassword(oldPassword, newPassword) {
        if (!oldPassword || !newPassword) {
            return { success: false, error: '旧密码和新密码不能为空' };
        }
        if (newPassword.length < 3) {
            return { success: false, error: '新密码长度不能少于3位' };
        }
        const oldHash = await this._hashPassword(oldPassword);
        if (oldHash !== this._passwordHash) {
            return { success: false, error: '旧密码不正确' };
        }
        if (oldPassword === newPassword) {
            return { success: false, error: '新密码不能与旧密码相同' };
        }
        this._passwordHash = await this._hashPassword(newPassword);
        this._save();
        return { success: true };
    },

    _save() {
        const data = {
            username: this._username,
            passwordHash: this._passwordHash
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    }
};

let loginAttempts = 0;

function showLoginMessage(message, type = '') {
    const msg = document.getElementById('loginMessage');
    msg.textContent = message;
    msg.className = 'login-message' + (type ? ' ' + type : '');
}

async function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');

    if (!username || !password) {
        showLoginMessage('请输入账号和密码', 'error');
        return;
    }

    if (loginAttempts >= AuthService.MAX_ATTEMPTS) {
        showLoginMessage('登录失败次数过多，请刷新页面重试', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = '验证中...';

    const success = await AuthService.login(username, password);

    if (success) {
        showLoginMessage('登录成功', 'success');
        setTimeout(() => {
            document.getElementById('loginPage').classList.add('hidden');
            loginAttempts = 0;
        }, 400);
    } else {
        loginAttempts++;
        const remaining = AuthService.MAX_ATTEMPTS - loginAttempts;
        showLoginMessage(`账号或密码错误（剩余 ${remaining} 次）`, 'error');
        document.getElementById('loginPassword').value = '';
        document.getElementById('loginPassword').focus();
    }

    btn.disabled = false;
    btn.textContent = '登录';
}

function toggleLoginPassword() {
    const checkbox = document.getElementById('showLoginPassword');
    const pwdInput = document.getElementById('loginPassword');
    pwdInput.type = checkbox.checked ? 'text' : 'password';
}

function openChangePasswordModal() {
    document.getElementById('changePasswordModal').classList.add('show');
    document.getElementById('oldPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    document.getElementById('showModalPassword').checked = false;
    toggleModalPassword();
    showChangePwdMessage('');
    document.getElementById('oldPassword').focus();
}

function closeChangePasswordModal() {
    document.getElementById('changePasswordModal').classList.remove('show');
}

function toggleModalPassword() {
    const checkbox = document.getElementById('showModalPassword');
    const type = checkbox.checked ? 'text' : 'password';
    document.getElementById('oldPassword').type = type;
    document.getElementById('newPassword').type = type;
    document.getElementById('confirmPassword').type = type;
}

function showChangePwdMessage(message, type = '') {
    const msg = document.getElementById('changePwdMessage');
    msg.textContent = message;
    msg.className = 'modal-message' + (type ? ' ' + type : '');
}

async function handleChangePassword() {
    const oldPwd = document.getElementById('oldPassword').value;
    const newPwd = document.getElementById('newPassword').value;
    const confirmPwd = document.getElementById('confirmPassword').value;
    const btn = document.getElementById('confirmChangePwdBtn');

    if (!oldPwd) {
        showChangePwdMessage('请输入当前密码', 'error');
        document.getElementById('oldPassword').focus();
        return;
    }
    if (!newPwd) {
        showChangePwdMessage('请输入新密码', 'error');
        document.getElementById('newPassword').focus();
        return;
    }
    if (newPwd.length < 3) {
        showChangePwdMessage('新密码至少需要 3 个字符', 'error');
        document.getElementById('newPassword').focus();
        return;
    }
    if (newPwd !== confirmPwd) {
        showChangePwdMessage('两次输入的新密码不一致', 'error');
        document.getElementById('confirmPassword').focus();
        return;
    }
    if (oldPwd === newPwd) {
        showChangePwdMessage('新密码不能与当前密码相同', 'warning');
        document.getElementById('newPassword').focus();
        return;
    }

    btn.disabled = true;
    btn.textContent = '处理中...';

    const result = await AuthService.changePassword(oldPwd, newPwd);

    if (result.success) {
        showChangePwdMessage('密码已更新', 'success');
        setTimeout(() => {
            closeChangePasswordModal();
            alert('密码修改成功，请使用新密码重新登录。');
            document.getElementById('loginPage').classList.remove('hidden');
            document.getElementById('loginPassword').value = '';
            document.getElementById('loginUsername').value = AuthService.DEFAULT_USERNAME;
            appendLog('密码已修改，请重新登录');
        }, 600);
    } else {
        showChangePwdMessage(result.error, 'error');
        document.getElementById('oldPassword').value = '';
        document.getElementById('oldPassword').focus();
    }

    btn.disabled = false;
    btn.textContent = '更新密码';
}

document.addEventListener('DOMContentLoaded', () => {
    AuthService.init();
    initCharts();

    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('showLoginPassword').addEventListener('change', toggleLoginPassword);
    document.getElementById('loginUsername').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('loginPassword').focus();
    });
    document.getElementById('loginPassword').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    document.getElementById('changePasswordBtn').addEventListener('click', openChangePasswordModal);
    document.getElementById('confirmChangePwdBtn').addEventListener('click', handleChangePassword);
    document.getElementById('showModalPassword').addEventListener('change', toggleModalPassword);

    document.getElementById('oldPassword').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('newPassword').focus();
    });
    document.getElementById('newPassword').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('confirmPassword').focus();
    });
    document.getElementById('confirmPassword').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleChangePassword();
    });

    document.getElementById('changePasswordModal').addEventListener('click', (e) => {
        if (e.target.id === 'changePasswordModal') {
            closeChangePasswordModal();
        }
    });

    appendLog('系统启动完成，等待连接...');
});