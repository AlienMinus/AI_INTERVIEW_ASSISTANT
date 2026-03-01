document.addEventListener("DOMContentLoaded", () => {

let interviewState = {
    questions: [],
    currentIndex: 0,
    totalScore: 0
};

/* =========================
   NAVIGATION
========================= */

function showSection(id) {
    document.querySelectorAll(".section").forEach(sec =>
        sec.classList.remove("active")
    );
    document.getElementById(id).classList.add("active");

    if (id === "history") loadHistory();
    if (id === "dashboard") updateDashboard();
}

document.getElementById("navDashboard").addEventListener("click", () => showSection("dashboard"));
document.getElementById("navInterview").addEventListener("click", () => showSection("interview"));
document.getElementById("navHistory").addEventListener("click", () => showSection("history"));
document.getElementById("navSettings").addEventListener("click", () => showSection("settings"));


/* =========================
   LOAD SAVED SETTINGS
========================= */

chrome.storage.local.get(["rapidKey", "jobDesc", "resume"], (data) => {

    if (data.rapidKey)
        document.getElementById("apiKeyInput").value = data.rapidKey;

    if (data.jobDesc)
        document.getElementById("jobDescInput").value = data.jobDesc;

    if (data.resume)
        document.getElementById("resumeInput").value = data.resume;
});


/* =========================
   SAVE SETTINGS
========================= */

document.getElementById("saveApiBtn").addEventListener("click", () => {
    const key = document.getElementById("apiKeyInput").value.trim();
    chrome.storage.local.set({ rapidKey: key }, () => {
        alert("API Key Saved");
    });
});

document.getElementById("saveProfileBtn").addEventListener("click", () => {
    const jobDesc = document.getElementById("jobDescInput").value;
    const resume = document.getElementById("resumeInput").value;

    chrome.storage.local.set({ jobDesc, resume }, () => {
        alert("Profile Saved");
    });
});


/* =========================
   START INTERVIEW
========================= */

document.getElementById("startInterviewBtn").addEventListener("click", async () => {

    chrome.storage.local.get(["rapidKey", "jobDesc", "resume"], async (data) => {

        if (!data.rapidKey || !data.jobDesc || !data.resume) {
            alert("Please fill API key, Job Description and Resume in Settings.");
            return;
        }

        const prompt = `
You are an expert technical interviewer.

Based on this Job Description:
${data.jobDesc}

And this Resume:
${data.resume}

Generate exactly 5 challenging interview questions.
Return them as a numbered list only.
`;

        const questionsText = await callAPI(data.rapidKey, prompt);

        interviewState.questions = questionsText
            .split("\n")
            .map(q => q.replace(/^\d+\.\s*/, "").trim())
            .filter(q => q.length > 0)
            .slice(0, 5);

        interviewState.currentIndex = 0;
        interviewState.totalScore = 0;

        document.getElementById("resultBox").innerText = "";
        showNextQuestion();
    });
});


/* =========================
   SUBMIT ANSWER
========================= */

document.getElementById("submitBtn").addEventListener("click", async () => {

    const answer = document.getElementById("answerInput").value.trim();
    if (!answer) return alert("Please answer the question.");

    const question = interviewState.questions[interviewState.currentIndex];

    chrome.storage.local.get(["rapidKey"], async (data) => {

        const evaluationPrompt = `
You are grading an interview answer.

Question: ${question}

Candidate Answer: ${answer}

Give a score from 0 to 20.
Return only the number.
`;

        const scoreText = await callAPI(data.rapidKey, evaluationPrompt);

        const match = scoreText.match(/\d+/);
        const score = match ? parseInt(match[0]) : 0;

        interviewState.totalScore += score;
        interviewState.currentIndex++;

        document.getElementById("answerInput").value = "";

        if (interviewState.currentIndex < 5) {
            showNextQuestion();
        } else {
            showFinalScore();
        }
    });
});


/* =========================
   DISPLAY LOGIC
========================= */

function showNextQuestion() {
    document.getElementById("questionBox").innerText =
        `Question ${interviewState.currentIndex + 1}/5:\n\n` +
        interviewState.questions[interviewState.currentIndex];
}

function showFinalScore() {

    const finalScore = interviewState.totalScore;

    document.getElementById("questionBox").innerText = "Interview Completed!";
    document.getElementById("resultBox").innerText =
        `Final Score: ${finalScore}/100`;

    saveHistory(finalScore);
}


/* =========================
   API CALL
========================= */

async function callAPI(apiKey, userPrompt) {

    const response = await fetch("https://chatgpt-42.p.rapidapi.com/gpt4", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-rapidapi-key": apiKey,
            "x-rapidapi-host": "chatgpt-42.p.rapidapi.com"
        },
        body: JSON.stringify({
            messages: [{ role: "user", content: userPrompt }],
            web_access: false
        })
    });

    const data = await response.json();

    return data?.result ||
           data?.choices?.[0]?.message?.content ||
           JSON.stringify(data);
}


/* =========================
   HISTORY + DASHBOARD
========================= */

function saveHistory(score) {

    chrome.storage.local.get(["history"], (result) => {

        const history = result.history || [];

        history.push({
            date: new Date().toLocaleString(),
            score: score
        });

        chrome.storage.local.set({ history }, () => {
            updateDashboard();
            loadHistory();
        });
    });
}

