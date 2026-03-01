document.addEventListener("DOMContentLoaded", () => {

let interviewState = {
    questions: [],
    currentIndex: 0,
    totalScore: 0,
    backendUrl: "http://localhost:5000",  // Enforce default backend URL
    timerInterval: null,
    typingInterval: null,
    recognition: null,
    isRecording: false,
    audioContext: null,
    analyser: null,
    mediaStream: null,
    visualizerFrame: null,
    cameraStream: null,
    cheatingInterval: null,
    cheatingIncidents: 0
};

/* ================= NAVIGATION ================= */

function showSection(id) {
    document.querySelectorAll(".section").forEach(sec =>
        sec.classList.remove("active")
    );
    document.getElementById(id).classList.add("active");

    if (id === "history") loadHistory();
    if (id === "dashboard") updateDashboard();
}

["Dashboard","Interview","History","Settings"].forEach(name=>{
    document.getElementById("nav"+name).onclick = () =>
        showSection(name.toLowerCase());
});

/* ================= LOAD SETTINGS ================= */

chrome.storage.local.get(["jobDesc","resume"], data => {
    if (data.jobDesc)
        document.getElementById("jobDescInput").value = data.jobDesc;

    if (data.resume)
        document.getElementById("resumeInput").value = data.resume;
});

/* ================= SAVE SETTINGS ================= */


document.getElementById("saveProfileBtn").onclick = () => {
    const jobDesc = document.getElementById("jobDescInput").value;
    const resume = document.getElementById("resumeInput").value;
    chrome.storage.local.set({ jobDesc, resume });
    alert("Profile Saved");
};

/* ================= FILE UPLOAD ================= */

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const fileNameDisplay = document.getElementById("fileNameDisplay");

dropZone.onclick = () => fileInput.click();

fileInput.onchange = () => {
    if (fileInput.files.length)
        fileNameDisplay.textContent =
            `Selected: ${fileInput.files[0].name}`;
};

document.getElementById("clearResumeBtn").onclick = () => {
    document.getElementById("resumeInput").value = "";
    fileInput.value = "";
    fileNameDisplay.textContent = "";
    document.getElementById("status").innerHTML = "";
    chrome.storage.local.remove("resume");
};

/* ================= EXTRACT TEXT ================= */

document.getElementById("extractTextBtn").onclick = async () => {

    if (!fileInput.files.length) {
        alert("Select a PDF or DOCX file.");
        return;
    }

    let file = fileInput.files[0];
    const extension = file.name.split(".").pop().toLowerCase();
    const status = document.getElementById("status");

    status.innerHTML = "Processing...";

    try {

        // Send file directly to local backend for extraction
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(
            `${interviewState.backendUrl}/extract-text`,
            { method: "POST", body: formData }
        );

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new Error("Server returned HTML. Please restart your backend.");
        }

        if (!response.ok)
            throw new Error(data.error || "Text extraction failed");

        document.getElementById("resumeInput").value = data.text;

        chrome.storage.local.set({ resume: data.text });

        status.innerHTML = "Resume extracted successfully.";

    } catch (error) {
        status.innerHTML = "Error: " + error.message;
    }
};

/* ================= START INTERVIEW ================= */

document.getElementById("startInterviewBtn").onclick = async () => {

    interviewState.cheatingIncidents = 0;

    chrome.storage.local.get(["jobDesc","resume"], async data => {

        if (!data.jobDesc || !data.resume) {
            alert("Please provide Job Description and Resume.");
            return;
        }

        await runCountdown();

        await startCamera();
        
        startCheatingDetection();

        const analysisBox = document.getElementById("analysisBox");

        // Inject spinner styles if missing
        if (!document.getElementById("spinner-style")) {
            const style = document.createElement("style");
            style.id = "spinner-style";
            style.textContent = `
                .spinner {
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #3498db;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 10px auto;
                }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `;
            document.head.appendChild(style);
        }

        // Show loading UI
        analysisBox.innerHTML = `
            <div style="text-align: center; padding: 10px;">
                <div class="spinner"></div>
                <div>Analyzing Resume...</div>
                <progress id="analysisProgress" value="0" max="100" style="width: 100%; margin-top: 5px;"></progress>
            </div>
        `;

        // Simulate progress
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 5;
            if (progress > 90) progress = 90;
            const bar = document.getElementById("analysisProgress");
            if (bar) bar.value = progress;
        }, 300);

        try {
            const response = await fetch(
                `${interviewState.backendUrl}/analyze`,
                {
                    method:"POST",
                    headers:{ "Content-Type":"application/json" },
                    body: JSON.stringify({
                        resume: data.resume,
                        job_description: data.jobDesc
                    })
                }
            );

            clearInterval(progressInterval);

            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch (e) {
                analysisBox.innerHTML = ""; // Clear loading
                alert("Backend Error: Server returned HTML. Check connection.");
                return;
            }

            interviewState.questions = result.questions;
            interviewState.currentIndex = 0;
            interviewState.totalScore = 0;

            analysisBox.innerHTML =
                `Match Score: <strong>${result.score}/100</strong><br>
                 Missing Skills: ${result.missing_skills.join(", ")}`;

            // Show input area & hide start button
            document.getElementById("interviewInterface").style.display = "block";
            document.getElementById("startInterviewBtn").style.display = "none";

            showNextQuestion();
        } catch (error) {
            clearInterval(progressInterval);
            analysisBox.innerHTML = `<div style="color:red">Error: ${error.message}</div>`;
            stopCamera();
        }
    });
};

