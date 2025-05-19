let go; // Go WASM instance - now primarily for main thread if any direct calls were kept, otherwise deprecated by worker
let recipe = [];
let wasmReady = false; // Tracks main thread WASM readiness (if still used)
let wasmFunctions = {}; // WASM functions available on the main thread (if any, deprecated by worker)
let cyberChefWorker; // The Web Worker instance
let deferredInstallPrompt = null;
let draggedItem = null; // Variable to store the dragged item

// Function to show the install button
function showInstallButton() {
    const installButton = document.getElementById('installAppButton');
    if (installButton) {
        installButton.style.display = 'block';
        installButton.onclick = () => {
            if (deferredInstallPrompt) {
                deferredInstallPrompt.prompt();
                deferredInstallPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        console.log('User accepted the A2HS prompt');
                        installButton.style.display = 'none'; // Hide button after install
                    } else {
                        console.log('User dismissed the A2HS prompt');
                    }
                    deferredInstallPrompt = null;
                });
            }
        };
    }
}

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredInstallPrompt = e;
    // Update UI notify the user they can install the PWA
    showInstallButton();
    console.log("'beforeinstallprompt' event fired.");
});

window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    const installButton = document.getElementById('installAppButton');
    if (installButton) {
        installButton.style.display = 'none';
    }
    deferredInstallPrompt = null; // Clear the deferred prompt
});

async function initMainWasmAndWorker() {
    const statusEl = document.getElementById('wasmStatus');
    const errorEl = document.getElementById('errorDisplay');
    const bakeBtn = document.getElementById('bakeButton');
    
    if (!statusEl || !errorEl || !bakeBtn) {
        console.error("DOM elements for status/error display or bake button not found during init. Retrying after DOMContentLoaded.");
        return;
    }
    bakeBtn.disabled = true;
    statusEl.textContent = 'Initializing Worker & WASM...';
    errorEl.textContent = '';

    // Initialize Web Worker
    if (window.Worker) {
        cyberChefWorker = new Worker('js_worker.js');
        cyberChefWorker.onmessage = function(e) {
            const { type, ...data } = e.data;
            switch (type) {
                case 'wasmWorkerInitialized':
                    wasmReady = true; // Consider app ready when worker confirms WASM init
                    statusEl.textContent = 'Worker & WASM Ready.';
                    bakeBtn.disabled = false;
                    console.log("Main: Worker reported WASM initialized. Available functions in worker:", data.availableFunctions);
                    // Optionally, store available functions if needed for main thread validation, though worker handles execution
                    break;
                case 'wasmWorkerError':
                    wasmReady = false;
                    statusEl.textContent = 'Worker WASM Error.';
                    errorEl.textContent = "Worker Error: " + data.error;
                    bakeBtn.disabled = true;
                    console.error("Main: Worker reported WASM error:", data.error);
                    break;
                case 'finalOutput':
                    document.getElementById('outputTextArea').value = data.data;
                    bakeBtn.disabled = false;
                    break;
                case 'error':
                    document.getElementById('outputTextArea').value = "Worker Error: " + data.message;
                    errorEl.textContent = "Worker Processing Error: " + data.message;
                    bakeBtn.disabled = false; // Re-enable bake button on error
                    // Ensure loop progress is hidden on error
                    document.getElementById('loopStatusContainer').style.display = 'none';
                    document.getElementById('loopProgressBarInner').style.width = '0%';
                    break;
                case 'processingTimeUpdate':
                    document.getElementById('processingTime').textContent = `Processing time (worker): ${data.time} ms`;
                    break;
                case 'loopProgressUpdate':
                    const loopStatusContainer = document.getElementById('loopStatusContainer');
                    const loopStatusMessage = document.getElementById('loopStatusMessage');
                    const loopProgressBarInner = document.getElementById('loopProgressBarInner');
                    if (data.identifier && data.totalIterations > 0) {
                        loopStatusContainer.style.display = 'block';
                        loopStatusMessage.textContent = `Processing Loop '${data.identifier}' - Iteration ${data.currentIteration} of ${data.totalIterations}`;
                        loopProgressBarInner.style.width = `${(data.currentIteration / data.totalIterations) * 100}%`;
                    } else { // Used to reset/hide the progress bar
                        loopStatusContainer.style.display = 'none';
                        loopProgressBarInner.style.width = '0%';
                    }
                    break;
                case 'processingStep': // For generic messages from worker
                    // Could update a general status or log
                    console.log("Worker says:", data.message);
                    break;
                case 'log': // For debugging messages from worker
                    console.log("Worker Log:", data.message);
                    break;
                default:
                    console.warn("Main: Unknown message type from worker:", type, data);
            }
        };

        cyberChefWorker.onerror = function(error) {
            console.error("Main: Error in Web Worker:", error.message, error);
            statusEl.textContent = 'Worker Initialization Failed!';
            errorEl.textContent = "Critical Worker Error: " + error.message;
            wasmReady = false;
            bakeBtn.disabled = true;
        };

        // Send init message to worker to load WASM
        cyberChefWorker.postMessage({ type: 'init' });


    } else {
        console.error("Web Workers not supported in this browser.");
        statusEl.textContent = 'Error!';
        errorEl.textContent = 'Web Workers are not supported. This application requires a modern browser.';
        bakeBtn.disabled = true;
    }
}

