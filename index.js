/**
 * BlockMedia Extension - Background Service Worker
 * Supporting per-format granular blocking
 */

const STATIC_RULESET_ID = "ruleset_1";

// Mapping each extension to its resource type for DNR
const EXTENSION_TO_RESOURCE_TYPE = {
  // Raster
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", 
  avif: "image", bmp: "image", ico: "image", tiff: "image", cur: "image",
  // Vector
  svg: "image", svgz: "image",
  // Audio
  mp3: "media", wav: "media", ogg: "media", m4a: "media", aac: "media", flac: "media", wma: "media",
  // Video
  mp4: "media", mkv: "media", mov: "media", avi: "media", wmv: "media", 
  flv: "media", webm: "media", m3u8: "media", ts: "media"
};

chrome.runtime.onInstalled.addListener(() => initializeRules());
chrome.runtime.onStartup.addListener(() => initializeRules());

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.blockConfig) {
    applyRules(changes.blockConfig.newValue);
  }
});

async function initializeRules() {
  const result = await chrome.storage.local.get(['blockConfig']);
  
  // Default fallback if no config exists yet
  const defaultConfig = { 
    mode: 'whitelist', 
    domains: [], 
    enabledFormats: {} 
  };
  
  // Populate all extensions as TRUE by default if not set
  Object.keys(EXTENSION_TO_RESOURCE_TYPE).forEach(ext => {
    defaultConfig.enabledFormats[ext] = true;
  });

  const config = result.blockConfig ? { ...defaultConfig, ...result.blockConfig } : defaultConfig;
  applyRules(config);
}

async function applyRules(config) {
  const { mode = 'whitelist', domains = [], enabledFormats = {} } = config;
  
  console.log(`Applying granular rules for mode: ${mode}`);

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingRuleIds = existingRules.map(rule => rule.id);
  
  await chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: [STATIC_RULESET_ID] });

  // Safety check: Ensure enabledFormats is an object before calling Object.keys
  const formatsToBlock = Object.keys(enabledFormats || {}).filter(fmt => enabledFormats[fmt]);


  if (formatsToBlock.length === 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingRuleIds });
    return;
  }

  const newRules = [];
  let ruleIdCounter = 1;

  formatsToBlock.forEach(ext => {
    const resourceType = EXTENSION_TO_RESOURCE_TYPE[ext] || "other";
    
    const rule = {
      id: ruleIdCounter++,
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter: `*/*.${ext}*`,
        resourceTypes: [resourceType, "other"],
        isUrlFilterCaseSensitive: false
      }
    };

    if (mode === 'whitelist' && domains.length > 0) {
      rule.condition.excludedInitiatorDomains = domains;
    } else if (mode === 'blacklist' && domains.length > 0) {
      rule.condition.initiatorDomains = domains;
    } else if (mode === 'blacklist' && domains.length === 0) {
      return; // Skip adding the rule
    }

    newRules.push(rule);
  });

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds,
      addRules: newRules
    });
    console.log(`Successfully applied ${newRules.length} granular rules.`);
  } catch (error) {
    console.error("Error applying granular rules:", error);
  }
}