/* ================= VOICE INPUT ================= */

// Inject Pulse Animation Style
const pulseStyle = document.createElement("style");
pulseStyle.textContent = `
    @keyframes pulse-red {
        0% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.7); }
        70% { box-shadow: 0 0 0 10px rgba(231, 76, 60, 0); }
        100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); }
    }
    .recording-pulse {
        animation: pulse-red 1.5s infinite;
    }
`;
document.head.appendChild(pulseStyle);

// Initialize Speech Recognition
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    interviewState.recognition = new SpeechRecognition();
    interviewState.recognition.continuous = true;
    interviewState.recognition.interimResults = true;
    interviewState.recognition.lang = 'en-US';

    interviewState.recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript + ' ';
            }
        }
        if (finalTranscript) {
            const input = document.getElementById("answerInput");
            input.value += finalTranscript;
        }
    };

    interviewState.recognition.onerror = (event) => {
        console.error("Speech Error:", event.error);
        if (event.error === 'not-allowed') {
            alert("Microphone access denied. Please check your browser settings.");
        }
        stopRecording();
    };

    // Ensure recording only stops when user manually clicks
    interviewState.recognition.onend = () => {
        if (interviewState.isRecording) {
            interviewState.recognition.start();
        }
    };
}

document.getElementById("micBtn").onclick = () => {
    if (!interviewState.recognition) return alert("Voice input not supported in this browser.");
    interviewState.isRecording ? stopRecording() : startRecording();
};

async function startRecording() {
    try {
        // 0. Reset recognition state to prevent InvalidStateError
        try {
            interviewState.recognition.abort();
        } catch (e) { /* Ignore if not running */ }

        // 1. Get Stream first (triggers permission prompt)
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        interviewState.mediaStream = stream;
        
        // 2. Setup Audio Context
        interviewState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = interviewState.audioContext.createMediaStreamSource(stream);
        interviewState.analyser = interviewState.audioContext.createAnalyser();
        interviewState.analyser.fftSize = 256;
        source.connect(interviewState.analyser);

        document.getElementById("micVisualizer").style.display = "block";
        drawVisualizer();

        // 3. Start Speech Recognition (after permission granted)
        try {
            interviewState.recognition.start();
        } catch (e) {
            // Ignore InvalidStateError (already started)
            if (e.name !== 'InvalidStateError') throw e;
        }
        interviewState.isRecording = true;

        // UI Updates
        const btn = document.getElementById("micBtn");
        btn.innerHTML = '<i class="fa-solid fa-stop"></i>';
        btn.style.backgroundColor = "#e74c3c";
        btn.classList.add("recording-pulse");
    } catch (err) {
        console.error("Error starting recording:", err);
        alert("Could not access microphone.");
        stopRecording();
    }
}

