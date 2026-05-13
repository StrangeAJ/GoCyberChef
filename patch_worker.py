import re

with open('js_worker.js', 'r') as f:
    content = f.read()

# Update expectedFunctions array
content = re.sub(
    r"const expectedFunctions = \['goEncodeBase64', 'goDecodeBase64'\];",
    r"const expectedFunctions = ['goEncodeBase64', 'goDecodeBase64', 'goAESEncrypt', 'goAESDecrypt'];",
    content
)

# Update executeProcessOperationsInWorker signature and call
content = content.replace(
    'const result = wasmFunc(currentVal);',
    '''
                let result;
                if (op.funcKey === 'goAESEncrypt' || op.funcKey === 'goAESDecrypt') {
                    const opts = {
                        key: op.key || "",
                        keyFormat: op.keyFormat || "Raw",
                        iv: op.iv || "",
                        ivFormat: op.ivFormat || "Raw",
                        mode: op.mode || "GCM",
                        inputFormat: op.inputFormat || "Base64",
                        outputFormat: op.outputFormat || "Base64"
                    };
                    result = wasmFunc(currentVal, opts);
                } else {
                    result = wasmFunc(currentVal);
                }'''
)

with open('js_worker.js', 'w') as f:
    f.write(content)
