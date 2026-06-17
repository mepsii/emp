// WMP Skin JScript Execution Sandbox & Data Binding Engine

function executeScriptWithContext(code, contextViewWrapper) {
  const oldView = window.view;
  if (contextViewWrapper) {
    currentContextView = contextViewWrapper;
  }
  try {
    executeScript(code);
  } finally {
    currentContextView = oldView;
  }
}

// Execute JScript/JS events (e.g. from attributes)
function executeScript(scriptStr) {
  let cleanCode = scriptStr.trim();
  if (cleanCode.toLowerCase().startsWith('jscript:')) {
    cleanCode = cleanCode.substring(8);
  } else if (cleanCode.toLowerCase().startsWith('javascript:')) {
    cleanCode = cleanCode.substring(11);
  }

  try {
    // Run in global scope
    window.eval(cleanCode);
  } catch (e) {
    console.error('Error executing skin expression:', cleanCode, e);
  }
}

// Load external JScripts associated with view
async function loadSkinScripts(viewNode) {
  const scriptFilesAttr = viewNode.getAttribute('scriptFile') || viewNode.getAttribute('scriptfile') || '';
  const scriptFiles = scriptFilesAttr.split(';').map(s => s.trim()).filter(s => s && !s.startsWith('res://'));

  for (let scriptName of scriptFiles) {
    if (loadedScripts.has(scriptName)) continue;
    loadedScripts.add(scriptName);
    const code = await window.electronAPI.readSkinTextFile(scriptName);
    if (code) {
      try {
        // Evaluate code in global window scope
        window.eval(code);
        console.log(`Executed skin script: ${scriptName}`);
      } catch (e) {
        console.error(`Error executing script ${scriptName}:`, e);
      }
    }
  }
}

// Data bindings lookup frame loop
function updateBindingsLoop() {
  for (const binding of activeBindings) {
    const val = resolveWmpProp(binding.propPath);
    if (val !== undefined && val !== binding.lastValue) {
      binding.lastValue = val;
      binding.updateFn(val);
    }
  }
  animationFrameId = requestAnimationFrame(updateBindingsLoop);
}

function resolveWmpProp(path) {
  // Resolve string path like "player.settings.volume"
  // Normalize variations of currentMedia and player controls casing
  const cleanPath = path
    .replace(/player\./gi, 'window.player.')
    .replace(/view\./gi, 'window.view.')
    .replace(/theme\./gi, 'window.theme.')
    .replace(/\.currentmedia/gi, '.currentMedia')
    .replace(/\.controls/gi, '.controls')
    .replace(/\.settings/gi, '.settings')
    .replace(/\.duration/gi, '.duration')
    .replace(/\.currentposition/gi, '.currentPosition');
    
  try {
    return (new Function(`return ${cleanPath}`))();
  } catch (e) {
    return undefined;
  }
}