function stopRecording() {
    if (interviewState.recognition) interviewState.recognition.stop();
    interviewState.isRecording = false;

    // Stop Audio Context & Stream
    if (interviewState.mediaStream) {
        interviewState.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (interviewState.audioContext) {
        interviewState.audioContext.close();
    }
    cancelAnimationFrame(interviewState.visualizerFrame);

    // UI Updates
    document.getElementById("micVisualizer").style.display = "none";
    const btn = document.getElementById("micBtn");
    btn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    btn.style.backgroundColor = "#95a5a6";
    btn.classList.remove("recording-pulse");
}

function drawVisualizer() {
    const canvas = document.getElementById("micVisualizer");
    const ctx = canvas.getContext("2d");
    const bufferLength = interviewState.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
        if (!interviewState.isRecording) return;
        
        interviewState.visualizerFrame = requestAnimationFrame(draw);
        interviewState.analyser.getByteFrequencyData(dataArray);

        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for(let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 2;
            ctx.fillStyle = `rgb(${barHeight + 100}, 50, 50)`;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    };
    draw();
}

/* ================= SUBMIT ANSWER ================= */

document.getElementById("submitBtn").onclick = async () => {

    // Stop effects
    clearInterval(interviewState.timerInterval);
    clearInterval(interviewState.typingInterval);
    window.speechSynthesis.cancel();
    stopRecording();

    const answer = document.getElementById("answerInput").value.trim();
    if (!answer) return alert("Please answer.");

    const question =
        interviewState.questions[interviewState.currentIndex];

    const response = await fetch(
        `${interviewState.backendUrl}/evaluate`,
        {
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body: JSON.stringify({
                candidate_answer: answer,
                reference_answer: question
            })
        }
    );

    const text = await response.text();
    let result;
    try {
        result = JSON.parse(text);
    } catch (e) {
        alert("Backend Error: Server returned HTML.");
        return;
    }

    interviewState.totalScore += result.answer_score;
    interviewState.currentIndex++;

    document.getElementById("answerInput").value = "";

    if (interviewState.currentIndex < interviewState.questions.length)
        showNextQuestion();
    else
        showFinalScore();
};

function showNextQuestion() {
    const index = interviewState.currentIndex;
    const total = interviewState.questions.length;
    
    // Determine Round Name
    const roundName = index < 5 ? "ROUND 1: TECHNICAL" : "ROUND 2: NON-TECHNICAL";
    const questionText = interviewState.questions[index];
    const fullText = `${roundName}\nQuestion ${index+1}/${total}:\n\n${questionText}`;

    // Reset UI
    document.getElementById("questionBox").innerHTML = "";
    document.getElementById("answerInput").value = "";
    
    // 1. Start Timer (2 minutes per question)
    startTimer(120);

    // 2. Typewriter Effect
    typeWriter(fullText, "questionBox");

    // 3. Voice (Speak only the question text)
    speak(questionText);
}

function startTimer(duration) {
    clearInterval(interviewState.timerInterval);
    let timer = duration;
    const display = document.getElementById("timerDisplay");
    
    const updateDisplay = () => {
        const minutes = parseInt(timer / 60, 10);
        const seconds = parseInt(timer % 60, 10);
        display.innerText = `Time Left: ${minutes}:${seconds < 10 ? "0" + seconds : seconds}`;
    };

    updateDisplay(); // Initial call

    interviewState.timerInterval = setInterval(() => {
        timer--;
        updateDisplay();

        if (timer <= 0) {
            clearInterval(interviewState.timerInterval);
            display.innerText = "Time's Up!";
        }
    }, 1000);
}

function typeWriter(text, elementId) {
    const element = document.getElementById(elementId);
    let i = 0;
    clearInterval(interviewState.typingInterval);
    
    interviewState.typingInterval = setInterval(() => {
        if (i < text.length) {
            const char = text.charAt(i);
            element.innerHTML += char === '\n' ? '<br>' : char;
            i++;
        } else {
            clearInterval(interviewState.typingInterval);
        }
    }, 30); // Speed: 30ms per character
}

function speak(text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
}

function showFinalScore() {
    const finalScore = interviewState.totalScore;

    document.getElementById("questionBox").innerText =
        "Interview Completed!";
    document.getElementById("resultBox").innerText =
        `Final Score: ${finalScore.toFixed(2)}/100`;

    // Hide input area & show start button
    document.getElementById("interviewInterface").style.display = "none";
    document.getElementById("startInterviewBtn").style.display = "block";
    document.getElementById("timerDisplay").innerText = "";

    stopCamera();
    saveHistory(finalScore);
}

/* ================= HISTORY ================= */

function saveHistory(score){
    chrome.storage.local.get(["history"], result=>{
        const history = result.history || [];
        history.push({
            date: new Date().toLocaleString(),
            score: score
        });
        chrome.storage.local.set({ history },()=>{
            updateDashboard();
            loadHistory();
        });
    });
}

function loadHistory(){
    chrome.storage.local.get(["history"], result=>{
        const history = result.history || [];
        const container =
            document.getElementById("historyList");
        container.innerHTML="";
        history.slice().reverse().forEach(item=>{
            const score = (item.score !== undefined && item.score !== null) ? Number(item.score) : 0;
            const cheating = item.cheatingCount || 0;
            container.innerHTML+=
                `<strong>${item.date}</strong><br>
                 Score: ${score.toFixed(2)}/100<br>
                 <span style="color:${cheating > 0 ? '#e74c3c' : '#2ecc71'}">
                    ⚠️ Cheating Alerts: ${cheating}
                 </span><hr>`;
        });
    });
}

function updateDashboard(){
    chrome.storage.local.get(["history"], result=>{
        const history = result.history || [];
        const total = history.length;
        const avg = total>0
            ? (history.reduce((s,h)=>s+(h.score||0),0)/total).toFixed(2)
            : 0;
        document.getElementById("totalCount").innerText=total;
        document.getElementById("avgScore").innerText=avg+"/100";

        // Update the Graph
        renderChart(history);
    });
}

/* ================= CHART ================= */

let myChart = null;

function renderChart(history) {
    const canvas = document.getElementById("scoreChart");
    
    // If no canvas or Chart.js not loaded, skip
    if (!canvas || typeof Chart === "undefined") return;

    const ctx = canvas.getContext("2d");

    // Create Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, "rgba(52, 152, 219, 0.6)"); // Top: Blue
    gradient.addColorStop(1, "rgba(52, 152, 219, 0.0)"); // Bottom: Transparent

    // Show last 10 interviews
    const recentHistory = history.slice(-10);
    const labels = recentHistory.map((h, i) => `Attempt ${i + 1}`);
    const data = recentHistory.map(h => (h.score !== undefined && h.score !== null) ? Number(h.score) : 0);

    // Destroy previous chart instance to prevent overlap
    if (myChart) {
        myChart.destroy();
    }

    myChart = new Chart(canvas, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Interview Score",
                data: data,
                borderColor: "#ffffff",
                backgroundColor: gradient,
        pointRadius: 5,
        pointBorderColor: '#fff',
                borderWidth: 3,
                pointBackgroundColor: "#fff",
                pointBorderColor: "#ffffff",
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
              padding: {
                bottom: 20,
              }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    padding: 10,
                    cornerRadius: 6
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: "rgba(0,0,0,0.05)" }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// Initialize Dashboard on load
updateDashboard();

/* ================= CAMERA ================= */

async function startCamera() {
    try {
        // Request both Camera and Microphone permissions
        let stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        
        // Stop audio tracks (only need video preview initially)
        stream.getAudioTracks().forEach(track => track.stop());

        // Check for Phone Link interference and switch if necessary
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        const currentLabel = stream.getVideoTracks()[0].label;

        if (currentLabel.includes("Phone Link") || currentLabel.includes("Virtual")) {
            const betterDevice = videoDevices.find(d => 
                !d.label.includes("Phone Link") && !d.label.includes("Virtual")
            );
            if (betterDevice) {
                stream.getTracks().forEach(t => t.stop());
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { deviceId: { exact: betterDevice.deviceId } }
                });
            }
        }

        interviewState.cameraStream = stream;
        const video = document.getElementById("cameraPreview");
        const overlay = document.getElementById("faceOverlay");
        video.srcObject = stream;
        video.style.display = "block";
        if (overlay) overlay.style.display = "block";
    } catch (err) {
        console.error("Camera access denied:", err);

        // Fallback: Try video only (in case audio permission is blocked)
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            interviewState.cameraStream = stream;
            const video = document.getElementById("cameraPreview");
            const overlay = document.getElementById("faceOverlay");
            video.srcObject = stream;
            video.style.display = "block";
            if (overlay) overlay.style.display = "block";
        } catch (err2) {
            alert("Access denied. Please allow Camera permissions.");
        }
    }
    
    // Wait for video to actually start playing
    return new Promise(resolve => {
        const video = document.getElementById("cameraPreview");
        if (video.readyState >= 3) resolve();
        else video.oncanplay = resolve;
    });
}

