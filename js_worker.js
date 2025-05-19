// js_worker.js
// This file will be completely overwritten with the new worker logic.
// The new logic initializes WASM and handles the baking process off the main thread.

importScripts('wasm_exec.js'); // Assumes wasm_exec.js is in the same directory

self.goWasmReadyPromiseResolve = null;
self.goWasmReadyPromiseReject = null;
self.goReadyPromise = new Promise((resolve, reject) => {
    self.goWasmReadyPromiseResolve = resolve;
    self.goWasmReadyPromiseReject = reject;
});

let goWasm;
let workerWasmReady = false;
let wasmFunctions = {}; // Store detected WASM functions for the worker
let goInstance;

// This function will be called by Go when it's ready
self.goWasmReady = () => {
    console.log("Worker: goWasmReady() CALLED by Go.");
        // ONLY expect functions currently implemented and exposed in main.go
    const expectedFunctions = ['goEncodeBase64', 'goDecodeBase64'];
    let allFound = true;
    let foundFunctions = {};

    console.log("Worker: Checking for expected Go functions in self (worker global scope):");
    expectedFunctions.forEach(funcName => {
        if (typeof self[funcName] === 'function') {
            console.log(`Worker: Found function: ${funcName}`);
            foundFunctions[funcName] = 'found';
        } else {
            console.warn(`Worker: MISSING function: ${funcName} (Type: ${typeof self[funcName]})`);
            allFound = false;
            foundFunctions[funcName] = `missing (type: ${typeof self[funcName]})`;
        }
    });

    if (allFound) {
        console.log("Worker: All expected Go functions are available in the worker's global scope.");
        if (self.goWasmReadyPromiseResolve) {
            self.goWasmReadyPromiseResolve(foundFunctions); // Resolve the promise with found functions
        } else {
            console.error("Worker: goWasmReadyPromiseResolve was not set!");
        }
    } else {
        console.error("Worker: Not all Go functions were found. Dumping global scope properties:");
        let globalProps = [];
        for (const prop in self) {
            globalProps.push(prop);
        }
        console.log("Worker Global Scope Properties:", globalProps.join(', '));
        if (self.goWasmReadyPromiseReject) {
            self.goWasmReadyPromiseReject(new Error("Go functions not found after goWasmReady call. Check worker console."));
        } else {
            console.error("Worker: goWasmReadyPromiseReject was not set!");
        }
    }
};

async function initWasmInWorker() {
    if (workerWasmReady) {
        postMessage({ type: 'wasmWorkerInitialized', availableFunctions: Object.keys(wasmFunctions) });
        return;
    }
    // Reset goReadyPromise for potential re-initialization attempts
    self.goReadyPromise = new Promise((resolve, reject) => {
        self.goWasmReadyPromiseResolve = resolve;
        self.goWasmReadyPromiseReject = reject;
    });

    self.goWasm = new Go();
    try {
        const response = await fetch("main.wasm");
        if (!response.ok) {
            throw new Error(`Failed to fetch main.wasm: ${response.statusText}`);
        }
        const result = await WebAssembly.instantiateStreaming(response, self.goWasm.importObject);
        
        const runGoProgram = () => {
            return new Promise(async (resolve, reject) => { // make this async
                try {
                    // Don't await go.run directly if it blocks indefinitely
                    // Instead, let it run and wait for the goWasmReady signal
                    Promise.resolve(self.goWasm.run(result.instance)).catch(err => {
                        // This catch is for errors during the execution of goInstance.run itself (e.g. Go runtime panics before goWasmReady)
                        console.error("Worker: Error during goInstance.run():", err);
                        postMessage({ type: 'wasmWorkerError', error: `Error during Go program execution: ${err.message || err}` });
                        if (self.goWasmReadyPromiseReject) {
                            self.goWasmReadyPromiseReject(err); // Reject the promise if Go panics early
                        }
                    });
                } catch (err) {
                    console.error("Go WASM execution error in worker:", err);
                    reject(err); 
                }
            });
        };
        
        // Start Go, but don't necessarily await its completion if it's a long-running service.
        runGoProgram().catch(err => {
            // Handle errors from the async runGoProgram itself if it rejects early
            console.error("WASM Worker: Error during initial Go program execution:", err);
            postMessage({ type: 'wasmWorkerError', error: "Go execution error: " + (err.message || String(err)) });
            workerWasmReady = false;
            // No need to throw here as we're already in an error path
        });

        // Wait for Go to signal it's ready OR a timeout
        const readyTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout waiting for Go to signal readiness")), 10000) // 10 second timeout
        );

        const readyFunctions = await Promise.race([self.goReadyPromise, readyTimeout]);

        wasmFunctions = readyFunctions; // Store the confirmed functions
        workerWasmReady = true; // <--- SET THE FLAG TO TRUE HERE
        console.log("Worker: Go is ready! Available functions:", Object.keys(wasmFunctions).join(', '));
        postMessage({ type: 'wasmWorkerInitialized', availableFunctions: Object.keys(wasmFunctions) });
        postMessage({ type: 'log', message: "Worker: WASM initialized successfully. Go functions ready." });

    } catch (err) {
        console.error("WASM Worker: Error loading or running WASM:", err);
        postMessage({ type: 'wasmWorkerError', error: "Load/run error: " + (err.message || String(err)) });
        postMessage({ type: 'log', message: `Worker: WASM initialization failed: ${err.message || err}` });
        workerWasmReady = false;
    }
}

