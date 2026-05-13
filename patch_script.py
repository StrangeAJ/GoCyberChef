import re

with open('script.js', 'r') as f:
    content = f.read()

# Add AES options when adding process operation
def_add_processing_operation = """function addProcessingOperation(opName, opFuncKey) {
    const errorEl = document.getElementById('errorDisplay');
    errorEl.textContent = ''; // Clear previous errors

    if (!wasmReady) { // wasmReady now refers to worker readiness
        errorEl.textContent = "Worker or WASM not ready. Cannot add operation.";
        console.warn("Attempted to add operation while WASM not ready.");
        return;
    }

    let opDetails = { type: 'process', name: opName, funcKey: opFuncKey, opIterations: 1 };

    if (opFuncKey === 'goAESEncrypt' || opFuncKey === 'goAESDecrypt') {
        opDetails.key = '';
        opDetails.keyFormat = 'Raw';
        opDetails.iv = '';
        opDetails.ivFormat = 'Raw';
        opDetails.mode = 'GCM';
        opDetails.inputFormat = 'Base64';
        opDetails.outputFormat = 'Base64';
    }

    recipe.push(opDetails);
    renderRecipe();
}"""

content = re.sub(r'function addProcessingOperation\(opName, opFuncKey\) \{.*?renderRecipe\(\);\n\}', def_add_processing_operation, content, flags=re.DOTALL)

# Handle drop new operation with AES
drop_new_op = """        } else { // Process operation
            let newItem = { type: 'process', name: draggedItem.name, funcKey: draggedItem.funcKey, opIterations: 1 };
            if (draggedItem.funcKey === 'goAESEncrypt' || draggedItem.funcKey === 'goAESDecrypt') {
                newItem.key = '';
                newItem.keyFormat = 'Raw';
                newItem.iv = '';
                newItem.ivFormat = 'Raw';
                newItem.mode = 'GCM';
                newItem.inputFormat = 'Base64';
                newItem.outputFormat = 'Base64';
            }
            recipe.push(newItem);
        }"""
content = re.sub(r'        \} else \{ // Process operation\n            recipe\.push\(\{ type: \'process\', name: draggedItem\.name, funcKey: draggedItem\.funcKey, opIterations: 1 \}\);\n        \}', drop_new_op, content)

drop_new_op_item = """        } else { // Process operation
            newItem = { type: 'process', name: draggedItem.name, funcKey: draggedItem.funcKey, opIterations: 1 };
            if (draggedItem.funcKey === 'goAESEncrypt' || draggedItem.funcKey === 'goAESDecrypt') {
                newItem.key = '';
                newItem.keyFormat = 'Raw';
                newItem.iv = '';
                newItem.ivFormat = 'Raw';
                newItem.mode = 'GCM';
                newItem.inputFormat = 'Base64';
                newItem.outputFormat = 'Base64';
            }
        }"""
content = re.sub(r'        \} else \{ // Process operation\n            newItem = \{ type: \'process\', name: draggedItem\.name, funcKey: draggedItem\.funcKey, opIterations: 1 \};\n        \}', drop_new_op_item, content)

# Update renderRecipe to show UI options
render_ui = """        if (item.type === 'process') {
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

            if (item.funcKey === 'goAESEncrypt' || item.funcKey === 'goAESDecrypt') {
                const optionsDiv = document.createElement('div');
                optionsDiv.classList.add('recipe-aes-options');

                // Mode
                const modeLabel = document.createElement('label');
                modeLabel.textContent = ' Mode: ';
                const modeSelect = document.createElement('select');
                ['GCM', 'CBC', 'CFB', 'CTR'].forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m;
                    opt.textContent = m;
                    if (item.mode === m) opt.selected = true;
                    modeSelect.appendChild(opt);
                });
                modeSelect.onchange = (e) => recipe[index].mode = e.target.value;
                optionsDiv.appendChild(modeLabel);
                optionsDiv.appendChild(modeSelect);

                // Key
                const keyLabel = document.createElement('label');
                keyLabel.textContent = ' Key: ';
                const keyInput = document.createElement('input');
                keyInput.type = 'text';
                keyInput.value = item.key || '';
                keyInput.onchange = (e) => recipe[index].key = e.target.value;

                const keyFormatSelect = document.createElement('select');
                ['Raw', 'Hex', 'Base64'].forEach(f => {
                    const opt = document.createElement('option');
                    opt.value = f;
                    opt.textContent = f;
                    if (item.keyFormat === f) opt.selected = true;
                    keyFormatSelect.appendChild(opt);
                });
                keyFormatSelect.onchange = (e) => recipe[index].keyFormat = e.target.value;
                optionsDiv.appendChild(keyLabel);
                optionsDiv.appendChild(keyInput);
                optionsDiv.appendChild(keyFormatSelect);

                // IV
                const ivLabel = document.createElement('label');
                ivLabel.textContent = ' IV: ';
                const ivInput = document.createElement('input');
                ivInput.type = 'text';
                ivInput.value = item.iv || '';
                ivInput.onchange = (e) => recipe[index].iv = e.target.value;

                const ivFormatSelect = document.createElement('select');
                ['Raw', 'Hex', 'Base64'].forEach(f => {
                    const opt = document.createElement('option');
                    opt.value = f;
                    opt.textContent = f;
                    if (item.ivFormat === f) opt.selected = true;
                    ivFormatSelect.appendChild(opt);
                });
                ivFormatSelect.onchange = (e) => recipe[index].ivFormat = e.target.value;
                optionsDiv.appendChild(ivLabel);
                optionsDiv.appendChild(ivInput);
                optionsDiv.appendChild(ivFormatSelect);

                // IO Format
                if (item.funcKey === 'goAESEncrypt') {
                    const formatLabel = document.createElement('label');
                    formatLabel.textContent = ' Output: ';
                    const formatSelect = document.createElement('select');
                    ['Base64', 'Hex'].forEach(f => {
                        const opt = document.createElement('option');
                        opt.value = f;
                        opt.textContent = f;
                        if (item.outputFormat === f) opt.selected = true;
                        formatSelect.appendChild(opt);
                    });
                    formatSelect.onchange = (e) => recipe[index].outputFormat = e.target.value;
                    optionsDiv.appendChild(formatLabel);
                    optionsDiv.appendChild(formatSelect);
                } else {
                    const formatLabel = document.createElement('label');
                    formatLabel.textContent = ' Input: ';
                    const formatSelect = document.createElement('select');
                    ['Base64', 'Hex'].forEach(f => {
                        const opt = document.createElement('option');
                        opt.value = f;
                        opt.textContent = f;
                        if (item.inputFormat === f) opt.selected = true;
                        formatSelect.appendChild(opt);
                    });
                    formatSelect.onchange = (e) => recipe[index].inputFormat = e.target.value;
                    optionsDiv.appendChild(formatLabel);
                    optionsDiv.appendChild(formatSelect);
                }

                div.appendChild(optionsDiv);
            }
        }"""
content = re.sub(r'        if \(item\.type === \'process\'\) \{.*?div\.appendChild\(iterInput\);\n        \}', render_ui, content, flags=re.DOTALL)

with open('script.js', 'w') as f:
    f.write(content)