function stopCamera() {
    if (interviewState.cheatingInterval) {
        clearInterval(interviewState.cheatingInterval);
        interviewState.cheatingInterval = null;
    }
    if (interviewState.cameraStream) {
        interviewState.cameraStream.getTracks().forEach(track => track.stop());
        document.getElementById("cameraPreview").style.display = "none";
        const overlay = document.getElementById("faceOverlay");
        if (overlay) overlay.style.display = "none";
    }
}

function startCheatingDetection() {
    if (interviewState.cheatingInterval) clearInterval(interviewState.cheatingInterval);

    interviewState.cheatingInterval = setInterval(() => {
        const video = document.getElementById("cameraPreview");
        const overlay = document.getElementById("faceOverlay");
        if (!video || video.paused || video.ended || !video.videoWidth) return;

        // Sync overlay resolution
        if (overlay && (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight)) {
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
        }

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(async (blob) => {
            if (!blob) return;

            const formData = new FormData();
            formData.append("image", blob, "frame.jpg");

            try {
                const response = await fetch(`${interviewState.backendUrl}/detect-cheating`, {
                    method: "POST",
                    body: formData
                });
                const data = await response.json();
                
                // Draw bounding box
                if (overlay && data.box) {
                    const ctx = overlay.getContext("2d");
                    ctx.clearRect(0, 0, overlay.width, overlay.height);
                    
                    const [x1, y1, x2, y2] = data.box;
                    const w = x2 - x1;
                    const h = y2 - y1;
                    
                    // Make it a square based on the larger dimension
                    const size = Math.max(w, h);
                    
                    // Shrink box by 20% for better fit
                    const scale = 0.4;
                    const finalSize = size * scale;
                    
                    // Center the square on the original center
                    const cx = x1 + w / 2;
                    const cy = y1 + h / 2;
                    
                    const sx = cx - finalSize / 2;
                    const sy = cy - finalSize / 2;

                    const color = data.status === "WARNING" ? "#e74c3c" : "#004cff";
                    ctx.strokeStyle = color;
                    
                    // Scale visuals based on canvas resolution (assuming ~100px display width)
                    const ratio = overlay.width / 120;
                    ctx.lineWidth = 3 * ratio;

                    ctx.beginPath();
                    if (ctx.roundRect) {
                        ctx.roundRect(sx, sy, finalSize, finalSize, 15 * ratio);
                    } else {
                        ctx.rect(sx, sy, finalSize, finalSize);
                    }
                    ctx.stroke();

                    // Draw Label
                    if (data.details) {
                        ctx.save();
                        const fontSize = 14 * ratio;
                        ctx.font = "bold " + fontSize + "px Arial";
                        const text = data.details;
                        const textMetrics = ctx.measureText(text);
                        const textWidth = textMetrics.width;
                        const padding = 4 * ratio;
                        const bgHeight = fontSize + padding;
                        const bgWidth = textWidth + padding * 2;

                        ctx.translate(sx + finalSize / 2, sy - (8 * ratio));
                        ctx.scale(-1, 1); // Counteract CSS mirror

                        // Draw Background
                        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
                        if (ctx.roundRect) {
                            ctx.beginPath();
                            ctx.roundRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 4 * ratio);
                            ctx.fill();
                        } else {
                            ctx.fillRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight);
                        }

                        // Draw Text
                        ctx.fillStyle = color;
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(text, 0, 0);
                        ctx.restore();
                    }
                }

                if (data.status === "WARNING") {
                    interviewState.cheatingIncidents++;
                    playAlertSound();
                    showCheatingWarning(data.details);
                    video.style.borderColor = "#e74c3c";
                    video.style.boxShadow = "0 0 20px rgba(231, 76, 60, 0.8)";
                } else {
                    video.style.borderColor = "#2ecc71";
                    video.style.boxShadow = "0 2px 10px rgba(0,0,0,0.3)";
                }
            } catch (err) {
                console.error("Cheating detection error:", err);
            }
        }, "image/jpeg");
    }, 3000);
}