// The old initWasm function is no longer directly called on page load for WASM init.
// Its relevant parts for checking globalThis.goEncodeBase64 etc. are now in the worker.
// If any main-thread WASM operations were intended, that logic would need to be re-evaluated.

function addProcessingOperation(opName, opFuncKey) {
    const errorEl = document.getElementById('errorDisplay');
    errorEl.textContent = ''; // Clear previous errors

    if (!wasmReady) { // wasmReady now refers to worker readiness
        errorEl.textContent = "Worker or WASM not ready. Cannot add operation.";
        console.warn("Attempted to add operation while WASM not ready.");
        return;
    }

    recipe.push({ type: 'process', name: opName, funcKey: opFuncKey, opIterations: 1 });
    renderRecipe();
}

function promptAddLoopStart() {
    const errorEl = document.getElementById('errorDisplay');
    errorEl.textContent = ''; // Clear previous errors
    const identifier = prompt("Enter Loop Identifier (e.g., A, Loop1):");
    if (!identifier || identifier.trim() === "") {
        errorEl.textContent = "Loop identifier cannot be empty.";
        return;
    }
    const iterationsStr = prompt("Enter number of loop iterations:", "2");
    const loopIterations = parseInt(iterationsStr, 10);
    if (isNaN(loopIterations) || loopIterations < 1) {
        errorEl.textContent = "Invalid number of iterations. Must be 1 or greater.";
        alert("Invalid number of iterations. Must be 1 or greater.");
        return;
    }
    recipe.push({ type: 'loopStart', identifier: identifier.trim(), loopIterations: loopIterations, name: `Loop Start: ${identifier.trim()} (${loopIterations}x)` });
    renderRecipe();
}

function promptAddLoopEnd() {
    const errorEl = document.getElementById('errorDisplay');
    errorEl.textContent = ''; // Clear previous errors
    const identifier = prompt("Enter Loop Identifier to End (e.g., A, Loop1):");
    if (!identifier || identifier.trim() === "") {
        errorEl.textContent = "Loop identifier cannot be empty.";
        return;
    }
    recipe.push({ type: 'loopEnd', identifier: identifier.trim(), name: `Loop End: ${identifier.trim()}` });
    renderRecipe();
}

function removeOperationFromRecipe(index) {
    recipe.splice(index, 1);
    renderRecipe();
}

