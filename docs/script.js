const REPO_OWNER = 'rolexf-panel';  // GANTI INI
const REPO_NAME = 'firmware-db';
const DATA_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/data/firmwares.json`;

let allData = { groups: [], firmwares: [] };
let currentGroup = 'all';
let currentAlpha = 'all';

// DOM Elements
const listEl = document.getElementById('firmware-list');
const emptyEl = document.getElementById('empty-state');
const searchEl = document.getElementById('search');
const countEl = document.getElementById('total-count');
const syncEl = document.getElementById('last-sync');
const groupListEl = document.getElementById('group-list');
const alphaListEl = document.getElementById('alpha-list');
const activeFilterEl = document.querySelector('#active-filter span');
const statTotalEl = document.getElementById('stat-total');
const statGroupsEl = document.getElementById('stat-groups');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupEventListeners();
});

function setupEventListeners() {
    searchEl.addEventListener('input', (e) => {
        renderList();
    });
    
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            searchEl.focus();
        }
    });
}

async function loadData() {
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error('Failed to fetch');
        
        allData = await response.json();
        
        // Ensure arrays exist
        if (!allData.groups) allData.groups = [];
        if (!allData.firmwares) allData.firmwares = [];
        
        // Update stats
        countEl.textContent = `${allData.firmwares.length} files`;
        statTotalEl.textContent = allData.firmwares.length;
        statGroupsEl.textContent = allData.groups.length;
        
        syncEl.textContent = new Date(allData.last_updated).toLocaleString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        renderGroups();
        renderAlphaNav();
        renderList();
        
    } catch (err) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠</div>
                <p>gagal memuat database</p>
                <p style="font-size: 12px; margin-top: 8px; color: var(--text-muted)">${err.message}</p>
            </div>
        `;
    }
}

function renderGroups() {
    // Sort groups by sort_order
    const sortedGroups = [...allData.groups].sort((a, b) => 
        (a.sort_order || 0) - (b.sort_order || 0)
    );
    
    // Count firmware per group
    const groupCounts = {};
    allData.firmwares.forEach(fw => {
        const gid = fw.group_id || 'uncategorized';
        groupCounts[gid] = (groupCounts[gid] || 0) + 1;
    });
    
    // Add uncategorized count
    const uncategorizedCount = groupCounts['uncategorized'] || 0;
    
    let html = `<li><button class="group-btn ${currentGroup === 'all' ? 'active' : ''}" data-group="all">All Devices <span class="group-count">${allData.firmwares.length}</span></button></li>`;
    
    sortedGroups.forEach(g => {
        const count = groupCounts[g.id] || 0;
        html += `
            <li>
                <button class="group-btn ${currentGroup === g.id ? 'active' : ''}" data-group="${g.id}">
                    ${escapeHtml(g.name)}
                    <span class="group-count">${count}</span>
                </button>
            </li>
        `;
    });
    
    if (uncategorizedCount > 0) {
        html += `
            <li>
                <button class="group-btn ${currentGroup === 'uncategorized' ? 'active' : ''}" data-group="uncategorized">
                    Uncategorized
                    <span class="group-count">${uncategorizedCount}</span>
                </button>
            </li>
        `;
    }
    
    groupListEl.innerHTML = html;
    
    // Add click handlers
    groupListEl.querySelectorAll('.group-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentGroup = btn.dataset.group;
            currentAlpha = 'all';
            
            // Update UI
            groupListEl.querySelectorAll('.group-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Reset alpha nav
            alphaListEl.querySelectorAll('.alpha-btn').forEach(b => b.classList.remove('active'));
            alphaListEl.querySelector('[data-alpha="all"]').classList.add('active');
            
            updateActiveFilter();
            renderList();
        });
    });
}