function showCheatingWarning(message) {
    let warningBox = document.getElementById("cheatingWarning");
    if (!warningBox) {
        warningBox = document.createElement("div");
        warningBox.id = "cheatingWarning";
        warningBox.style.cssText = "position:fixed; top:10px; left:50%; transform:translateX(-50%); background:rgba(231,76,60,0.9); color:white; padding:10px 20px; border-radius:5px; z-index:4000; font-weight:bold; display:none; box-shadow: 0 2px 10px rgba(0,0,0,0.2);";
        document.body.appendChild(warningBox);
    }
    warningBox.innerText = `⚠️ ${message}`;
    warningBox.style.display = "block";
    
    setTimeout(() => {
        warningBox.style.display = "none";
    }, 2500);
}

function playAlertSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    osc.frequency.value = 880; // A5
    gain.gain.value = 0.1;

    osc.start();
    setTimeout(() => {
        osc.stop();
        ctx.close();
    }, 200);
}

function runCountdown() {
    return new Promise(resolve => {
        const display = document.getElementById("countdownDisplay");
        if (!display) return resolve();
        
        display.style.display = "block";
        let count = 3;
        display.innerText = count;

        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                display.innerText = count;
            } else {
                clearInterval(interval);
                display.style.display = "none";
                resolve();
            }
        }, 1000);
    });
}

}); 