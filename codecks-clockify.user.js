// ==UserScript==
// @name         Codecks Clockify
// @namespace    http://tampermonkey.net/
// @version      1.0.5
// @description  Clockify in Codecks
// @author       Qiryth
// @match        https://*.codecks.io/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tampermonkey.net
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      api.clockify.me
// ==/UserScript==

(function() {
    'use strict';

    const subdomain = window.location.hostname.split('.')[0];

    const Sub_ClockifyEnabled = `${subdomain}_ClockifyEnabled`;
    const Sub_ClockifyApiKey = `${subdomain}_ClockifyApiKey`;
    const Sub_ClockifyUserId = `${subdomain}_ClockifyUserId`;
    const Sub_ClockifyWorkspaceId = `${subdomain}_ClockifyWorkspaceId`;
    const Sub_ClockifyProjectId = `${subdomain}_ClockifyProjectId`;

    // Setup
    let ClockifyEnabled = GM_getValue(Sub_ClockifyEnabled, true);
    let ClockifyApiKey = GM_getValue(Sub_ClockifyApiKey, null);
    let ClockifyUserId = GM_getValue(Sub_ClockifyUserId, null);
    let ClockifyWorkspaceId = GM_getValue(Sub_ClockifyWorkspaceId, null);
    let ClockifyProjectId = GM_getValue(Sub_ClockifyProjectId, null);

    var UpdateClockifyApiKey = function() {
        ClockifyApiKey = prompt("Please enter your Clockify API Key:");
	if (ClockifyApiKey == null) {
	    GM_setValue(Sub_ClockifyEnabled, false);
	    return;
	}
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://api.clockify.me/api/v1/user",
            headers: { "X-Api-Key": ClockifyApiKey },
            onload: (response) => {
                const responseText = JSON.parse(response.responseText);
                if (responseText.id) {
                    GM_setValue(Sub_ClockifyApiKey, ClockifyApiKey);
                    ClockifyUserId = responseText.id;
                    GM_setValue(Sub_ClockifyUserId, ClockifyUserId);
                    alert(`Thanks for providing your key: ${responseText.name}`);
                    UpdateClockifyWorkspace();
                }
                else {
                    ClockifyApiKey = GM_getValue("ClockifyApiKey", null);
                    alert("Api key does not exist");
                };
            },
            onerror: (error) => alert("Something went wrong ¯\_(ツ)_/¯"),
        });
    };

    var UpdateClockifyWorkspace = function() {
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://api.clockify.me/api/v1/workspaces",
            headers: { "X-Api-Key": ClockifyApiKey, "Content-Type": "application/json" },
            onload: (response) => {
                const responseText = JSON.parse(response.responseText);
                let promptText = "Choose your workspace (Enter number):\n";
                for(let i = 0; i < responseText.length; i++) { promptText += `${i+1}. ${responseText[i].name}\n`; };
                const userInput = prompt(promptText);
                if (responseText[userInput - 1]) {
                    ClockifyWorkspaceId = responseText[userInput - 1].id;
                    GM_setValue(Sub_ClockifyWorkspaceId, ClockifyWorkspaceId);
                    alert(`Workspace was set to: ${responseText[userInput - 1].name}`);
                    UpdateClockifyProject();
                }
                else alert("No valid Workspace was selected.")
            },
            onerror: (error) => alert("Something went wrong ¯\_(ツ)_/¯"),
        });
    }

    var UpdateClockifyProject = function() {
        GM_xmlhttpRequest({
            method: "GET",
            url: `https://api.clockify.me/api/v1/workspaces/${ClockifyWorkspaceId}/projects`,
            headers: { "X-Api-Key": ClockifyApiKey, "Content-Type": "application/json" },
            onload: (response) => {
                const responseText = JSON.parse(response.responseText);
                let promptText = "Choose your project (Enter number):\n";
                for(let i = 0; i < responseText.length; i++) { promptText += `${i+1}. ${responseText[i].name}\n`; };
                const userInput = prompt(promptText);
                if (responseText[userInput - 1]) {
                    ClockifyProjectId = responseText[userInput - 1].id;
                    GM_setValue(Sub_ClockifyProjectId, ClockifyProjectId);
                    alert(`Project was set to: ${responseText[userInput - 1].name}`);
                    window.location.href = '/';
                }
                else alert("No valid Project was selected.")
            },
            onerror: (error) => alert("Something went wrong ¯\_(ツ)_/¯"),
        });
    }

    GM_registerMenuCommand("Change API Key", () => UpdateClockifyApiKey());
    GM_registerMenuCommand("Choose Workspace", () => UpdateClockifyWorkspace());
    GM_registerMenuCommand("Choose Project", () => UpdateClockifyProject());
    GM_registerMenuCommand('Clear All Data', async () => {
        if (confirm("Are you sure you want to clear your API key and it's related data?\nThis can not be undone.")) {
            GM_setValue(Sub_ClockifyApiKey, null);
            GM_setValue(Sub_ClockifyUserId, null);
            GM_setValue(Sub_ClockifyWorkspaceId, null);
            GM_setValue(Sub_ClockifyProjectId, null);
            window.location.href = '/';
        }
    });

    if (!ClockifyEnabled) return;
    if (!ClockifyApiKey) UpdateClockifyApiKey();
    else if (!ClockifyWorkspaceId) UpdateClockifyWorkspace();
    else if (!ClockifyProjectId) UpdateClockifyProject();

    if (!ClockifyApiKey || !ClockifyUserId || !ClockifyWorkspaceId || !ClockifyProjectId) return;

    // UI Elements
    const InfoBox = document.createElement('div');
    InfoBox.innerHTML = "";
    InfoBox.style.padding = ".15em";
    InfoBox.style.margin = ".35em .35em .35em .85em";
    InfoBox.style.color = "#704d9e";
    InfoBox.style.cursor = "pointer";

    const TimerDisplay = document.createElement('div');
    TimerDisplay.innerHTML = "00:00:00";
    TimerDisplay.style.padding = ".5em";

    const ClockifyButton = document.createElement('button');
    ClockifyButton.style.color = "#edeef2";
    ClockifyButton.style.border = "none";
    ClockifyButton.style.padding = ".5em";
    ClockifyButton.style.borderRadius = ".5em";

    let CurrentSeconds = 0;
    let CurrentInterval = 0;
    var UpdateUI = function(bStartTimer, AccumulatedTime = 0) {
        CurrentSeconds = AccumulatedTime;
        TimerDisplay.innerHTML = new Date(CurrentSeconds * 1000).toISOString().substr(11, 8);
        if (bStartTimer) {
            CheckTimerActive();
            ClockifyButton.onclick = StartTimer;
            ClockifyButton.textContent = "Start Timer";
            ClockifyButton.style.backgroundColor = "#3e69b6";
            if (CurrentInterval) clearInterval(CurrentInterval);
        } else {
            InfoBox.innerHTML = "";
            ClockifyButton.onclick = StopTimer;
            ClockifyButton.textContent = "Stop Timer";
            ClockifyButton.style.backgroundColor = "#a50d2b";
            CurrentInterval = setInterval(() => {
                TimerDisplay.innerHTML = new Date(++CurrentSeconds * 1000).toISOString().substr(11, 8);
            }, 1000);
        }
    };

    const Clockify = document.createElement('div');
    Clockify.style.display = "flex";
    Clockify.style.alignItems = "center";
    Clockify.style.justifyContent = "space-between";

    Clockify.appendChild(ClockifyButton);
    Clockify.appendChild(InfoBox);
    Clockify.appendChild(TimerDisplay);


    // Injection
    const app = document.getElementById('app');

    let LastHref = "";
    const AppObserver = new MutationObserver(() => {
        if (location.href === LastHref) return;

        if (window.location.pathname.startsWith("/card/")) {
            const CardDetails = app.querySelector('div[data-cdx-context="CardDetail"]');
            if (!CardDetails) return;

            LastHref = location.href;
            const selectedCardElement = CardDetails.querySelector('div.d-flex.flexDir-column.minHeight-0.sp-12px');
            selectedCardElement.appendChild(Clockify);
            CheckCurrentTime();
        } else {
            LastHref = location.href;
        };
    });
    AppObserver.observe(app, { childList: true, subtree: true })

    // Helper Function
    var GetFormattedCardPath = function() {
        const SplitUpPath = window.location.pathname.replace("/card/", "").split("-");
        return `[$${SplitUpPath.shift()}] ${SplitUpPath[0].charAt(0).toUpperCase() + SplitUpPath.join(" ").slice(1)}`;
    }


    // API Calls
    var CheckCurrentTime = function() {
        GM_xmlhttpRequest({
            method: "GET",
            url: `https://api.clockify.me/api/v1/workspaces/${ClockifyWorkspaceId}/user/${ClockifyUserId}/time-entries?description=${encodeURIComponent(GetFormattedCardPath())}`,
            headers: { "X-Api-Key": ClockifyApiKey, "Content-Type": "application/json" },
            onload: response => {
                let bIsTimerRunning = false;
                let AccumulatedTime = 0;
                JSON.parse(response.responseText).forEach(entry => {
                    if (entry.timeInterval.duration) {
                        const match = entry.timeInterval.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
                        AccumulatedTime += parseInt(match[1] || 0, 10) * 3600 + parseInt(match[2] || 0, 10) * 60 + parseInt(match[3] || 0, 10);
                    }
                    else {
                        bIsTimerRunning = true;
                        AccumulatedTime += Math.floor((new Date() - new Date(entry.timeInterval.start)) / 1000);
                    }
                });
                UpdateUI(!bIsTimerRunning, AccumulatedTime);
            },
            onerror: error => console.error("Error getting running time entry:", error)
        });
    }

    var CheckTimerActive = function() {
        GM_xmlhttpRequest({
            method: "GET",
            url: `https://api.clockify.me/api/v1/workspaces/${ClockifyWorkspaceId}/user/${ClockifyUserId}/time-entries?in-progress=true`,
            headers: { "X-Api-Key": ClockifyApiKey, "Content-Type": "application/json" },
            onload: response => {
                InfoBox.innerHTML = !JSON.parse(response.responseText).length ? "" : JSON.parse(response.responseText)[0].description.match(/\[.*?\]/)?.[0];
                InfoBox.onclick = () => { window.location.href = "https://plausch.codecks.io/card/" +
                    JSON.parse(response.responseText)[0].description.replace(/\[\$(.*?)\]\s*(.*)/, (_, code, text) => {
                        return `${code}-${text.toLowerCase().replace(/\s+/g, '-')}`;
                    });
                };
            },
            onerror: error => console.error("Error getting running time entry:", error)
        });
    }

    var StartTimer = function() {
        GM_xmlhttpRequest({
            method: "POST",
            url: `https://api.clockify.me/api/v1/workspaces/${ClockifyWorkspaceId}/time-entries`,
            headers: { "X-Api-Key": ClockifyApiKey, "Content-Type": "application/json" },
            data: JSON.stringify({ "billable": true, "description": `${GetFormattedCardPath()}`, "projectId": `${ClockifyProjectId}` }),
            onload: response => UpdateUI(false, CurrentSeconds),
            onerror: error => console.error("Error starting time entry:", error)
        });
    };

    var StopTimer = function() {
        GM_xmlhttpRequest({
            method: "PATCH",
            url: `https://api.clockify.me/api/v1/workspaces/${ClockifyWorkspaceId}/user/${ClockifyUserId}/time-entries`,
            headers: { "X-Api-Key": ClockifyApiKey, "Content-Type": "application/json" },
            data: JSON.stringify({ "end": new Date().toISOString() }),
            onload: response => UpdateUI(true, CurrentSeconds),
            onerror: error => console.error("Error stopping time entry:", error)
        });
    };
})();
