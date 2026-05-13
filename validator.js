document.addEventListener('DOMContentLoaded', () => {
    const hexInput = document.getElementById('hexInput');
    const hexContainer = document.getElementById('hexContainer');
    const hexStatusIcon = document.querySelector('#hexStatus .status-icon');
    const hexStatusMessage = document.querySelector('#hexStatus .status-message');

    const base64Input = document.getElementById('base64Input');
    const base64Container = document.getElementById('base64Container');
    const base64StatusIcon = document.querySelector('#base64Status .status-icon');
    const base64StatusMessage = document.querySelector('#base64Status .status-message');

    const clearAllBtn = document.getElementById('clearAll');

    function validateHex(value) {
        if (value.length === 0) {
            return { valid: null, message: '' };
        }

        // Check for invalid characters
        if (!/^[0-9A-Fa-f]*$/.test(value)) {
            const invalidChar = value.match(/[^0-9A-Fa-f]/)[0];
            return { valid: false, message: `Invalid character: "${invalidChar}" is not a valid HEX character.` };
        }

        // Check for even length
        if (value.length % 2 !== 0) {
            return { valid: false, message: 'Invalid length: HEX strings must have an even number of characters.' };
        }

        return { valid: true, message: 'Valid HEX format.' };
    }

    function validateBase64(value) {
        if (value.length === 0) {
            return { valid: null, message: '' };
        }

        // Basic Base64 regex (Standard Alphabet)
        const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

        // Find first invalid character
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        for (let char of value) {
            if (!alphabet.includes(char)) {
                return { valid: false, message: `Invalid character: "${char}" is not valid in Base64.` };
            }
        }

        if (!base64Regex.test(value)) {
            // Check for obvious length issues
            if (value.length % 4 !== 0) {
                return { valid: false, message: 'Invalid length: Base64 string length must be a multiple of 4.' };
            }
            return { valid: false, message: 'Invalid Base64 format (check padding or characters).' };
        }

        return { valid: true, message: 'Valid Base64 format.' };
    }

    function updateUI(container, statusIcon, statusMessage, result) {
        container.classList.remove('error', 'success');

        if (result.valid === true) {
            container.classList.add('success');
            statusIcon.textContent = '✓';
            statusMessage.textContent = result.message;
        } else if (result.valid === false) {
            container.classList.add('error');
            statusIcon.textContent = '⚠';
            statusMessage.textContent = result.message;
        } else {
            statusIcon.textContent = '';
            statusMessage.textContent = '';
        }
    }

    hexInput.addEventListener('input', (e) => {
        const value = e.target.value.replace(/\s/g, ''); // Ignore whitespace for HEX
        const result = validateHex(value);
        updateUI(hexContainer, hexStatusIcon, hexStatusMessage, result);
    });

    base64Input.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        const result = validateBase64(value);
        updateUI(base64Container, base64StatusIcon, base64StatusMessage, result);
    });

    clearAllBtn.addEventListener('click', () => {
        hexInput.value = '';
        base64Input.value = '';
        updateUI(hexContainer, hexStatusIcon, hexStatusMessage, { valid: null });
        updateUI(base64Container, base64StatusIcon, base64StatusMessage, { valid: null });
    });
});