function renderRecipe() {
    const recipeContainer = document.getElementById('recipeContainer');
    if (!recipeContainer) return;
    recipeContainer.innerHTML = ''; // Clear current recipe
    recipe.forEach((item, index) => {
        const div = document.createElement('div');
        div.classList.add('recipe-item');
        div.setAttribute('draggable', true); // Make recipe items draggable
        div.setAttribute('data-index', index); // Store index for reordering

        div.addEventListener('dragstart', handleDragStartRecipeItem);
        div.addEventListener('dragend', handleDragEnd);
        div.addEventListener('dragover', handleDragOver);
        div.addEventListener('drop', handleDropOnRecipeItem);
        div.addEventListener('dragleave', handleDragLeave);

        const opNameSpan = document.createElement('span');
        opNameSpan.classList.add('recipe-item-name'); // Added class for styling

        if (item.type === 'loopStart') {
            div.classList.add('loop-start');
            opNameSpan.textContent = `${index + 1}. Loop Start: `;

            const idInput = document.createElement('input');
            idInput.type = 'text';
            idInput.value = item.identifier;
            idInput.title = "Loop Identifier";
            idInput.classList.add('recipe-loop-input');
            idInput.onchange = (event) => {
                const newId = event.target.value.trim();
                if (newId) {
                    recipe[index].identifier = newId;
                    recipe[index].name = `Loop Start: ${newId} (${recipe[index].loopIterations}x)`;
                    renderRecipe(); // Re-render to update names and potentially other dependent items
                } else {
                    event.target.value = recipe[index].identifier; // revert if empty
                    alert("Loop identifier cannot be empty.");
                }
            };

            const iterInput = document.createElement('input');
            iterInput.type = 'number';
            iterInput.value = item.loopIterations;
            iterInput.min = 1;
            iterInput.title = "Number of loop iterations";
            iterInput.classList.add('recipe-loop-input');
            iterInput.onchange = (event) => {
                const newIterations = parseInt(event.target.value, 10);
                if (newIterations && newIterations > 0) {
                    recipe[index].loopIterations = newIterations;
                    recipe[index].name = `Loop Start: ${recipe[index].identifier} (${newIterations}x)`;
                    renderRecipe();
                } else {
                    event.target.value = recipe[index].loopIterations; // revert if invalid
                    alert("Invalid number of iterations. Must be 1 or greater.");
                }
            };
            opNameSpan.appendChild(document.createTextNode('(ID: '));
            opNameSpan.appendChild(idInput);
            opNameSpan.appendChild(document.createTextNode(', Iterations: '));
            opNameSpan.appendChild(iterInput);
            opNameSpan.appendChild(document.createTextNode(')'));

        } else if (item.type === 'loopEnd') {
            div.classList.add('loop-end');
            opNameSpan.textContent = `${index + 1}. Loop End: `;

            const idInput = document.createElement('input');
            idInput.type = 'text';
            idInput.value = item.identifier;
            idInput.title = "Loop Identifier";
            idInput.classList.add('recipe-loop-input');
            idInput.onchange = (event) => {
                const newId = event.target.value.trim();
                if (newId) {
                    recipe[index].identifier = newId;
                    recipe[index].name = `Loop End: ${newId}`;
                    renderRecipe();
                } else {
                    event.target.value = recipe[index].identifier; // revert if empty
                    alert("Loop identifier cannot be empty.");
                }
            };
            opNameSpan.appendChild(document.createTextNode('(ID: '));
            opNameSpan.appendChild(idInput);
            opNameSpan.appendChild(document.createTextNode(')'));

        } else { // Process item
            opNameSpan.textContent = `${index + 1}. ${item.name}`;
        }
        
        div.appendChild(opNameSpan);
        
        if (item.type === 'process') {
            const iterInput = document.createElement('input');
            iterInput.type = 'number';
            iterInput.value = item.opIterations || 1;
            iterInput.min = 1;
            iterInput.title = "Number of times to run this operation";
            iterInput.classList.add('recipe-process-iter-input'); // Added class for styling
            iterInput.onchange = (event) => {
                const newIterations = parseInt(event.target.value, 10);
                if (newIterations && newIterations > 0) {
                    recipe[index].opIterations = newIterations;
                } else {
                    event.target.value = recipe[index].opIterations; // revert if invalid
                }
            };
            div.appendChild(iterInput);
        }
        
        const removeBtn = document.createElement('button');
        removeBtn.classList.add('remove-op-btn');
        removeBtn.textContent = 'Remove';
        removeBtn.onclick = (event) => {
            event.stopPropagation(); // Prevent triggering other clicks if any
            removeOperationFromRecipe(index);
        };
        div.appendChild(removeBtn);
        recipeContainer.appendChild(div);
    });
}

// Drag and Drop Handlers
function handleDragStartOperation(e) {
    draggedItem = {
        type: 'new-operation',
        name: e.target.dataset.opName,
        funcKey: e.target.dataset.opFuncKey, // Will be undefined for loops, which is fine
        opType: e.target.dataset.opType // Added to distinguish loop operations
    };
    e.dataTransfer.effectAllowed = 'copy';
    e.target.classList.add('dragging');
}

function handleDragStartRecipeItem(e) {
    draggedItem = {
        type: 'recipe-item',
        index: parseInt(e.target.dataset.index, 10)
    };
    e.dataTransfer.effectAllowed = 'move';
    e.target.classList.add('dragging');
    // Set data to be dragged (required for Firefox)
    e.dataTransfer.setData('text/plain', e.target.dataset.index);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    const recipeContainer = document.getElementById('recipeContainer');
    recipeContainer.classList.remove('drag-over'); // Clean up class on container
    document.querySelectorAll('.recipe-item.drag-over-item').forEach(item => {
        item.classList.remove('drag-over-item');
    });
    draggedItem = null;
}