function loadHistory() {

    chrome.storage.local.get(["history"], (result) => {

        const history = result.history || [];
        const container = document.getElementById("historyList");

        if (!container) return;

        container.innerHTML = "";

        history.slice().reverse().forEach(item => {

            const div = document.createElement("div");
            div.className = "history-item";

            div.innerHTML = `
                <strong>Date:</strong> ${item.date}<br>
                <strong>Score:</strong> ${item.score}/100
                <hr>
            `;

            container.appendChild(div);
        });
    });
}

loadHistory();
/* =========================
   INITIAL LOAD
========================= */

updateDashboard();
function updateDashboard() {

    chrome.storage.local.get(["history"], (result) => {

        const history = result.history || [];
        
        // Fix: Filter out invalid scores to prevent NaN errors
        const validHistory = history.filter(h => !isNaN(parseFloat(h.score)));
        const totalInterviews = validHistory.length;

        const avg = totalInterviews > 0
            ? (validHistory.reduce((sum, item) => sum + Number(item.score), 0) / totalInterviews).toFixed(1)
            : 0;

        document.getElementById("totalCount").innerText = totalInterviews;
        document.getElementById("avgScore").innerText = avg + "/100";
        
        renderChart(validHistory);
    });
}

function renderChart(history) {
    const svg = document.getElementById("scoreChart");
    if (!svg) return;

    if (history.length === 0) {
        svg.innerHTML = "";
        return;
    }

    const width = 340;
    const height = 150;
    const padding = 15;

    // Scales
    const getX = (i) => padding + (i / (history.length - 1 || 1)) * (width - 2 * padding);
    const getY = (score) => height - padding - (score / 100) * (height - 2 * padding);

    let svgContent = "";

    // Grid Lines (0, 50, 100)
    [0, 50, 100].forEach(val => {
        const y = getY(val);
        svgContent += `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" class="chart-grid" />`;
    });

    // Line Path
    const points = history.map((item, i) => `${getX(i)},${getY(item.score)}`).join(" ");
    svgContent += `<polyline points="${points}" class="chart-line" />`;

    // Data Points
    history.forEach((item, i) => {
        svgContent += `<circle cx="${getX(i)}" cy="${getY(item.score)}" r="4" class="chart-dot"><title>${item.date}: ${item.score}</title></circle>`;
    });

    svg.innerHTML = svgContent;
}



});
/* =========================
   CLEAR HISTORY
========================= */

document.getElementById("clearHistoryBtn").addEventListener("click", () => {

    if (!confirm("Are you sure you want to clear all interview history?"))
        return;

    chrome.storage.local.set({ history: [] }, () => {

        // Reset dashboard values immediately
        document.getElementById("totalCount").innerText = 0;
        document.getElementById("avgScore").innerText = 0;

        // Clear history UI
        const container = document.getElementById("historyList");
        if (container) container.innerHTML = "";

        alert("History cleared successfully.");
    });
});

/* =========================
   DOCX TEXT EXTRACTOR
========================= */

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const fileNameDisplay = document.getElementById("fileNameDisplay");

// Drag & Drop Logic
dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        updateFileName();
    }
});

fileInput.addEventListener("change", updateFileName);

function updateFileName() {
    fileNameDisplay.textContent = fileInput.files.length ? `Selected: ${fileInput.files[0].name}` : "";
    fileNameDisplay.style.display = fileInput.files.length ? "block" : "none";
}

document.getElementById("clearResumeBtn").addEventListener("click", () => {
    document.getElementById("resumeInput").value = "";
    fileInput.value = "";
    updateFileName();
    document.getElementById("status").innerHTML = "";
});

document.getElementById("extractTextBtn").addEventListener("click", extractText);

async function extractText() {
    const fileInput = document.getElementById("fileInput");
    const status = document.getElementById("status");
    status.innerHTML = "";

    if (!fileInput.files.length) {
        status.innerHTML = "<div class='error'>Please select a file (.pdf or .docx)</div>";
        return;
    }

    let file = fileInput.files[0];
    const extension = file.name.split('.').pop().toLowerCase();

    status.innerHTML = "<div class='loading'><div class='spinner'></div> Processing...</div>";

    try {
        // STEP 1: Convert PDF to DOCX if needed
        if (extension === "pdf") {
            const convertForm = new FormData();
            convertForm.append("file", file);

            const convertResponse = await fetch(
                "https://doc-converter-vdh0.onrender.com/api/pdf-to-docx",
                { method: "POST", body: convertForm }
            );

            if (!convertResponse.ok) {
                const err = await convertResponse.json();
                throw new Error(err.error || "PDF Conversion Failed");
            }

            const convertedBlob = await convertResponse.blob();
            file = new File([convertedBlob], file.name.replace(".pdf", ".docx"), {
                type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            });
        }

        // STEP 2: Extract text
        const extractForm = new FormData();
        extractForm.append("file", file);

        const response = await fetch(
            "https://doc-manipulation.vercel.app/api/text",
            { method: "POST", body: extractForm }
        );

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || "Text extraction failed");

        status.innerHTML = "";
        document.getElementById("resumeInput").value = data.text;

        const jobDesc = document.getElementById("jobDescInput").value;
        chrome.storage.local.set({ jobDesc, resume: data.text }, () => {
            alert("Resume extracted and saved to profile!");
        });

    } catch (error) {
        status.innerHTML = `<div class='error'>Error: ${error.message}</div>`;
    }
}
