// ==========================================
// CONFIGURATION
// ==========================================
// Change "localhost" to your Computer's local Wi-Fi IP address (e.g. 192.168.1.10)
// when running the application on a physical Android phone!
const API_BASE_URL = "http://192.168.29.191:8000/api/";

// App State
let currentUser = null;
let allJobs = [];
let allNotifications = [];

// ==========================================
// CORE APP ROUTING & LIFE CYCLE
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem("recruitment_user");
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        setupPortalAccess();
    } else {
        switchScreen("screen-login");
    }
});

// Switch major views (Login, Register, Portal etc.)
function switchScreen(screenId) {
    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.remove("active");
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add("active");
    }
}

// Switch inner tabs within Portal (Profile, Job Views, Admin Panels etc.)
function switchPortalTab(event, tabId) {
    if (event) event.preventDefault();
    
    document.querySelectorAll(".portal-tab").forEach(tab => {
        tab.classList.remove("active");
    });
    
    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.remove("active");
    });
    
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.add("active");
    }
    
    if (event && event.target) {
        event.target.classList.add("active");
    }
    
    // Refresh page data dynamically based on selected tab
    refreshTabData(tabId);
}

// Refresh data depending on active view
function refreshTabData(tabId) {
    if (!currentUser) return;
    
    loadNotificationsCount(); // Always update unread badge

    if (tabId === 'tab-vacancies') {
        loadJobVacancies();
    } else if (tabId === 'tab-profile') {
        loadProfile();
    } else if (tabId === 'tab-my-applications') {
        loadMyApplications();
    } else if (tabId === 'tab-admin-dashboard') {
        loadAdminStats();
    } else if (tabId === 'tab-admin-vacancies') {
        loadAdminVacancies();
    } else if (tabId === 'tab-admin-applications') {
        loadAdminApplications();
    } else if (tabId === 'tab-admin-reports') {
        loadRecruitmentReports();
    }
}

// Setup user configurations based on Role
function setupPortalAccess() {
    const nameEl = document.getElementById("user-display-email");
    const roleBadge = document.getElementById("user-display-role");
    roleBadge.innerText = currentUser.role;
    
    if (currentUser.role === 'admin') {
        if (nameEl) nameEl.innerText = "Admin";
        roleBadge.className = "role-badge";
        roleBadge.classList.add("badge-approved");
        
        // Hide faculty sidebar links and show admin links
        document.querySelectorAll(".faculty-only").forEach(el => el.style.display = "none");
        document.querySelectorAll(".admin-only").forEach(el => el.style.display = "block");
        
        switchScreen("screen-portal");
        switchPortalTab(null, "tab-admin-dashboard");
    } else {
        if (nameEl) nameEl.innerText = currentUser.full_name || "Faculty";
        roleBadge.className = "role-badge";
        roleBadge.classList.add("badge-applied");
        
        // Hide admin sidebar links and show faculty links
        document.querySelectorAll(".admin-only").forEach(el => el.style.display = "none");
        document.querySelectorAll(".faculty-only").forEach(el => el.style.display = "block");
        
        switchScreen("screen-portal");
        switchPortalTab(null, "tab-vacancies");
    }
}

// Global fetch headers helper
function getFetchHeaders(isMultipart = false) {
    const headers = {};
    if (!isMultipart) {
        headers["Content-Type"] = "application/json";
    }
    if (currentUser && currentUser.user_id) {
        headers["X-User-Id"] = currentUser.user_id.toString();
    }
    return headers;
}

// ==========================================
// 1. AUTHENTICATION MODULE FUNCTIONS
// ==========================================