async function bakeInWorker(recipe, initialData) {
    if (!workerWasmReady || Object.keys(wasmFunctions).length === 0) {
        postMessage({ type: 'error', message: "WASM functions not ready in worker for baking." });
        console.error("bakeInWorker: Aborted because workerWasmReady is false or wasmFunctions is empty.", {workerWasmReady, wasmFunctions});
        return;
    }

    console.log("Worker: bakeInWorker started.", { recipe, initialDataLength: initialData?.length });
    postMessage({ type: 'log', message: `Worker: bakeInWorker started. Recipe items: ${recipe.length}` });

    let currentData = initialData;
    const startTime = performance.now();

    postMessage({ type: 'processingStep', message: 'Processing in worker...' });

    function executeProcessOperationsInWorker(ops, data) {
        let currentVal = data;
        console.log("Worker: executeProcessOperationsInWorker called with ops:", ops.map(o => o.name).join(', '), " data length:", currentVal?.length);
        postMessage({ type: 'log', message: `Worker: Executing ops: ${ops.map(o => o.name).join(', ')}` });

        for (const op of ops) {
            console.log(`Worker: Processing operation: ${op.name} (funcKey: ${op.funcKey})`);
            postMessage({ type: 'log', message: `Worker: Processing op: ${op.name}` });
            if (op.type !== 'process') {
                 postMessage({ type: 'log', message: `Worker: executeProcessOperations expects only process ops, got ${op.type}`});
                 throw new Error("Internal error: executeProcessOperations expects only process ops.");
            }
            const wasmFunc = self[op.funcKey];
            if (typeof wasmFunc !== 'function') {
                console.error(`Worker: WASM function ${op.funcKey} is not a function. Type: ${typeof wasmFunc}`);
                postMessage({ type: 'log', message: `Worker: ERROR - WASM function ${op.funcKey} is not a function.` });
                throw new Error(`WASM Operation '${op.name}' (${op.funcKey}) is not available or not a function in worker.`);
            }
            const opIterations = op.opIterations || 1;
            console.log(`Worker: Iterations for ${op.name}: ${opIterations}`);
            postMessage({ type: 'log', message: `Worker: Iterations for ${op.name}: ${opIterations}` });

            for (let i = 0; i < opIterations; i++) {
                console.log(`Worker: Op ${op.name}, Iteration ${i + 1}/${opIterations}. Input data length: ${currentVal?.length}`);
                postMessage({ type: 'log', message: `Worker: Op ${op.name}, Iteration ${i + 1}/${opIterations}.` });
                
                const result = wasmFunc(currentVal); 
                
                console.log(`Worker: Op ${op.name}, Iteration ${i + 1} completed. Result type: ${typeof result}, Result length: ${result?.length}`);
                postMessage({ type: 'log', message: `Worker: Op ${op.name}, Iteration ${i + 1} completed.` });

                if (result && typeof result === 'object' && result.error) {
                    console.error(`Worker: Error in ${op.name} (iter ${i+1}/${opIterations}): ${result.error}`);
                    postMessage({ type: 'log', message: `Worker: ERROR in ${op.name} (iter ${i+1}/${opIterations}): ${result.error}` });
                    throw new Error(`Error in ${op.name} (iter ${i+1}/${opIterations}): ${result.error}`);
                }
                currentVal = result;
            }
        }
        console.log("Worker: executeProcessOperationsInWorker finished. Output data length:", currentVal?.length);
        postMessage({ type: 'log', message: `Worker: Finished executing ops. Output data length: ${currentVal?.length}` });
        return currentVal;
    }

    try {
        let pc = 0;
        console.log("Worker: Starting recipe processing loop.");
        postMessage({ type: 'log', message: "Worker: Starting recipe processing loop." });

        while (pc < recipe.length) {
            const op = recipe[pc];
            console.log(`Worker: Recipe loop, pc=${pc}, op type: ${op.type}, op name: ${op.name}`);
            postMessage({ type: 'log', message: `Worker: Recipe loop, pc=${pc}, op: ${op.name}` });

            if (op.type === 'process') {
                currentData = executeProcessOperationsInWorker([op], currentData);
                pc++;
            } else if (op.type === 'loopStart') {
                console.log(`Worker: LoopStart found: ${op.identifier}, iterations: ${op.loopIterations}`);
                postMessage({ type: 'log', message: `Worker: LoopStart: ${op.identifier}, iterations: ${op.loopIterations}` });
                let balance = 0;
                let loopEndIndex = -1;
                // Find matching loopEnd
                for (let j = pc; j < recipe.length; j++) {
                    if (recipe[j].type === 'loopStart' && recipe[j].identifier === op.identifier) {
                        balance++;
                    } else if (recipe[j].type === 'loopEnd' && recipe[j].identifier === op.identifier) {
                        balance--;
                        if (balance === 0) {
                            loopEndIndex = j;
                            break;
                        }
                    }
                }

                if (loopEndIndex === -1 || balance !== 0) {
                    console.error(`Worker: Mismatched Loop: No valid Loop End for '${op.identifier}' at index ${pc + 1}. Balance: ${balance}, EndIndex: ${loopEndIndex}`);
                    postMessage({ type: 'log', message: `Worker: ERROR - Mismatched Loop for '${op.identifier}'.` });
                    throw new Error(`Mismatched Loop: No valid Loop End for '${op.identifier}' at index ${pc + 1}.`);
                }
                console.log(`Worker: Loop \'${op.identifier}\' body from index ${pc + 1} to ${loopEndIndex -1}.`);
                postMessage({ type: 'log', message: `Worker: Loop \'${op.identifier}\' body from ${pc + 1} to ${loopEndIndex -1}.` });

                const loopBodyOps = recipe.slice(pc + 1, loopEndIndex);
                for(const bodyOp of loopBodyOps) { // Check for nested loops
                    if (bodyOp.type === 'loopStart' || bodyOp.type === 'loopEnd') {
                        console.error("Worker: Nested loops are not supported.");
                        postMessage({ type: 'log', message: "Worker: ERROR - Nested loops are not supported." });
                        throw new Error("Nested loops are not supported.");
                    }
                     if (bodyOp.type !== 'process') {
                        console.error(`Worker: Invalid operation type '${bodyOp.type}' in loop body.`);
                        postMessage({ type: 'log', message: `Worker: ERROR - Invalid op type '${bodyOp.type}' in loop.` });
                        throw new Error(`Invalid operation type '${bodyOp.type}' in loop body.`);
                    }
                }

                const loopIterationsCount = op.loopIterations || 1;
                console.log(`Worker: Executing loop \'${op.identifier}\' for ${loopIterationsCount} iterations.`);
                postMessage({ type: 'log', message: `Worker: Executing loop \'${op.identifier}\' for ${loopIterationsCount} iterations.` });

                for (let i = 0; i < loopIterationsCount; i++) {
                    console.log(`Worker: Loop \'${op.identifier}\', Iteration ${i + 1}/${loopIterationsCount}.`);
                    postMessage({ type: 'log', message: `Worker: Loop \'${op.identifier}\', Iteration ${i + 1}/${loopIterationsCount}.` });
                    postMessage({
                        type: 'loopProgressUpdate',
                        identifier: op.identifier,
                        currentIteration: i + 1,
                        totalIterations: loopIterationsCount
                    });
                    currentData = executeProcessOperationsInWorker(loopBodyOps, currentData);
                    console.log(`Worker: Loop \'${op.identifier}\', Iteration ${i + 1} completed. Data length: ${currentData?.length}`);
                    postMessage({ type: 'log', message: `Worker: Loop \'${op.identifier}\', Iteration ${i + 1} completed.` });
                }
                pc = loopEndIndex + 1;
                console.log(`Worker: Loop \'${op.identifier}\' finished. New pc: ${pc}`);
                postMessage({ type: 'log', message: `Worker: Loop \'${op.identifier}\' finished. New pc: ${pc}` });

            } else if (op.type === 'loopEnd') {
                // This should ideally not be hit if loop logic is correct, as pc jumps past it.
                console.error(`Worker: Orphaned Loop End encountered: '${op.identifier}' at index ${pc + 1}. This indicates a logic flaw.`);
                postMessage({ type: 'log', message: `Worker: ERROR - Orphaned Loop End: '${op.identifier}'.` });
                throw new Error(`Orphaned Loop End: '${op.identifier}' at index ${pc + 1}.`);
            } else {
                console.error(`Worker: Unknown operation type at recipe index ${pc + 1}: ${op.type}`);
                postMessage({ type: 'log', message: `Worker: ERROR - Unknown op type: ${op.type}` });
                throw new Error(`Unknown operation type at recipe index ${pc + 1}: ${op.type}`);
            }
        }
        console.log("Worker: Recipe processing loop COMPLETED. Final data length:", currentData?.length);
        postMessage({ type: 'log', message: "Worker: Recipe processing loop COMPLETED." });
        postMessage({ type: 'finalOutput', data: currentData });

    } catch (e) {
        console.error("Worker: Error during bake process:", e);
        postMessage({ type: 'error', message: e.message || String(e) });
        postMessage({ type: 'log', message: `Worker: CRITICAL ERROR during bake: ${e.message || String(e)}` });
    } finally {
        const endTime = performance.now();
        console.log(`Worker: bakeInWorker finished. Total time: ${(endTime - startTime).toFixed(2)} ms`);
        postMessage({ type: 'log', message: `Worker: bakeInWorker finished. Total time: ${(endTime - startTime).toFixed(2)} ms` });
        postMessage({ type: 'processingTimeUpdate', time: (endTime - startTime).toFixed(2) });
        postMessage({ type: 'loopProgressUpdate', identifier: null, currentIteration: 0, totalIterations: 0 }); // Reset loop progress on main thread
    }
}

