with open('index.html', 'r') as f:
    content = f.read()

content = content.replace(
    '<button data-op-name="From Base64" data-op-func-key="goDecodeBase64" onclick="addProcessingOperation(\'From Base64\', \'goDecodeBase64\')">From Base64</button>',
    '''<button data-op-name="From Base64" data-op-func-key="goDecodeBase64" onclick="addProcessingOperation('From Base64', 'goDecodeBase64')">From Base64</button>
            <button data-op-name="AES Encrypt" data-op-func-key="goAESEncrypt" onclick="addProcessingOperation('AES Encrypt', 'goAESEncrypt')">AES Encrypt</button>
            <button data-op-name="AES Decrypt" data-op-func-key="goAESDecrypt" onclick="addProcessingOperation('AES Decrypt', 'goAESDecrypt')">AES Decrypt</button>'''
)

with open('index.html', 'w') as f:
    f.write(content)