function handleDragOver(e) {
    e.preventDefault();
    if (e.target.classList.contains('recipe-item')) {
        e.target.classList.add('drag-over-item');
    } else if (e.target.id === 'recipeContainer') {
        e.target.classList.add('drag-over');
    }
    if (draggedItem && draggedItem.type === 'new-operation') {
        e.dataTransfer.dropEffect = 'copy';
    } else {
        e.dataTransfer.dropEffect = 'move';
    }
}

function handleDragLeave(e) {
    if (e.target.classList.contains('recipe-item')) {
        e.target.classList.remove('drag-over-item');
    } else if (e.target.id === 'recipeContainer') {
        e.target.classList.remove('drag-over');
    }
}

function handleDropOnRecipeContainer(e) {
    e.preventDefault();
    e.target.classList.remove('drag-over');
    if (!draggedItem) return;

    const errorEl = document.getElementById('errorDisplay');
    if (errorEl) errorEl.textContent = ''; // Clear previous errors

    if (draggedItem.type === 'new-operation') {
        if (draggedItem.opType === 'loopStart') {
            const identifier = prompt("Enter Loop Identifier (e.g., A, Loop1):");
            if (!identifier || identifier.trim() === "") {
                if (errorEl) errorEl.textContent = "Loop identifier cannot be empty.";
            } else {
                const iterationsStr = prompt("Enter number of loop iterations:", "2");
                const loopIterations = parseInt(iterationsStr, 10);
                if (isNaN(loopIterations) || loopIterations < 1) {
                    if (errorEl) errorEl.textContent = "Invalid number of iterations. Must be 1 or greater.";
                } else {
                    recipe.push({ type: 'loopStart', identifier: identifier.trim(), loopIterations: loopIterations, name: `Loop Start: ${identifier.trim()} (${loopIterations}x)` });
                }
            }
        } else if (draggedItem.opType === 'loopEnd') {
            const identifier = prompt("Enter Loop Identifier to End (e.g., A, Loop1):");
            if (!identifier || identifier.trim() === "") {
                if (errorEl) errorEl.textContent = "Loop identifier cannot be empty.";
            } else {
                recipe.push({ type: 'loopEnd', identifier: identifier.trim(), name: `Loop End: ${identifier.trim()}` });
            }
        } else { // Process operation
            recipe.push({ type: 'process', name: draggedItem.name, funcKey: draggedItem.funcKey, opIterations: 1 });
        }
    } else if (draggedItem.type === 'recipe-item') {
        // This case handles dropping a recipe item onto the container (e.g., to the end)
        // If the drop is not on another item, move to the end.
        const itemToMove = recipe.splice(draggedItem.index, 1)[0];
        recipe.push(itemToMove);
    }
    renderRecipe();
    draggedItem = null;
}

function handleDropOnRecipeItem(e) {
    e.preventDefault();
    e.stopPropagation(); // Prevent drop from bubbling to container if not needed
    const targetItem = e.target.closest('.recipe-item');
    targetItem.classList.remove('drag-over-item');
    if (!draggedItem || !targetItem) return;

    const targetIndex = parseInt(targetItem.dataset.index, 10);
    const errorEl = document.getElementById('errorDisplay');
    if (errorEl) errorEl.textContent = ''; // Clear previous errors

    if (draggedItem.type === 'new-operation') {
        let newItem = null;
        if (draggedItem.opType === 'loopStart') {
            const identifier = prompt("Enter Loop Identifier (e.g., A, Loop1):");
            if (!identifier || identifier.trim() === "") {
                if (errorEl) errorEl.textContent = "Loop identifier cannot be empty.";
            } else {
                const iterationsStr = prompt("Enter number of loop iterations:", "2");
                const loopIterations = parseInt(iterationsStr, 10);
                if (isNaN(loopIterations) || loopIterations < 1) {
                    if (errorEl) errorEl.textContent = "Invalid number of iterations. Must be 1 or greater.";
                } else {
                    newItem = { type: 'loopStart', identifier: identifier.trim(), loopIterations: loopIterations, name: `Loop Start: ${identifier.trim()} (${loopIterations}x)` };
                }
            }
        } else if (draggedItem.opType === 'loopEnd') {
            const identifier = prompt("Enter Loop Identifier to End (e.g., A, Loop1):");
            if (!identifier || identifier.trim() === "") {
                if (errorEl) errorEl.textContent = "Loop identifier cannot be empty.";
            } else {
                newItem = { type: 'loopEnd', identifier: identifier.trim(), name: `Loop End: ${identifier.trim()}` };
            }
        } else { // Process operation
            newItem = { type: 'process', name: draggedItem.name, funcKey: draggedItem.funcKey, opIterations: 1 };
        }
        
        if (newItem) { // Only add if newItem was successfully created
            recipe.splice(targetIndex, 0, newItem);
        }
    } else if (draggedItem.type === 'recipe-item') {
        if (draggedItem.index === targetIndex) return; // Dropped on itself

        const itemToMove = recipe.splice(draggedItem.index, 1)[0];
        // Adjust targetIndex if item was moved from before the target
        const adjustedTargetIndex = draggedItem.index < targetIndex ? targetIndex -1 : targetIndex;
        recipe.splice(adjustedTargetIndex, 0, itemToMove);
    }
    renderRecipe();
    draggedItem = null;
}

