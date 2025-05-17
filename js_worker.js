// js_worker.js
self.onmessage = function(e) {
    const { type, payload, operationId } = e.data;
    let result;
    let error;

    try {
        if (type === 'encode') {
            // Ensure UTF-8 handling for btoa, as btoa only works on strings with characters in the Latin1 range.
            // 1. Encode string to UTF-8 byte sequence.
            // 2. Convert byte sequence to a binary string.
            // 3. Base64 encode the binary string.
            result = btoa(unescape(encodeURIComponent(payload)));
        } else if (type === 'decode') {
            // Ensure UTF-8 handling for atob
            // 1. Base64 decode to a binary string.
            // 2. Convert binary string to UTF-8 byte sequence.
            // 3. Decode UTF-8 byte sequence to original string.
            result = decodeURIComponent(escape(atob(payload)));
        } else {
            throw new Error('Unknown operation type for JS worker');
        }
    } catch (err) {
        error = "JS Worker: " + err.message;
        console.error('JS Worker Error:', err);
    }
    self.postMessage({ result, error, operationId });
};