self.onmessage = async function(e) {
    const { type, ...payload } = e.data;

    switch (type) {
        case 'init':
            console.log("Worker: Received 'init' message.");
            postMessage({ type: 'log', message: "Worker: Received 'init' message. Starting WASM initialization." });
            await initWasmInWorker();
            break;
        case 'bakeRecipe':
            console.log("Worker: Received 'bakeRecipe' message.", { workerWasmReady, recipe: payload.recipe, inputLength: payload.input?.length });
            postMessage({ type: 'log', message: "Worker: Received 'bakeRecipe' message." });
            if (workerWasmReady) {
                await bakeInWorker(payload.recipe, payload.input);
            } else {
                console.warn("Worker: Bake request received but WASM not ready. Attempting init first.");
                postMessage({ type: 'log', message: "Worker: Bake request received but WASM not ready. Attempting init first." });
                await initWasmInWorker(); 
                if(workerWasmReady){
                    console.log("Worker: WASM initialized after second attempt. Proceeding with bake.");
                    postMessage({ type: 'log', message: "Worker: WASM initialized after second attempt. Proceeding with bake." });
                    await bakeInWorker(payload.recipe, payload.input);
                } else {
                    console.error("Worker: WASM NOT initialized even after second attempt. Cannot bake.");
                    postMessage({ type: 'error', message: 'WASM not initialized in worker after attempt. Cannot bake.' });
                    postMessage({ type: 'log', message: "Worker: WASM NOT initialized even after second attempt. Cannot bake." });
                }
            }
            break;
        default:
            console.warn('JS Worker: Unknown message type received:', type, payload);
            postMessage({ type: 'error', message: 'Unknown operation type for JS worker' });
    }
};

console.log("Worker: js_worker.js script loaded and event listener attached.");
postMessage({ type: 'log', message: "Worker: js_worker.js script loaded." });