async function bake() {
    const inputTextArea = document.getElementById('inputTextArea');
    const outputTextArea = document.getElementById('outputTextArea');
    const processingTimeEl = document.getElementById('processingTime');
    const errorEl = document.getElementById('errorDisplay');
    const bakeBtn = document.getElementById('bakeButton');
    const loopStatusContainer = document.getElementById('loopStatusContainer');
    const loopStatusMessage = document.getElementById('loopStatusMessage');
    const loopProgressBarInner = document.getElementById('loopProgressBarInner');

    if (!inputTextArea || !outputTextArea || !processingTimeEl || !errorEl || !bakeBtn || !loopStatusContainer || !loopStatusMessage || !loopProgressBarInner) {
        console.error("Missing critical UI elements for bake operation.");
        if(errorEl) errorEl.textContent = "UI Error: Page elements missing.";
        return;
    }
    
    errorEl.textContent = ''; // Clear previous errors
    if (!wasmReady) { // wasmReady now refers to worker readiness
        errorEl.textContent = "Worker or WASM not ready. Cannot bake.";
        return;
    }
    if (recipe.length === 0) {
        errorEl.textContent = "Recipe is empty. Add operations first.";
        return;
    }

    outputTextArea.value = 'Processing...';
    bakeBtn.disabled = true;
    let currentData = inputTextArea.value;
    const startTime = performance.now(); // Main thread start time, worker will send its own time

    // Clear previous loop status on main thread before sending to worker
    loopStatusContainer.style.display = 'none';
    loopStatusMessage.textContent = '';
    loopProgressBarInner.style.width = '0%';

    // Send recipe and input to the worker
    cyberChefWorker.postMessage({
        type: 'bakeRecipe',
        recipe: recipe,
        input: currentData
    });

    // The rest of the bake logic (looping, calling wasmFunc) is now in the worker.
    // The main thread will receive messages for UI updates (output, errors, progress).
}

document.addEventListener('DOMContentLoaded', () => {
    // Ensure initWasm is called after the DOM is ready.
    initMainWasmAndWorker().catch(err => {
        const errorEl = document.getElementById('errorDisplay'); // Ensure errorEl is defined here or passed
        if (errorEl) errorEl.textContent = "Critical Main Initialization Error: " + (err.message || err);
    });
    renderRecipe(); // Initial render of empty recipe

    // Add drag listeners to operation buttons
    document.querySelectorAll('.operations-list button[data-op-name]').forEach(button => {
        button.setAttribute('draggable', true);
        button.addEventListener('dragstart', handleDragStartOperation);
        button.addEventListener('dragend', handleDragEnd);
    });
    
    // Add drop listeners to recipe container
    const recipeContainer = document.getElementById('recipeContainer');
    if (recipeContainer) {
        recipeContainer.addEventListener('dragover', handleDragOver);
        recipeContainer.addEventListener('dragleave', handleDragLeave); // Add dragleave for container
        recipeContainer.addEventListener('drop', handleDropOnRecipeContainer);
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
        .then(function(registration) {
            console.log('Service Worker registered with scope:', registration.scope);
        }).catch(function(error) {
            console.log('Service Worker registration failed:', error);
        });
    }

    // Initially hide the install button, it will be shown if 'beforeinstallprompt' fires
    const installButton = document.getElementById('installAppButton');
    if (installButton) {
        installButton.style.display = 'none';
    }
    const downloadButton = document.getElementById('downloadAppButton');
    if (downloadButton) {
        downloadButton.onclick = () => {
            // This is a placeholder for the actual download functionality.
            // For a PWA, "download" usually means prompting the install.
            // If this is for downloading data, that needs specific implementation.
            if (deferredInstallPrompt) {
                showInstallButton(); // Show install button if available
                deferredInstallPrompt.prompt(); // Or trigger prompt directly
            } else if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
                alert('App is already installed and running in standalone mode.');
            }
            else {
                alert('To install this app, please use the install button or look for an install option in your browser menu.');
            }
        };
    }
});