function renderAlphaNav() {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
    
    let html = `<button class="alpha-btn ${currentAlpha === 'all' ? 'active' : ''}" data-alpha="all">#</button>`;
    
    alphabet.forEach(letter => {
        // Check if any firmware starts with this letter
        const hasFirmware = allData.firmwares.some(fw => 
            fw.nama.toLowerCase().startsWith(letter)
        );
        
        html += `
            <button class="alpha-btn ${currentAlpha === letter ? 'active' : ''}" 
                    data-alpha="${letter}"
                    ${!hasFirmware ? 'disabled' : ''}>
                ${letter}
            </button>
        `;
    });
    
    alphaListEl.innerHTML = html;
    
    // Add click handlers
    alphaListEl.querySelectorAll('.alpha-btn').forEach(btn => {
        if (btn.disabled) return;
        
        btn.addEventListener('click', () => {
            currentAlpha = btn.dataset.alpha;
            
            alphaListEl.querySelectorAll('.alpha-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            updateActiveFilter();
            renderList();
        });
    });
}

function updateActiveFilter() {
    let text = '';
    
    if (currentGroup === 'all' && currentAlpha === 'all') {
        text = 'all devices';
    } else if (currentGroup !== 'all' && currentAlpha === 'all') {
        const group = allData.groups.find(g => g.id === currentGroup);
        text = group ? group.name.toLowerCase() : currentGroup;
    } else if (currentGroup === 'all' && currentAlpha !== 'all') {
        text = `letter "${currentAlpha.toUpperCase()}"`;
    } else {
        const group = allData.groups.find(g => g.id === currentGroup);
        text = `${group ? group.name.toLowerCase() : currentGroup} + "${currentAlpha.toUpperCase()}"`;
    }
    
    activeFilterEl.textContent = text;
}

function renderList() {
    const searchTerm = searchEl.value.toLowerCase().trim();
    
    // Filter firmwares
    let filtered = allData.firmwares;
    
    // By group
    if (currentGroup !== 'all') {
        if (currentGroup === 'uncategorized') {
            filtered = filtered.filter(fw => !fw.group_id);
        } else {
            filtered = filtered.filter(fw => fw.group_id === currentGroup);
        }
    }
    
    // By search
    if (searchTerm) {
        filtered = filtered.filter(fw => 
            fw.nama.toLowerCase().includes(searchTerm) ||
            fw.id.toLowerCase().includes(searchTerm)
        );
    }
    
    // By alpha
    if (currentAlpha !== 'all') {
        filtered = filtered.filter(fw => 
            fw.nama.toLowerCase().startsWith(currentAlpha)
        );
    }
    
    if (filtered.length === 0) {
        listEl.innerHTML = '';
        emptyEl.classList.remove('hidden');
        return;
    }
    
    emptyEl.classList.add('hidden');
    
    // Sort by name
    filtered.sort((a, b) => a.nama.localeCompare(b.nama));
    
    // Group by first letter if showing all or alpha filter
    let html = '';
    
    if (currentAlpha === 'all' && !searchTerm) {
        // Group by first letter
        const grouped = {};
        filtered.forEach(fw => {
            const firstLetter = fw.nama[0].toUpperCase();
            if (!grouped[firstLetter]) grouped[firstLetter] = [];
            grouped[firstLetter].push(fw);
        });
        
        Object.keys(grouped).sort().forEach(letter => {
            html += `<div class="letter-section">`;
            html += `<div class="letter-header">${letter}</div>`;
            html += renderFirmwareCards(grouped[letter]);
            html += `</div>`;
        });
    } else {
        // Flat list
        html += renderFirmwareCards(filtered);
    }
    
    listEl.innerHTML = html;
}

function renderFirmwareCards(firmwares) {
    return firmwares.map(fw => {
        const group = allData.groups.find(g => g.id === fw.group_id);
        const groupTag = group ? `<span class="fw-group-tag">${escapeHtml(group.name)}</span>` : '';
        const uncategorizedClass = !fw.group_id ? 'uncategorized' : '';
        
        return `
            <article class="fw-card ${uncategorizedClass}">
                <div class="fw-header">
                    <div class="fw-title-group">
                        <h3 class="fw-name">${escapeHtml(fw.nama)}</h3>
                        <span class="fw-id">${escapeHtml(fw.id)}</span>
                        ${groupTag}
                    </div>
                    <time class="fw-date">${formatDate(fw.date)}</time>
                </div>
                <div class="fw-links">
                    <a href="${escapeHtml(fw.links.utama)}" target="_blank" rel="noopener" class="fw-link primary">
                        <span class="link-icon">↓</span>
                        <span>download</span>
                    </a>
                    ${fw.links.gofile ? `
                    <a href="${escapeHtml(fw.links.gofile)}" target="_blank" rel="noopener" class="fw-link">
                        <span class="link-icon">↗</span>
                        <span>gofile</span>
                    </a>
                    ` : ''}
                    ${fw.links.pixeldrain ? `
                    <a href="${escapeHtml(fw.links.pixeldrain)}" target="_blank" rel="noopener" class="fw-link">
                        <span class="link-icon">↗</span>
                        <span>pixeldrain</span>
                    </a>
                    ` : ''}
                </div>
            </article>
        `;
    }).join('');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = (now - date) / 1000;
    
    if (diff < 3600) return 'baru saja';
    if (diff < 86400) return `${Math.floor(diff / 3600)}j lalu`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}h lalu`;
    
    return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short'
    });
}

// Refresh every 5 minutes
setInterval(loadData, 300000);
