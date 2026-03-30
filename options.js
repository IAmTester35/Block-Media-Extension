const MEDIA_GROUPS = {
  raster: {
    title: "Raster Images",
    formats: ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico", "tiff", "cur"]
  },
  vector: {
    title: "Vector Graphics",
    formats: ["svg", "svgz"]
  },
  audio: {
    title: "Audio Files",
    formats: ["mp3", "wav", "ogg", "m4a", "aac", "flac", "wma"]
  },
  video: {
    title: "Video Content",
    formats: ["mp4", "mkv", "mov", "avi", "wmv", "flv", "webm", "m3u8", "ts"]
  }
};

let config = {
  mode: 'whitelist',
  domains: [],
  enabledFormats: {} // Will store { "png": true, "jpg": false, ... }
};

// Initialize enabledFormats with all true if not present
Object.values(MEDIA_GROUPS).forEach(group => {
  group.formats.forEach(fmt => config.enabledFormats[fmt] = true);
});

const modeCards = document.querySelectorAll('.mode-card');
const domainInput = document.getElementById('domain-input');
const addBtn = document.getElementById('add-btn');
const domainList = document.getElementById('domain-list');
const typesContainer = document.getElementById('types-container');
const statusToast = document.getElementById('status');

// Load stored settings
chrome.storage.local.get(['blockConfig'], (result) => {
  if (result.blockConfig) {
    config = { ...config, ...result.blockConfig };
  }
  renderMediaGroups();
  updateUI();
});

function renderMediaGroups() {
  typesContainer.innerHTML = '';
  
  Object.keys(MEDIA_GROUPS).forEach(groupId => {
    const group = MEDIA_GROUPS[groupId];
    const item = document.createElement('div');
    item.className = 'type-item';
    
    // Check if ALL formats in this group are enabled
    const allEnabled = group.formats.every(fmt => config.enabledFormats[fmt]);
    
    item.innerHTML = `
      <div class="type-main">
        <div class="type-info">
          <h4>${group.title}</h4>
          <p>${group.formats.slice(0, 5).join(', ').toUpperCase()}...</p>
        </div>
        <div style="display: flex; align-items: center; gap: 16px;">
          <label class="switch">
            <input type="checkbox" class="group-toggle" data-group="${groupId}" ${allEnabled ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
          <span class="expand-icon">▼</span>
        </div>
      </div>
      <div class="formats-list">
        ${group.formats.map(fmt => `
          <div class="format-tag ${config.enabledFormats[fmt] ? 'active' : ''}" data-fmt="${fmt}">
            <input type="checkbox" class="format-checkbox" ${config.enabledFormats[fmt] ? 'checked' : ''}>
            <span>${fmt.toUpperCase()}</span>
          </div>
        `).join('')}
      </div>
    `;

    // Toggle expansion
    const typeMain = item.querySelector('.type-main');
    typeMain.addEventListener('click', (e) => {
      if (e.target.closest('.switch')) return;
      item.classList.toggle('expanded');
    });

    // Group toggle (All ON/OFF)
    const groupToggle = item.querySelector('.group-toggle');
    groupToggle.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      group.formats.forEach(fmt => {
        config.enabledFormats[fmt] = isChecked;
      });
      renderMediaGroups(); // Re-render to update tags
      saveConfig();
    });

    // Individual format tags
    item.querySelectorAll('.format-tag').forEach(tag => {
      tag.addEventListener('click', (e) => {
        e.stopPropagation();
        const fmt = tag.dataset.fmt;
        config.enabledFormats[fmt] = !config.enabledFormats[fmt];
        saveConfig();
        renderMediaGroups();
      });
    });

    typesContainer.appendChild(item);
  });
}

// Mode Selection
modeCards.forEach(card => {
  card.addEventListener('click', () => {
    config.mode = card.dataset.mode;
    saveConfig();
    updateUI();
  });
});

// Domain Management
addBtn.addEventListener('click', () => {
  const input = domainInput.value.trim();
  const domain = normalizeDomain(input);
  if (domain && !config.domains.includes(domain)) {
    config.domains.push(domain);
    domainInput.value = '';
    saveConfig();
    updateUI();
  }
});

function removeDomain(domain) {
  config.domains = config.domains.filter(d => d !== domain);
  saveConfig();
  updateUI();
}

function normalizeDomain(url) {
  if (!url) return null;
  try {
    let target = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) target = 'https://' + url;
    const urlObj = new URL(target);
    let host = urlObj.hostname;
    if (host.startsWith('www.')) host = host.substring(4);
    return host;
  } catch (e) {
    const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^/?#:]+)/i);
    return match ? match[1].toLowerCase() : null;
  }
}

function saveConfig() {
  chrome.storage.local.set({ blockConfig: config }, () => {
    showStatus();
  });
}

function showStatus() {
  statusToast.classList.add('visible');
  setTimeout(() => statusToast.classList.remove('visible'), 2000);
}

function updateUI() {
  modeCards.forEach(card => {
    card.classList.toggle('active', card.dataset.mode === config.mode);
  });

  domainList.innerHTML = '';
  config.domains.forEach(domain => {
    const item = document.createElement('div');
    item.className = 'domain-item';
    item.innerHTML = `<span>${domain}</span><button class="remove-btn">&times;</button>`;
    item.querySelector('.remove-btn').addEventListener('click', () => removeDomain(domain));
    domainList.appendChild(item);
  });
}