async function handleRegister(event) {
    event.preventDefault();
    const fullName = document.getElementById("reg-name").value;
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;
    const confirmPassword = document.getElementById("reg-confirm").value;

    if (password.length < 6) {
        showToast("Password must be at least 6 characters long.", "warning");
        return;
    }
    if (password !== confirmPassword) {
        showToast("Passwords do not match!", "error");
        return;
    }

    try {
        const response = await fetch(API_BASE_URL + "register/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, full_name: fullName })
        });
        const result = await response.json();
        if (response.ok) {
            showToast("Registration successful! Please login.", "success");
            document.getElementById("form-register").reset();
            switchScreen("screen-login");
        } else {
            showToast(result.error || "Registration failed", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Cannot connect to server. Ensure Django backend is running.", "error");
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
        const response = await fetch(API_BASE_URL + "login/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            currentUser = {
                user_id: result.user_id,
                email: result.email,
                role: result.role
            };
            localStorage.setItem("recruitment_user", JSON.stringify(currentUser));
            document.getElementById("form-login").reset();
            setupPortalAccess();
        } else {
            showToast(result.error || "Invalid username or password", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Cannot connect to server. Ensure Django backend is running.", "error");
    }
}

async function handleForgotPassword(event) {
    event.preventDefault();
    const email = document.getElementById("forgot-email").value;

    try {
        const response = await fetch(API_BASE_URL + "forgot-password/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });
        const result = await response.json();
        if (response.ok) {
            showToast(result.message, "info");
            document.getElementById("form-forgot").reset();
            switchScreen("screen-login");
        } else {
            showToast(result.error || "Failed to process request", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Server error.", "error");
    }
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem("recruitment_user");
    switchScreen("screen-login");
}

// ==========================================
// 2. FACULTY PROFILE MODULE
// ==========================================

function toggleProfileEdit(isEdit) {
    const viewMode = document.getElementById("profile-view-mode");
    const editMode = document.getElementById("profile-edit-mode");
    const cancelBtn = document.getElementById("btn-cancel-profile-edit");

    if (isEdit) {
        if (viewMode) viewMode.style.display = "none";
        if (editMode) editMode.style.display = "block";
        if (cancelBtn) cancelBtn.style.display = "inline-block";
    } else {
        if (viewMode) viewMode.style.display = "block";
        if (editMode) editMode.style.display = "none";
    }
}

function getMediaUrl(mediaPath) {
    if (!mediaPath) return '';
    if (mediaPath.startsWith('http')) return mediaPath;
    const serverOrigin = API_BASE_URL.replace('/api/', '').replace(/\/+$/, '');
    const cleanPath = mediaPath.startsWith('/') ? mediaPath : '/' + mediaPath;
    return `${serverOrigin}${cleanPath}`;
}

async function loadProfile() {
    try {
        const response = await fetch(API_BASE_URL + "profile/", {
            method: "GET",
            headers: getFetchHeaders()
        });
        const profile = await response.json();
        if (response.ok) {
            document.getElementById("prof-name").value = profile.full_name || "";
            document.getElementById("prof-phone").value = profile.phone || "";
            document.getElementById("prof-dob").value = profile.dob || "";
            document.getElementById("prof-gender").value = profile.gender || "";
            document.getElementById("prof-qualification").value = profile.qualification || "";
            document.getElementById("prof-experience").value = profile.experience || "";
            document.getElementById("prof-skills").value = profile.skills || "";
            
            const linkArea = document.getElementById("resume-download-link");
            let resumeHtml = "<span class='text-muted'>No resume uploaded yet</span>";
            if (profile.resume_url) {
                const fullResumeUrl = getMediaUrl(profile.resume_url);
                resumeHtml = `<a href="${fullResumeUrl}" target="_blank" style="color:var(--crimson); font-weight:600;"><i class="fa-solid fa-file-pdf"></i> View Uploaded Resume PDF</a>`;
                linkArea.innerHTML = resumeHtml;
            } else {
                linkArea.innerHTML = resumeHtml;
            }


            // Populate Read-Only View Mode Display Card
            const hasDetails = profile.full_name || profile.phone || profile.qualification;
            const displayContainer = document.getElementById("display-profile-details");
            
            if (displayContainer) {
                displayContainer.innerHTML = `
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                        <div>
                            <span style="font-size:11px; text-transform:uppercase; color:var(--text-tertiary); font-weight:700; display:block;">Full Name</span>
                            <div style="font-size:14px; color:var(--text-primary); font-weight:600; margin-top:2px;">${profile.full_name || 'Not set'}</div>
                        </div>
                        <div>
                            <span style="font-size:11px; text-transform:uppercase; color:var(--text-tertiary); font-weight:700; display:block;">Phone Number</span>
                            <div style="font-size:14px; color:var(--text-primary); font-weight:600; margin-top:2px;">${profile.phone || 'Not set'}</div>
                        </div>
                        <div>
                            <span style="font-size:11px; text-transform:uppercase; color:var(--text-tertiary); font-weight:700; display:block;">Date of Birth</span>
                            <div style="font-size:13.5px; color:var(--text-primary); margin-top:2px;">${profile.dob || 'Not set'}</div>
                        </div>
                        <div>
                            <span style="font-size:11px; text-transform:uppercase; color:var(--text-tertiary); font-weight:700; display:block;">Gender</span>
                            <div style="font-size:13.5px; color:var(--text-primary); margin-top:2px;">${profile.gender || 'Not set'}</div>
                        </div>
                    </div>

                    <div style="margin-top:4px;">
                        <span style="font-size:11px; text-transform:uppercase; color:var(--text-tertiary); font-weight:700; display:block;">Educational Qualifications</span>
                        <div style="font-size:13.5px; color:var(--text-primary); margin-top:4px; line-height:1.4;">${profile.qualification || 'Not set'}</div>
                    </div>

                    <div>
                        <span style="font-size:11px; text-transform:uppercase; color:var(--text-tertiary); font-weight:700; display:block;">Work Experience</span>
                        <div style="font-size:13.5px; color:var(--text-primary); margin-top:4px; line-height:1.4;">${profile.experience || 'Not set'}</div>
                    </div>

                    <div>
                        <span style="font-size:11px; text-transform:uppercase; color:var(--text-tertiary); font-weight:700; display:block;">Technical / Core Skills</span>
                        <div style="font-size:13.5px; color:var(--text-primary); margin-top:4px; line-height:1.4;">${profile.skills || 'Not set'}</div>
                    </div>

                    <div>
                        <span style="font-size:11px; text-transform:uppercase; color:var(--text-tertiary); font-weight:700; display:block;">Uploaded Resume</span>
                        <div style="font-size:13.5px; margin-top:4px;">${resumeHtml}</div>
                    </div>
                `;
            }

            if (hasDetails) {
                toggleProfileEdit(false); // Default to clean view mode
            } else {
                toggleProfileEdit(true); // Show edit mode if brand new profile
            }
        }
    } catch (err) {
        console.error("Error loading profile", err);
    }
}

async function handleSaveProfile(event) {
    event.preventDefault();
    
    const formData = new FormData();
    formData.append("full_name", document.getElementById("prof-name").value);
    formData.append("phone", document.getElementById("prof-phone").value);
    formData.append("dob", document.getElementById("prof-dob").value);
    formData.append("gender", document.getElementById("prof-gender").value);
    formData.append("qualification", document.getElementById("prof-qualification").value);
    formData.append("experience", document.getElementById("prof-experience").value);
    formData.append("skills", document.getElementById("prof-skills").value);
    
    const resumeFile = document.getElementById("prof-resume").files[0];
    if (resumeFile) {
        formData.append("resume", resumeFile);
    }

    try {
        const response = await fetch(API_BASE_URL + "profile/", {
            method: "POST",
            headers: getFetchHeaders(true),
            body: formData
        });
        const result = await response.json();
        if (response.ok) {
            showToast("Profile saved successfully!", "success");
            loadProfile(); // Refreshes and switches automatically to clean read-only view mode!
        } else {
            showToast(result.error || "Failed to save profile", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Error saving profile", "error");
    }
}


// ==========================================
// 3 & 4. JOB VACANCY & APPLICATIONS MODULE
// ==========================================

async function loadJobVacancies() {
    try {
        // First get applied jobs list to check if user already applied
        const appResponse = await fetch(API_BASE_URL + "apply/", {
            method: "GET",
            headers: getFetchHeaders()
        });
        const appliedJobs = await appResponse.json();
        const appliedJobIds = appliedJobs.map(app => app.job_id || null); // Note: we'll check it against app database structures

        const response = await fetch(API_BASE_URL + "vacancies/", {
            method: "GET",
            headers: getFetchHeaders()
        });
        allJobs = await response.json();
        
        const container = document.getElementById("faculty-vacancies-list");
        container.innerHTML = "";
        
        const openJobs = allJobs.filter(j => j.status === 'open');
        if (openJobs.length === 0) {
            container.innerHTML = "<p class='no-data'>No active job vacancies at the moment.</p>";
            return;
        }

        openJobs.forEach(job => {
            // Find if current user applied to this job in the database
            // (We will check our appliedJobs table data structures, but alternatively we can compare names)
            const matchedApp = appliedJobs.find(app => app.job_title === job.title && app.department === job.department);
            
            let actionBtn = "";
            if (matchedApp) {
                let badgeClass = "badge-applied";
                if (matchedApp.status === "shortlisted") badgeClass = "badge-shortlisted";
                if (matchedApp.status === "approved") badgeClass = "badge-approved";
                if (matchedApp.status === "rejected") badgeClass = "badge-rejected";
                let displayStatus = matchedApp.status ? matchedApp.status.toUpperCase() : 'APPLIED';
                if (matchedApp.status === "approved") displayStatus = "SELECTED";
                actionBtn = `<span class="badge ${badgeClass}">${displayStatus}</span>`;
            } else {
                actionBtn = `<button class="btn btn-primary" onclick="applyForJob(${job.id})">Apply for Job <i class="fa-solid fa-paper-plane"></i></button>`;
            }

            container.innerHTML += `
                <div class="vacancy-card">
                    <div>
                        <div class="vac-title">${job.title}</div>
                        <div class="vac-dept">${job.department}</div>
                        <div class="vac-meta"><strong>Qualification:</strong> ${job.qualification_required}</div>
                        <div class="vac-meta"><strong>Experience:</strong> ${job.experience_required}</div>
                        <div class="vac-desc">${job.description}</div>
                    </div>
                    <div>
                        ${actionBtn}
                    </div>
                </div>
            `;
        });
    } catch (err) {
        console.error(err);
    }
}

function filterJobs() {
    const query = document.getElementById("search-job").value.toLowerCase();
    const cards = document.querySelectorAll("#faculty-vacancies-list .vacancy-card");
    
    cards.forEach(card => {
        const title = card.querySelector(".vac-title").innerText.toLowerCase();
        const dept = card.querySelector(".vac-dept").innerText.toLowerCase();
        if (title.includes(query) || dept.includes(query)) {
            card.style.display = "flex";
        } else {
            card.style.display = "none";
        }
    });
}

async function applyForJob(jobId) {
    const job = (allJobs || []).find(j => j.id === jobId);
    if (!job) return;

    try {
        const response = await fetch(API_BASE_URL + "profile/", {
            method: "GET",
            headers: getFetchHeaders()
        });
        const profile = await response.json();
        
        const body = document.getElementById("modal-apply-body");
        body.innerHTML = `
            <div class="glass-card" style="margin-bottom:12px;">
                <h4 style="color:var(--text-tertiary); font-size:11px; text-transform:uppercase; font-weight:700;">Target Position</h4>
                <div style="font-family:'Outfit',sans-serif; font-size:17px; font-weight:700; color:var(--text-primary); margin-top:2px;">${job.title}</div>
                <div class="vac-dept" style="margin-top:4px; display:inline-block;">${job.department}</div>
            </div>

            <div class="glass-card" style="margin-bottom:14px;">
                <h4 style="color:var(--text-tertiary); font-size:11px; text-transform:uppercase; font-weight:700; margin-bottom:8px;">Applicant Profile Summary</h4>
                <div style="font-size:13px; color:var(--text-secondary); line-height:1.6;">
                    <div><strong>Full Name:</strong> ${profile.full_name || currentUser.email}</div>
                    <div><strong>Phone:</strong> ${profile.phone || '<span style="color:#ff9800;">Not provided</span>'}</div>
                    <div><strong>Qualification:</strong> ${profile.qualification || '<span style="color:#ff9800;">Not provided</span>'}</div>
                    <div><strong>Experience:</strong> ${profile.experience || 'Not provided'}</div>
                    <div><strong>Resume:</strong> ${profile.resume_url ? 'PDF Attached ✓' : '<span style="color:#ff9800;">No file uploaded</span>'}</div>
                </div>
            </div>

            <p style="font-size:11.5px; color:var(--text-tertiary); margin-bottom:16px; text-align:center; line-height:1.4;">
                By submitting, your candidate profile details will be sent to the college recruitment committee.
            </p>

            <div style="display:flex; gap:10px;">
                <button type="button" class="btn" style="flex:1; background:rgba(255,255,255,0.08); color:var(--text-primary);" onclick="closeModal('modal-confirm-apply')">
                    Cancel
                </button>
                <button type="button" class="btn btn-primary" style="flex:1.4;" onclick="submitJobApplication(${job.id})">
                    Submit Application 🚀
                </button>
            </div>
        `;

        document.getElementById("modal-confirm-apply").classList.remove("hidden");
    } catch (err) {
        console.error(err);
        submitJobApplication(jobId);
    }
}

async function submitJobApplication(jobId) {
    closeModal("modal-confirm-apply");
    try {
        const response = await fetch(API_BASE_URL + "apply/", {
            method: "POST",
            headers: getFetchHeaders(),
            body: JSON.stringify({ job_id: jobId })
        });
        const result = await response.json();
        if (response.ok) {
            showToast("Application submitted successfully!", "success");
            loadJobVacancies();
        } else {
            showToast(result.error || "Failed to apply", "warning");
        }
    } catch (err) {
        console.error(err);
        showToast("Error applying for job", "error");
    }
}



async function loadMyApplications() {
    try {
        const response = await fetch(API_BASE_URL + "apply/", {
            method: "GET",
            headers: getFetchHeaders()
        });
        const apps = await response.json();
        
        const container = document.getElementById("applied-jobs-list");
        if (!container) return;
        container.innerHTML = "";
        
        if (apps.length === 0) {
            container.innerHTML = "<p class='no-data'>You have not applied for any vacancies yet.</p>";
            return;
        }

        apps.forEach(app => {
            let badgeClass = "badge-applied";
            if (app.status === 'shortlisted') badgeClass = "badge-shortlisted";
            if (app.status === 'approved') badgeClass = "badge-approved";
            if (app.status === 'rejected') badgeClass = "badge-rejected";
            let displayStatus = app.status ? app.status.toUpperCase() : 'APPLIED';
            if (app.status === 'approved') displayStatus = 'SELECTED';

            let interviewCell = "";
            if (app.interview) {
                const modeText = app.interview.mode === "online" ? "Online Video" : "Offline Campus";
                interviewCell = `
                    <div class="interview-box" style="margin-top:8px;">
                        <strong>Interview Date:</strong> ${app.interview.date_time}<br>
                        <strong>Mode:</strong> ${modeText}<br>
                        <strong>Details:</strong> ${app.interview.details}
                    </div>
                `;
            }

            container.innerHTML += `
                <div class="mobile-card">
                    <div class="mobile-card-header">
                        <div class="mobile-card-title">${app.job_title}</div>
                        <span class="badge ${badgeClass}">${displayStatus}</span>
                    </div>
                    <div class="vac-dept" style="margin:4px 0 6px 0; width:fit-content;">${app.department}</div>
                    <div class="mobile-card-meta">
                        <span><i class="fa-regular fa-clock"></i> Applied on: ${app.applied_at || 'Recently'}</span>
                    </div>
                    ${interviewCell}
                </div>
            `;
        });
    } catch (err) {
        console.error(err);
    }
}

// ==========================================
// 5 & 6. ADMIN APPLICATION & INTERVIEW MODULES
// ==========================================

async function loadAdminApplications() {
    try {
        const response = await fetch(API_BASE_URL + "admin/applications/", {
            method: "GET",
            headers: getFetchHeaders()
        });
        const apps = await response.json();
        
        const container = document.getElementById("admin-applications-list");
        if (!container) return;
        container.innerHTML = "";
        
        if (apps.length === 0) {
            container.innerHTML = "<p class='no-data'>No applications received yet.</p>";
            return;
        }

        apps.forEach(app => {
            let badgeClass = "badge-applied";
            if (app.status === 'shortlisted') badgeClass = "badge-shortlisted";
            if (app.status === 'approved') badgeClass = "badge-approved";
            if (app.status === 'rejected') badgeClass = "badge-rejected";
            let displayStatus = app.status ? app.status.toUpperCase() : 'APPLIED';
            if (app.status === 'approved') displayStatus = 'SELECTED';

            const initials = app.applicant_name ? app.applicant_name.charAt(0).toUpperCase() : 'A';

            // Action buttons configuration
            let actions = `
                <button class="btn-icon btn-icon-view" onclick="viewCandidateProfile('${encodeURIComponent(JSON.stringify(app))}')" title="View Profile">
                    <i class="fa-solid fa-eye"></i>
                </button>
            `;

            if (app.status === 'applied') {
                actions += `
                    <button class="btn-icon btn-icon-shortlist" onclick="handleApplicationAction(${app.id}, 'shortlist')" title="Shortlist Candidate">
                        <i class="fa-solid fa-star"></i>
                    </button>
                    <button class="btn-icon btn-icon-shortlist" onclick="openScheduleInterviewModal(${app.id})" title="Schedule Interview">
                        <i class="fa-solid fa-calendar-days"></i>
                    </button>
                    <button class="btn-icon btn-icon-approve" onclick="handleApplicationAction(${app.id}, 'approve')" title="Approve & Select Candidate">
                        <i class="fa-solid fa-user-check"></i>
                    </button>
                    <button class="btn-icon btn-icon-reject" onclick="handleApplicationAction(${app.id}, 'reject')" title="Reject Candidate">
                        <i class="fa-solid fa-user-xmark"></i>
                    </button>
                `;
            } else if (app.status === 'shortlisted') {
                actions += `
                    <button class="btn-icon btn-icon-shortlist" onclick="openScheduleInterviewModal(${app.id})" title="Schedule Interview">
                        <i class="fa-solid fa-calendar-days"></i>
                    </button>
                    <button class="btn-icon btn-icon-approve" onclick="handleApplicationAction(${app.id}, 'approve')" title="Approve & Select Candidate">
                        <i class="fa-solid fa-user-check"></i>
                    </button>
                    <button class="btn-icon btn-icon-reject" onclick="handleApplicationAction(${app.id}, 'reject')" title="Reject Candidate">
                        <i class="fa-solid fa-user-xmark"></i>
                    </button>
                `;
            }



            container.innerHTML += `
                <div class="mobile-card">
                    <div class="mobile-card-header" style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:8px;">
                        <div>
                            <div class="mobile-card-title" style="font-size:15px; font-weight:700; color:var(--text-primary); line-height:1.2;">${app.applicant_name}</div>
                            <div class="mobile-card-sub" style="font-size:12px; color:var(--text-tertiary); margin-top:3px;">${app.applicant_email}</div>
                        </div>
                        <span class="badge ${badgeClass}" style="flex-shrink:0;">${displayStatus}</span>
                    </div>

                    <div class="mobile-card-meta" style="font-size:12.5px; color:var(--text-secondary); display:flex; flex-direction:column; gap:4px; margin-bottom:8px;">
                        <div><strong>Applied For:</strong> ${app.job_title} (${app.department})</div>
                        <div><strong>Qualification:</strong> ${app.applicant_qualification || 'Not specified'}</div>
                    </div>

                    <div class="mobile-card-actions" style="display:flex; align-items:center; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.06); padding-top:10px; margin-top:8px;">
                        <span class="mobile-card-sub" style="font-size:11.5px; color:var(--text-tertiary);"><i class="fa-regular fa-clock"></i> ${app.applied_at || ''}</span>
                        <div class="btn-action-container" style="display:flex; align-items:center; gap:6px;">${actions}</div>
                    </div>
                </div>
            `;

        });
    } catch (err) {
        console.error(err);
    }
}

function viewCandidateProfile(encodedAppString) {
    const app = JSON.parse(decodeURIComponent(encodedAppString));
    const container = document.getElementById("modal-candidate-body");
    
    let resumeHTML = "<p><strong>Resume:</strong> Not Uploaded</p>";
    if (app.applicant_resume) {
        const fullResumeUrl = getMediaUrl(app.applicant_resume);
        resumeHTML = `
            <p><strong>Resume:</strong> 
                <a href="${fullResumeUrl}" target="_blank" class="btn btn-primary" style="padding: 4px 10px; font-size: 0.8rem; display:inline-flex;">
                    <i class="fa-solid fa-file-pdf"></i> Download/View Resume
                </a>
            </p>
        `;
    }


    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap: 0.8rem;">
            <p><strong>Full Name:</strong> ${app.applicant_name}</p>
            <p><strong>Email ID:</strong> ${app.applicant_email}</p>
            <p><strong>Phone:</strong> ${app.applicant_phone || 'N/A'}</p>
            <p><strong>Educational Qualifications:</strong><br><span style="white-space:pre-wrap; color:var(--text-muted);">${app.applicant_qualification || 'N/A'}</span></p>
            <p><strong>Teaching/Work Experience:</strong><br><span style="white-space:pre-wrap; color:var(--text-muted);">${app.applicant_experience || 'N/A'}</span></p>
            <p><strong>Core Skills:</strong><br><span style="white-space:pre-wrap; color:var(--text-muted);">${app.applicant_skills || 'N/A'}</span></p>
            ${resumeHTML}
            <p><strong>Applied Date:</strong> ${app.applied_at}</p>
            <p><strong>Current Application Status:</strong> <span class="badge badge-applied">${app.status}</span></p>
        </div>
    `;
    
    document.getElementById("modal-candidate-detail").classList.remove("hidden");
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add("hidden");
}

async function handleApplicationAction(applicationId, action) {
    const actionTitles = {
        shortlist: 'Shortlist Candidate',
        approve: 'Approve Candidate',
        reject: 'Reject Candidate'
    };
    showConfirmDialog(
        actionTitles[action] || 'Confirm Action',
        `Are you sure you want to ${action} this candidate application?`,
        `Yes, ${action.toUpperCase()}`,
        async function() {
            try {
                const response = await fetch(API_BASE_URL + "admin/applications/", {
                    method: "POST",
                    headers: getFetchHeaders(),
                    body: JSON.stringify({ application_id: applicationId, action: action })
                });
                const result = await response.json();
                if (response.ok) {
                    showToast(result.message, "success");
                    loadAdminApplications();
                } else {
                    showToast(result.error || "Action failed", "error");
                }
            } catch (err) {
                console.error(err);
            }
        }
    );
}

function openScheduleInterviewModal(applicationId) {
    document.getElementById("sch-app-id").value = applicationId;
    document.getElementById("modal-schedule-interview").classList.remove("hidden");
}

function toggleInterviewMode(val) {
    const label = document.getElementById("lbl-sch-details");
    const input = document.getElementById("sch-details");
    if (val === 'online') {
        label.innerText = "Video Meeting Link (Google Meet / Zoom URL)";
        input.placeholder = "https://meet.google.com/abc-defg-hij";
    } else {
        label.innerText = "Campus Classroom / Office Venue Room Number";
        input.placeholder = "Block A, Room 102";
    }
}

async function handleScheduleInterview(event) {
    event.preventDefault();
    const applicationId = document.getElementById("sch-app-id").value;
    const dateTime = document.getElementById("sch-date-time").value;
    const mode = document.getElementById("sch-mode").value;
    const details = document.getElementById("sch-details").value;

    try {
        const response = await fetch(API_BASE_URL + "admin/schedule-interview/", {
            method: "POST",
            headers: getFetchHeaders(),
            body: JSON.stringify({
                application_id: applicationId,
                date_time: dateTime,
                mode: mode,
                details: details
            })
        });
        const result = await response.json();
        if (response.ok) {
            showToast("Interview scheduled successfully!", "success");
            closeModal("modal-schedule-interview");
            document.getElementById("form-schedule-interview").reset();
            loadAdminApplications();
        } else {
            showToast(result.error || "Failed to schedule interview", "error");
        }
    } catch (err) {
        console.error(err);
    }
}

// ==========================================
// 3. JOB VACANCY MANAGEMENT (ADMIN SIDE)
// ==========================================

let adminVacanciesData = [];

function switchJobSubTab(target) {
    const btnPost = document.getElementById("subtab-btn-post");
    const btnList = document.getElementById("subtab-btn-list");
    const viewPost = document.getElementById("job-view-post");
    const viewList = document.getElementById("job-view-list");
    
    if (btnPost) btnPost.className = target === 'post' ? 'job-subtab-btn active' : 'job-subtab-btn';
    if (btnList) btnList.className = target === 'list' ? 'job-subtab-btn active' : 'job-subtab-btn';
    
    if (viewPost) {
        viewPost.style.display = target === 'post' ? 'block' : 'none';
    }
    if (viewList) {
        viewList.style.display = target === 'list' ? 'block' : 'none';
    }

    if (target === 'list') {
        loadAdminVacancies();
    }
}

async function loadAdminVacancies() {
    try {
        const response = await fetch(API_BASE_URL + "vacancies/", {
            method: "GET",
            headers: getFetchHeaders()
        });
        adminVacanciesData = await response.json();
        const container = document.getElementById("admin-vacancies-list");
        if (!container) return;
        container.innerHTML = "";
        
        if (adminVacanciesData.length === 0) {
            container.innerHTML = "<p class='no-data'>No active job openings posted yet. Click 'Create Opening' to add one.</p>";
            return;
        }

        adminVacanciesData.forEach(v => {
            container.innerHTML += `
                <div class="mobile-card" onclick="viewVacancyDetails(${v.id})" style="cursor:pointer;">
                    <div class="mobile-card-header">
                        <div>
                            <div class="mobile-card-title">${v.title}</div>
                            <div class="vac-dept" style="margin-top:4px; width:fit-content;">${v.department}</div>
                        </div>
                        <span class="badge badge-applied">Active</span>
                    </div>
                    <div class="mobile-card-meta">
                        <div><strong>Qualification:</strong> ${v.qualification_required}</div>
                        <div><strong>Experience:</strong> ${v.experience_required}</div>
                    </div>
                    <div class="mobile-card-actions" onclick="event.stopPropagation();">
                        <span class="mobile-card-sub"><i class="fa-regular fa-calendar"></i> ${v.created_at || ''}</span>
                        <div class="btn-action-container">
                            <button class="btn-icon btn-icon-view" onclick="viewVacancyDetails(${v.id})" title="View Full Details">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                            <button class="btn-icon btn-icon-shortlist" onclick="openEditVacancyModal(${v.id})" title="Edit Opening">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="btn-icon btn-icon-reject" onclick="handleDeleteVacancy(${v.id})" title="Delete Opening">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
    } catch (err) {
        console.error(err);
    }
}

function viewVacancyDetails(jobId) {
    const job = adminVacanciesData.find(v => v.id === jobId);
    if (!job) return;
    
    const body = document.getElementById("modal-view-vacancy-body");
    body.innerHTML = `
        <div class="glass-card" style="margin-bottom:12px;">
            <h2 style="font-family:'Outfit',sans-serif; font-size:18px; font-weight:700; color:var(--text-primary); margin-bottom:4px;">${job.title}</h2>
            <div class="vac-dept" style="margin-bottom:12px; display:inline-block;">${job.department}</div>
            
            <div class="profile-detail-item" style="margin-bottom:10px;">
                <label style="font-size:11px; text-transform:uppercase; color:var(--text-tertiary); font-weight:700; display:block;">Required Qualification</label>
                <div style="font-size:13.5px; color:var(--text-primary); margin-top:2px;">${job.qualification_required}</div>
            </div>
            
            <div class="profile-detail-item" style="margin-bottom:10px;">
                <label style="font-size:11px; text-transform:uppercase; color:var(--text-tertiary); font-weight:700; display:block;">Required Experience</label>
                <div style="font-size:13.5px; color:var(--text-primary); margin-top:2px;">${job.experience_required}</div>
            </div>
            
            <div class="profile-detail-item" style="margin-bottom:14px;">
                <label style="font-size:11px; text-transform:uppercase; color:var(--text-tertiary); font-weight:700; display:block;">Job Description</label>
                <div style="font-size:13px; color:var(--text-secondary); margin-top:4px; line-height:1.5; white-space:pre-wrap;">${job.description}</div>
            </div>

            <div style="display:flex; gap:10px; margin-top:16px;">
                <button class="btn btn-primary" style="flex:1;" onclick="closeModal('modal-view-vacancy'); openEditVacancyModal(${job.id});">
                    <i class="fa-solid fa-pen-to-square"></i> Edit Opening
                </button>
                <button class="btn btn-danger" style="flex:1;" onclick="closeModal('modal-view-vacancy'); handleDeleteVacancy(${job.id});">
                    <i class="fa-solid fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;
    
    document.getElementById("modal-view-vacancy").classList.remove("hidden");
}


function openEditVacancyModal(jobId) {
    const job = adminVacanciesData.find(v => v.id === jobId);
    if (!job) return;
    
    document.getElementById("edit-job-id").value = job.id;
    document.getElementById("edit-job-title").value = job.title;
    document.getElementById("edit-job-dept").value = job.department;
    document.getElementById("edit-job-qualification").value = job.qualification_required;
    document.getElementById("edit-job-experience").value = job.experience_required;
    document.getElementById("edit-job-desc").value = job.description;
    
    document.getElementById("modal-edit-vacancy").classList.remove("hidden");
}

async function handleUpdateVacancy(event) {
    event.preventDefault();
    const jobId = document.getElementById("edit-job-id").value;
    const title = document.getElementById("edit-job-title").value;
    const department = document.getElementById("edit-job-dept").value;
    const qualification = document.getElementById("edit-job-qualification").value;
    const experience = document.getElementById("edit-job-experience").value;
    const description = document.getElementById("edit-job-desc").value;

    try {
        const response = await fetch(API_BASE_URL + "vacancies/", {
            method: "PUT",
            headers: getFetchHeaders(),
            body: JSON.stringify({
                id: parseInt(jobId),
                title,
                department,
                qualification_required: qualification,
                experience_required: experience,
                description
            })
        });
        const result = await response.json();
        if (response.ok) {
            showToast("Job vacancy updated successfully!", "success");
            closeModal("modal-edit-vacancy");
            loadAdminVacancies();
        } else {
            showToast(result.error || "Update failed", "error");
        }
    } catch (err) {
        console.error(err);
    }
}

async function handlePostJob(event) {
    event.preventDefault();
    const title = document.getElementById("job-title").value;
    const department = document.getElementById("job-dept").value;
    const qualification = document.getElementById("job-qualification").value;
    const experience = document.getElementById("job-experience").value;
    const description = document.getElementById("job-desc").value;

    try {
        const response = await fetch(API_BASE_URL + "vacancies/", {
            method: "POST",
            headers: getFetchHeaders(),
            body: JSON.stringify({
                title,
                department,
                qualification_required: qualification,
                experience_required: experience,
                description
            })
        });
        const result = await response.json();
        if (response.ok) {
            showToast("Vacancy published successfully!", "success");
            document.getElementById("form-post-job").reset();
            switchJobSubTab('list');
        } else {
            showToast(result.error || "Post job failed", "error");
        }

    } catch (err) {
        console.error(err);
    }
}

async function handleDeleteVacancy(jobId) {
    showConfirmDialog(
        "Delete Job Opening",
        "Are you sure you want to delete this job vacancy posting? This action cannot be undone.",
        "Yes, Delete",
        async function() {
            try {
                const response = await fetch(`${API_BASE_URL}vacancies/?id=${jobId}`, {
                    method: "DELETE",
                    headers: getFetchHeaders()
                });
                const result = await response.json();
                if (response.ok) {
                    showToast("Vacancy deleted successfully!", "success");
                    loadAdminVacancies();
                } else {
                    showToast(result.error || "Deletion failed", "error");
                }
            } catch (err) {
                console.error(err);
            }
        }
    );
}

// ==========================================
// 7. SELECTION & NOTIFICATION MODULE
// ==========================================

async function loadNotificationsCount() {
    try {
        const response = await fetch(API_BASE_URL + "notifications/", {
            method: "GET",
            headers: getFetchHeaders()
        });
        allNotifications = await response.json();
        
        const unreadCount = allNotifications.filter(n => !n.is_read).length;
        const countBadge = document.getElementById("notif-count");
        
        countBadge.innerText = unreadCount;
        if (unreadCount === 0) {
            countBadge.style.display = "none";
        } else {
            countBadge.style.display = "flex";
        }
    } catch (err) {
        console.error("Notifications fetch error", err);
    }
}

function toggleNotificationsView() {
    const panel = document.getElementById("notif-dropdown");
    panel.classList.toggle("hidden");
    
    if (!panel.classList.contains("hidden")) {
        renderNotificationsList();
    }
}

function renderNotificationsList() {
    const container = document.getElementById("notif-list-container");
    container.innerHTML = "";
    
    if (allNotifications.length === 0) {
        container.innerHTML = "<p class='no-data'>No notifications</p>";
        return;
    }
    
    allNotifications.forEach(notif => {
        const unreadClass = notif.is_read ? "" : "unread";
        container.innerHTML += `
            <div class="notif-item ${unreadClass}">
                <div class="notif-title">${notif.title}</div>
                <div class="notif-desc">${notif.message}</div>
                <span class="notif-date">${notif.created_at}</span>
            </div>
        `;
    });
}

async function markNotificationsAsRead() {
    try {
        const response = await fetch(API_BASE_URL + "notifications/", {
            method: "POST",
            headers: getFetchHeaders()
        });
        if (response.ok) {
            loadNotificationsCount();
            renderNotificationsList();
        }
    } catch (err) {
        console.error(err);
    }
}

// =style helpers to close dropdown on click outside
window.addEventListener("click", (e) => {
    const badgeWrapper = document.querySelector(".notification-badge-wrapper");
    const dropdown = document.getElementById("notif-dropdown");
    if (dropdown && !dropdown.classList.contains("hidden") && 
        !badgeWrapper.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add("hidden");
    }
});

// ==========================================
// 8. ADMIN DASHBOARD & REPORTS MODULE
// ==========================================

async function loadAdminStats() {
    try {
        const response = await fetch(API_BASE_URL + "admin/stats/", {
            method: "GET",
            headers: getFetchHeaders()
        });
        const stats = await response.json();
        
        if (response.ok) {
            document.getElementById("stat-vacancies").innerText = stats.total_vacancies;
            document.getElementById("stat-applications").innerText = stats.total_applications;
            document.getElementById("stat-shortlisted").innerText = stats.total_shortlisted;
            document.getElementById("stat-selected").innerText = stats.total_selected;
        }
    } catch (err) {
        console.error(err);
    }
}

async function loadRecruitmentReports() {
    try {
        const response = await fetch(API_BASE_URL + "admin/applications/", {
            method: "GET",
            headers: getFetchHeaders()
        });
        const apps = await response.json();
        
        const cardsContainer = document.getElementById("report-cards-list");
        const tableBody = document.getElementById("report-table-body");
        if (cardsContainer) cardsContainer.innerHTML = "";
        if (tableBody) tableBody.innerHTML = "";
        
        const reportDateEl = document.getElementById("report-date-time");
        if (reportDateEl) reportDateEl.innerText = "Generated on: " + new Date().toLocaleString();
        
        // Filter out SELECTED (approved) candidates
        const selectedApps = apps.filter(app => app.status === 'approved');
        
        if (selectedApps.length === 0) {
            const emptyMsg = "<p class='no-data'>No candidates have been finalized/selected yet.</p>";
            if (cardsContainer) cardsContainer.innerHTML = emptyMsg;
            if (tableBody) tableBody.innerHTML = "<tr><td colspan='6' class='no-data' style='text-align:center;'>No candidates selected.</td></tr>";
            return;
        }
        
        selectedApps.forEach((app, index) => {
            const initials = app.applicant_name ? app.applicant_name.charAt(0).toUpperCase() : 'S';

            // Mobile Cards View (Screen)
            if (cardsContainer) {
                cardsContainer.innerHTML += `
                    <div class="mobile-card">
                        <div class="mobile-card-header">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div class="header-avatar" style="width:36px; height:36px; font-size:13px; flex-shrink:0;">${initials}</div>
                                <div>
                                    <div class="mobile-card-title">${app.applicant_name}</div>
                                    <div class="mobile-card-sub">${app.applicant_email} • ${app.applicant_phone || 'N/A'}</div>
                                </div>
                            </div>
                            <span class="badge badge-approved">Selected</span>
                        </div>
                        <div class="mobile-card-meta" style="margin-top:6px;">
                            <div><strong>Selected For:</strong> ${app.job_title} (${app.department})</div>
                            <div><strong>Qualification:</strong> ${app.applicant_qualification || 'N/A'}</div>
                        </div>
                    </div>
                `;
            }

            // Table View (For PDF Printing)
            if (tableBody) {
                tableBody.innerHTML += `
                    <tr>
                        <td>${index + 1}</td>
                        <td><strong>${app.applicant_name}</strong></td>
                        <td>${app.job_title} (${app.department})</td>
                        <td>
                            Email: ${app.applicant_email}<br>
                            Phone: ${app.applicant_phone || 'N/A'}
                        </td>
                        <td>${app.applicant_qualification || 'N/A'}</td>
                        <td><span class="badge badge-approved">Selected</span></td>
                    </tr>
                `;
            }
        });
    } catch (err) {
        console.error(err);
    }
}


// ==========================================
// NATIVE MOBILE UI ENHANCEMENTS
// ==========================================

// -- Toast Notifications --
function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toast-container');
    if (!container) return;
    var icons = { success:'fa-circle-check', error:'fa-circle-xmark', info:'fa-circle-info', warning:'fa-triangle-exclamation' };
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<i class=\"fa-solid ' + (icons[type] || icons.info) + '\"></i><span>' + message + '</span>';
    container.appendChild(toast);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ toast.classList.add('show'); }); });
    setTimeout(function(){ toast.classList.remove('show'); setTimeout(function(){ toast.remove(); }, 320); }, 3200);
}

// Global safety override: Replace native browser alert popup with App Toast banner
window.alert = function(msg) {
    showToast(msg, 'success');
};

// Native Mobile Confirm Dialog Helper
function showConfirmDialog(title, message, btnText, onConfirmCallback) {
    var titleEl = document.getElementById("confirm-modal-title");
    var msgEl = document.getElementById("confirm-modal-message");
    var yesBtn = document.getElementById("confirm-modal-btn-yes");
    var modal = document.getElementById("modal-confirm-action");

    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;
    if (yesBtn) {
        yesBtn.innerText = btnText || "Yes, Proceed";
        yesBtn.onclick = function() {
            closeModal("modal-confirm-action");
            if (onConfirmCallback) onConfirmCallback();
        };
    }
    if (modal) modal.classList.remove("hidden");
}

// Global safety override: Prevent browser confirm popups
window.confirm = function(msg) {
    return true;
};

// -- Ripple Touch Effect --
document.addEventListener('pointerdown', function(e) {
    var el = e.target.closest('.btn, .auth-btn, .nav-item, .btn-icon, .vacancy-card');
    if (!el) return;
    var ripple = document.createElement('span');
    ripple.className = 'ripple';
    var rect = el.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height) * 2;
    ripple.style.cssText = 'width:'+size+'px;height:'+size+'px;left:'+(e.clientX-rect.left-size/2)+'px;top:'+(e.clientY-rect.top-size/2)+'px;';
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.style.overflow = 'hidden';
    el.appendChild(ripple);
    setTimeout(function(){ ripple.remove(); }, 580);
});

// -- Avatar Initials --
function updateHeaderAvatar(user) {
    var el = document.getElementById('header-avatar');
    if (!el || !user) return;
    if (user.role === 'admin') {
        el.textContent = 'A';
    } else {
        var str = user.full_name || user.email || 'F';
        el.textContent = str.charAt(0).toUpperCase();
    }
}

// -- Patch setupPortalAccess --
var _origSetupPortal = setupPortalAccess;
setupPortalAccess = function() {
    _origSetupPortal.apply(this, arguments);
    if (currentUser) updateHeaderAvatar(currentUser);
    setTimeout(function(){
        document.querySelectorAll('.bottom-nav .nav-section').forEach(function(sec){
            if (sec.style.display && sec.style.display !== 'none') sec.style.display = 'flex';
        });
    }, 20);
};

